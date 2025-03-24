import {selectAndWriteTextArea, submitPrompt} from "../utils/dom_helpers.js"

const BTN_SEND = 'button[data-testid="send-button"]'
const TEXTAREA = '#prompt-textarea'

const PRE_PROMPTS = {
  BASE: "",
  INIT_CONVERSATION:(returnFollowups) =>{
    let base =  "You can only speak in markdown, if prompted for diagrams default to mermaid.js markdown too, DO NOT BE WOKE, Explain things in layman's terms."
    let fu = " Add 3 follow up question to expand on your response. each followup question should be surrounded by <question> </question>, Rembember to phrase the follow-up questions as further prompts to yourself"
    return returnFollowups ? base + fu : base 
  },
  FOLLOWUP: () => "Rembember to phrase the follow-up questions as further prompts to yourself",
  STANDALONE: () => "respond only with what you were asked"
} 

function watchForResponse (conversationURL, returnFollowups){

  let log = (msg) => chrome.runtime.sendMessage({type: "DEBUG", payload: msg})
  const observer = new MutationObserver(function(mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            let response = node.textContent
            let watchFor = response.startsWith("ChatGPTNew") ? "ChatGPTNew chat" : "ChatGPT" + document.title 
            log("MUTATION: " + node.textContent + "\n" + "WATCH FOR: " + watchFor)
            if (response.startsWith(watchFor)) {
              let mds = document.querySelectorAll(".markdown")
              response=mds[mds.length-1].textContent
              let fus = []
              if(returnFollowups){
                fus = [...response.matchAll(/<question>(.*?)<\/question>/g)].map(match => match[1]);
                response = response.replace(/<question>.*?<\/question>/g, '') 
                log("FU: " + fus)
              }
              chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{raw: response, llm: "chatgpt", followUps: fus, conversationURL}});
              observer.disconnect()
            }
          }
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true});
}
export async function chatgpt(llm){
  const {tabId, currentRequest, returnFollowups} = llm
  const prompt = PRE_PROMPTS[currentRequest.type](returnFollowups) + '\n\n' + currentRequest.getPrompt()
  const conversationURL = await llm.getURL()
  await chrome.scripting.executeScript({ target: { tabId }, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  await chrome.scripting.executeScript({target: {tabId}, args: [conversationURL, returnFollowups], func: watchForResponse})
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
}