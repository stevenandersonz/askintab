import { submitPrompt, selectTextArea } from "../utils/dom_helpers.js"

const BTN_SEND = 'form button[type="submit"]:not(#companion-btn)'
const TEXTAREA = 'form textarea:not(#companion-textarea)'
const REQUESTS_TO = "https://grok.com/rest/app-chat/conversations"
const DEBUGGER_TIMEOUT = 1000*60*4
const DEBUG = true


if (DEBUG) console.log("IMPORTING GROK")

const parseResponseBody = (b) => {
  b = b.split('\n')
  b = JSON.parse(b[b.length-2])  
  //TODO: validate response
  if(DEBUG) console.log(`Response Body: ${JSON.stringify(b)}`)
  return b.result.modelResponse.message
}

function setDebuggerTimeout(llm){
  return setTimeout(()=>{
    llm.debugerAttached = false
    chrome.debugger.detach({ tabId: llm.tabId }, () => {
    if(DEBUG) console.log("DETACHING DEBUGGER @ TAB: " + llm.tabId)
    }) 
  }, DEBUGGER_TIMEOUT)
}

let debuggerTimeoutId = null
// GROK needs to setup a debuger due to evt.isTrusted check
export async function grok(llm){
  const {tabId, currentRequest, name} = llm
  const basePrompt = await llm.getPrompt()
  const prompt = currentRequest.annotation.getPrompt(basePrompt)
  if(!llm.debuggerAttached && llm.useDebugger){
    await chrome.debugger.attach({ tabId }, "1.3")
    if(DEBUG) console.log(`ATTACHED DEBUGGER @ TAB: ${tabId}`)
    llm.debuggerAttached = true
    debuggerTimeoutId = setDebuggerTimeout(llm) 
  }
  clearTimeout(debuggerTimeoutId)
  debuggerTimeoutId = setDebuggerTimeout(llm)
  await chrome.debugger.sendCommand({ tabId }, "Network.enable") 
  if(DEBUG) console.log(`ENABLING NETWORK SNIFFER @ TAB: ${tabId}`)
  await chrome.scripting.executeScript({target: { tabId }, args: [TEXTAREA], func:selectTextArea})
  //await executeScript(tabId, [TEXTAREA], selectTextArea)
  if(DEBUG) console.log('FOUND TEXTAREA')
  //await sendDebuggerCommand(tabId,"Input.insertText", { text: prompt }) 
  await chrome.debugger.sendCommand({ tabId }, "Input.insertText", { text: prompt })
  if(DEBUG) console.log(`PROMPT INSERTED: ${prompt}`)
  //await executeScript(tabId, [BTN_SEND], submitPrompt)
  await chrome.scripting.executeScript({target: { tabId }, args: [BTN_SEND], func:submitPrompt})
  if(DEBUG) console.log('BTN_SENT CLICKED')

  let targetRequestId = null;
  async function handleNetworkEvt (source, method, params) {
    // Step 1: Catch the response and store the requestId
    if (method === "Network.responseReceived") {
      if (params.response.url.startsWith(REQUESTS_TO)){
        if(DEBUG) console.log(`DETECTED REQUEST TO: ${REQUESTS_TO}`)
        targetRequestId = params.requestId; // Save the requestId
      }
    }
    // Step 2: Get the body when the response is "finished"
    if (method === "Network.loadingFinished") {
      if (params.requestId === targetRequestId) {
        // Now try to fetch the response body
        let ret = await chrome.debugger.sendCommand({ tabId },"Network.getResponseBody",{ requestId: targetRequestId })
        //let ret = await sendDebuggerCommand(tabId,"Network.getResponseBody",{ requestId: targetRequestId })
        if (ret) {
          if(typeof ret.body !== 'string') return
          let {annotation, timeoutId, senderId} = currentRequest
          clearTimeout(timeoutId)
          annotation.save(parseResponseBody(ret.body)) 
  
          if(DEBUG) console.log(`${name.toUpperCase()} - REQUEST COMPLETED`)
          const {response, submittedAt} = annotation.state.data[annotation.state.data.length-1]
          chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: {raw: response, id: submittedAt} }); 
          llm.processing = false
          llm.currentRequest = null
          targetRequestId=null
          llm.processQueue()
          chrome.debugger.onEvent.removeListener(handleNetworkEvt);
        }
      }
    }
  };

  chrome.debugger.onEvent.addListener(handleNetworkEvt);
}

