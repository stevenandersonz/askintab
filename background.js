const LLMSETUP = {
  chatgpt: {
    btnSend: 'button[data-testid="send-button"]',
    textArea: '#prompt-textarea',
    responseStartsWith: "ChatGPT",
  },
  grok: {
    domain: "grok.com",
    btnSend: 'form button[type="submit"]:not(#companion-btn)',
    textArea: 'form textarea:not(#companion-textarea)',
    responseStartsWith: "ChatGPT"
  }
} 
const LLM = "grok"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LLM_RESPONSE") {
      console.log("SENDING LLM RESPONSE TO ACTIVE TAB");
      chrome.tabs.sendMessage(message.targetId, { type: "LLM_RESPONSE", payload: message.text });
  }
  if (message.type === "PROMPT_REQUEST") {
      console.log("SENDING PROMPT TO LLM")
      chrome.tabs.query({}, (tabs) => {
          const targetTab = tabs.find(tab => tab.url.includes(LLMSETUP[LLM].domain) && !tab.active);
          console.log(sender);
          if (targetTab) {
              chrome.scripting.executeScript({
                  target: { tabId: targetTab.id },
                  func: injectFunctions,
                  args: [message.payload, sender.tab.id, LLMSETUP[LLM]]
              });
              console.log("Sent text to inactive tab:", targetTab.id, targetTab.url);
          } else {
              console.log("No matching inactive tab found.");
          }
      });
  }
});
// Injects both `pasteTextAndSend` and `monitorResponseCompletion`
function injectFunctions(text, senderId, UI) {
    function pasteTextAndSend(text, senderId) {
        console.log("Pasting text into the textarea...");
        observeConversation()
        const textarea = document.querySelector(UI.textArea)
        console.log(textarea)
        if (!textarea) {
            console.log("Textarea not found.");
            return;
        }

        textarea.innerHTML = `${text}`;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        console.log("Text pasted successfully!");

        function findAndClickButton(retries = 5) {
            const sendButton = document.querySelector(UI.btnSend);
            console.log(sendButton)
            if (sendButton) {
                console.log("Clicking the send button...");
                sendButton.click();
                chrome.runtime.sendMessage({
                    type: "PROMPT_SENT",
                    activeTab: senderId
                })
            } else if (retries > 0) {
                console.log(`Send button not found, retrying (${retries} left)...`);
                setTimeout(() => findAndClickButton(retries - 1), 500);
            } else {
                console.log("Send button not found after retries.");
            }
        }

        setTimeout(() => findAndClickButton(), 500);
    }

    function observeConversation() {
      const targetNode = document.body;
      const config = { childList: true, subtree: true, characterData: true };
    
      const callback = function(mutationsList) {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                const text = node.textContent.trim();
                console.log(text)
                if (text.startsWith(UI.responseStartsWith)) {
                  console.log("SENDING TEXT to BG")
                  chrome.runtime.sendMessage({ type: "LLM_RESPONSE", text, targetId: senderId });
                }
              }
            });
          } 
        }
      };
    
      const observer = new MutationObserver(callback);
      observer.observe(targetNode, config);
    }
    // Start execution in the ChatGPT tab
    pasteTextAndSend(text, senderId);
}

// --- HANDLE Right click over selection and shows ask ai option
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
      id: "annotateText",
      title: "Annotate Selection",
      contexts: ["selection"] // Ensures it only appears when text is selected
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "annotateText" && info.selectionText) {
      chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: annotateSelection,
          args: [info.selectionText]
      });
  }
});

function annotateSelection(selectedText) {
  const EXT_NAME = "companion"
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    let range = selection.getRangeAt(0)
    let span = document.createElement("span");
    span.className = EXT_NAME + "-pending";

    // Extract the selected content and append it to the span
    let extractedContents = range.extractContents();
    span.appendChild(extractedContents);

    // Insert the span back into the document
    range.insertNode(span);

    let prompterContainer = document.querySelector(`.${EXT_NAME}-container`)
    let prompterInput = document.querySelector(`.${EXT_NAME}-textarea`)
    let selectionSpan = document.querySelector(`.${EXT_NAME}-pending`)
    if(prompterContainer){
      selectionSpan.classList.add(EXT_NAME + "-selection-effect")
      prompterContainer.style.display = "block"
      prompterInput.focus()
    }
  }
  // Perform the annotation action
}
