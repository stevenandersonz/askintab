import LLM from "./llm.js"
import {cleanUrl} from"./utils/helpers.js"

const SYNC_LOCAL_PERIOD = 2
const DEBUG = true
const DEFAULT_CFG = {
  mockResponse: false,
  returnFollowupQuestions: true,
  prompterShortcut: "Meta + k"
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
    this.mockResponse = false;
    this.returnFollowupQuestions = false;

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

  async saveResponse(response, conversationURL, followUps) {
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
    let ret = this.state.data.filter(r => r.id===id)
    return ret.length === 1 ? ret[0]: null;
  }
  
  static getRequestCount() {
    return this.state.count;
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    console.log('Extension updated from version', details.previousVersion, 'to', chrome.runtime.getManifest().version);
    let strg = await chrome.storage.local.get(["askintab_data", "askintab_cfg"])
    if(!strg.askintab_cfg) return await chrome.storage.local.set({ askintab_cfg: DEFAULT_CFG })
    if(strg.askintab_data && strg.askintab_data.length <= 0) return 
    Request.state.data = strg.askintab_data
    Request.state.requestsCreated = Request.state.data.length 
    
    chrome.alarms.create("SYNC_LOCAL", { periodInMinutes: SYNC_LOCAL_PERIOD });
  }

  if (details.reason === 'install') {
    await chrome.storage.local.set({ askintab_cfg: DEFAULT_CFG })
    chrome.alarms.create("SYNC_LOCAL", { periodInMinutes: SYNC_LOCAL_PERIOD });
  }
});

chrome.runtime.onStartup.addListener(() => LLM.loadAvailable());
chrome.tabs.onUpdated.addListener(() => LLM.loadAvailable());
chrome.runtime.onMessage.addListener( function(message, sender, sendResponse) {
  const { type, payload } = message

  if(type === "LLM_INFO") {
    sendResponse(LLM.llms.filter(llm => llm.tabId).map(llm => llm.name))
    return
  }

  if (type === "LLM_REQUEST") {
    const { question, selectedText, llm:to, savedRange, type, parentReqId} = payload
    if (!to) sendResponse({ error: `LLM is missing` }); 

    let llm = LLM.get(to)
    if (!llm) sendResponse({ error: `LLM ${to} is not available` });

    if(DEBUG) console.log(`NEW MESSAGE: ${type} \n ${JSON.stringify(payload)}`)

    const req = new Request(llm.name, question, selectedText, sender, savedRange, type, parentReqId);
    sendResponse({ id: req.id, status: req.status})
    chrome.storage.local.get("askintab_cfg").then(({askintab_cfg})=>{
      req.returnFollowupQuestions = askintab_cfg.returnFollowupQuestions
      req.mockResponse = askintab_cfg.mockResponse
      llm.queue.push(req)
      llm.processQueue() 
    })
  }

  if (type === "LLM_RESPONSE") {
    let llm = LLM.get(payload.llm)
    if (!llm) sendResponse({ error: `LLM ${llm} is not available` });
    clearTimeout(llm.currentRequest)

    llm.currentRequest.saveResponse(payload.raw, payload.conversationURL, payload.followUps)

    if(DEBUG) console.log(`${payload.llm.toUpperCase()} - REQUEST COMPLETED`)
    chrome.tabs.sendMessage(llm.currentRequest.sender.id, { type: "LLM_RESPONSE", payload: llm.currentRequest}); 

    llm.processing = false
    llm.currentRequest = null
    llm.processQueue()
  }

  if(type === "LOAD_PAGE") {
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

  if (type === 'EXPORT_CONVERSATION') {
    let conversation = []
    let req = Request.findById(Number(payload.id))
    conversation.push(`---
        \n origin: ${req.sender.url}
        \n llm: ${req.llm}
        \n url: ${req.conversationURL}
        \n highlighted: ${req.selectedText}
        \n ---
        \n ### ${req.question} 
        \n ${req.response}`)

    for (let cId of req.conversation){
      let ret = Request.findById(cId)
      conversation.push(`### ${ret.question} \n ${ret.response}`)
    }
    sendResponse(conversation.join("\n"))
  }

  if(type==="DEBUG" && DEBUG) console.log(payload)
});

chrome.alarms.onAlarm.addListener(async(alarm) => {
  if (alarm.name === "SYNC_LOCAL"){
    try{
      console.log("SYNCING")
      await chrome.storage.local.set({ askintab_data: Request.getAllRequests()})
    }catch(e){
      console.log(e)
    }
  }
});