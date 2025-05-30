const toggleFrame = (shouldClose) => {
  const chatbot = document.querySelector("#ago-chatbot");
  const button = document.querySelector("#ago-chat-button");

  if (chatbot && button) {
    const isClosed = chatbot.classList.contains("closed");

    if (shouldClose || !isClosed) {
      // Closing
      chatbot.classList.add("closed");
      button.classList.add("closed");
    } else {
      // Opening
      chatbot.classList.remove("closed");
      button.classList.remove("closed");

      // Focus the iframe for keyboard events
      const iframe = chatbot.querySelector("#ago-iframe");
      if (chatbot) {
        iframe.focus();
      }
    }

    //updateButtonIcon(button, isClosed);
  }
};

const createIFrame = () => {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("id", "ago-wrapper");

  const styletag = document.createElement("link");
  styletag.setAttribute("rel", "stylesheet");
  styletag.setAttribute("href", "https://useago.github.io/widgetjs/frame.css");
  document.head.appendChild(styletag);

  const chatbot = document.createElement("div");
  chatbot.setAttribute("id", "ago-chatbot");
  chatbot.classList.add("closed");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("id", "ago-iframe");
  iframe.setAttribute("title", "AGO chatbot");
  iframe.setAttribute(
    "src",
    window.AGO.basepath + "embed/?widgetApiKey=" + window.AGO.widgetApiKey
  );
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

  button.addEventListener("click", () => {
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

  isMobile.addEventListener("change", function () {
    sendMobileState();
  });
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

  if (window.AGO.colors && window.AGO.colors.button) {
    const button = document.querySelector("#ago-chat-button");
    if (button) {
      button.style.backgroundColor = window.AGO.colors.button;
    }
  }

  // Listen for messages from iframe
  window.addEventListener("message", (event) => {
    if (event.data.type === "CLOSE_CHAT") {
      toggleFrame(true);
    }
  });
};

if (document.body) {
  createIFrame();
} else {
  document.addEventListener("DOMContentLoaded", () => {
    createIFrame();
  });
}
