import LLM from "./llm.js"
import db from "./db.js"
import {cleanUrl} from"./helpers.js"

const DEBUG = true
chrome.runtime.onStartup.addListener(() => LLM.loadAvailable());
chrome.tabs.onUpdated.addListener(() => LLM.loadAvailable());
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log("HERE")
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    if (!payload.llm) sendResponse({ error: `LLM is missing` }); 
    let llm = LLM.get(payload.llm)
    if (!llm) sendResponse({ error: `LLM ${payload.llm} is not available` });
    db.getCfg().then(cfg => {
      llm = cfg.mockResponse ? LLM.get("mock") : llm
      const req = {
        parentReqId: payload.parentReqId ? payload.parentReqId : null,
        createdAt: Date.now(),
        question: payload.question,
        type: payload.type,
        highlightedText: payload.type === "STANDALONE" ? null : { text: payload.selectedText, range: payload.savedRange },
        conversation: payload.type === "INIT_CONVERSATION" ? [] : null,
        llm: {
          name: payload.llm,
          response: "",
          mockResponse: cfg.mockResponse,
          returnFollowupQuestions: cfg.returnFollowupQuestions,
          url: null,
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
      })
    })
    return true
  }

  if (type === "LLM_RESPONSE") {
    let llm = LLM.get(payload.name)
    if (!llm) sendResponse({ error: `LLM ${llm} is not available` });
    let {currentRequest} = llm
    clearTimeout(llm.timeoutId)
    if(DEBUG) console.log(`${payload.name.toUpperCase()} - REQUEST COMPLETED`)
    currentRequest.llm = {...currentRequest.llm, ...payload}
    chrome.tabs.sendMessage(llm.currentRequest.sender.id, { type: "LLM_RESPONSE", payload: currentRequest }); 
    db.updateRequestLLM(currentRequest.id, currentRequest.llm).then(() => llm.clear()) 
  }
  if(type === "LLM_INFO") sendResponse(LLM.llms.filter(llm => llm.tabId).map(llm => llm.name))
  if(type === "CLEAR_REQ") db.clearRequests().then(ok => sendResponse(ok))
  if(type === "GET_CFG") db.getCfg().then(cfg => sendResponse(cfg))
  if(type === "PUT_CFG") db.updateCfg(payload).then(cfg => sendResponse(cfg))
  if (type === 'GET_ALL') db.getRequests().then(reqs => sendResponse(reqs))
  if(type === "LOAD_PAGE"){
    db.getRequestsByUrl(sender.url).then(reqs =>{
      console.log(reqs)
      sendResponse(reqs)
    })
  } 

  // if (type === 'PAGE_STATS') {
  //   const rs = Request.getAllRequests().filter(r => r.url === payload.url && r.type !== "STANDALONE");
  //   const questions = rs.map(r => ({text: r.question, id: "companion-md-" + r.id }));
  //   const questionCount = questions.length
  //   sendResponse({ questionCount, questions })
  // }


  // if (type === 'EXPORT_CONVERSATION') {
  //   let conversation = []
  //   let req = Request.findById(Number(payload.id))
  //   conversation.push(`---
  //       \n origin: ${req.sender.url}
  //       \n llm: ${req.llm}
  //       \n url: ${req.conversationURL}
  //       \n highlighted: ${req.selectedText}
  //       \n ---
  //       \n ### ${req.question} 
  //       \n ${req.response}`)

  //   for (let cId of req.conversation){
  //     let ret = Request.findById(cId)
  //     conversation.push(`### ${ret.question} \n ${ret.response}`)
  //   }

  //   sendResponse(conversation.join("\n"))
  // }

  if(type==="DEBUG" && DEBUG) console.log(payload)
  return true
});