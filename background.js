import {grok, chatGPT} from "./llms/index.js"
import {marked}from "./libs/marked.min.esm.js"

const annotations = {
  count: 0,
  saved: [],
  lastSaved: null,
  preprompt: "for any type of flow charts use mermaid.js format. make sure it can be rendered\n",
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

const LLMS = {grok:{url:"grok.com", tabId: null, send: grok, lastUsed: null }, chatgpt: {url:"chatgpt.com", tabId: null, send:chatGPT, lastUsed:null}}
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

let senderId = null //TODO: maybe future can hold multiple senders?

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    const { prompt, llm } = payload
    if (!LLMS[llm].tabId) return  
    annotations.save(prompt, llm, sendResponse) 
    senderId = sender.tab.id
    LLMS[llm].lastUsed = Date.now()
    LLMS[llm].send(LLMS[llm].tabId, senderId, annotations.lastSaved)
    console.log(`SENDING REQUEST from tab ${senderId} TO ${llm} at tab id: ${LLMS[llm].tabId}`)

  }

  if (type === "LLM_RESPONSE") {
    console.log(`Sending response to tab: ${senderId}}`)
    // SUPPORT MERMAID.js in markdown
    const renderer = new marked.Renderer();
    renderer.code = (tokens) => {
      console.log(tokens)
      if (tokens.lang === "mermaid") {
        return `<div class="mermaid">${tokens.text}</div>`;
      }
      return `<pre><code class="${tokens.lang}">${tokens.raw}</code></pre>`;
    };
    annotations.lastSaved.response = marked.parse(payload, {renderer})
    annotations.lastSaved.waitingResponse = false
    chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: annotations.lastSaved }); 
  }
});

// --- HANDLE Right click over selection and shows ask ai option
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
      id: "annotateText",
      title: "Ask in Tab",
      contexts: ["selection"], // Ensures it only appears when text is selected
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "annotateText" && info.selectionText) {
    annotations.selectedText = info.selectionText
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: annotateSelection,
        args: [Object.keys(LLMS).filter(llm => LLMS[llm].tabId).sort((a,b) => LLMS[b].lastUsed - LLMS[a].lastUsed)]
    });
  }
});

function annotateSelection(llms) {
  const EXT_NAME = "companion"
  const selection = window.getSelection();
  console.log(llms) 
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
    let llmDropdown = document.querySelector(`.${EXT_NAME}-dropdown`)
    llmDropdown.innerHTML = ""
    for(let llm of llms){
      let option = document.createElement("option")
      option.value=llm
      option.innerHTML=llm
      llmDropdown.appendChild(option)
    }
    let prompterInput = document.querySelector(`.${EXT_NAME}-textarea`)
    if(prompterContainer){
      prompterContainer.style.display = "block"
      prompterInput.focus()
    }
  }
  // Perform the annotation action
}

