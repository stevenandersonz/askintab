import {selectAndWriteTextArea, submitPrompt, watchForResponse} from "../helpers.js"

const BTN_SEND = 'button[data-testid="send-button"]'
const TEXTAREA = '#prompt-textarea'

// function watchForResponse (){

//   let log = (msg) => chrome.runtime.sendMessage({type: "DEBUG", payload: msg})
//   const observer = new MutationObserver(function(mutationsList) {
//     for (const mutation of mutationsList) {
//       if (mutation.type === 'childList') {
//         mutation.addedNodes.forEach(node => {
//           if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
//             let response = node.textContent
//             let watchFor = response.startsWith("ChatGPTNew") ? "ChatGPTNew chat" : "ChatGPT" + document.title 
//             chrome.runtime.sendMessage({ type: "PING", payload:{name:"chatgpt"}});
//             log("MUTATION: " + node.textContent + "\n" + "WATCH FOR: " + watchFor)
//             if (response.startsWith(watchFor)) {
//               let mds = document.querySelectorAll(".markdown")
//               response=mds[mds.length-1].textContent
//               chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{response, name: "chatgpt"}});
//               observer.disconnect()
//             }
//           }
//         });
//       }
//     }
//   });
//   observer.observe(document.body, { childList: true, subtree: true, characterData: true});
// }

export async function chatgpt(provider){
  const {tabId, promptId, prompt} = provider
  await chrome.scripting.executeScript({target: { tabId }, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  await chrome.scripting.executeScript({target: {tabId}, args: [promptId, "chatgpt"], func: watchForResponse})
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
}
