import {grok, chatGPT} from"./llms/index.js"

const DEBUG = false
const TIMEOUT_AFTER = 1000*60*10

class Request {
  static state = {
    data: [],
    requestsCreated: 0,
  };

  constructor(llm, question, selectedText, senderId, senderURL, savedRange, type, parentId=null) {
    this.id = Request.state.requestsCreated;
    this.selectedText = selectedText;
    this.response = null;
    this.createdAt = Date.now();
    this.responseAt = null;
    this.question = question;
    this.conversationURL = null;
    this.raw = null;
    this.parentId = parentId;
    this.followUps = [];
    this.llm = llm;
    this.status = "pending"
    this.timeoutId = null
    this.senderId = senderId
    this.type = type
    this.senderURL = senderURL
    this.savedRange = savedRange 
    this.conversation = []

    // Store instance in static state
    Request.state.data.push(this);
    Request.state.requestsCreated++;
    if(type==="FOLLOWUP"){
      let ret = Request.findById(parentId)
      if(ret) ret.conversation.push(this.id)
    }
  }

  getPrompt() {
    return `${this.question} \n ${this.selectedText}`;
  }

  saveResponse(response, conversationURL, followUps) {
    this.response = response;
    this.responseAt = Date.now();
    this.conversationURL = conversationURL;
    this.status = "completed"
    this.followUps = followUps
    this.raw = `### ${this.question} \n ${this.response}`
  }

  static getAllRequests() {
    return this.state.data;
  }
  static findById(id) {
    console.log(this.state.data)
    let ret = this.state.data.filter(r => r.id===id)
    console.log("here")
    console.log(ret)
    return ret.length === 1 ? ret[0]: null;
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
        this.currentRequest.saveResponse("### " + this.currentRequest.id + " Mock Response\n this is a test \n - 1 \n - 2 \n - 3", '#', ['q1','q2','q3'].map(q => this.currentRequest.id + "-" +q))
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
    const { question, selectedText, llm, savedRange, type:requestType, parentReqId} = payload
    if (!llmsMap[llm].tabId) sendResponse({ error: `LLM ${llm} is not available` });
    //todo: this should be independent from annotation
    if(DEBUG) console.log(`NEW MESSAGE: ${type} \n ${JSON.stringify(payload)}`)
    const req = new Request(llm, question, selectedText, sender.tab.id, sender.url, savedRange, requestType, parentReqId);
    llmsMap[llm].queue.push(req)
    llmsMap[llm].processQueue() 
    sendResponse({ id: req.id, status: req.status})
  }

  if (type === "LLM_RESPONSE") {
    console.log(`RESPONSE FROM ${payload.llm}`)
    let llm = llmsMap[payload.llm] 
    clearTimeout(llm.currentRequest)

    llm.currentRequest.saveResponse(payload.raw, payload.conversationURL, payload.followUps)
    if(DEBUG) console.log(`${payload.llm.toUpperCase()} - REQUEST COMPLETED`)
    chrome.tabs.sendMessage(llm.currentRequest.senderId, { type: "LLM_RESPONSE", payload: llm.currentRequest }); 

    // free llm to process new item in the queue
    llm.processing = false
    llm.currentRequest = null
    llm.processQueue()
  }

  if(type === "DOWNLOAD") {
    let conversation = [] 
    let initRequest = Request.getAllRequests().filter(req => req.type === "INIT_CONVERSATION")
    for (let req of initRequest){
      conversation.push(`--- \n origin: ${req.senderURL} \n llm: ${req.llm} \n url: ${req.conversationURL} \n Selected Text: ${req.selectedText}\n --- \n asked: ${req.question}\n responded: ${req.response} \n`)
      for (let cId of req.conversation){
        let ret = Request.findById(cId)
        conversation.push(`asked: ${ret.question} \n responded: ${ret.response} \n`)
      }
    }
    console.log(conversation)
    console.log(conversation.join("\n"))
    sendResponse(conversation.join("\n"))
    
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