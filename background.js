import {grok, chatGPT} from"./llms/index.js"

const DEBUG = false
const TIMEOUT_AFTER = 1000*60*10

class Request {
  static state = {
    data: [],
    requestsCreated: 0,
  };

  constructor(llm, question, selectedText, senderId, senderURL, savedRange) {
    this.id = Request.state.requestsCreated;
    this.selectedText = selectedText;
    this.response = null;
    this.createdAt = Date.now();
    this.responseAt = null;
    this.question = question;
    this.conversationURL = null;
    this.llm = llm;
    this.status = "pending"
    this.timeoutId = null
    this.senderId = senderId
    this.senderURL = senderURL
    this.savedRange =savedRange 

    // Store instance in static state
    Request.state.data.push(this);
    Request.state.requestsCreated++;
  }

  getBody() {
    return `${this.question} \n ${this.selectedText}`;
  }

  saveResponse(response, conversationURL) {
    this.response = response;
    this.responseAt = Date.now();
    this.conversationURL = conversationURL;
    this.status = "completed"
  }

  static getAllRequests() {
    return this.state.data;
  }

  static getRequestCount() {
    return this.state.count;
  }

}

class LLM {
  constructor(name, domain, send, useDebugger = false, mockResponse=false) {
    this.name = name;
    this.domain = domain;
    this.lastUsed = null;
    this.tabId = null;
    this.queue = [];
    this.processing = false;
    this.currentRequest = null;
    this.useDebugger = useDebugger;
    this.debuggerAttached = false;
    this.processRequest = send;
    this.mockResponse = mockResponse;
  }

  send() {
    if (DEBUG) {
      console.log(`${this.name.toUpperCase()} IS PROCESSING REQUEST: \n ${JSON.stringify(this.currentRequest)} \n`);
    }
    if (this.mockResponse) {
      setTimeout(() => {
        this.currentRequest.saveResponse("# Mock Response\n this is a test \n - 1 \n - 2 \n - 3", '#') 
        chrome.tabs.sendMessage(this.currentRequest.senderId, { type: "LLM_RESPONSE", payload: this.currentRequest}); 
        this.processing = false
        this.currentRequest = null
        this.processQueue()
      }, 1000)
      
    } else {
      this.processRequest(this);
    } 

  }

  async getURL() {
    let tab = await chrome.tabs.get(this.tabId);
    if (DEBUG) console.log(`${this.name.toUpperCase()} URL: ${tab.url}`);
    return tab.url;
  }

  async getPrompt(text) {
    const url = chrome.runtime.getURL(`data/${this.name}-prompt.txt`);
    console.log(url);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      let basePrompt = await response.text();
      return basePrompt + "\n\n" + text
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  processQueue() {
    if (this.processing || this.queue.length === 0) return;

    const req = this.queue.shift();
    this.processing = true;
    this.lastUsed = Date.now();

    req.timeoutId = setTimeout(() => {
      if (this.processing && this.currentRequest === req) {
        console.log(`REQUEST TIMEOUT ${this.name}`);
        req.status="failed"
        chrome.tabs.sendMessage(req.senderId, { type: "LLM_TIMEOUT", id: req.createdAt });
        this.processing = false;
        this.currentRequest = null;
        this.processQueue();
      }
    }, TIMEOUT_AFTER);

    this.currentRequest = req;
    this.send();
  }

}


const llms = [new LLM('grok', 'grok.com', grok, true, true), new LLM('chatgpt', 'chatgpt.com', chatGPT, false, true)]
let llmsMap = llms.reduce((llms, llm) => {
    llms[llm.name] = llm
    return llms
  }, {})

// Check availables LLMS
for(let llm of llms){
  const urlPattern = `*://*.${llm.domain}/*`;
  chrome.tabs.query({ url: urlPattern }, function(tabs) {
    if(tabs.length <= 0) return
    if(tabs.length > 1) console.log(`more than one tab for ${llm.domain} is present`) 
    console.log(tabs)
    console.log(`${llm.domain} is avaible at tab id: ${tabs[0].id}`)
    llm.tabId = tabs[0].id 
  });
}


console.log(llmsMap)

chrome.runtime.onMessage.addListener(async function(message, sender, sendResponse) {
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    const { question, selectedText, llm, savedRange} = payload
    if (!llmsMap[llm].tabId) sendResponse({ error: `LLM ${llm} is not available` });
    //todo: this should be independent from annotation
    if(DEBUG) console.log(`NEW MESSAGE: ${type} \n ${JSON.stringify(payload)}`)
    const req = new Request(llm, question, selectedText, sender.tab.id, sender.url, savedRange);
    llmsMap[llm].queue.push(req)
    llmsMap[llm].processQueue() 
    sendResponse({ id: req.id, status: req.status})
  }

  if (type === "LLM_RESPONSE") {
    console.log(`RESPONSE FROM ${payload.llm}`)
    let llm = llmsMap[payload.llm] 
    clearTimeout(llm.currentRequest)
    llm.currentRequest.saveResponse(payload.raw, payload.conversationURL)
    if(DEBUG) console.log(`${payload.llm.toUpperCase()} - REQUEST COMPLETED`)
    chrome.tabs.sendMessage(llm.currentRequest.senderId, { type: "LLM_RESPONSE", payload: llm.currentRequest }); 

    // free llm to process new item in the queue
    llm.processing = false
    llm.currentRequest = null
    llm.processQueue()
  }

  if(type === "PUT_RESPONSE") {
    console.log("this")
    console.log(payload)
    let request = Request.getAllRequests().filter(req => req.id === payload.id)
    if(request.length === 0) console.log("FOUND NO MATCH")
    request[0].response = payload.update  
    console.log("new response")
    console.log(request[0].response)
    sendResponse({response: request[0].response})
  }

  if(type === "LLM_INFO") {
    sendResponse(llms.filter(llm => llm.tabId).sort((a,b) => b.lastUsed - a.lastUsed))
  }

  if(type === "LOAD_PAGE") {
    console.log(sender)
    let requests = Request.getAllRequests().filter(req => req.senderURL === sender.url)
    sendResponse({requests})
  }

});