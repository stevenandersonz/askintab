import {grok, chatGPT} from"./llms/index.js"

const DEBUG = true
const TIMEOUT_AFTER = 1000*60*10

function annotations(){}

annotations.prototype.state = {
  basePrompt: "for any type of flow charts use mermaid.js format. make sure it can be rendered\n",
  data:[],
  count:0,
}

annotations.prototype.save = function saveAnnotation (response){
  this.state.data.push(this)
  this.state.count++
  this.state.selectedText = ""
  this.response = response
  this.responseAt = Date.now()
}

function Annotation(llm, question, selectedText, submittedAt) {
  this.selectedText = selectedText 
  this.response = null,
  this.submittedAt = submittedAt,
  this.createdAt = Date.now(),
  this.responseAt = null,
  this.question = question,
  this.llm = llm
}

Annotation.prototype = Object.create(annotations.prototype)
Annotation.prototype.constructor = Annotation 
Annotation.prototype.getPrompt = function(){
  return `${this.state.basePrompt} \n ${this.question} \n ${this.selectedText}` 
}

let selectedText = ""

function LLM (name, url, send) {
  this.name = name
  this.url = url
  this.lastUsed = null
  this.tabId = null
  this.queue = []
  this.processing = false
  this.currentRequest = null
  this.send = function() {
    if (DEBUG) console.log(`${this.name.toUpperCase()} IS PROCESSING REQUEST: \n ${JSON.stringify(this.currentRequest)} \n Prompt: ${this.currentRequest.annotation.getPrompt()} \n ITEMS IN QUEUE: ${this.queue.length}`)
    send(this)
  }
}

LLM.prototype.processQueue = function(){

  if (this.processing || this.queue.length === 0) return 

  const req = this.queue.shift()
  this.processing = true
  this.lastUsed = Date.now()

  req.annotation = new Annotation(this.name, req.question, req.selectedText, req.submittedAt)
  req.timeoutId = setTimeout(() => {
    if(this.processing && this.currentRequest === req) {
      //todo we might want to sent more information
      console.log(`REQUEST TIMEOUT ${this.name}`)
      chrome.tabs.sendMessage(req.senderId, { type: "LLM_TIMEOUT", payload: {id: req.submittedAt}}); 
      this.processing = false;
      this.currentRequest = null;
      this.processQueue();
    }
  }, TIMEOUT_AFTER) 

  this.currentRequest = req
  this.send()
}

const llms = [new LLM('grok', 'grok.com', (...args) => console.log(args)), new LLM('chatgpt', 'chatgpt.com', chatGPT)]
let llmsMap = llms.reduce((llms, llm) => {
    llms[llm.name] = llm
    return llms
  }, {})

// Check availables LLMS
for(let llm of llms){
  const urlPattern = `*://*.${llm.url}/*`;
  chrome.tabs.query({ url: urlPattern }, function(tabs) {
    if(tabs.length <= 0) return
    if(tabs.length > 1) console.log(`more than one tab for ${llm.url} is present`) 
    console.log(`${llm.url} is avaible at tab id: ${tabs[0].id}`)
    llm.tabId = tabs[0].id 
  });
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    const { question, llm } = payload
    if (!llmsMap[llm].tabId) sendResponse({ error: `LLM ${llm} is not available` });
    const request = {question, senderId: sender.tab.id, submittedAt: Date.now(), selectedText} 
    //todo: this should be independent from annotation
    selectedText = ""
    if(DEBUG) console.log(`NEW MESSAGE: ${type} \n ${JSON.stringify(payload)}`)
    llmsMap[llm].queue.push(request)
    llmsMap[llm].processQueue() 
    sendResponse({ id: request.submittedAt, status: "processing"})
  }

  if (type === "LLM_RESPONSE") {
    console.log(`RESPONSE FROM ${payload.llm}`)
    let llm = llmsMap[payload.llm] 
    let {annotation, timeoutId, senderId} = llm.currentRequest
    clearTimeout(timeoutId)
    annotation.save(payload.raw) 
    if(DEBUG) console.log(`${payload.llm.toUpperCase()} - REQUEST COMPLETED`)
    chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: {raw: payload.raw, id: annotation.submittedAt, count: annotation.state.data.length} }); 

    // free llm to process new item in the queue
    llm.processing = false
    llm.currentRequest = null
    llm.processQueue()
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
    selectedText = info.selectionText
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: annotateSelection,
        args: [llms.filter(llm => llm.tabId).sort((a,b) => b.lastUsed - a.lastUsed)]
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
      option.value=llm.name
      option.innerHTML=llm.name
      llmDropdown.appendChild(option)
    }
    let prompterInput = document.querySelector(`.${EXT_NAME}-textarea`)
    if(prompterContainer){
      prompterContainer.style.display = "block"
      prompterInput.focus()
    }
  }
}