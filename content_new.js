/**
 * @fileoverview Content script for the AskInTab Chrome Extension.
 * Injects a side chat panel into the current webpage, allowing users to interact
 * with AI models, referencing page content and other tabs.
 */

// Add a check to prevent multiple initializations in the same context
if (!window.hasInitializedAskInTabSideChat) {
  window.hasInitializedAskInTabSideChat = true;

  (async () => {
    // --- Constants ---
    const EXT_NAME = "askintab";
    const SIDE_CHAT_ID = 'extension-side-chat';
    const SIDE_CHAT_CONTAINER_ID = 'side-chat-container';
    const SIDE_CHAT_WIDTH = '400px';

    // --- DOM Helper Functions ---
    const createElement = (type, props = {}) => Object.assign(document.createElement(type), props);
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    // --- Text Selection & Highlighting Logic ---
    class TextHighlighter {
      /**
       * Gets the DOM path of a node relative to the BODY element.
       * @param {Node} node - The node to get the path for.
       * @returns {number[]} An array of child indices representing the path.
       */
      static getElementPath(node) {
        const path = [];
        let current = node;
        while (current && current.tagName !== "BODY") {
          const parent = current.parentElement;
          if (!parent) break; // Should not happen in a valid document
          // Filter out non-element nodes before getting index
          const elementChildren = Array.from(parent.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE);
          const index = elementChildren.indexOf(current);
          if (index === -1) break; // Node not found among element/text children
          path.unshift(index);
          current = parent;
        }
        return path;
      }

      /**
       * Finds a node in the document based on its DOM path.
       * @param {number[]} path - The array of child indices.
       * @returns {Node|null} The found node or null if not found.
       */
      static findNodeByPath(path) {
        let current = document.body;
        try {
          for (const index of path) {
            // Filter out non-element nodes when traversing
            const elementChildren = Array.from(current.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE);
            if (index < 0 || index >= elementChildren.length) {
              console.warn('Node index out of bounds during path traversal:', index, elementChildren);
              return null; // Path is invalid
            }
            current = elementChildren[index];
            if (!current) return null; // Node not found at index
          }
          return current;
        } catch (error) {
          console.error('Error finding node by path:', error, path);
          return null;
        }
      }

      /**
       * Serializes a DOM Range object into a plain object with paths.
       * @param {Range} range - The DOM Range object.
       * @returns {object|null} A serializable representation of the range, or null if invalid.
       */
      static serializeRange(range) {
        if (!range || !range.startContainer || !range.endContainer) return null;
        return {
          startContainerPath: this.getElementPath(range.startContainer),
          startOffset: range.startOffset,
          endContainerPath: this.getElementPath(range.endContainer),
          endOffset: range.endOffset
        };
      }

      /**
       * Highlights text in the document based on serialized range data.
       * @param {object} rangeData - The serialized range object.
       */
      static highlightTextInDocument(rangeData) {
        if (!rangeData || !rangeData.startContainerPath || !rangeData.endContainerPath) {
          console.warn('Invalid range data provided for highlighting.');
          return;
        }

        const { startContainerPath, startOffset, endContainerPath, endOffset } = rangeData;
        try {
          const startNode = this.findNodeByPath(startContainerPath);
          const endNode = this.findNodeByPath(endContainerPath);

          if (!startNode || !endNode) {
            console.error('Could not find nodes for highlighting using paths:', startContainerPath, endContainerPath);
            return;
          }

          const range = document.createRange();
          // Ensure offsets are within the valid bounds of the nodes
          const safeStartOffset = Math.min(startOffset, startNode.textContent?.length ?? 0);
          const safeEndOffset = Math.min(endOffset, endNode.textContent?.length ?? 0);

          range.setStart(startNode, safeStartOffset);
          range.setEnd(endNode, safeEndOffset);

          const selection = window.getSelection();
          if (!selection) return;
          selection.removeAllRanges();
          selection.addRange(range);

          // Scroll into view if needed
          const rect = range.getBoundingClientRect();
          if (rect.top < 0 || rect.bottom > window.innerHeight) {
            const targetScrollY = window.scrollY + rect.top - 100; // Adjust scroll position
            window.scrollTo({
              top: targetScrollY,
              behavior: 'smooth'
            });
          }
        } catch (error) {
          console.error('Failed to highlight text:', error, rangeData);
        }
      }
    }


    // --- State Management ---
    class ChatState {
      constructor() {
        this.messages = []; // Stores { type: 'user'|'assistant', ...messageData }
        this.currentMessage = this.getEmptyMessage();
        this.currentHighlight = { range: null, text: "" }; // Temp storage for selection
        this.models = [];
        this.selectedModel = null;
        this.tabs = []; // Store available tabs for context
      }

      getEmptyMessage() {
        return {
          input: "",
          type: "user", // Default type for new messages being composed
          // highlight: { text: "", range: null }, // Deprecated, use badges
          badges: [] // Stores { type: 'tab'|'highlight', text: '...', fullText?: '...', tabId?: '...', range?: '...' }
        };
      }

      resetCurrentMessage() {
        this.currentMessage = this.getEmptyMessage();
        this.currentHighlight = { range: null, text: "" };
      }

      addBadge(badgeData) {
        // Avoid duplicates
        const exists = this.currentMessage.badges.some(b =>
          b.type === badgeData.type &&
          (b.text === badgeData.text || (b.type === 'tab' && b.tabId === badgeData.tabId))
        );
        if (exists) return false;

        this.currentMessage.badges.push(badgeData);
        return true;
      }

      removeBadge(badgeData) {
        this.currentMessage.badges = this.currentMessage.badges.filter(b =>
          !(b.type === badgeData.type && b.text === badgeData.text)
        );
      }

      addMessage(messageData) {
        this.messages.push(messageData);
      }

      getLastMessageId() {
        const lastAssistantMessage = [...this.messages].reverse().find(m => m.type === 'assistant' && m.responseId);
        return lastAssistantMessage?.responseId;
      }

      async fetchInitialData() {
        try {
            [this.models, this.tabs] = await Promise.all([
                chrome.runtime.sendMessage({ action: "GET_MODELS" }),
                chrome.runtime.sendMessage({ action: "GET_TABS" })
            ]);
            this.selectedModel = this.models[0] || null; // Default to the first model
            console.log("Fetched Models:", this.models);
            console.log("Fetched Tabs:", this.tabs);
        } catch (error) {
            console.error("Error fetching initial data:", error);
            // Provide default values or handle the error appropriately
            this.models = [];
            this.tabs = [];
            this.selectedModel = null;
        }
      }
    }


    // --- UI Components & Logic ---
    class ChatUI {
      constructor(shadowRoot, state, messageSender) {
        this.root = shadowRoot;
        this.state = state;
        this.messageSender = messageSender; // Function to send message to background
        this.elements = {}; // Populated in initializeElements
        this.isChatVisible = false; // Track visibility state
        this.initializeMermaid();
      }

      initializeMermaid() {
          if (typeof mermaid !== 'undefined') {
              mermaid.initialize({
                  startOnLoad: false,
                  theme: 'dark',
                  securityLevel: 'loose', // May be needed for shadow DOM
              });
          } else {
              console.warn("Mermaid library not found.");
          }
      }

      getStyles() {
        // Keep styles here for simplicity, or load from external CSS
        return `
          /* Container styles */
          #${SIDE_CHAT_CONTAINER_ID} {
            position: fixed;
            top: 0;
            right: 0;
            width: ${SIDE_CHAT_WIDTH};
            height: 100vh;
            background-color: #1e1e1e;
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            z-index: 2147483647; /* Max z-index */
            font-family: Arial, sans-serif;
            border-left: 1px solid #333;
            color: #e0e0e0;
            visibility: hidden; /* Start hidden */
            transition: transform 0.3s ease, visibility 0.3s ease;
            transform: translateX(100%); /* Start off-screen */
          }
          #${SIDE_CHAT_CONTAINER_ID}.chat-visible { /* Use chat-visible class */
             transform: translateX(0);
             visibility: visible;
          }

          /* Badge container */
          .badge-container {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 8px;
            position: relative; /* For menu positioning */
          }

          /* Add badge button */
          .add-badge-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #333;
            border: 1px solid #444;
            border-radius: 3px;
            padding: 2px 5px;
            font-size: 11px;
            color: #b0b0b0;
            cursor: pointer;
            height: 20px;
            min-width: 20px;
          }
          .add-badge-btn:hover {
            background-color: #3a3a3a;
            color: #e0e0e0;
          }

          /* Badge menu (positioned above) */
          .badge-menu {
            display: none;
            position: absolute;
            bottom: 30px; /* Position above the + button */
            left: 0;
            background-color: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 10; /* Above badges */
            max-height: 150px;
            overflow-y: auto;
            width: max-content; /* Adjust width based on content */
            min-width: 150px; /* Minimum width */
          }
          .badge-menu.active {
            display: block;
          }
          .badge-menu-item {
            padding: 6px 10px;
            font-size: 12px;
            color: #d0d0d0;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .badge-menu-item:hover {
            background-color: #3a3a3a;
          }

          /* Custom badge styles */
          .custom-badge {
            display: flex;
            align-items: center;
            background-color: #333;
            border: 1px solid #444;
            border-radius: 3px;
            padding: 2px 6px;
            font-size: 11px;
            color: #b0b0b0;
            height: 20px;
            max-width: 150px; /* Limit badge width */
          }
          .custom-badge-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: default; /* Default cursor */
          }
          .custom-badge[data-type="highlight"] .custom-badge-text {
            cursor: pointer; /* Pointer only for highlight badges */
          }
          .custom-badge-close {
            background: none;
            border: none;
            color: #777;
            font-size: 12px;
            cursor: pointer;
            margin-left: 4px;
            padding: 0 2px;
            line-height: 1;
          }
          .custom-badge-close:hover {
            color: #aaa;
          }
          /* Badge type indicators */
          .custom-badge[data-type="tab"] {
            border-left: 2px solid #4a8eff; /* Blue for tabs */
          }
          .custom-badge[data-type="highlight"] {
            border-left: 2px solid #ffaa4a; /* Orange for highlights */
          }

          /* Header styles */
          .chat-header {
            padding: 15px;
            background-color: #252525;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0; /* Prevent header from shrinking */
          }
          .chat-header h3 {
            margin: 0;
            font-size: 16px;
            color: #e0e0e0;
            margin-right: auto; /* Push buttons to the right */
          }
          .header-buttons {
            display: flex;
            align-items: center;
            gap: 10px; /* Space between buttons */
          }
          .header-btn { /* Common style for header buttons */
            background: none;
            border: none;
            cursor: pointer;
            /* font-size: 18px; */ /* Remove or adjust if it interferes with SVG size */
            color: #b0b0b0; /* This color will be used by fill="currentColor" */
            padding: 0 5px;
            line-height: 1; /* Ensure consistent height */
            display: inline-flex; /* Make button a flex container */
            align-items: center; /* Center SVG vertically */
            justify-content: center; /* Center SVG horizontally */
            height: 24px; /* Give button a defined height */
            width: 24px;  /* Give button a defined width */
          }
          .header-btn:hover {
              color: #ffffff; /* Hover color for SVG */
          }
          .settings-btn svg { /* Style the SVG directly if needed */
             width: 16px;
             height: 16px;
             /* fill: currentColor; */ /* Already set in SVG, but can override here */
          }
          .close-btn { /* Specific style if needed */
             font-size: 18px; /* Keep font-size for text-based button */
          }

          /* Messages area */
          .chat-messages {
            flex: 1; /* Take remaining space */
            overflow-y: auto;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            background-color: #1e1e1e;
          }

          /* Base message style */
          .message {
            word-wrap: break-word;
            font-size: 13px;
            line-height: 1.5;
            max-width: 100%;
            color: #d0d0d0;
          }

          /* User message style */
          .user-message {
            align-self: flex-end;
            background-color: #333;
            color: #d0d0d0;
            padding: 10px 12px;
            border-radius: 6px;
            border: 1px solid #444;
            box-sizing: border-box;
            max-width: 90%; /* Prevent user message from taking full width */
          }

          /* Badges within a user message */
          .message-badges {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed #555;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }
          .message-badge {
            font-size: 11px;
            color: #a0a0a0;
            padding: 1px 4px;
            border: 1px solid #444;
            border-radius: 3px;
            background-color: #3a3a3a; /* Slightly different background */
          }
          .message-badge[data-type="highlight"] {
             cursor: pointer;
             border-left: 2px solid #ffaa4a;
          }
          .message-badge[data-type="highlight"]:hover {
             color: #b8b8b8;
             text-decoration: underline;
          }
          .message-badge[data-type="tab"] {
             border-left: 2px solid #4a8eff;
          }


          /* Assistant message style */
          .assistant-message {
            align-self: flex-start;
            background-color: transparent;
            padding: 0;
            max-width: 100%; /* Allow assistant message to take full width */
          }

          /* Typing indicator */
          .typing-indicator {
            display: flex;
            align-items: center;
            align-self: flex-start;
            padding: 5px 0; /* Add some padding */
            height: 20px;
          }
          .typing-dot {
            width: 5px;
            height: 5px;
            margin: 0 2px;
            background-color: #888;
            border-radius: 50%;
            opacity: 0.4;
            animation: typing-animation 1.2s infinite ease-in-out;
          }
          .typing-dot:nth-child(1) { animation-delay: 0s; }
          .typing-dot:nth-child(2) { animation-delay: 0.2s; }
          .typing-dot:nth-child(3) { animation-delay: 0.4s; }
          @keyframes typing-animation {
            0%, 50%, 100% { opacity: 0.4; }
            25% { opacity: 1; }
          }

          /* Input area */
          .chat-input-container {
            position: relative;
            padding: 15px;
            background-color: #252525;
            border-top: 1px solid #333;
            flex-shrink: 0; /* Prevent input area from shrinking */
          }

          /* Input textarea */
          #${SIDE_CHAT_CONTAINER_ID} .chat-input { /* High specificity */
            width: 100% !important;
            padding: 10px 10px 40px 10px !important; /* Bottom padding for controls */
            border: 1px solid #444 !important;
            border-radius: 4px !important;
            outline: none !important;
            font-size: 14px !important;
            min-height: 80px !important; /* Adjusted height */
            max-height: 200px; /* Limit max height */
            resize: vertical !important;
            font-family: Arial, sans-serif !important;
            background-color: #2a2a2a !important;
            color: #e0e0e0 !important;
            box-sizing: border-box !important;
            line-height: 1.4 !important;
            margin: 0 !important;
          }
          #${SIDE_CHAT_CONTAINER_ID} .chat-input::placeholder {
            color: #999 !important;
          }

          /* Model selector */
          .model-selector {
            position: absolute !important;
            bottom: 25px !important;
            left: 25px !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            border: none !important;
            background-color: #333 !important;
            color: #999 !important;
            font-size: 12px !important;
            cursor: pointer !important;
            outline: none !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="6"><path d="M0,0 L12,0 L6,6 Z" fill="%23999"/></svg>') !important;
            background-repeat: no-repeat !important;
            background-position: right 6px center !important;
            padding-right: 20px !important; /* Space for arrow */
            opacity: 0.7 !important;
            transition: opacity 0.2s !important;
            z-index: 5; /* Above textarea */
          }
          .model-selector:hover {
            opacity: 1 !important;
          }
          .model-selector option {
            background-color: #333 !important;
            color: #e0e0e0 !important;
          }

          /* Send button */
          .send-btn {
            position: absolute !important;
            bottom: 25px !important;
            right: 25px !important;
            background-color: #333 !important;
            color: #999 !important;
            border: none !important;
            padding: 4px 10px !important; /* Slightly wider */
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            opacity: 0.7 !important;
            transition: opacity 0.2s, background-color 0.2s, color 0.2s !important;
            z-index: 5; /* Above textarea */
          }
          .send-btn:hover {
            opacity: 1 !important;
            background-color: #4a8eff !important; /* Highlight on hover */
            color: #fff !important;
          }
          .send-btn:disabled {
              opacity: 0.5 !important;
              cursor: not-allowed !important;
              background-color: #333 !important;
              color: #777 !important;
          }


          /* Code block styling */
          .assistant-message pre {
            background-color: #252525;
            padding: 12px; /* More padding */
            border-radius: 4px;
            overflow-x: auto;
            margin: 10px 0; /* More margin */
            font-family: 'Courier New', Courier, monospace; /* Monospace font */
            font-size: 13px; /* Slightly larger */
            border: 1px solid #444; /* Subtle border */
          }
          .assistant-message code:not(pre code) { /* Inline code */
            background-color: #2a2a2a;
            padding: 2px 5px; /* Adjust padding */
            border-radius: 3px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            border: 1px solid #444;
          }
          .assistant-message pre code { /* Code within pre */
             background-color: transparent; /* No background */
             padding: 0;
             border-radius: 0;
             font-family: inherit; /* Inherit from pre */
             font-size: inherit;
             border: none; /* No border */
          }
          /* Mermaid diagram container */
          .assistant-message .mermaid {
              background-color: #252525; /* Match pre background */
              padding: 15px;
              border-radius: 4px;
              margin: 10px 0;
              border: 1px solid #444;
              text-align: center; /* Center diagram */
          }
          .assistant-message .mermaid svg {
              max-width: 100%; /* Ensure SVG scales */
              height: auto;
          }


          /* Highlight popover */
          .highlight-popover {
            position: absolute;
            visibility: hidden;
            background-color: #252525;
            color: white;
            border-radius: 3px; /* Slightly more rounded */
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 13px; /* Smaller font */
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            z-index: 2147483646; /* Just below chat panel */
            padding: 4px 8px; /* Adjust padding */
            border: 1px solid rgba(255, 255, 255, 0.3);
            white-space: nowrap; /* Prevent wrapping */
          }
          .highlight-popover:hover {
              background-color: #3a3a3a;
          }

          /* Scrollbar styling */
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: #1e1e1e; }
          ::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #666; }

          /* Suggested Question styles */
          .suggested-questions-container {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #555; /* Separator */
            display: flex;
            flex-direction: column; /* Stack questions vertically */
            gap: 8px; /* Space between questions */
            align-items: stretch; /* Make items stretch to fill width */
          }
          .suggested-question {
            display: block; /* Change from inline-block to block */
            background-color: #333;
            color: #b0b0b0;
            padding: 5px 10px;
            border-radius: 4px;
            border: 1px solid #444;
            font-size: 12px;
            cursor: pointer;
            transition: background-color 0.2s, color 0.2s;
            /* max-width: 100%; Remove this - block elements take full width by default */
            box-sizing: border-box;
            text-align: left; /* Ensure text aligns left */
            width: 100%; /* Explicitly set width to 100% */
          }
          .suggested-question:hover {
            background-color: #4a8eff; /* Highlight color on hover */
            color: #fff;
          }
        `;
      }

      getHTMLTemplate() {
          const tabMenuItems = this.state.tabs
              .map(tab => `<div class="badge-menu-item" data-type="tab" data-tab-id="${tab.id}" title="${tab.title}" data-tab-url="${tab.url}">${tab.title}</div>`)
              .join('');

          // Start with chat-hidden class
          return `
          <div id="${SIDE_CHAT_CONTAINER_ID}">
            <div class="chat-header">
              <h3>AI Chat (${EXT_NAME})</h3>
              <div class="header-buttons">
                 <button class="header-btn settings-btn" title="Settings">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16px" height="16px">
                     <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.09-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.3-.06.62-.06.94s.02.64.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.09.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                   </svg>
                 </button>
                 <button class="header-btn close-btn" title="Close Chat">✕</button>
              </div>
            </div>

            <div class="chat-messages">
              <!-- Messages will be added here -->
            </div>

            <div class="chat-input-container">
              <div class="badge-container">
                <!-- Badges added dynamically here -->
                <div class="add-badge-btn" title="Add Context (Tab or Highlight)">+</div>
                <div class="badge-menu">
                  <div class="badge-menu-item" data-type="highlight">Add Selected Text</div>
                  ${tabMenuItems}
                </div>
              </div>
              <textarea class="chat-input" placeholder="Ask anything... (Shift+Enter for newline)"></textarea>
              <select class="model-selector" title="Select AI Model"></select>
              <button class="send-btn" title="Send Message" disabled>Send</button>
            </div>
          </div>

          <!-- Highlight popover (outside the main container) -->
          <div class="highlight-popover">Add to Chat Context</div>
        `;
      }

      render() {
        this.root.innerHTML = `
          <style>${this.getStyles()}</style>
          ${this.getHTMLTemplate()}
        `;
        this.initializeElements();
        this.populateModels();
        this.bindEvents();
        this.updateSendButtonState(); // Initial state
        // Show the chat on initial render (first injection)
        this.toggleVisibility(true);
      }

      initializeElements() {
        this.elements = {
          container: $(`#${SIDE_CHAT_CONTAINER_ID}`, this.root),
          closeBtn: $('.close-btn', this.root),
          settingsBtn: $('.settings-btn', this.root), // Get settings button
          messages: $('.chat-messages', this.root),
          input: $('.chat-input', this.root),
          sendBtn: $('.send-btn', this.root),
          modelSelector: $('.model-selector', this.root),
          popover: $('.highlight-popover', this.root),
          badgeContainer: $('.badge-container', this.root),
          addBadgeBtn: $('.add-badge-btn', this.root),
          badgeMenu: $('.badge-menu', this.root),
          badgeMenuItems: $$('.badge-menu-item', this.root)
        };
      }

      populateModels() {
        if (!this.elements.modelSelector) return;
        this.elements.modelSelector.innerHTML = this.state.models
          .map(model => `<option value="${model}" ${model === this.state.selectedModel ? 'selected' : ''}>${model}</option>`)
          .join('');
      }

      bindEvents() {
        this.elements.closeBtn?.addEventListener('click', () => this.toggleVisibility(false));
        this.elements.settingsBtn?.addEventListener('click', this.handleOpenSettings.bind(this)); // Bind settings button
        this.elements.sendBtn?.addEventListener('click', () => this.handleSendMessage());
        this.elements.input?.addEventListener('keypress', this.handleInputKeyPress.bind(this));
        this.elements.input?.addEventListener('input', this.updateSendButtonState.bind(this));
        this.elements.modelSelector?.addEventListener('change', (e) => {
          this.state.selectedModel = e.target.value;
        });
        this.elements.popover?.addEventListener('click', this.handleAddHighlightBadge.bind(this));
        this.elements.addBadgeBtn?.addEventListener('click', this.toggleBadgeMenu.bind(this));

        // Badge Menu Item Clicks
        this.elements.badgeMenuItems.forEach(item => {
          item.addEventListener('click', this.handleAddBadgeFromMenu.bind(this, item));
        });

        // Global listeners (consider scoping or cleanup)
        document.addEventListener('mouseup', this.handleTextSelection.bind(this));
        document.addEventListener('click', this.handleDocumentClick.bind(this)); // For closing menu

        // Add delegation for suggested questions within the messages container
        this.elements.messages?.addEventListener('click', (event) => {
          if (event.target.classList.contains('suggested-question')) {
            this.handleSuggestedQuestionClick(event.target.dataset.question);
          }
        });
      }

      handleOpenSettings() {
          // Send message to background script to open the settings page
          chrome.runtime.sendMessage({ action: "OPEN_SETTINGS" })
              .catch(error => console.error("AskInTab: Error sending OPEN_SETTINGS message:", error));
      }

      handleSendMessage() {
          const inputText = this.elements.input.value.trim();
          // Check if there's input text OR at least one badge
          if (!inputText && this.state.currentMessage.badges.length === 0) return;

          // Finalize current message state
          this.state.currentMessage.input = inputText;
          this.state.currentMessage.model = this.state.selectedModel;
          this.state.currentMessage.lastMessageId = this.state.getLastMessageId();

          const messageToSend = { ...this.state.currentMessage }; // Clone message

          this.addMessage(messageToSend, true); // Add user message to UI
          this.messageSender(messageToSend); // Send to background script

          // Reset UI and state for next message
          this.elements.input.value = '';
          this.clearBadgesFromInput();
          this.state.resetCurrentMessage();
          this.updateSendButtonState(); // Disable send button
          this.showTypingIndicator();
      }

      handleInputKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault(); // Prevent newline
          if (!this.elements.sendBtn.disabled) {
              this.handleSendMessage();
          }
        }
      }

      updateSendButtonState() {
          if (!this.elements.sendBtn || !this.elements.input) return;
          const hasText = this.elements.input.value.trim().length > 0;
          const hasBadges = this.state.currentMessage.badges.length > 0;
          this.elements.sendBtn.disabled = !(hasText || hasBadges);
      }

      handleTextSelection(event) {
        // Avoid triggering selection inside the chat panel itself
        if (event.target.closest(`#${SIDE_CHAT_ID}`)) {
          this.hidePopover();
          return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount < 1 || selection.isCollapsed) {
          this.hidePopover();
          return;
        }

        const range = selection.getRangeAt(0);
        const text = selection.toString().trim();

        if (text.length > 0) {
          const serializedRange = TextHighlighter.serializeRange(range);
          if (!serializedRange) {
              this.hidePopover();
              return; // Could not serialize range
          }
          this.state.currentHighlight = { range: serializedRange, text };
          this.showPopover(range.getBoundingClientRect());
        } else {
          this.hidePopover();
        }
      }

      showPopover(rect) {
        if (!this.elements.popover) return;
        // Position popover near the selection end
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        this.elements.popover.style.left = `${scrollX + rect.right - this.elements.popover.offsetWidth / 2}px`;
        this.elements.popover.style.top = `${scrollY + rect.bottom + 5}px`; // 5px below selection
        this.elements.popover.style.visibility = 'visible';
      }

      hidePopover() {
        if (!this.elements.popover) return;
        this.elements.popover.style.visibility = 'hidden';
        // Optionally reset currentHighlight if popover is hidden without adding
        // this.state.currentHighlight = { range: null, text: "" };
      }

      handleAddHighlightBadge() {
          if (!this.state.currentHighlight.text) return;

          const highlightData = {
              type: 'highlight',
              text: this.state.currentHighlight.text.length > 20 ?
                    this.state.currentHighlight.text.substring(0, 17) + '...' :
                    this.state.currentHighlight.text,
              fullText: this.state.currentHighlight.text,
              range: this.state.currentHighlight.range
          };

          if (this.state.addBadge(highlightData)) {
              this.addBadgeToUI(highlightData);
              this.updateSendButtonState(); // Enable send button if needed
          }

          // Clear the temporary highlight state and hide popover
          this.state.currentHighlight = { range: null, text: "" };
          this.hidePopover();
          window.getSelection()?.removeAllRanges(); // Clear document selection
      }

      toggleBadgeMenu(event) {
        event?.stopPropagation(); // Prevent document click listener from closing immediately
        this.elements.badgeMenu?.classList.toggle('active');
      }

      closeBadgeMenu() {
          this.elements.badgeMenu?.classList.remove('active');
      }

      handleDocumentClick(event) {
          // Close badge menu if click is outside the menu and the add button
          if (!this.elements.badgeMenu?.contains(event.target) && !this.elements.addBadgeBtn?.contains(event.target)) {
              this.closeBadgeMenu();
          }
          // Hide popover if click is outside the popover
          if (!this.elements.popover?.contains(event.target)) {
               // Check if the click was on the popover's trigger area (selection)
               const selection = window.getSelection();
               if (!selection || selection.isCollapsed) {
                   this.hidePopover();
               }
          }
      }

      handleAddBadgeFromMenu(item) {
          const badgeType = item.dataset.type;
          if (!badgeType) return;

          let badgeData = null;

          if (badgeType === 'highlight') {
              // Trigger the same logic as clicking the popover
              this.handleAddHighlightBadge();
              this.closeBadgeMenu();
              return; // Exit early as addHighlightBadge handles UI/state
          } else if (badgeType === 'tab') {
              const tabId = item.dataset.tabId;
              const tabUrl = item.dataset.tabUrl;
              const tabTitle = item.getAttribute('title') || item.textContent; // Use title for full text
              if (!tabId) return;
              badgeData = {
                  type: 'tab',
                  text: tabTitle.length > 20 ? tabTitle.substring(0, 17) + '...' : tabTitle,
                  tabUrl: tabUrl,
                  fullText: tabTitle,
                  tabId: tabId
              };
          }

          if (badgeData && this.state.addBadge(badgeData)) {
              this.addBadgeToUI(badgeData);
              this.updateSendButtonState(); // Enable send button if needed
          }
          this.closeBadgeMenu();
      }

      addBadgeToUI(badgeData) {
        const badge = createElement('div', {
          className: 'custom-badge',
          title: badgeData.fullText || badgeData.text // Show full text on hover
        });
        badge.setAttribute('data-type', badgeData.type);
        if (badgeData.tabId) {
          badge.setAttribute('data-tab-id', badgeData.tabId);
        }

        const badgeText = createElement('span', {
          className: 'custom-badge-text',
          textContent: badgeData.text
        });
        badge.appendChild(badgeText);

        // Add click handler for highlight badges to re-highlight text
        if (badgeData.type === 'highlight' && badgeData.range) {
          badgeText.addEventListener('click', () => {
            TextHighlighter.highlightTextInDocument(badgeData.range);
          });
        }

        const closeBtn = createElement('button', {
          className: 'custom-badge-close',
          textContent: '×',
          title: 'Remove Context'
        });
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.removeBadge(badgeData);
          badge.remove();
          this.updateSendButtonState(); // Update button state after removal
        });
        badge.appendChild(closeBtn);

        // Insert before the add button
        this.elements.badgeContainer?.insertBefore(badge, this.elements.addBadgeBtn);
      }

      clearBadgesFromInput() {
          $$('.custom-badge', this.elements.badgeContainer).forEach(badge => badge.remove());
      }

      addMessage(messageData, isUser = false) {
        const messageEl = createElement('div', {
          className: `message ${isUser ? 'user-message' : 'assistant-message'}`
        });

        if (isUser) {
          this.renderUserMessage(messageEl, messageData);
        } else {
          this.renderAssistantMessage(messageEl, messageData);
        }

        this.elements.messages?.appendChild(messageEl);
        this.scrollToBottom();
      }

      renderUserMessage(messageEl, messageData) {
          // Display input text if present
          if (messageData.input) {
              const inputText = createElement('div', { textContent: messageData.input });
              messageEl.appendChild(inputText);
          }

          // Display badges if present
          if (messageData.badges && messageData.badges.length > 0) {
              const badgesContainer = createElement('div', { className: 'message-badges' });
              messageData.badges.forEach(badge => {
                  const badgeEl = createElement('span', {
                      className: 'message-badge',
                      textContent: `[${badge.text}]`,
                      title: badge.fullText || badge.text
                  });
                  badgeEl.setAttribute('data-type', badge.type);

                  // Add click handler for highlight badges within the message history
                  if (badge.type === 'highlight' && badge.range) {
                      badgeEl.addEventListener('click', () => {
                          TextHighlighter.highlightTextInDocument(badge.range);
                      });
                  }
                  badgesContainer.appendChild(badgeEl);
              });
              messageEl.appendChild(badgesContainer);
          }
      }

      renderAssistantMessage(messageEl, messageData) {
          const rawText = messageData.message.text || '';
          const questionRegex = /<q>(.*?)<\/q>/gs; // Regex to find <q> tags
          const questions = [];
          let cleanedText = rawText.replace(questionRegex, (match, questionContent) => {
              if (questionContent) {
                  questions.push(questionContent.trim());
              }
              return ''; // Remove the <q> tag and its content from the main text
          }).trim(); // Remove leading/trailing whitespace potentially left after removal

          // Render the main content (without the <q> tags) using Marked
          if (typeof marked === 'undefined') {
              console.warn("Marked library not found. Displaying raw text.");
              messageEl.textContent = cleanedText;
              // Still append questions even if marked fails
          } else {
              try {
                  const renderer = new marked.Renderer();
                  const originalCodeRenderer = renderer.code;

                  renderer.code = (tokens) => {
                      if (tokens.lang === 'mermaid') {
                          const diagramId = `mermaid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                          return `<div class="mermaid" id="${diagramId}">${escapeHtml(tokens.text)}</div>`;
                      }
                      // Ensure originalCodeRenderer is called correctly
                      // It might expect (code, language, isEscaped) or just the token object depending on version/config
                      // Let's assume it expects the token object based on the previous edit
                      // If errors occur, revert to: return originalCodeRenderer.call(renderer, tokens.text, tokens.lang, false);
                      return originalCodeRenderer.call(renderer, tokens);
                  };

                  marked.use({ renderer });
                  const htmlContent = marked.parse(cleanedText);
                  messageEl.innerHTML = htmlContent;

                  this.processMermaidDiagrams(messageEl);

              } catch (error) {
                  console.error("Error rendering assistant message with Marked:", error);
                  messageEl.textContent = cleanedText; // Fallback to cleaned text
              }
          }

          // Append the extracted questions if any exist
          if (questions.length > 0) {
              const questionsContainer = createElement('div', { className: 'suggested-questions-container' });
              questions.forEach(qText => {
                  const questionEl = createElement('div', {
                      className: 'suggested-question',
                      textContent: qText,
                      title: `Ask: "${qText}"` // Tooltip
                  });
                  // Store the question text in a data attribute for the click handler
                  questionEl.dataset.question = qText;
                  questionsContainer.appendChild(questionEl);
              });
              messageEl.appendChild(questionsContainer);
          }
      }

      processMermaidDiagrams(container) {
          if (typeof mermaid === 'undefined') return;

          const mermaidDivs = $$('.mermaid', container);
          if (mermaidDivs.length === 0) return;

          mermaidDivs.forEach(async (mermaidDiv) => {
              const diagramId = mermaidDiv.id;
              const code = mermaidDiv.textContent || ''; // Get code from placeholder
              mermaidDiv.textContent = ''; // Clear placeholder text

              if (!diagramId || !code) return;

              try {
                  // Use mermaid.render to get SVG
                  const { svg } = await mermaid.render(diagramId, code);
                  mermaidDiv.innerHTML = svg;
              } catch (error) {
                  console.error('Mermaid rendering error:', error);
                  mermaidDiv.innerHTML = `<pre>Error rendering diagram:\n${escapeHtml(error.message)}</pre>`;
              }
          });
      }

      createTypingIndicator() {
        const indicator = createElement('div', { className: 'typing-indicator' });
        for (let i = 0; i < 3; i++) {
          indicator.appendChild(createElement('div', { className: 'typing-dot' }));
        }
        return indicator;
      }

      showTypingIndicator() {
        this.hideTypingIndicator(); // Remove existing one first
        const indicator = this.createTypingIndicator();
        this.elements.messages?.appendChild(indicator);
        this.scrollToBottom();
      }

      hideTypingIndicator() {
        const indicator = $('.typing-indicator', this.root);
        indicator?.remove();
      }

      scrollToBottom() {
        if (!this.elements.messages) return;
        // Use requestAnimationFrame for smoother scrolling after DOM updates
        requestAnimationFrame(() => {
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        });
      }

      /**
       * Toggles the visibility of the chat panel.
       * @param {boolean} [forceShow] - If true, shows the panel; if false, hides it. If undefined, toggles.
       */
      toggleVisibility(forceShow) {
          const container = this.elements.container;
          if (!container) return;

          const shouldShow = forceShow !== undefined ? forceShow : !this.isChatVisible;
          const bodyPadding = shouldShow ? SIDE_CHAT_WIDTH : '0';

          // Use transitions for smooth slide-in/out and body padding adjustment
          document.body.style.transition = 'padding-right 0.3s ease';
          document.body.style.paddingRight = bodyPadding;

          if (shouldShow) {
              container.classList.add('chat-visible'); // Use add/remove for visibility class
          } else {
              container.classList.remove('chat-visible');
          }
          this.isChatVisible = shouldShow; // Update state
      }

      /**
       * Handles clicking on a suggested question.
       * @param {string} questionText The text of the clicked question.
       */
      handleSuggestedQuestionClick(questionText) {
          if (!questionText || !this.elements.input || !this.elements.sendBtn) return;

          // Set the input value to the question
          this.elements.input.value = questionText;

          // Update the state and UI accordingly
          this.state.currentMessage.input = questionText; // Update state immediately
          this.updateSendButtonState(); // Enable send button

          // Optionally, automatically send the message
          // this.handleSendMessage();

          // Or just focus the input field
          this.elements.input.focus();
      }
    }


    // --- Main Chat Controller ---
    class SideChat {
      constructor() {
        this.state = new ChatState();
        this.shadowRoot = null;
        this.ui = null;
        this.container = null;
      }

      async initialize() {
        // Prevent duplicate initialization (redundant with window flag but safe)
        if ($(`#${SIDE_CHAT_ID}`)) {
          console.warn(`${EXT_NAME}: Side chat already initialized.`);
          // If already initialized, maybe just ensure it's visible?
          // Or rely on the toggle message from background.js
          return;
        }

        console.log(`${EXT_NAME}: Initializing...`);
        await this.state.fetchInitialData(); // Fetch models and tabs first
        this.setupContainer();

        if (!this.shadowRoot) {
            console.error(`${EXT_NAME}: Failed to create shadow root.`);
            return;
        }

        this.ui = new ChatUI(this.shadowRoot, this.state, this.sendMessageToBackground.bind(this));
        this.ui.render(); // Render UI elements (will call toggleVisibility(true))

        this.setupMessageHandling();
        // Initial visibility is handled by ui.render() -> ui.toggleVisibility(true)
        console.log(`${EXT_NAME}: Initialization complete.`);
      }

      setupContainer() {
        this.container = createElement('div', { id: SIDE_CHAT_ID });
        // Ensure container is added to body before creating shadow root if issues arise
        document.body.appendChild(this.container);
        try {
            this.shadowRoot = this.container.attachShadow({ mode: 'open' });
        } catch (error) {
            console.error("Error attaching shadow DOM:", error);
            this.container.remove(); // Clean up if shadow DOM fails
            this.container = null;
        }
      }

      setupMessageHandling() {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
          // No need to check sender ID usually, background script is trusted source
          // if (sender.id !== chrome.runtime.id) return false;

          if (msg.action === "NEW_MESSAGE") {
            this.handleResponse(msg.payload);
            // No need to return true/false unless sending an async response *from here*
          } else if (msg.action === "TOGGLE_CHAT") {
            console.log("AskInTab: Received TOGGLE_CHAT message.");
            this.ui?.toggleVisibility(); // Toggle based on current state
            // No response needed
          }
          // Handle other actions if needed

          // Return true only if you intend to use sendResponse asynchronously later
          // For sync handling or no response, return false or undefined.
          return false;
        });
      }

      sendMessageToBackground(payload) {
          console.log("Sending request to background:", payload);
          chrome.runtime.sendMessage({ action: "NEW_MESSAGE", payload })
              .then(response => {
                  // Optional: Handle direct response from background if needed
                  // console.log("Direct response from background:", response);
                  if (response?.error) {
                      console.error("AskInTab: Error from background:", response.error);
                       this.ui?.hideTypingIndicator();
                       this.ui?.addMessage({ raw: `Error: ${response.error}` }, false);
                  }
              })
              .catch(error => {
                  console.error("Error sending message to background:", error);
                  this.ui?.hideTypingIndicator();
                  // Optionally display an error message in the chat
                  this.ui?.addMessage({ raw: `Error: Could not connect to background script. ${error.message}` }, false);
              });
      }

      handleResponse(payload) {
        console.log("Received response from background:", payload);
        if (!this.ui) return;

        this.ui.hideTypingIndicator();
        // Check for errors in the response payload itself
        if (payload.error) {
            console.error("AskInTab: Received error in response:", payload.error);
            this.ui.addMessage({ raw: `Error: ${payload.error}` }, false);
        } else {
            this.ui.addMessage(payload, false); // Add assistant message to UI
            this.state.addMessage({ ...payload, type: "assistant" }); // Store in state
        }
      }
    }

    // --- Utility Functions ---
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
     }

    // --- Initialization ---
    // The window flag at the top prevents re-running this whole script.

    // Inject necessary libraries if they aren't already present
    // Basic check for mermaid and marked
    if (typeof mermaid === 'undefined') {
        console.warn(`${EXT_NAME}: Mermaid library not found. Diagrams may not render.`);
        // Libraries are injected by background.js now, so this is just a check
    }
    if (typeof marked === 'undefined') {
        console.warn(`${EXT_NAME}: Marked library not found. Markdown may not render correctly.`);
        // Libraries are injected by background.js now
    }

    const sideChat = new SideChat();

    // Wait for DOM ready before initializing (though run_at: document_end usually suffices)
    // Since injection is manual now, DOM should generally be ready, but this is safer.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => sideChat.initialize());
    } else {
      sideChat.initialize();
    }

  })(); // IIFE
} // End of window flag check
