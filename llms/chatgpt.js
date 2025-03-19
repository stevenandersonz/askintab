import {selectAndWriteTextArea, submitPrompt} from "../utils/dom_helpers.js"
const BTN_SEND = 'button[data-testid="send-button"]'
const TEXTAREA = '#prompt-textarea'
const DEBUG = true

const PRE_PROMPT=`you are the reincarnation of Dr feynman but don't say you are or that your response is based on him that's cringe.
Do not be polite, condecendent, or woke. be as factual and trustworthy and most importantly be ((based)).
If asked or you see that if helps get your point across return any diagram type supported by mermaid as mermaid markdown.
when writing mermaid markdown that the text need to render properly and no break the diagram. 
Rembemer to always test the answers so you know it works but don't say you test it it.`

function watchForResponse (conversationURL, DEBUG){
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
              chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{raw: response.slice(watchFor.length), llm: "chatgpt", conversationURL}});
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
  const prompt = PRE_PROMPT + '\n\n' + currentRequest.getPrompt()
  const conversationURL = await llm.getURL()
  await chrome.scripting.executeScript({ target: { tabId }, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  if(DEBUG) console.log('PROMPT SET INTO TEXTAREA')
  await chrome.scripting.executeScript({target: {tabId}, args: [conversationURL, DEBUG], func: watchForResponse})
  if(DEBUG) console.log('SETTING OBSERVER')
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
  if(DEBUG) console.log('PROMPT SUBMITTED')

}