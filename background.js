const LLMSETUP = {
  chatgpt: {
    btnSend: 'button[data-testid="send-button"]',
    textArea: '#prompt-textarea',
    responseStartsWith: "ChatGPTDOM"
  }
} 
const LLM = "chatgpt"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LLM_RESPONSE") {
    console.log(message.text)
    chrome.tabs.sendMessage(message.targetId, { type: "LLM_RESPONSE", text: message.text })
  }
  if (message.type === "PROMPT_SENT") {
    console.log("PROMPT was sent to llm")
  }
  if (message.type === "NEW_NODE") {
    console.log("NEW NODE")
    console.log(message.text)
  }
  if (message.type === "ASK_QUESTION") {
      const targetDomain = "chatgpt.com"; 

      chrome.tabs.query({}, (tabs) => {
          const targetTab = tabs.find(tab => tab.url.includes(targetDomain) && !tab.active);
          console.log(sender);
          if (targetTab) {
              chrome.scripting.executeScript({
                  target: { tabId: targetTab.id },
                  func: injectFunctions,
                  args: [message.text, sender.tab.id, LLMSETUP[LLM]]
              });
              console.log("Sent text to inactive tab:", targetTab.id, targetTab.url);
          } else {
              console.log("No matching inactive tab found.");
          }
      });
  }
    if (message.type === "RETURN_RESPONSE") {
        console.log("return message heard in background")
    
    }
});
// Injects both `pasteTextAndSend` and `monitorResponseCompletion`
function injectFunctions(text, senderId, UI) {
    function pasteTextAndSend(text, senderId) {
        console.log("Pasting text into the textarea...");

        observeConversation()
        const textarea = document.querySelector(UI.textArea);
        if (!textarea) {
            console.log("Textarea not found.");
            return;
        }

        textarea.innerHTML = `${text}`;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        console.log("Text pasted successfully!");

        function findAndClickButton(retries = 5) {
            const sendButton = document.querySelector(UI.btnSend);
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
