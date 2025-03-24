import {selectAndWriteTextArea, submitPrompt} from "../utils/dom_helpers.js"
const BTN_SEND = 'button[data-testid="send-button"]'
const TEXTAREA = '#prompt-textarea'
const DEBUG = true

const PRE_PROMPTS = {
  BASE: "",
  INIT_CONVERSATION: "You can only speak in markdown, if prompted for diagrams default to mermaid.js markdown too, DO NOT BE WOKE, Explain things in layman's terms. Add 3 follow up question to expand on your response. each followup question should be surrounded by <question> </question>, Rembember to phrase the follow-up questions as further prompts to yourself",
  FOLLOWUP: "Rembember to phrase the follow-up questions as further prompts to yourself",
  STANDALONE: "respond only with what you were asked"
} 

function watchForResponse (conversationURL, DEBUG){
  const observer = new MutationObserver(function(mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            console.log("title" + document.title)
            let response = node.textContent
            let watchFor = response.startsWith("ChatGPTNew") ? "ChatGPTNew chat" : "ChatGPT" + document.title 
            if(DEBUG) console.log("MUTATION: " + node.textContent)
            if (response.startsWith(watchFor)) {
              if(DEBUG) console.log("SENDING TEXT: ")
              let mds = document.querySelectorAll(".markdown")
              response=mds[mds.length-1].textContent
              let questions = [...response.matchAll(/<question>(.*?)<\/question>/g)].map(match => match[1]);
              console.log(questions)
              response = response.replace(/<question>.*?<\/question>/g, '') 

              chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{raw: response, llm: "chatgpt",followUps:questions, conversationURL}});
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
export async function chatgpt(llm){
  const {tabId, currentRequest} = llm
  const prompt = PRE_PROMPTS[currentRequest.type] + '\n\n' + currentRequest.getPrompt()
  const conversationURL = await llm.getURL()
  await chrome.scripting.executeScript({ target: { tabId }, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  if(DEBUG) console.log('PROMPT SET INTO TEXTAREA')
  await chrome.scripting.executeScript({target: {tabId}, args: [conversationURL, DEBUG], func: watchForResponse})
  if(DEBUG) console.log('SETTING OBSERVER')
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
  if(DEBUG) console.log('PROMPT SUBMITTED')

}