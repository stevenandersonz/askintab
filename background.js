import LLM from "./llm.js"
import db from "./db.js"
import {cleanUrl} from"./helpers.js"

const DEBUG = true
chrome.runtime.onStartup.addListener(() => LLM.loadAvailable());
chrome.tabs.onUpdated.addListener(() => LLM.loadAvailable());
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    if (!payload.llm) sendResponse({ error: `LLM is missing` }); 
    let llm = LLM.get(payload.llm)
    if (!llm) sendResponse({ error: `LLM ${payload.llm} is not available` });
    const req = {
      parentReqId: payload.parentReqId ? Number(payload.parentReqId) : null,
      createdAt: Date.now(),
      question: payload.question,
      type: payload.type,
      highlightedText: payload.type === "STANDALONE" ? null : { text: payload.selectedText, range: payload.savedRange },
      llm: {
        name: payload.llm,
        response: "",
        mockResponse: null,
        returnFollowupQuestions: null,
        responseAt: null,
        followupQuestions: [],
      },
      sender: {
        id: sender.tab.id,
        title: sender.tab.title,
        url: cleanUrl(sender.url)
      },
      status: "pending",
      timeoutId: null,
    }
    db.createRequest(req).then(r => {
      sendResponse(r) 
      llm.send(r)
      db.addPage(req.sender.url)
    })

    return true
  }

  if (type === "LLM_RESPONSE") {
    let llm = LLM.get(payload.name)
    if (!llm) sendResponse({ error: `LLM ${llm} is not available` });
    let {currentRequest} = llm
    if(currentRequest){
      clearTimeout(llm.timeoutId)
      if(DEBUG) console.log(`${payload.name.toUpperCase()} - REQUEST COMPLETED`)
      let fus = []
      if(currentRequest.llm.returnFollowupQuestions) fus = [...payload.raw.matchAll(/<button class="askintab-followup-q">(.*?)<\/button>/g)].map(match => match[1]);
      currentRequest.llm.response = payload.raw.replaceAll(/<button class="askintab-followup-q">(.*?)<\/button>/g, "")
      currentRequest.llm.response = payload.raw.replaceAll(/<div class='mermaid'>(.*?)<\/div>/gs, "```mermaid\n$1\n```");
      currentRequest.llm.raw = payload.raw
      currentRequest.llm.responseAt = payload.responseAt
      currentRequest.llm.followupQuestions = fus
      currentRequest.status = "completed"
      chrome.tabs.sendMessage(llm.currentRequest.sender.id, { type: "LLM_RESPONSE", payload: currentRequest }); 
      db.updateRequestLLM(currentRequest.id, currentRequest.llm).then(() => llm.currentRequest = null) 
      return
    }
    console.log("error can't find a request")
  }

  if(type === "PING"){
    let llm = LLM.get(payload.name)
    if(llm.currentRequest)llm.setTimer()
  } 

  if(type === "RETRY"){
    db.getRequestById(payload.id).then(r =>{
      console.log(type)
      console.log(payload)
      console.log(LLM.get(r.llm.name))
      LLM.get(r.llm.name).send(r, 1000*30)
    })
  }

  if(type === "LLM_INFO") sendResponse(LLM.llms.filter(llm => llm.tabId).map(llm => llm.name))
  if(type === "CLEAR_REQ") db.clearRequests().then(ok => sendResponse(ok))
  if(type === "GET_CFG") db.getCfg().then(cfg => sendResponse(cfg))
  if(type === "PUT_CFG") db.updateCfg(payload).then(cfg => sendResponse(cfg))
  if (type === 'GET_ALL') db.getRequests().then(reqs => sendResponse(reqs))
  if(type === "GET_BY_URL") db.getRequestsByUrl(cleanUrl(payload)).then(reqs => sendResponse(reqs))
  if(type === "GET_URLS") db.getPages().then(urls => sendResponse(urls))
  if(type==="DEBUG" && DEBUG) console.log(payload)
  return true
});