import { submitPrompt, selectAndWriteTextArea } from "../helpers.js"

const BTN_SEND = 'form button[type="submit"]:not(#companion-btn-ask)'
const TEXTAREA = '.query-bar textarea'
function watchForResponse (id, returnFollowupQuestions){
  let log = (msg) => chrome.runtime.sendMessage({type: "DEBUG", payload: msg})
  const observer = new MutationObserver(function(mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            let response = node.textContent.trim()
            log("MUTATION: " + node.textContent)
            chrome.runtime.sendMessage({ type: "PING", payload:{name:"grok"}});
            if (typeof response === 'string' && response.includes(`|START_REQ_${id}|`) && response.includes(`|END_REQ_${id}|`) && !response.includes("|IGNORE|")) {
              response = response.split('\n').slice(1, -1).join('\n'); 
              let fus = [];
              if(returnFollowupQuestions){
                fus = [...response.matchAll(/<question>(.*?)<\/question>/g)].map(match => match[1]);
                log("FOLLOW UPS: " + fus)
                response = response.replace(/<question>.*?<\/question>/g, '') 
              }
              chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{response, followupQuestions: fus, name: "grok"}});
              observer.disconnect()
            }
          }
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true});
}

export async function grok(provider, setProviderPrompt){
  const {tabId, currentRequest} = provider
  let id = Math.floor(Math.random() * 1000) + 1
  const prompt = setProviderPrompt(`Ignore the tag |IGNORE| start your response with |START_REQ_${id}| end your response with |END_REQ_${id}|`)
  await chrome.scripting.executeScript({ target: { tabId }, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  await chrome.scripting.executeScript({target: {tabId}, args: [id, currentRequest.llm.returnFollowupQuestions], func: watchForResponse})
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
}