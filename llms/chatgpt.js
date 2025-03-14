import {selectAndWriteTextArea, submitPrompt} from "../utils/dom_helpers.js"
const BTN_SEND = 'button[data-testid="send-button"]'
const TEXTAREA = '#prompt-textarea'
const DEBUG = true

function watchForResponse (DEBUG){
  const observer = new MutationObserver(function(mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            console.log("title" + document.title)
            let response = node.textContent.trim()
            let watchFor = response.startsWith("ChatGPTNew") ? "ChatGPTNew chat" : "ChatGPT" + document.title 
            // When ChatGPT is done writing a reponse it triggers a mutation with the whole text prependend with "chatGPT"+title
            if(DEBUG) console.log("MUTATION: " + node.textContent)
            if (response.startsWith(watchFor)) {
              if(DEBUG) console.log("SENDING TEXT: ")
              chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{raw: response.slice(watchFor.length), llm: "chatgpt"}});
              observer.disconnect()
            }
          }
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true});
}
if (DEBUG) console.log("IMPORTING CHATGPT")
export async function chatGPT(llm){
  const {tabId, currentRequest} = llm
  const basePrompt = await llm.getPrompt()
  await chrome.scripting.executeScript({ target: { tabId }, args: [TEXTAREA, currentRequest.annotation.getPrompt(basePrompt)], func: selectAndWriteTextArea})
  if(DEBUG) console.log('PROMPT SET INTO TEXTAREA')
  await chrome.scripting.executeScript({target: {tabId}, args: [DEBUG], func: watchForResponse})
  if(DEBUG) console.log('SETTING OBSERVER')
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
  if(DEBUG) console.log('PROMPT SUBMITTED')

}