const BTN_SEND = 'button[data-testid="send-button"]'
const TEXTAREA = '#prompt-textarea'
const DEBUG = true
if (DEBUG) console.log("IMPORTING CHATGPT")
export function chatGPT(tabId, senderId, annotation){
  if(DEBUG) console.log(`INITIALIZNG CHATGPT: TAB ${tabId} - SENDER ${senderId} - ANNOTATION: ${annotation}`)
  //todo: chatgpt doesnt require a debugger
  chrome.debugger.attach({ tabId }, "1.3", function() {
    if(DEBUG) console.log(`ATTACHED DEBUGGER @ TAB: ${tabId}`)
    handlePrompt(annotation.fullPrompt, tabId)
  })
}

function handlePrompt(prompt, tabId){
  if(DEBUG) console.log(`PROMPT: ${prompt} - TAB ${tabId}`)
  chrome.scripting.executeScript({
    target: { tabId },
    args: [TEXTAREA],
    func: function (selector) {
      let textArea = document.querySelector(selector);
      if (textArea){
        if(DEBUG) console.log('FOUND TEXTAREA')
        textArea.focus();
      } 
    }},

    async () => {
      await new Promise(resolve => 
        chrome.debugger.sendCommand(
          { tabId },
          "Input.insertText",
          { text: prompt },
          resolve
        )
      );

      if(DEBUG) console.log('PROMPT INSERTED')

      chrome.scripting.executeScript({
        target: { tabId },
        args: [BTN_SEND],
        func: function(selector) {
          let btnSend = document.querySelector(selector);
          if (btnSend){
            const observer = new MutationObserver(function(mutationsList) {
              for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                  mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                      let watchFor = "ChatGPT" + document.title
                      // When ChatGPT is done writing a reponse it triggers a mutation with the whole text prependend with "chatGPT"+title
                      if (node.textContent.trim().startsWith(watchFor)) {
                        chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload: node.textContent.trim().slice(watchFor.length) });
                        observer.disconnect()
                      }
                    }
                  });
                }
              }
            });
            observer.observe(document.body, { childList: true, subtree: true, characterData: true});
            btnSend.click();
          } 
        }
      }, function() {
          if(DEBUG) console.log('BTN_SENT CLICKED')
          if(DEBUG) console.log('DETACHING DEBUGGER')
          chrome.debugger.detach({ tabId }) 
      });
    }
  );
}