// Utility function to check if device is mobile
const isMobileDevice = () => window.matchMedia("(max-width: 450px)").matches;

// Store scroll position for mobile
let scrollPosition = 0;

// State tracking for lazy loading
let isChatLoaded = false;
let isFirstClick = true;

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
    styletag.setAttribute("href", "https://useago.github.io/widgetjs/frame.css");
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
};

const removePrompt = () => {
    const prompt = document.querySelector("#ago-prompt");
    if (prompt) {
        prompt.remove();
    }
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
    const email = window.AGO.email ?? "";
    iframe.setAttribute(
        "src",
        window.AGO.basepath +
        "embed/?widgetApiKey=" +
        window.AGO.widgetApiKey +
        "&email=" +
        encodeURIComponent(email)
    );
    iframe.setAttribute("tabindex", "0");
    chatbot.appendChild(iframe);
    wrapper.appendChild(chatbot);

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
                "*"
            );
        }
    };

    const sendInitMessages = () => {
        sendMobileState();

        iframe.contentWindow.postMessage(
            {
                type: "INIT_CHAT",
                title: window.AGO.title || "AGO Chatbot",
                prompt: window.AGO.prompt || "Hello, how can I help you today?",
                colors: window.AGO.colors || {},
            },
            "*"
        );

        // Send JWT if provided in the AGO configuration
        if (window.AGO.jwt) {
            sendJwtToAGO(window.AGO.jwt);
        }
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

// Cleanup on page unload
addEventListenerWithCleanup(window, "beforeunload", cleanupEventListeners);

if (document.body) {
    createButton();

    setTimeout(() => {
        createPrompt();
    }, 1000);
} else {
    document.addEventListener("DOMContentLoaded", () => {
        createButton();
    });
}

function sendMetadataToAGO(metadata) {
    const iframe = document.querySelector('#ago-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'SET_METADATA',
            data: metadata
        }, '*');
        console.log('[AGO] SET_METADATA message sent to iframe');
    } else {
        console.warn('[AGO] Failed to send SET_METADATA: iframe not ready');
    }
}

function sendJwtToAGO(jwt) {
    const iframe = document.querySelector('#ago-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'SET_JWT',
            jwt: jwt
        }, '*');
        console.log('[AGO] SET_JWT message sent to iframe');
    } else {
        console.warn('[AGO] Failed to send SET_JWT: iframe not ready');
    }
}
