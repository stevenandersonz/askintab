async function initializeSideChat() {
  // Create the main container
  const chatContainer = document.createElement('div');
  const EXT_NAME = "askintab"
  chatContainer.id = 'extension-side-chat';
  // Create shadow DOM
  const shadowRoot = chatContainer.attachShadow({ mode: 'open' });
  mermaid.initialize({ 
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose', // May be needed for shadow DOM
  });  
  // Add HTML content
  shadowRoot.innerHTML = `
    <style>
      /* Container styles */
      #side-chat-container {
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100vh;
        background-color: #1e1e1e;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        z-index: 9999;
        font-family: Arial, sans-serif;
        border-left: 1px solid #333;
        color: #e0e0e0;
      }
      
      /* Badge container */
      .badge-container {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
        position: relative;
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
        z-index: 10000;
        overflow: hidden;
      }
      
      .badge-menu.active {
        display: block;
      }
      
      .badge-menu-item {
        padding: 6px 10px;
        font-size: 12px;
        color: #d0d0d0;
        cursor: pointer;
      }
      
      .badge-menu-item:hover {
        background-color: #3a3a3a;
      }
      
      /* Highlight badge */
      .highlight-badge {
        display: none;
        background-color: #333;
        border: 1px solid #444;
        border-radius: 3px;
        padding: 2px 6px;
        font-size: 11px;
        color: #b0b0b0;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        height: 20px;
        align-items: center;
      }
      
      .highlight-badge.active {
        display: flex;
      }
      
      .highlight-badge-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }
      
      .highlight-badge-text:hover {
        color: #e0e0e0;
        text-decoration: underline;
      }
      
      .highlight-badge-close {
        background: none;
        border: none;
        color: #777;
        font-size: 12px;
        cursor: pointer;
        margin-left: 4px;
        padding: 0 2px;
      }
      
      .highlight-badge-close:hover {
        color: #aaa;
      }
      
      /* Header styles */
      .chat-header {
        padding: 15px;
        background-color: #252525;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .chat-header h3 {
        margin: 0;
        font-size: 16px;
        color: #e0e0e0;
      }
      
      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        color: #b0b0b0;
      }
      
      /* Messages area */
      .chat-messages {
        flex: 1;
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
        width: 100%;
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
      }
      
      /* Highlighted text in user message */
      .highlight-text {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #555;
        font-style: italic;
        color: #a0a0a0;
        cursor: pointer;
      }
      
      .highlight-text:hover {
        text-decoration: underline;
        color: #b8b8b8;
      }
      
      /* Assistant message style (plain text) */
      .assistant-message {
        align-self: flex-start;
        background-color: transparent;
        padding: 0;
      }
      
      /* Typing indicator */
      .typing-indicator {
        display: flex;
        align-items: center;
        align-self: flex-start;
        padding: 0;
        margin-top: 5px;
        height: 20px;
      }
      
      .typing-dot {
        width: 5px;
        height: 5px;
        margin: 0 2px;
        background-color: #888;
        border-radius: 50%;
        opacity: 0.6;
        animation: typing-animation 1.2s infinite ease-in-out;
      }
      
      .typing-dot:nth-child(1) {
        animation-delay: 0s;
      }
      
      .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      @keyframes typing-animation {
        0%, 50%, 100% {
          opacity: 0.4;
        }
        25% {
          opacity: 1;
        }
      }

      /* Input area */
      .chat-input-container {
        position: relative;
        padding: 15px;
        background-color: #252525;
        border-top: 1px solid #333;
      }
      
      /* Using a high specificity selector to ensure styles are applied */
      #side-chat-container .chat-input {
        width: 100% !important;
        padding: 10px 40px 40px 10px !important; /* Increased bottom padding for controls */
        border: 1px solid #444 !important;
        border-radius: 4px !important;
        outline: none !important;
        font-size: 14px !important;
        min-height: 100px !important; /* Increased height to accommodate controls */
        resize: vertical !important;
        font-family: Arial, sans-serif !important;
        background-color: #2a2a2a !important; /* Slightly lighter for better contrast */
        color: #e0e0e0 !important;
        box-sizing: border-box !important;
        line-height: 1.4 !important;
        margin: 0 !important;
      }
      
      #side-chat-container .chat-input::placeholder {
        color: #999 !important;
      }
      
      /* Model selector (positioned inside text area) */
      .model-selector {
        position: absolute !important;
        bottom: 25px !important;
        left: 25px !important;
        width: auto !important;
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
        padding-right: 20px !important;
        opacity: 0.7 !important;
        transition: opacity 0.2s !important;
      }
      
      .model-selector:hover {
        opacity: 1 !important;
      }
      
      .model-selector option {
        background-color: #333 !important;
        color: #e0e0e0 !important;
      }
      
      /* Send button (positioned inside text area) */
      .send-btn {
        position: absolute !important;
        bottom: 25px !important;
        right: 25px !important;
        background-color: #333 !important;
        color: #999 !important;
        border: none !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        opacity: 0.7 !important;
        transition: opacity 0.2s !important;
      }
      
      .send-btn:hover {
        opacity: 1 !important;
      }
      
      /* Remove the arrow content */
      .send-btn:before {
        content: '' !important;
      }
      
      .chat-hidden {
        display: none;
      }
      
      /* Code block styling */
      .assistant-message pre {
        background-color: #252525;
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
        margin: 8px 0;
        font-family: monospace;
        font-size: 12px;
      }
      
      .assistant-message code {
        background-color: #2a2a2a;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 12px;
      }
      
      /* Highlight popover */
      .highlight-popover {
        position: absolute;
        visibility: hidden;
        background-color: #252525;
        color: white;
        width: 90px;
        height: 18;
        border-radius: 2px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 14px;
        font-weight: normal;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        z-index: 9997;
        padding: 3px 5px;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
      
      /* Scrollbar styling */
      ::-webkit-scrollbar {
        width: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: #1e1e1e;
      }
      
      ::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: #666;
      }
    </style>
    
    <!-- Main container -->
    <div id="side-chat-container" class="chat-hidden">
      <div class="chat-header">
        <h3>AI Chat</h3>
        <button class="close-btn">✕</button>
      </div>
      
      <div class="chat-messages"></div>
      
      <div class="chat-input-container">
        <div class="badge-container">
          <div class="add-badge-btn">+</div>
          <div class="badge-menu">
            <div class="badge-menu-item" data-type="code">Code</div>
            <div class="badge-menu-item" data-type="explain">Explain</div>
            <div class="badge-menu-item" data-type="summarize">Summarize</div>
            <div class="badge-menu-item" data-type="translate">Translate</div>
            <div class="badge-menu-item" data-type="improve">Improve</div>
          </div>
          <div class="highlight-badge">
            <span class="highlight-badge-text"></span>
            <button class="highlight-badge-close">×</button>
          </div>
        </div>
        <textarea class="chat-input" placeholder="Ask me anything..."></textarea>
        <select class="model-selector">
        </select>
        <button class="send-btn">Submit</button>
      </div>
    </div>
    
    <!-- Highlight popover -->
    <div class="highlight-popover">add to chat</div>
  `;
 
  // Add the container to the document
  document.body.appendChild(chatContainer);
  
  // Get references to elements
  const sideChatContainer = shadowRoot.querySelector('#side-chat-container');
  const closeButton = shadowRoot.querySelector('.close-btn');
  const chatInput = shadowRoot.querySelector('.chat-input');
  const sendButton = shadowRoot.querySelector('.send-btn');
  const chatMessages = shadowRoot.querySelector('.chat-messages');
  const modelSelector = shadowRoot.querySelector('.model-selector');
  const popover = shadowRoot.querySelector('.highlight-popover');
  const highlightBadge = shadowRoot.querySelector('.highlight-badge');
  const highlightBadgeText = shadowRoot.querySelector('.highlight-badge-text');
  const highlightBadgeClose = shadowRoot.querySelector('.highlight-badge-close');
  const addBadgeBtn = shadowRoot.querySelector('.add-badge-btn');
  const badgeMenu = shadowRoot.querySelector('.badge-menu');
  
  // Initialize chat visibility - by default show the chat and push content
  sideChatContainer.classList.remove('chat-hidden');
  
  // Default state: push content right away since chat is visible by default
  document.body.style.transition = 'padding-right 0.3s ease';
  document.body.style.paddingRight = '400px';
  // Store message data including highlights
  const state = {
    messages: [],
    currentMessage: { 
      input: "", 
      highlight: {text: "", range: null},
      badges: []
    },
    currentHighlight: { range: null, text: "" }
  } 

  let models = await chrome.runtime.sendMessage({ action: "GET_MODELS" })
  console.log(models)
  modelSelector.innerHTML = ""
  for(let model of models){
    let option = document.createElement("option")
    option.value = model
    option.innerHTML = model
    modelSelector.appendChild(option)
  }

  // Function to create typing indicator
  function createTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'typing-dot';
      typingIndicator.appendChild(dot);
    }
    
    return typingIndicator;
  }
  
  // Function to show typing indicator
  function showTypingIndicator() {
    const existingIndicator = shadowRoot.querySelector('.typing-indicator');
    if (existingIndicator) return
    const typingIndicator = createTypingIndicator();
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Function to remove typing indicator
  function hideTypingIndicator() {
    const typingIndicator = shadowRoot.querySelector('.typing-indicator');
    if (!typingIndicator) return
    typingIndicator.remove();
  }
  
  // Function to close chat completely
  function closeChat() {
    chatContainer.style.display = 'none';
    document.body.style.transition = 'padding-right 0.3s ease';
    document.body.style.paddingRight = '0';
  }

  function getElementPath(node) {
    const path = [];
    let current = node; 
    while (current) {
      if (current.tagName === "BODY") break
      const index = Array.prototype.indexOf.call(current.parentElement.childNodes, current);
      path.unshift(index);
      current = current.parentElement;
    }
    return path;
  }

  function findNodeByPath(path) {
    let current = document.body;
    for (let index of path) {
      current = current.childNodes[index];
    }
    return current; // Fallback to element if no text node
  }

  const serializedRange = (range) => ({
    startContainerPath: getElementPath(range.startContainer),
    startOffset: range.startOffset,
    endContainerPath: getElementPath(range.endContainer),
    endOffset: range.endOffset
  }); 
  
  // Function to update highlight badge
  function updateHighlightBadge() {
    if (state.currentMessage.highlight && state.currentMessage.highlight.text) {
      const text = state.currentMessage.highlight.text;
      highlightBadgeText.textContent = text.length > 15 ? text.substring(0, 15) + '...' : text;
      highlightBadge.classList.add('active');
    } else {
      highlightBadge.classList.remove('active');
    }
  }
  
  // Function to highlight text in the document based on range data
  function highlightTextInDocument(rangeData) {
    if (!rangeData) return;
    
    const { startContainerPath, startOffset, endContainerPath, endOffset } = rangeData;
    try {
      const startNode = findNodeByPath(startContainerPath);
      const endNode = findNodeByPath(endContainerPath);
      
      if (!startNode || !endNode) {
        console.error('Could not find nodes for highlighting');
        return;
      }
      
      const range = document.createRange();
      range.setStart(startNode, Math.min(startOffset, startNode.length || 0));
      range.setEnd(endNode, Math.min(endOffset, endNode.length || 0));
  
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Scroll into view if needed
      const rect = range.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        window.scrollTo({
          top: window.scrollY + rect.top - 100,
          behavior: 'smooth'
        });
      }
    } catch (error) {
      console.error('Failed to highlight text:', error);
    }
  }
  
  // Make the highlight badge text clickable
  highlightBadgeText.addEventListener('click', () => {
    if (state.currentMessage.highlight && state.currentMessage.highlight.range) {
      highlightTextInDocument(state.currentMessage.highlight.range);
    }
  });
  
  // Function to add a message to the chat
  function addMessage(messageData, isUser = false) {
    // Store the message data
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
    
    if (isUser) {
      // For user messages, show input text and highlighted text
      let messageContent = '';
      
      // Add badges as prefixes if available
      if (messageData.badges && messageData.badges.length > 0) {
        messageContent += messageData.badges.map(badge => `[${badge.text}]`).join(' ') + ' ';
      }
      
      // Add user input
      messageContent += messageData.input || '';
      
      const inputText = document.createElement('div');
      inputText.textContent = messageContent;
      messageElement.appendChild(inputText);
      
      // Add highlighted text if available
      if (messageData.highlight.text) {
        const highlightElement = document.createElement('div');
        highlightElement.className = 'highlight-text';
        highlightElement.textContent = messageData.highlight.text;
        highlightElement.addEventListener('click', () => {
          highlightTextInDocument(messageData.highlight.range);
        });
        messageElement.appendChild(highlightElement);
      }

      
      // Update highlight badge
      updateHighlightBadge();
    } else {
      // For assistant messages, support basic markdown-like formatting
      const responseElement = document.createElement('div');
      // Configure marked to handle mermaid code blocks
      marked.use({
        renderer: {
          code(tokens) {
            console.log(tokens)
            if (tokens.lang === 'mermaid') {
              return `<div class="mermaid">${tokens.text}</div>`;
            }
            return `<pre><code class="language-${tokens.lang}">${tokens.raw}</code></pre>`;
          }
        }
      });
      responseElement.innerHTML = marked.parse(messageData.raw);
      messageElement.appendChild(responseElement);
      
      // Process any mermaid diagrams after the message is added to DOM
      setTimeout(() => {
        const mermaidDivs = responseElement.querySelectorAll('.mermaid');
        if (mermaidDivs.length > 0) {
          mermaidDivs.forEach((mermaidDiv, index) => {
            try {
              // Create a unique ID for each mermaid diagram
              const id = `mermaid-diagram-${Date.now()}-${index}`;
              mermaidDiv.id = id;
              
              // Render the mermaid diagram
              mermaid.render(id, mermaidDiv.textContent).then(result => {
                mermaidDiv.innerHTML = result.svg;
              }).catch(error => {
                console.error('Mermaid rendering error:', error);
                mermaidDiv.innerHTML = `<pre>Error rendering diagram: ${error.message}</pre>`;
              });
            } catch (e) {
              console.error('Error processing mermaid diagram:', e);
            }
          });
        }
      }, 100); // Small delay to ensure DOM is updated
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Function to handle sending a message
  async function sendMessage() {
    const inputText = chatInput.value.trim();
    
    // Don't send if no content (unless we have badges or highlights)
    if (!inputText && !state.currentMessage.highlight.text && state.currentMessage.badges.length === 0) return;
    state.currentMessage = { ...state.currentMessage, input: inputText };
    chatInput.value = "";
    addMessage(state.currentMessage, true);
    const selectedModel = modelSelector.value;
    showTypingIndicator();
    let res = await chrome.runtime.sendMessage({ action: "REQUEST", payload: {model: selectedModel, ...state.currentMessage} })
    console.log("sendMessage")
    console.log(res)
    state.messages.push(state.currentMessage);
    state.currentMessage = { 
      input: "", 
      highlight: {text: "", range: null},
      badges: []
    };
    
    // Simulate response with typing animation
  }
    
  
  // Event listeners
  closeButton.addEventListener('click', closeChat);
  sendButton.addEventListener('click', () => {
    sendMessage();
  });
  
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent new line
      sendButton.click();
    }
  });
  // Update the current message input as the user types
  chatInput.addEventListener('input', (e) => {
    state.currentMessage.input = e.target.value.trim();
  });
  
  // Clear the highlight when the close button is clicked
  highlightBadgeClose.addEventListener('click', () => {
    state.currentMessage.highlight = { text: "", range: null };
    updateHighlightBadge();
  });
  
  document.addEventListener("mouseup", async (event) => {
    const selection = window.getSelection();
    if (selection.rangeCount >= 1 && selection.toString().trim().length > 0) {
      let range = selection.getRangeAt(0)
      let text = selection.toString().trim()
      if (text.length > 0) {
        // Position the popover at the right bottom corner of the selection
        const rect = range.getBoundingClientRect();
        popover.style.position = 'absolute';
        popover.style.top = `${rect.bottom + window.scrollY}px`;
        popover.style.left = `${rect.right + window.scrollX - popover.offsetWidth}px`;
        popover.style.visibility = 'visible';
        
        // Serialize the range and update the current highlight state
        range = serializedRange(range);
        state.currentHighlight = { range, text };
      }
    } else {
      popover.style.visibility = 'hidden'
    }
  });
  popover.addEventListener('click', (evt) => {
    state.currentMessage.highlight = {...state.currentHighlight}
    state.currentHighlight = { range: null, text:"" }
    popover.style.visibility = 'hidden'
    
    // Update the highlight badge
    updateHighlightBadge();
  });

  // Badge menu toggle
  addBadgeBtn.addEventListener('click', (e) => {
    badgeMenu.classList.toggle('active');
    e.stopPropagation();
  });
  
  // Close menu when clicking elsewhere
  document.addEventListener('click', () => {
    badgeMenu.classList.remove('active');
  });
  
  // Prevent clicks inside menu from closing it
  badgeMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Add custom badges when menu items are clicked
  const menuItems = shadowRoot.querySelectorAll('.badge-menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const badgeType = item.dataset.type;
      const badgeText = item.textContent;
      
      // Add badge to state
      state.currentMessage.badges.push({
        type: badgeType,
        text: badgeText
      });
      
      // Log the updated state
      console.log('Added badge:', badgeType, badgeText);
      console.log('Current message state:', state.currentMessage);
      
      // Close the menu
      badgeMenu.classList.remove('active');
    });
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "RESPONSE") {
      console.log(msg.payload)
      hideTypingIndicator();
      addMessage(msg.payload, false)
    }
  })
}
// Initialize the side chat when the page is loaded


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSideChat);
} else {
  initializeSideChat();
}
