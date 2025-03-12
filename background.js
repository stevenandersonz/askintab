import {grok} from "./llms/index.js"

const annotations = {
  count: 0,
  saved: [],
  lastSaved: null,
  preprompt: "",
  selectedText: "",
  save: function(prompt,llm, cb){
    this.count += 1 
    let annotation = {
      count: this.count,
      waitingResponse:true,
      response: null,
      submittedAt: Date.now(),
      responseAt: null,
      selectedText: annotations.selectedText,
      prompt,
      fullPrompt: `${this.preprompt} \n ${prompt} \n  ${this.selectedText}`,
      llm,
    }
    this.saved.push(annotation)
    this.lastSaved = annotation
    this.selectedText = ""
    cb(this.lastSaved); 
  }
}


const LLMSETUP = {
  chatgpt: {
    // when answering it goes:
    // result-thinking -> result-streaming
    // result-streaming -> 

    selectors: {
      send:'button[data-testid="send-button"]',
      write:'#prompt-textarea',
      title: "div[title]"
    },
    present: false,
    tabId: null,
    domain: "chatgpt.com",
    mutationObserverConfig: {},

  },
} 

const LLMS = {grok:{url:"grok.com", tabId: null, send: grok }, chatgpt: {url:"chatgpt.com", tabId: null}}
// Check availables LLMS
for(let LLM of Object.values(LLMS)){
  const urlPattern = `*://*.${LLM.url}/*`;
  chrome.tabs.query({ url: urlPattern }, function(tabs) {
    if(tabs.length <= 0) return
    if(tabs.length > 1) console.log(`more than one tab for ${LLM.url} is present`) 
    console.log(`${LLM.url} is avaible at tab id: ${tabs[0].id}`)
    LLM.tabId = tabs[0].id 
  });
}

console.log(LLMS)

let debuggerAttached = false
let activeLLM = null
let senderId = null //TODO: maybe future can hold multiple senders?

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    const { prompt, llm } = payload
    if (!LLMS[llm].tabId) return  

    annotations.save(prompt, llm, sendResponse) 
    LLMS[llm].send(LLMS[llm].tabId, sender.tab.id, annotations.lastSaved)
    console.log(`SENDING REQUEST from tab ${sender.tab.id} TO ${llm} at tab id: ${LLMS[llm].tabId}`)

    // chrome.debugger.attach({ tabId }, "1.3", function() {
    //   console.log(`Attaching debugger to for request at tab id: ${tabId}`)
    //   debuggerAttached = true
    //   if(networkDebuggerConfig){
    //     console.log(`Using Network debugger at tab id: ${tabId}`)
    //     // Enable Network domain to watch for net request made through the llm
    //     chrome.debugger.sendCommand(
    //       { tabId },
    //       "Network.enable",
    //       {},
    //       // as soon as we watch the network make llm specific request
    //       function() {
    //         handlePrompt(fullPrompt)
    //       }
    //     );
    //   } 
    //   if(mutationObserverConfig){
    //     console.log(`Using MutationObserver at tab id: ${tabId}`)
    //     handlePrompt(fullPrompt)
    //   }
    // });

  }
  if (type === "LLM_RESPONSE") {
    console.log(`Sending response to tab: ${senderId}}`)
    annotations.lastSaved.response = payload
    annotations.lastSaved.waitingResponse = false
    chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: annotations.lastSaved }); 
  }
});

// function handlePrompt(prompt){
//   const {selectors, tabId, mutationObserverConfig} = LLMSETUP[activeLLM] 
//   // executeScript sents func and executes it into the tab web context
//   chrome.scripting.executeScript({
//     target: { tabId },
//     func: function (selectors) {
//       let textArea = document.querySelector(selectors.write);
//       if (textArea){
//         console.log(`Found selector ${selectors.write}`)
//         textArea.focus();
//       } 
//     },
//     args: [selectors]},
//     // this callback is executed after func in the serviceWorker context
//     async () => {
//       // debugger.command is needed since llm like grok checks for event.isTrusted === true
//       await new Promise(resolve => 
//         chrome.debugger.sendCommand(
//           { tabId },
//           "Input.insertText",
//           { text: prompt },
//           resolve
//         )
//       );

//       chrome.scripting.executeScript({
//         target: { tabId },
//         args: [selectors, mutationObserverConfig ? mutationObserverConfig : false],
//         func: function(selectors, mutationObserverConfig) {
//           let btnSend = document.querySelector(selectors.send);
//           if (btnSend){
//             if (mutationObserverConfig){
//               // Observe the mutations on the DOM, and return the text if match watchFor
//               const observer = new MutationObserver(function(mutationsList) {
//                 for (const mutation of mutationsList) {
//                   if (mutation.type === 'childList') {
//                     mutation.addedNodes.forEach(node => {
//                       if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
//                         let watchFor = "ChatGPT" + document.title
//                         if (node.textContent.trim().startsWith(watchFor)) {
//                           console.log("Found Match, sending response")
//                           chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload: node.textContent.trim().slice(watchFor.length) });
//                           observer.disconnect()
//                         }
//                       }
//                     });
//                   }
//                 }
//               });
//               observer.observe(document.body, { childList: true, subtree: true, characterData: true});
//             }
//             btnSend.click();
//             console.log(`Selector ${selectors.write} clicked`)
//           } 
//         }
//       }, function() {
//         console.log("Detaching debugger")
//         if(!mutationObserverConfig) return true
//         debuggerAttached = false
//         chrome.debugger.detach({ tabId }) 
//       });
//     }
//   );
// }

// --- HANDLE Right click over selection and shows ask ai option
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
      id: "annotateText",
      title: "Annotate Selection",
      contexts: ["selection"] // Ensures it only appears when text is selected
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "annotateText" && info.selectionText) {
    annotations.selectedText = info.selectionText
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: annotateSelection,
        args: [info.selectionText]
    });
  }
});

function annotateSelection(selectedText) {
  const EXT_NAME = "companion"
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    let range = selection.getRangeAt(0)
    let span = document.createElement("span");
    span.className = EXT_NAME + "-selection";

    // // Extract the selected content and append it to the span
    // TODO: this method will clone part of a selected object and insert it back into the parent. maybe selection should find the closest block?
    let extractedContents = range.extractContents();
    span.appendChild(extractedContents);

    // // Insert the span back into the document
    range.insertNode(span);

    let prompterContainer = document.querySelector(`.${EXT_NAME}-container`)
    let prompterInput = document.querySelector(`.${EXT_NAME}-textarea`)
    if(prompterContainer){
      prompterContainer.style.display = "block"
      prompterInput.focus()
    }
  }
  // Perform the annotation action
}