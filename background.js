import Provider from "./provider.js"
import db from "./db.js"
import {cleanUrl} from"./helpers.js"

const DEBUG = true
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  const { action, type, payload } = message
  if (action === "REQUEST") {
    if (!payload.model) sendResponse({ error: `LLM is missing` }); 
    let provider = Provider.findByModel(payload.model)
    console.log("provider")
    console.log(provider)
    if (!provider) sendResponse({ error: `provider of model ${payload.model} is not available` });
    const req = {
      createdAt: Date.now(),
      question: payload.question,
      highlight:{ text: payload.selectedText, range: payload.savedRange },
      provider: {
        model: payload.model,
      },
      sender: {
        id: sender.tab.id,
        title: sender.tab.title,
        url: cleanUrl(sender.url)
      },
      status: "pending",
    }
    console.log("createRequest")
    console.log(req)
    db.createRequest(req).then(r => {
      sendResponse(r) 
      provider.processRequest(r)
      db.addPage(req.sender.url)
    })

    return true
  }

  // if (type === "LLM_RESPONSE") {
  //   let llm = LLM.get(payload.name)
  //   if (!llm) sendResponse({ error: `LLM ${llm} is not available` });
  //   llm.processResponse(payload)
  // }

  // if(type === "PING"){
  //   let llm = LLM.get(payload.name)
  //   if(llm.currentRequest)llm.setTimer()
  // } 

  // if(type === "RETRY"){
  //   db.getRequestById(payload.id).then(r =>{
  //     console.log(type)
  //     console.log(payload)
  //     console.log(LLM.get(r.llm.name))
  //     LLM.get(r.llm.name).send(r, 1000*30)
  //   })
  // }

  if(action === "GET_MODELS") sendResponse(Provider.getModels())
  if(type === "CLEAR_REQ") db.clearRequests().then(ok => sendResponse(ok))
  if(type === "GET_CFG") db.getCfg().then(cfg => sendResponse(cfg))
  if(type === "PUT_CFG") db.updateCfg(payload).then(cfg => sendResponse(cfg))
  if (type === 'GET_ALL') db.getRequests().then(reqs => sendResponse(reqs))
  if(type === "GET_BY_URL") db.getRequestsByUrl(cleanUrl(payload)).then(reqs => sendResponse(reqs))
  if(type === "GET_URLS") db.getPages().then(urls => sendResponse(urls))
  if(type==="DEBUG" && DEBUG) console.log(payload)
  return true
});