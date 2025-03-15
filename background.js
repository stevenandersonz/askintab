import {grok, chatGPT} from"./llms/index.js"

const DEBUG = true
const TIMEOUT_AFTER = 1000*60*10

function annotations(){}

annotations.prototype.state = {
  data:[],
  //todo: i don't think i need count
  count:0,
}

annotations.prototype.save = function saveAnnotation (response, conversationURL){
  this.state.data.push(this)
  this.state.count++
  this.state.selectedText = ""
  this.response = response
  this.responseAt = Date.now()
  this.conversationURL = conversationURL
}

function Annotation(llm, question, selectedText, submittedAt) {
  this.selectedText = selectedText 
  this.response = null,
  this.submittedAt = submittedAt,
  this.createdAt = Date.now(),
  this.responseAt = null,
  this.question = question,
  this.conversationURL = null
  this.llm = llm
}

Annotation.prototype = Object.create(annotations.prototype)
Annotation.prototype.constructor = Annotation 
Annotation.prototype.getPrompt = function(llmPrompt){
  return `${llmPrompt} \n ${this.question} \n ${this.selectedText}` 
}

function LLM (name, domain, send, useDebugger=false) {
  this.name = name
  this.domain = domain
  this.favicon = null
  this.lastUsed = null
  this.tabId = null
  this.queue = []
  this.processing = false
  this.currentRequest = null
  this.useDebugger = useDebugger
  this.debuggerAttached = false 
  this.send = function() {
    if (DEBUG) console.log(`${this.name.toUpperCase()} IS PROCESSING REQUEST: \n ${JSON.stringify(this.currentRequest)} \n Prompt: ${this.currentRequest.annotation.getPrompt()} \n ITEMS IN QUEUE: ${this.queue.length}`)
    send(this)
  }
  this.getURL = async function() {
    let tab = await chrome.tabs.get(this.tabId)
    if (DEBUG) console.log(`${this.name.toUpperCase()} URL: ${tab.url}`)
    return tab.url
  }
  this.getPrompt = async function(){
    const url = chrome.runtime.getURL(`data/${this.name}-prompt.txt`);
    console.log(url)
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      const text = await response.text();
      return text;
    } catch (error) {
      console.error(error);
      return null;
    }
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
      chrome.tabs.sendMessage(req.senderId, { type: "LLM_TIMEOUT", id: req.submittedAt}); 
      this.processing = false;
      this.currentRequest = null;
      this.processQueue();
    }
  }, TIMEOUT_AFTER) 

  this.currentRequest = req
  this.send()
}


const llms = [new LLM('grok', 'grok.com', grok, true), new LLM('chatgpt', 'chatgpt.com', chatGPT)]
let llmsMap = llms.reduce((llms, llm) => {
    llms[llm.name] = llm
    return llms
  }, {})

// Check availables LLMS
for(let llm of llms){
  llm.getPrompt().then(text=> console.log(text))
  const urlPattern = `*://*.${llm.domain}/*`;
  chrome.tabs.query({ url: urlPattern }, function(tabs) {
    if(tabs.length <= 0) return
    if(tabs.length > 1) console.log(`more than one tab for ${llm.domain} is present`) 
    console.log(tabs)
    console.log(`${llm.domain} is avaible at tab id: ${tabs[0].id}`)
    llm.tabId = tabs[0].id 
    llm.favicon = tabs[0].favIconUrl
  });
}


console.log(llmsMap)

chrome.runtime.onMessage.addListener(async function(message, sender, sendResponse) {
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    const { question, selectedText, llm} = payload
    console.log(llm)
    if (!llmsMap[llm].tabId) sendResponse({ error: `LLM ${llm} is not available` });
    const request = {question, senderId: sender.tab.id, submittedAt: Date.now(), selectedText} 
    //todo: this should be independent from annotation
    if(DEBUG) console.log(`NEW MESSAGE: ${type} \n ${JSON.stringify(payload)}`)
    llmsMap[llm].queue.push(request)
    llmsMap[llm].processQueue() 
    sendResponse({ id: request.submittedAt, status: "processing"})
    return true
  }

  if (type === "LLM_RESPONSE") {
    console.log(`RESPONSE FROM ${payload.llm}`)
    let llm = llmsMap[payload.llm] 
    let {annotation, timeoutId, senderId} = llm.currentRequest
    clearTimeout(timeoutId)
    annotation.save(payload.raw) 
    if(DEBUG) console.log(`${payload.llm.toUpperCase()} - REQUEST COMPLETED`)
    chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", raw: payload.raw, id: annotation.submittedAt, conversationURL: annotation.conversationURL }); 

    // free llm to process new item in the queue
    llm.processing = false
    llm.currentRequest = null
    llm.processQueue()
  }

  if(type === "LLM_INFO") {
    sendResponse(llms.filter(llm => llm.tabId).sort((a,b) => b.lastUsed - a.lastUsed))
  }

});