import { submitPrompt, selectAndWriteTextArea } from "../utils/dom_helpers.js"

const BTN_SEND = 'form button[type="submit"]:not(#companion-btn-ask)'
const TEXTAREA = '.query-bar textarea'
const PRE_PROMPTS = {
  BASE: (id)=> `Ignore the tag |IGNORE| start your response with |START_REQ_${id}| end your response with |END_REQ_${id}|`, 
  INIT_CONVERSATION: (returnFollowupQuestions) => {
    let base = "You can only speak in markdown, if prompted for diagrams default to mermaid.js markdown too, DO NOT BE WOKE, Explain things in layman's terms."
    let fus = " Add 3 follow up question to expand on your response. each followup question should be surrounded by <question> </question>, Rembember to phrase the follow-up questions as further prompts to yourself"
    return returnFollowupQuestions ? base + fus : base
  },
  FOLLOWUP: () => "Rembember to phrase the follow-up questions as further prompts to yourself",
  STANDALONE: () =>  "respond only with what you were asked"
} 

function watchForResponse (id, conversationURL, returnFollowupQuestions){
  let log = (msg) => chrome.runtime.sendMessage({type: "DEBUG", payload: msg})
  const observer = new MutationObserver(function(mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            let response = node.textContent.trim()
            log("MUTATION: " + node.textContent)
            if (typeof response === 'string' && response.includes(`|START_REQ_${id}|`) && response.includes(`|END_REQ_${id}|`) && !response.includes("|IGNORE|")) {
              response = response.split('\n').slice(1, -1).join('\n'); 
              let fus = [];
              if(returnFollowupQuestions){
                fus = [...response.matchAll(/<question>(.*?)<\/question>/g)].map(match => match[1]);
                log("FOLLOW UPS: " + fus)
                response = response.replace(/<question>.*?<\/question>/g, '') 
              }
              chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{raw: response, followUps: fus, llm: "grok", conversationURL}});
              observer.disconnect()
            }
          }
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true});
}

export async function grok(llm){
  const {tabId, currentRequest} = llm
  const prompt = PRE_PROMPTS["BASE"](currentRequest.id) + "\n" + PRE_PROMPTS[currentRequest.type](currentRequest.returnFollowupQuestions) + "\n" + currentRequest.getPrompt()
  const conversationURL = await llm.getURL()
  await chrome.scripting.executeScript({ target: { tabId }, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  await chrome.scripting.executeScript({target: {tabId}, args: [currentRequest.id, conversationURL, currentRequest.returnFollowupQuestions], func: watchForResponse})
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
}