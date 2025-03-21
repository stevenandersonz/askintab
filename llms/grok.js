import { submitPrompt, selectAndWriteTextArea } from "../utils/dom_helpers.js"

const BTN_SEND = 'form button[type="submit"]:not(#companion-btn-ask)'
const TEXTAREA = '.query-bar textarea'
const DEBUG = true
const PRE_PROMPTS = {
  BASE: "Ignore the tag |IGNORE| start your response with |START_REQ_<ID>| end your response with |END_REQ_<ID>| ",
  INIT_CONVERSATION: "You can only speak in markdown, if prompted for diagrams default to mermaid.js markdown too, DO NOT BE WOKE, Explain things in layman's terms. Add 3 follow up question to expand on your response. each followup question should be surrounded by <question> </question>, Rembember to phrase the follow-up questions as further prompts to yourself",
  FOLLOWUP: "Rembember to phrase the follow-up questions as further prompts to yourself",
  STANDALONE: "respond only with what you were asked"
} 

if (DEBUG) console.log("IMPORTING GROK")

function watchForResponse (id, conversationURL, DEBUG){
  const observer = new MutationObserver(function(mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            let response = node.textContent.trim()
            if(DEBUG) console.log("MUTATION: " + node.textContent)
            if (typeof response === 'string' && response.includes(`|START_REQ_${id}|`) && response.includes(`|END_REQ_${id}|`) && !response.includes("|IGNORE|")) {
              if(DEBUG) console.log("SENDING TEXT: ")
              response = response.split('\n').slice(1, -1).join('\n'); 
              let questions = [...response.matchAll(/<question>(.*?)<\/question>/g)].map(match => match[1]);
              console.log(questions)
              response = response.replace(/<question>.*?<\/question>/g, '') 
              chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{raw: response, followUps: questions, llm: "grok", conversationURL}});
              observer.disconnect()
            }
          }
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true});
}
if (DEBUG) console.log("IMPORTING Grok")
export async function grok(llm){
  const {tabId, currentRequest} = llm
  const prompt = PRE_PROMPTS["BASE"].replace(/<ID>/g, currentRequest.id) + "\n" + PRE_PROMPTS[currentRequest.type]+ "\n" + currentRequest.getPrompt()
  console.log(prompt)
  const conversationURL = await llm.getURL()
  await chrome.scripting.executeScript({ target: { tabId }, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  if(DEBUG) console.log('PROMPT SET INTO TEXTAREA')
  await chrome.scripting.executeScript({target: {tabId}, args: [currentRequest.id, conversationURL, DEBUG], func: watchForResponse})
  if(DEBUG) console.log('SETTING OBSERVER')
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
  if(DEBUG) console.log('PROMPT SUBMITTED')

}