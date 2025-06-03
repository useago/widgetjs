const styles = `
#ago-chatbot {
  border-radius: 16px;
  bottom: 80px;
  box-shadow: rgba(15, 15, 15, 0.16) 0px 5px 40px 0px;
  display: block;
  height: min(704px, 100% - 80px);
  opacity: 1;
  overflow: hidden;
  pointer-events: all;
  position: fixed;
  right: 20px;
  transform-origin: right bottom;
  visibility: visible;
  width: min(704px, 100% - 40px);
  z-index: 2100000000;
}
#ago-chatbot.closed {
  height: 0px;
  left: 100%;
  top: 100%;
  width: 0px;  
}
#ago-iframe {
  border: none;
  height: 100%;
  width: 100%;
}
#ago-chat-button {
  align-items: center;
  background-color: #007bff;
  border: none;
  border-radius: 50%;
  top:calc(100vh - 68px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
  cursor: pointer;
  display: flex;
  height: 48px;
  justify-content: center;
  left: calc(100vw - 68px);
  padding: 12px;
  position: fixed !important;
  transition: all 0.2s ease;
  width: 48px;
  z-index: 2100000001;
  /* Prevent iOS Safari from moving the button during scroll */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  /* Additional positioning fixes for mobile */
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  will-change: transform;
  /* Isolate from website layout changes */
  margin: 0 !important;
  box-sizing: border-box !important;
  contain: layout style paint !important;
}
#ago-chat-button svg {
  fill: #ffffff;
}
#ago-chat-button:not(.closed) #open-path,
#ago-chat-button.closed #close-path {
  display: none;
}
#ago-chat-button:hover {
  box-shadow: 0 6px 16px rgba(0, 123, 255, 0.4);
  scale: 1.1;
}
@media (max-width: 450px) {
  #ago-chatbot {
    border-radius: 0;
    bottom: 0;
    height: 100vh; /* Fallback for older browsers */
    height: 100dvh;
    left: 0;
    right: 0;
    top: 0;
    width: 100vw; /* Fallback for older browsers */
    width: 100dvw;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
  }
  #ago-chatbot.closed {
    height: 0px;
    left: 100%;
    top: 100%;
    width: 0px;  
  }
  #ago-chat-button:not(.closed) {
    display: none;
  }
  /* Fix for iOS Safari scroll behavior */
  body.ago-chat-open {
    position: fixed;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
}
`;

// Utility function to check if device is mobile
const isMobileDevice = () => window.matchMedia("(max-width: 450px)").matches;

// Store scroll position for mobile
let scrollPosition = 0;

const toggleFrame = (shouldClose) => {
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
            chatbot.classList.remove("closed");
            button.classList.remove("closed");

            // Prevent body scroll on mobile
            if (isMobileDevice()) {
                scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
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
    eventListeners.push({ element, event, handler });
};

const cleanupEventListeners = () => {
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
};

const createIFrame = () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("id", "ago-wrapper");

    const styletag = document.createElement("style");
    styletag.innerHTML = styles;
    wrapper.appendChild(styletag);

    const chatbot = document.createElement("div");
    chatbot.setAttribute("id", "ago-chatbot");
    chatbot.classList.add("closed");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("id", "ago-iframe");
    iframe.setAttribute("title", "AGO chatbot");
    iframe.setAttribute("src", window.AGO.basepath + "embed/?widgetApiKey=" + window.AGO.widgetApiKey);
    iframe.setAttribute("tabindex", "0");

    chatbot.appendChild(iframe);
    wrapper.appendChild(chatbot);

    const button = document.createElement("button");
    button.setAttribute("id", "ago-chat-button");
    button.classList.add("closed");
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
    const close = document.createElementNS("http://www.w3.org/2000/svg", "path");
    close.setAttribute(
        "d",
        "M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"
    );
    close.setAttribute("id", "close-path");
    svg.appendChild(close);
    button.appendChild(svg);

    addEventListenerWithCleanup(button, "click", () => {
        toggleFrame();
    });

    wrapper.appendChild(button);

    document.body.appendChild(wrapper);

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
                scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
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
};

// Cleanup on page unload
addEventListenerWithCleanup(window, "beforeunload", cleanupEventListeners);

if (document.body) {
    createIFrame();
} else {
    document.addEventListener("DOMContentLoaded", () => {
        createIFrame();
    });
}
