// Resolve the URL this script was loaded from, so sibling assets (frame.css)
// load from the same origin. Locally this picks up ./frame.css; in production
// it resolves to the CDN copy next to frame.js. Falls back to the CDN.
// Captured at load time: document.currentScript is only set during the
// script's initial synchronous execution, not inside later callbacks.
const agoCurrentScript = document.currentScript;
const getStylesheetHref = () => {
    const fallback = "https://useago.github.io/widgetjs/frame.css";
    try {
        const self =
            agoCurrentScript ||
            document.querySelector('script[src$="frame.js"]');
        if (self && self.src) {
            return self.src.replace(/frame\.js(\?.*)?$/, "frame.css");
        }
    } catch {
        // ignore and fall back
    }
    return fallback;
};

// Utility function to check if device is mobile
const isMobileDevice = () => window.matchMedia("(max-width: 450px)").matches;

// Store scroll position for mobile
let scrollPosition = 0;

// Derive the target origin from the configured basepath
const getTargetOrigin = () => {
    try {
        return new URL(window.AGO.basepath).origin;
    } catch {
        return window.location.origin;
    }
};

// Validate that an incoming message origin is trusted
const isTrustedOrigin = (origin) => {
    const targetOrigin = getTargetOrigin();
    return origin === targetOrigin;
};

// Gap between the top of the chat button and the prompt/panel above it,
// and the max panel height (must match the 880px = 80px + 800px cap in
// frame.css #ago-chatbot top rule).
const BUTTON_GAP = 6;
const MAX_PANEL_HEIGHT = 800;

// Position the prompt bubble and chat panel relative to the button's actual
// rendered position. Host pages move the button with `!important` overrides
// (to clear their own cookie bars, scroll-to-top buttons, etc.); without this
// the prompt/panel keep their stylesheet defaults and the button overlaps
// them. Inline `!important` styles win over host stylesheet overrides, so the
// derived position is authoritative on desktop; on mobile the stylesheet's
// fullscreen layout stays in charge.
const syncPositionsToButton = () => {
    const button = document.querySelector("#ago-chat-button");
    const targets = [
        document.querySelector("#ago-prompt"),
        document.querySelector("#ago-chatbot"),
    ].filter(Boolean);
    if (!button || targets.length === 0) return;

    if (isMobileDevice()) {
        targets.forEach((el) => {
            el.style.removeProperty("bottom");
            el.style.removeProperty("right");
            el.style.removeProperty("top");
        });
        return;
    }

    // Read the button's used position from computed style, not
    // getBoundingClientRect(): the rect includes the hover `scale: 1.1`
    // transform, which would make the derived position jitter.
    if (!button.offsetHeight) return; // hidden: keep stylesheet defaults
    const buttonStyle = getComputedStyle(button);
    const buttonBottom = parseFloat(buttonStyle.bottom);
    const buttonRight = parseFloat(buttonStyle.right);
    if (isNaN(buttonBottom) || isNaN(buttonRight)) return;

    const bottom = Math.round(buttonBottom + button.offsetHeight) + BUTTON_GAP;
    const right = Math.round(buttonRight);
    targets.forEach((el) => {
        el.style.setProperty("bottom", bottom + "px", "important");
        el.style.setProperty("right", right + "px", "important");
        if (el.id === "ago-chatbot") {
            // Keep the panel capped at MAX_PANEL_HEIGHT while never letting
            // its top edge get closer than 40px to the top of the viewport.
            el.style.setProperty(
                "top",
                `max(40px, calc(100% - ${bottom + MAX_PANEL_HEIGHT}px))`,
                "important"
            );
        }
    });
};

// State tracking for lazy loading
let isChatLoaded = false;
let isFirstClick = true;
let lastUnreadConversationId = null;

const sendToNotificationFrame = (message) => {
    const frame = document.querySelector("#ago-notification-frame");
    if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage(message, getTargetOrigin());
    }
};

const toggleFrame = (shouldClose) => {
    // If this is the first click and chat interface hasn't been loaded yet
    if (isFirstClick && !isChatLoaded) {
        isFirstClick = false;
        createChatInterface();
        return;
    }
    const chatbot = document.querySelector("#ago-chatbot");
    const button = document.querySelector("#ago-chat-button");

    if (chatbot && button) {
        const isClosed = chatbot.classList.contains("closed");

        if (shouldClose || !isClosed) {
            // Closing
            chatbot.classList.add("closed");
            button.classList.add("closed");

            // Reset so notification reappears on next poll
            lastDismissedCount = 0;

            // Resume notification polling and trigger an immediate check
            sendToNotificationFrame({type: "RESUME_NOTIFICATION_POLL"});
            sendToNotificationFrame({type: "POLL_NOW"});

            // Restore scroll on mobile
            if (isMobileDevice()) {
                document.body.classList.remove("ago-chat-open");
                document.body.style.top = "";
                window.scrollTo(0, scrollPosition);
            }
        } else {
            // Opening
            removePrompt();
            chatbot.classList.remove("closed");
            button.classList.remove("closed");

            // Re-sync metadata in case the host updated window.AGO.metadata
            // while the widget was closed (e.g. user context change).
            if (window.AGO.metadata && typeof window.AGO.metadata === "object") {
                sendMetadataToAGO(window.AGO.metadata);
            }

            // Same for auth credentials: a tab left open past the token TTL
            // would otherwise keep forwarding an expired token.
            refreshCredentials();

            // Pause notification polling while widget is open
            sendToNotificationFrame({type: "PAUSE_NOTIFICATION_POLL"});

            // Prevent body scroll on mobile
            if (isMobileDevice()) {
                scrollPosition =
                    window.pageYOffset || document.documentElement.scrollTop;
                document.body.style.top = `-${scrollPosition}px`;
                document.body.classList.add("ago-chat-open");
            } else {
                // Focus the iframe for keyboard events - but not on mobile
                const iframe = chatbot.querySelector("#ago-iframe");
                if (iframe) {
                    iframe.focus();
                }
            }
        }
    }
};

// Cleanup function for event listeners
let eventListeners = [];

const addEventListenerWithCleanup = (element, event, handler) => {
    element.addEventListener(event, handler);
    eventListeners.push({element, event, handler});
};

const cleanupEventListeners = () => {
    eventListeners.forEach(({element, event, handler}) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
};

const createClosePath = () => {
    const close = document.createElementNS("http://www.w3.org/2000/svg", "path");
    close.setAttribute(
        "d",
        "M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"
    );
    close.setAttribute("id", "close-path");
    return close;
};

const createButton = () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("id", "ago-wrapper");

    const styletag = document.createElement("link");
    styletag.setAttribute("rel", "stylesheet");
    styletag.setAttribute("href", getStylesheetHref());
    document.head.appendChild(styletag);

    const button = document.createElement("button");
    button.setAttribute("id", "ago-chat-button");
    button.classList.add("closed");

    // Check if custom icon URL is provided
    if (window.AGO.icon) {
        const img = document.createElement("img");
        img.setAttribute("src", window.AGO.icon);
        img.setAttribute("alt", "Chat");
        img.style.width = "32px";
        img.style.height = "32px";
        img.style.objectFit = "contain";
        img.setAttribute("id", "open-path");
        button.appendChild(img);

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("height", "48");
        svg.setAttribute("width", "48");
        svg.setAttribute("viewBox", "0 -960 960 960");
        svg.appendChild(createClosePath());
        button.appendChild(svg);
    } else {
        // Use default SVG icon
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("height", "48");
        svg.setAttribute("width", "48");
        svg.setAttribute("viewBox", "0 -960 960 960");
        const open = document.createElementNS("http://www.w3.org/2000/svg", "path");
        open.setAttribute(
            "d",
            "M240-400h480v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM880-80 720-240H160q-33 0-56.5-23.5T80-320v-480q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v720ZM160-320h594l46 45v-525H160v480Zm0 0v-480 480Z"
        );
        open.setAttribute("id", "open-path");
        svg.appendChild(open);
        svg.appendChild(createClosePath());
        button.appendChild(svg);
    }

    addEventListenerWithCleanup(button, "click", () => {
        toggleFrame();
    });

    wrapper.appendChild(button);

    document.body.appendChild(wrapper);

    if (window.AGO.colors && window.AGO.colors.button) {
        button.style.backgroundColor = window.AGO.colors.button;
    }
};

const createPrompt = () => {
    // Don't overwrite a notification prompt that arrived first
    if (document.querySelector("#ago-prompt")) return;

    const wrapper = document.querySelector("#ago-wrapper");

    const prompt = document.createElement("div");
    prompt.setAttribute("id", "ago-prompt");
    const close = document.createElement("button");
    close.setAttribute("id", "ago-prompt-close");
    close.textContent = "X";
    close.addEventListener(
        "click",
        () => {
            removePrompt();
        },
        {once: true}
    );
    prompt.appendChild(close);
    const promptText = document.createElement("p");
    promptText.textContent =
        window.AGO.prompt || "Hello, how can I help you today?";
    prompt.appendChild(promptText);

    // Add click event to open the widget when prompt is clicked (but not when close button is clicked)
    prompt.addEventListener("click", (e) => {
        if (e.target !== close) {
            toggleFrame();
        }
    });

    wrapper.prepend(prompt);
    syncPositionsToButton();
};

const removePrompt = () => {
    const prompt = document.querySelector("#ago-prompt");
    if (prompt) {
        prompt.remove();
    }
};

let lastDismissedCount = 0;

const showNotificationPrompt = (count) => {
    // Remove any existing prompt (welcome or notification)
    removePrompt();

    const chatbot = document.querySelector("#ago-chatbot");
    const isClosed = !chatbot || chatbot.classList.contains("closed");
    if (!isClosed || count <= 0) return;

    // Don't re-show if user dismissed this exact count
    if (count <= lastDismissedCount) return;

    const wrapper = document.querySelector("#ago-wrapper");
    if (!wrapper) return;

    const template = window.AGO.notificationMessage || "You have {{count}} new message(s)";
    const text = template.replace("{{count}}", String(count));

    const prompt = document.createElement("div");
    prompt.setAttribute("id", "ago-prompt");

    const close = document.createElement("button");
    close.textContent = "\u2715";
    close.addEventListener("click", (e) => {
        e.stopPropagation();
        lastDismissedCount = count;
        removePrompt();
    }, {once: true});

    const dot = document.createElement("span");
    dot.setAttribute("id", "ago-notification-dot");

    const p = document.createElement("p");
    p.appendChild(dot);
    p.appendChild(document.createTextNode(text));

    prompt.appendChild(close);
    prompt.appendChild(p);

    prompt.addEventListener("click", (e) => {
        if (e.target !== close) toggleFrame();
    });

    wrapper.prepend(prompt);
    syncPositionsToButton();
};

const createNotificationFrame = () => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("id", "ago-notification-frame");
    iframe.style.display = "none";
    const notifParams = [];
    if (window.AGO.widgetApiKey) notifParams.push("widgetApiKey=" + encodeURIComponent(window.AGO.widgetApiKey));
    if (window.AGO.email) notifParams.push("email=" + encodeURIComponent(window.AGO.email));
    if (window.AGO.jwt) notifParams.push("jwt=" + encodeURIComponent(window.AGO.jwt));
    iframe.setAttribute("src",
        window.AGO.basepath + "embed/notification-frame/"
        + (notifParams.length ? "?" + notifParams.join("&") : "")
    );
    document.body.appendChild(iframe);
};

const createChatInterface = () => {
    isChatLoaded = true;

    const wrapper = document.querySelector("#ago-wrapper");

    const chatbot = document.createElement("div");
    chatbot.setAttribute("id", "ago-chatbot");
    chatbot.classList.add("closed");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("id", "ago-iframe");
    iframe.setAttribute("title", "AGO chatbot");
    const chatParams = [];
    if (window.AGO.widgetApiKey) chatParams.push("widgetApiKey=" + encodeURIComponent(window.AGO.widgetApiKey));
    if (window.AGO.email) chatParams.push("email=" + encodeURIComponent(window.AGO.email));
    iframe.setAttribute(
        "src",
        window.AGO.basepath + "embed/"
        + (chatParams.length ? "?" + chatParams.join("&") : "")
    );
    iframe.setAttribute("tabindex", "0");
    chatbot.appendChild(iframe);
    wrapper.appendChild(chatbot);
    syncPositionsToButton();

    // Send messages to iframe
    const isMobile = window.matchMedia("(max-width: 450px)");
    const sendMobileState = () => {
        const iframe = document.querySelector("#ago-iframe");

        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(
                {
                    type: "MOBILE_STATE",
                    isMobile: isMobile.matches,
                },
                getTargetOrigin()
            );
        }
    };

    const sendInitMessages = () => {
        sendMobileState();

        // Send INIT_CHAT with all configuration including JWT, authToken and permission
        iframe.contentWindow.postMessage(
            {
                type: "INIT_CHAT",
                title: window.AGO.title || "AGO Chatbot",
                prompt: window.AGO.prompt || "Hello, how can I help you today?",
                colors: window.AGO.colors || {},
                hideFooter: window.AGO.hideFooter || false,
                jwt: window.AGO.jwt || null, // Include JWT in INIT_CHAT message
                authToken: window.AGO.authToken || null, // Include authToken for forwarding to external APIs
                permission: window.AGO.permission || null, // Include permission override in INIT_CHAT message
                defaultAgent: window.AGO.agent || window.AGO.defaultAgent || null, // Include default agent slug/id (accepts `agent` shorthand)
                lastUnreadConversationId: lastUnreadConversationId, // Forward unread conversation from notification frame
            },
            getTargetOrigin()
        );
        lastSentCredentials.jwt = window.AGO.jwt || null;
        lastSentCredentials.authToken = window.AGO.authToken || null;

        if (window.AGO.metadata && typeof window.AGO.metadata === "object") {
            sendMetadataToAGO(window.AGO.metadata);
        }

        // Ask the host for fresh credentials. Deliberately after INIT_CHAT and
        // not awaited: a slow getAuthToken() must not delay widget boot, and
        // SET_AUTH_TOKEN arriving a moment later is idempotent.
        refreshCredentials();
    };

    // Wait for iframe to load before sending messages
    addEventListenerWithCleanup(iframe, "load", () => {
        // Small delay to ensure the React app is ready
        setTimeout(sendInitMessages, 100);
    });

    addEventListenerWithCleanup(isMobile, "change", function () {
        sendMobileState();

        // Handle mobile state changes (orientation changes, etc.)
        const chatbot = document.querySelector("#ago-chatbot");
        const isOpen = chatbot && !chatbot.classList.contains("closed");

        if (isOpen) {
            if (isMobile.matches) {
                // Switched to mobile - apply mobile scroll prevention
                scrollPosition =
                    window.pageYOffset || document.documentElement.scrollTop;
                document.body.style.top = `-${scrollPosition}px`;
                document.body.classList.add("ago-chat-open");
            } else {
                // Switched to desktop - remove mobile scroll prevention
                document.body.classList.remove("ago-chat-open");
                document.body.style.top = "";
                window.scrollTo(0, scrollPosition);
            }
        }
    });

    // Handle viewport size changes (including virtual keyboard on mobile)
    let resizeTimeout;
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Update mobile state in case viewport changed
            sendMobileState();
        }, 150);
    };

    addEventListenerWithCleanup(window, "orientationchange", handleResize);

    if (window.AGO.colors && window.AGO.colors.button) {
        const button = document.querySelector("#ago-chat-button");
        if (button) {
            button.style.backgroundColor = window.AGO.colors.button;
        }
    }

    // Listen for messages from iframe
    const messageHandler = (event) => {
        if (!isTrustedOrigin(event.origin)) return;
        if (event.data.type === "CLOSE_CHAT") {
            toggleFrame(true);
        }
    };
    addEventListenerWithCleanup(window, "message", messageHandler);

    // Automatically open the chat after creating the interface
    setTimeout(() => {
        toggleFrame();
    }, 100);
};

// Re-derive prompt/panel positions when the viewport changes: host pages may
// move the button only above certain widths (media queries), and the mobile
// fullscreen layout needs the inline overrides cleared.
let syncPositionsTimeout;
addEventListenerWithCleanup(window, "resize", () => {
    clearTimeout(syncPositionsTimeout);
    syncPositionsTimeout = setTimeout(syncPositionsToButton, 150);
});

// A tab left open overnight comes back with an expired token. Re-pull when it
// regains focus, so the credential is fresh before the visitor types anything.
addEventListenerWithCleanup(document, "visibilitychange", () => {
    if (document.visibilityState === "visible") refreshCredentials();
});

// Listen for unread staff message count from notification iframe
addEventListenerWithCleanup(window, "message", (event) => {
    if (!isTrustedOrigin(event.origin)) return;
    if (event.data && event.data.type === "UNREAD_STAFF_COUNT") {
        lastUnreadConversationId = event.data.lastUnreadConversationId || null;
        showNotificationPrompt(event.data.count);
    }
});

// Cleanup on page unload
addEventListenerWithCleanup(window, "beforeunload", cleanupEventListeners);

if (document.body) {
    createButton();

    setTimeout(() => {
        createPrompt();
    }, 1000);

    if (window.AGO.notifications) {
        createNotificationFrame();
    }
} else {
    document.addEventListener("DOMContentLoaded", () => {
        createButton();

        if (window.AGO.notifications) {
            createNotificationFrame();
        }
    });
}

function sendMetadataToAGO(metadata) {
    // Remember the latest value so the re-sync on reopen (see toggleFrame)
    // picks it up even if the integrator called sendMetadataToAGO live.
    window.AGO.metadata = metadata;
    const iframe = document.querySelector('#ago-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'SET_METADATA',
            data: metadata
        }, getTargetOrigin());
        console.log('[AGO] SET_METADATA message sent to iframe');
    } else {
        console.warn('[AGO] Failed to send SET_METADATA: iframe not ready');
    }
}

// Credentials already delivered to the iframe. Tracked separately from
// window.AGO.* so a re-sync can tell "the host swapped the token" apart from
// "nothing changed" and stay quiet in the second case.
const lastSentCredentials = {jwt: null, authToken: null};

const isUsableCredential = (value) =>
    typeof value === 'string'
    && value !== ''
    && value !== 'undefined'
    && value !== 'null';

const AGO_TOKEN_SHIMS = [
    {
        name: "cautioneo",
        match: (hostname) => hostname === "cautioneo.com" || hostname.endsWith(".cautioneo.com"),
        read: () => {
            const client = window.__APOLLO_CLIENT__;
            if (!client || !client.cache || typeof client.cache.extract !== "function") return null;
            const root = client.cache.extract().ROOT_QUERY;
            if (!root) return null;

            let best = null;
            let bestExpiry = null;
            for (const key of Object.keys(root)) {
                if (!key.startsWith("node(")) continue;
                const found = key.match(/"id":"([^"]+)"/);
                if (!found) continue;
                const expiry = signedGlobalIdExpiry(found[1]);
                // Never swap in a token that is already dead: it would replace a
                // stale token with an equally stale one and hide the problem.
                if (!expiry || expiry <= new Date()) continue;
                if (!bestExpiry || expiry > bestExpiry) {
                    best = found[1];
                    bestExpiry = expiry;
                }
            }
            return best;
        },
    },
];

function signedGlobalIdExpiry(token) {
    try {
        const raw = atob(token.split("--")[0].replace(/-/g, "+").replace(/_/g, "/"));
        if (!/gid:\/\/[^/]+\/User\//.test(raw)) return null;
        const stamp = raw.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/);
        return stamp ? new Date(stamp[0]) : null;
    } catch (error) {
        return null;
    }
}


let lastShimOutcome;

function readHostAuthToken() {
    let shim;
    try {
        shim = AGO_TOKEN_SHIMS.find((entry) => entry.match(location.hostname));
    } catch (error) {
        return null;
    }
    if (!shim) return null;

    let token = null;
    try {
        token = shim.read();
    } catch (error) {
        // Host changed shape, or the visitor is logged out.
        token = null;
    }

    const outcome = token ? "resolved" : "empty";
    if (outcome !== lastShimOutcome) {
        lastShimOutcome = outcome;
        console.info(
            token
                ? `[AGO] host token shim '${shim.name}' resolved a token`
                : `[AGO] host token shim '${shim.name}' found nothing, keeping window.AGO.authToken`
        );
    }
    return token;
}


function refreshCredentials() {
    if (!document.querySelector('#ago-iframe')) return;
    syncCredential('authToken', 'getAuthToken', sendAuthTokenToAGO);
    syncCredential('jwt', 'getJwt', sendJwtToAGO);
}

function syncCredential(configKey, providerKey, send) {
    const push = (value) => {
        if (!isUsableCredential(value)) return;
        if (value === lastSentCredentials[configKey]) return; // nothing changed
        send(value);
    };

    const provider = window.AGO[providerKey];
    if (typeof provider !== 'function') {
        // No provider: prefer a host shim that can re-read the live source,
        // otherwise the global the host may have reassigned.
        push((configKey === 'authToken' ? readHostAuthToken() : null) || window.AGO[configKey]);
        return;
    }

    let result;
    try {
        result = provider();
    } catch (error) {
        console.warn(`[AGO] window.AGO.${providerKey}() threw, keeping the previous value`, error);
        return;
    }
    Promise.resolve(result).then(push).catch((error) => {
        console.warn(`[AGO] window.AGO.${providerKey}() rejected, keeping the previous value`, error);
    });
}

function sendJwtToAGO(jwt) {
    window.AGO.jwt = jwt;
    lastSentCredentials.jwt = jwt;
    const iframe = document.querySelector('#ago-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'SET_JWT',
            jwt: jwt
        }, getTargetOrigin());
        console.log('[AGO] SET_JWT message sent to iframe');
    } else {
        console.warn('[AGO] Failed to send SET_JWT: iframe not ready');
    }
    // Also update the notification iframe
    const notifIframe = document.querySelector('#ago-notification-frame');
    if (notifIframe && notifIframe.contentWindow) {
        notifIframe.contentWindow.postMessage({
            type: 'UPDATE_NOTIFICATION_JWT',
            jwt: jwt
        }, getTargetOrigin());
    }
}

function sendAuthTokenToAGO(authToken) {
    if (!isUsableCredential(authToken)) {
        console.warn('[AGO] sendAuthTokenToAGO called with empty authToken, ignoring');
        return;
    }
    window.AGO.authToken = authToken;
    lastSentCredentials.authToken = authToken;
    const iframe = document.querySelector('#ago-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'SET_AUTH_TOKEN',
            authToken: authToken
        }, getTargetOrigin());
        console.log('[AGO] SET_AUTH_TOKEN message sent to iframe');
    } else {
        console.warn('[AGO] Failed to send SET_AUTH_TOKEN: iframe not ready');
    }
}
