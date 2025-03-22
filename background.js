import {grok, chatGPT} from"./llms/index.js"

const DEBUG = false
const TIMEOUT_AFTER = 1000*60*10
function cleanUrl(url) {
  try {
      const urlObj = new URL(url);
      // Return only protocol, hostname, and pathname
      return urlObj.protocol + '//' + urlObj.hostname + urlObj.pathname;
  } catch (e) {
      // Fallback for invalid URLs
      console.error('Invalid URL:', url, e);
      return url; // Return original if parsing fails
  }
}
class Request {
  static state = {
    data: [],
    requestsCreated: 0,
  };

  constructor(llm, question, selectedText, sender, savedRange, type, parentId=null) {
    this.id = Request.state.requestsCreated;
    this.selectedText = selectedText;
    this.createdAt = Date.now();
    this.responseAt = null;
    this.question = question;
    this.conversationURL = null;
    this.parentId = parentId;
    this.followUps = [];
    this.llm = llm;
    this.status = "pending"
    this.timeoutId = null
    this.sender = {
      id: sender.tab.id,
      title: sender.tab.title,
      url: cleanUrl(sender.url)
    }
    this.type = type
    this.savedRange = savedRange 
    this.conversation = []
    this.response = null

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
    this.responseAt = Date.now();
    this.conversationURL = conversationURL;
    this.status = "completed"
    this.followUps = followUps
    this.response = response
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
  constructor(name, domain, send, mockResponse=false) {
    this.name = name;
    this.domain = domain;
    this.lastUsed = null;
    this.tabId = null;
    this.queue = [];
    this.processing = false;
    this.currentRequest = null;
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
        chrome.tabs.sendMessage(this.currentRequest.sender.id, { type: "LLM_RESPONSE", payload: this.currentRequest}); 
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
        this.processing = false;
        this.currentRequest = null;
        this.processQueue();
      }
    }, TIMEOUT_AFTER);

    this.currentRequest = req;
    this.send();
  }

}


const llms = [new LLM('grok', 'grok.com', grok, true), new LLM('chatgpt', 'chatgpt.com', chatGPT, false)]
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
    console.log("---")
    console.log(sender)
    console.log("----")
    const req = new Request(llm, question, selectedText, sender, savedRange, requestType, parentReqId);
    llmsMap[llm].queue.push(req)
    llmsMap[llm].processQueue() 
    sendResponse({ id: req.id, status: req.status})
  }

  if (type === "LLM_RESPONSE") {
    console.log(`RESPONSE FROM ${payload.llm}`)
    let llm = llmsMap[payload.llm] 
    clearTimeout(llm.currentRequest)
    console.log(payload)

    llm.currentRequest.saveResponse(payload.raw, payload.conversationURL, payload.followUps)
    console.log(Request.getAllRequests())
    if(DEBUG) console.log(`${payload.llm.toUpperCase()} - REQUEST COMPLETED`)

    // free llm to process new item in the queue
    llm.processing = false
    llm.currentRequest = null
    llm.processQueue()
  }

  if(type === "DOWNLOAD") {
    let conversation = [] 
    let initRequest = Request.getAllRequests().filter(req => req.type === "INIT_CONVERSATION")
    for (let req of initRequest){
      conversation.push(`--- \n origin: ${req.sender.url} \n llm: ${req.llm} \n url: ${req.conversationURL} \n Selected Text: ${req.selectedText}\n --- \n ${req.raw}`)
      for (let cId of req.conversation){
        let ret = Request.findById(cId)
        conversation.push(`### ${ret.question} \n ${ret.response}`)
      }
    }
    console.log(conversation.join("\n"))
    sendResponse(conversation.join("\n"))
    
  }

  if(type === "LLM_INFO") {
    sendResponse(llms.filter(llm => llm.tabId).sort((a,b) => b.lastUsed - a.lastUsed))
  }

  if(type === "LOAD_PAGE") {
    console.log(sender)
    let requests = Request.getAllRequests().filter(req => req.sender.url === cleanUrl(sender.url))
    sendResponse({requests})
  }
  if (type === 'PAGE_STATS') {
    const rs = Request.getAllRequests().filter(r => r.url === payload.url && r.type !== "STANDALONE");
    const questions = rs.map(r => ({text: r.question, id: "companion-md-" + r.id }));
    const questionCount = questions.length
    sendResponse({ questionCount, questions })
  }

  if (type === 'GET_ALL') {
    sendResponse(Request.getAllRequests())
  }

});