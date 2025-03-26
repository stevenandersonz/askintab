import LLM from "./llm.js"
import db from "./db.js"
import {cleanUrl} from"./helpers.js"

const DEBUG = true
chrome.runtime.onStartup.addListener(() => LLM.loadAvailable());
chrome.tabs.onUpdated.addListener(() => LLM.loadAvailable());
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
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
    db.getCfg().then(cfg => {
      console.log("---cfg---")
      console.log(cfg)
      console.log("------")
      llm = cfg.mockResponse ? LLM.get("mock") : llm
      const req = {
        createdAt: Date.now(),
        question: question,
        type: type,
        highlightedText: type === "STANDALONE" ? null : { text: selectedText, range: savedRange },
        conversation: type === "INIT_CONVERSATION" ? [] : null,
        // parentId: type === "FOLLOWUP" ? parentId : null,
        llm: {
          name: to,
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
        console.log("---r---")
        console.log(r)
        console.log("------")
        sendResponse(r) 
        llm.queue.push(r)
        llm.processQueue()  
      })
    })
    return true
  }

  if (type === "LLM_RESPONSE") {
    let llm = LLM.get(payload.name)
    if (!llm) sendResponse({ error: `LLM ${llm} is not available` });
    clearTimeout(llm.currentRequest)
    if(DEBUG) console.log(`${payload.name.toUpperCase()} - REQUEST COMPLETED`)
    llm.currentRequest.llm = {...llm.currentRequest.llm, ...payload}
    chrome.tabs.sendMessage(llm.currentRequest.sender.id, { type: "LLM_RESPONSE", payload: llm.currentRequest }); 
    db.updateRequest(llm.currentRequest).then(() => {
      llm.processing = false
      llm.currentRequest = null
      llm.processQueue()
    });
  }

  if(type === "CLEAR_REQ"){
    db.clearRequests().then(ok => sendResponse(ok))
    return true
  }

  if(type === "GET_CFG"){
    db.getCfg().then(cfg => sendResponse(cfg))
    return true
  }

  if(type === "PUT_CFG"){
    db.updateCfg(payload).then(cfg => sendResponse(cfg))
    return true
  }

  // if(type === "LOAD_PAGE") {
  //   let requests = Request.getAllRequests().filter(req => req.sender.url === cleanUrl(sender.url))
  //   sendResponse({requests})
  // }

  // if (type === 'PAGE_STATS') {
  //   const rs = Request.getAllRequests().filter(r => r.url === payload.url && r.type !== "STANDALONE");
  //   const questions = rs.map(r => ({text: r.question, id: "companion-md-" + r.id }));
  //   const questionCount = questions.length
  //   sendResponse({ questionCount, questions })
  // }

  if (type === 'GET_ALL') {
    db.getRequests().then(reqs => sendResponse(reqs))
    return true
  }

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
});