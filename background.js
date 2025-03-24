import LLM from"./llm.js"
import {decodeJWT, cleanUrl} from"./utils/helpers.js"

const DEBUG = false
let token = null;

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

  async saveResponse(response, conversationURL, followUps) {
    this.responseAt = Date.now();
    this.conversationURL = conversationURL;
    this.status = "completed"
    this.followUps = followUps
    this.response = response
    await saveLocal()
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

  async sync(){
    let token = await chrome.storage.local.get("accessToken")
    console.log(token)
    if(token){
      let res = await fetch("http://localhost:3000/sync", {
        body: JSON.stringify(this),
        method: "POST",
        headers: {"Authorization": `Bearer ${token.accessToken}`}
      })
      let data = await res.json()
      console.log(data)
    }
  }
}

async function saveLocal() {
  try{
    await chrome.storage.local.set({ extensionData: JSON.stringify(Request.getAllRequests())})
    console.log("saved Requests")
  }catch(e){
    console.log(e)
  }
}

async function loadFromLocalStorage() {
  try {
    let {extensionData} = await chrome.storage.local.get("extensionData")
    Request.state.data = JSON.parse(extensionData)
    Request.state.requestsCreated = Request.state.data.length 
    console.log("Requests Loaded")
  } catch(e){
    console.log(e)
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    console.log('Extension updated from version', details.previousVersion, 'to', chrome.runtime.getManifest().version);
    loadFromLocalStorage();
  } else if (details.reason === 'install') {
    console.log('Extension installed');
  }
});

chrome.runtime.onStartup.addListener(() => {
  LLM.loadAvailable() 
  loadFromLocalStorage()
});

chrome.tabs.onUpdated.addListener(() => LLM.loadAvailable());

chrome.runtime.onMessage.addListener(async function(message, sender, sendResponse) {
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
    llm.queue.push(req)
    llm.processQueue() 
    sendResponse({ id: req.id, status: req.status})
  }

  if (type === "LLM_RESPONSE") {
    let llm = LLM.get(payload.llm)
    if (!llm) sendResponse({ error: `LLM ${llm} is not available` });
    clearTimeout(llm.currentRequest)

    llm.currentRequest.saveResponse(payload.raw, payload.conversationURL, payload.followUps)

    //await llm.currentRequest.sync() 

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
    console.log(payload.id)
    let req = Request.findById(Number(payload.id))
    console.log(req)
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
    console.log(conversation)
    sendResponse(conversation.join("\n"))
  }

  if(type === "LOGIN"){
    const authUrl = 'http://localhost:3000/auth/google';
    sendResponse({ status: "initiated" })
    let redirectUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true})
    const accessToken = new URL(redirectUrl).searchParams.get("access_token");
    const refreshToken = new URL(redirectUrl).searchParams.get("refresh_token");
    if (accessToken && refreshToken) {
      await chrome.storage.local.set({accessToken: accessToken, refreshToken: refreshToken, tokenTimestamp: Date.now()})
      let decodedAccessToken = decodeJWT(accessToken)
      chrome.alarms.create("refreshToken", {
        periodInMinutes: decodedAccessToken.expiresInMinutes
      });
    }
  }
});

chrome.alarms.onAlarm.addListener(async(alarm) => {
  console.log(alarm)
  if (alarm.name === "refreshToken") {
    console.log("Alarm fired - Refreshing token...");
    try {
      let {refreshToken} = await chrome.storage.local.get(["refreshToken"])
      console.log(refreshToken)
      let res = await fetch("http://localhost:3000/refresh", {
        headers: { Authorization: `Bearer ${refreshToken}` },
        method: "POST"
      })
      if(res.ok){
        let data =  await res.json()
        console.log(data)
        console.log("new tokens set")
        return await chrome.storage.local.set({accessToken: data.accessToken, refreshToken: data.refreshToken, tokenTimestamp: Date.now()})
      }
      console.log(res)
    return true;
    } catch(e){
      console.log(e)
    }
  }
});