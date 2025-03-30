// Create and initialize the side chat interface
function initializeSideChat() {
  // Create the main container
  const chatContainer = document.createElement('div');
  const EXT_NAME = "askintab"
  chatContainer.id = 'extension-side-chat';
  
  // Create shadow DOM
  const shadowRoot = chatContainer.attachShadow({ mode: 'closed' });
  
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
      
      /* Model selector styles */
      .model-selector-container {
        padding: 10px 15px;
        background-color: #252525;
        border-bottom: 1px solid #333;
      }
      
      .model-selector {
        width: 100%;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid #444;
        background-color: #333;
        color: #e0e0e0;
        font-size: 14px;
      }
      
      .model-selector option {
        background-color: #333;
        color: #e0e0e0;
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
        padding: 15px;
        border-top: 1px solid #333;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background-color: #252525;
      }
      
      /* Using a high specificity selector to ensure styles are applied */
      #side-chat-container .chat-input {
        width: 100% !important;
        padding: 10px !important;
        border: 1px solid #444 !important;
        border-radius: 6px !important;
        outline: none !important;
        font-size: 14px !important;
        min-height: 80px !important;
        resize: vertical !important;
        font-family: Arial, sans-serif !important;
        background-color: #333 !important;
        color: #e0e0e0 !important;
        box-sizing: border-box !important;
        line-height: 1.4 !important;
        margin: 0 !important;
      }
      
      #side-chat-container .chat-input::placeholder {
        color: #999 !important;
      }
      
      .send-button-container {
        display: flex;
        justify-content: flex-end;
      }
      
      .send-btn {
        background-color: #4c7eff;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .send-btn:hover {
        background-color: #3a68e0;
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
      
      /* Scrollbar styling */
      .chat-messages::-webkit-scrollbar {
        width: 8px;
      }
      
      .chat-messages::-webkit-scrollbar-track {
        background: #1e1e1e;
      }
      
      .chat-messages::-webkit-scrollbar-thumb {
        background-color: #444;
        border-radius: 4px;
      }
      
      .chat-messages::-webkit-scrollbar-thumb:hover {
        background-color: #555;
      }
    </style>
    
    <button class="toggle-chat-btn">💬</button>
    
    <div id="side-chat-container" class="chat-hidden">
      <div class="chat-header">
        <h3>AI Assistant</h3>
        <button class="close-btn">✕</button>
      </div>
      
      <div class="model-selector-container">
        <select class="model-selector">
          <option value="GPT-3.5">GPT-3.5</option>
          <option value="GPT-4" selected>GPT-4</option>
          <option value="Claude">Claude</option>
          <option value="Gemini">Gemini</option>
          <option value="Llama">Llama 3</option>
        </select>
      </div>
      
      <div class="chat-messages"></div>
      
      <div class="chat-input-container">
        <textarea class="chat-input" placeholder="Type your message..."></textarea>
        <div class="send-button-container">
          <button class="send-btn">Send</button>
        </div>
      </div>
    </div>
    <div class="highlight-popover" style="
        position: absolute;
        width: 24px;
        display: none;
        height: 24px;
        background-color: black;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        visibility: hidden;
        justify-content: center;
        align-items: center;
        color: white;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 9999;"> +
    </div>
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
  
  // Initialize chat visibility - by default show the chat and push content
  sideChatContainer.classList.remove('chat-hidden');
  
  // Default state: push content right away since chat is visible by default
  document.body.style.transition = 'padding-right 0.3s ease';
  document.body.style.paddingRight = '400px';
  // Store message data including highlights
  const state = {
    messages: [],
    currentMessage: { input: "", highlight: {text: "", range: null} },
    currentHighlight: { text: "", range: null }
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
    removeSelectionToolbar();
  }

  function getClassName(className){
    if(Array.isArray(className)) return className.map(cls => EXT_NAME + '-' + cls).join(" ")
    if(typeof className === 'string') return EXT_NAME + '-' + className
  }

  const highlight = document.createElement("span");
  highlight.className = getClassName("selection");


  function createHighlight(range, id="pending"){
    clonedHighlight = highlight.cloneNode()
    clonedHighlight.id = getClassName("request-"+id)
    let extractedContents = range.extractContents();
    clonedHighlight.appendChild(extractedContents);
    range.insertNode(clonedHighlight);
    return clonedHighlight 
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
  
  // Function to add a message to the chat
  function addMessage(messageData, isUser = false) {

    // Store the message data
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
    
    if (isUser) {
      // For user messages, show input text and highlighted text
      const inputText = document.createElement('div');
      inputText.textContent = messageData.input || '';
      messageElement.appendChild(inputText);
      
      // Add highlighted text if available
      if (messageData.highlight.text) {
        const highlightElement = document.createElement('div');
        highlightElement.className = 'highlight-text';
        highlightElement.textContent = messageData.highlight.text;
        highlightElement.addEventListener('click', (evt) => {
          console.log(messageData.highlight)
          const { startContainerPath, startOffset, endContainerPath, endOffset} = messageData.highlight.range;
          console.log(startContainerPath, startOffset, endContainerPath, endOffset)
          const startNode = findNodeByPath(startContainerPath);
          const endNode = findNodeByPath(endContainerPath);
          const range = document.createRange();
          range.setStart(startNode, Math.min(startOffset, startNode.length || 0));
          range.setEnd(endNode, Math.min(endOffset, endNode.length || 0));
      
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        })
        messageElement.appendChild(highlightElement);
        // Store the message index as a data attribute
        messageElement.dataset.messageIndex = state.messages.length - 1;
      }
      state.messages.push(messageData)
      state.currentMessage = { input: "", highlight: {text: "", range: null} };
    } else {
      // For assistant messages, support basic markdown-like formatting
      const responseElement = document.createElement('div');
      responseElement.innerHTML = messageData.response
        .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')  // Code blocks
        .replace(/`([^`]+)`/g, '<code>$1</code>');      // Inline code
      messageElement.appendChild(responseElement);
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
  }
  
  // Function to handle sending a message
  function sendMessage() {
    const inputText = chatInput.value.trim();
    if (!inputText) return;
    state.currentMessage = { ...state.currentMessage, input: inputText }
    chatInput.value = ""
    addMessage(state.currentMessage, true)
    const selectedModel = modelSelector.value;
    showTypingIndicator();
    
    setTimeout(() => {
      hideTypingIndicator();
      let responseText = `This is a demo response
      
You can also include code examples:
\`\`\`javascript
// Sample code
function example() {
  console.log("This is formatted as code");
  return true;
}
\`\`\`

Or inline code like \`const x = 10;\` within text.`;
      
      // Add the response
      addMessage({ response: responseText }, false);
    }, 2000); // Longer delay to show the typing animation
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
    console.log(e.target.value.trim())
    state.currentMessage.input = e.target.value.trim();
  });
  
  document.addEventListener("mouseup", async (event) => {
    const selection = window.getSelection();
    console.log(selection.rangeCount)
    if (selection.rangeCount >= 1 && selection.toString().trim().length > 0) {
      let range = selection.getRangeAt(0)
      let text = selection.toString().trim()
      if (text.length > 0) {
        popover.style.visibility = 'visible';
        const highlightRect = selection.getRangeAt(0).getBoundingClientRect();
        popover.style.left = `${window.scrollX + highlightRect.right + 5}px`;
        popover.style.bottom = `${window.innerHeight - (window.scrollY + highlightRect.bottom)}px`;
        range = serializedRange(range)
        state.currentHighlight = { range, text }
      }
    } else {
      const popover = shadowRoot.querySelector('.highlight-popover');
      popover.style.visibility = 'hidden'
    }
  });
  popover.addEventListener('click', (evt) => {
    state.currentMessage.highlight = {...state.currentHighlight}
    state.currentHighlight = { range: null, text:"" }
    console.log(state.currentMessage)
    popover.style.visibility = 'hidden'
  });
}
// Initialize the side chat when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSideChat);
} else {
  initializeSideChat();
}
