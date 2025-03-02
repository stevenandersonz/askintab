const LLMSETUP = {
  chatgpt: {
    btnSend: 'button[data-testid="send-button"]',
    textArea: '#prompt-textarea'
  }
} 
const LLM = "chatgpt"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STREAMING_COMPLETE") {
    console.log("STREAMING_COMPLETE")
  }
  if (message.type === "STREAMING_RESPONSE") {
    console.log(message.data)
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
                observeConversation()
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
      let timer = null;
      // Adjust this selector to match ChatGPT's conversation container
      const conversationContainer = document.querySelector('div[class*="@container/thread"]'); 
      if (!conversationContainer) {
          console.error("Conversation container not found.");
          return;
      }

      const observer = new MutationObserver((mutationsList) => {
            mutationsList.forEach(mutation => {
              mutation.addedNodes.forEach(node => {
                  if (node.nodeType === Node.ELEMENT_NODE && node.matches('div.prose')) {
                    observeStreamingDiv(node) 
                  }
              });
          });
      });


      observer.observe(conversationContainer, { childList: true, subtree: true });

      function observeStreamingDiv(streamingDiv) {
        const streamObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        clearTimeout(timer);
                        console.log("Added streaming content:", node.textContent.trim());
                        chrome.runtime.sendMessage({
                          type: "STREAMING_RESPONSE",
                          data: node.textContent.trim(),
                          activeTab: senderId
                        })
                    }
                });
            });
            timer = setTimeout(() => {
              console.log("No changes detected for 1000ms. Closing observer.");
              observer.disconnect(); // Stop observing
  
              // Send a message to the background script (or elsewhere)
              chrome.runtime.sendMessage({
                  type: "STREAMING_COMPLETE",
                  data: res // Optionally send the collected nodes or other data
              });
          }, 1000);
        });

        streamObserver.observe(streamingDiv, { childList: true, subtree: true });
      }
    }

    // Start execution in the ChatGPT tab
    pasteTextAndSend(text, senderId);
}
