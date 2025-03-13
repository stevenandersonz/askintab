const BTN_SEND = 'form button[type="submit"]:not(#companion-btn)'
const TEXTAREA = 'form textarea:not(#companion-textarea)'
const REQUESTS_TO = "https://grok.com/rest/app-chat/conversations"
const DEBUG = true


if (DEBUG) console.log("IMPORTING GROK")

const parseResponseBody = (b) => {
  b = b.split('\n')
  b = JSON.parse(b[b.length-2])  
  //TODO: validate response
  if(DEBUG) console.log(`Response Body: ${JSON.stringify(b)}`)
  return b.result.modelResponse.message
}


// GROK needs to setup a debuger due to evt.isTrusted check
export function grok(llm){
  const {tabId, currentRequest, name} = llm
  chrome.debugger.attach({ tabId }, "1.3", function() {
    if(DEBUG) console.log(`ATTACHED DEBUGGER @ TAB: ${tabId}`)
    // Enable Network Debugger to watch for requests coming out of grok 
    chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, function() {
      if(DEBUG) console.log(`ENABLING NETWORK SNIFFER @ TAB: ${tabId}`)
      handlePrompt(currentRequest.annotation.getPrompt(), tabId) 
    });

    let targetRequestId = null;
    chrome.debugger.onEvent.addListener(function (source, method, params) {
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
          chrome.debugger.sendCommand(
            { tabId: source.tabId }, // source.tabid -> grok tab id
            "Network.getResponseBody",
            { requestId: targetRequestId },
            function (response) {
              if (response) {
                if(typeof response.body !== 'string') return
                let {annotation, timeoutId, senderId} = currentRequest
                clearTimeout(timeoutId)
                annotation.save(parseResponseBody(response.body)) 

                // free llm to process new item in the queue
                llm.processing = false
                llm.currentRequest = null
                llm.processQueue()
                // Sends response directly to origin tab
                chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: {raw: annotation.response, id: annotation.submittedAt, count: annotation.state.data.length} }); 

                if(DEBUG) console.log(`${name.toUpperCase()} - REQUEST COMPLETED \n DETACHING FROM TAB: ${tabId}`)
                chrome.debugger.detach({ tabId });
              }
            }
          );
        }
      }
    });
  })
}

function handlePrompt(prompt, tabId){
  if(DEBUG) console.log(`PROMPT: ${prompt} - TAB ${tabId}`)
  chrome.scripting.executeScript({
    target: { tabId },
    args: [TEXTAREA],
    func: function (selector) {
      let textArea = document.querySelector(selector);
      if (textArea){
        if(DEBUG) console.log('FOUND TEXTAREA')
        textArea.focus();
      } 
    }},

    async () => {
      await new Promise(resolve => 
        chrome.debugger.sendCommand(
          { tabId },
          "Input.insertText",
          { text: prompt },
          resolve
        )
      );

      if(DEBUG) console.log('PROMPT INSERTED')

      chrome.scripting.executeScript({
        target: { tabId },
        args: [BTN_SEND],
        func: function(selector) {
          let btnSend = document.querySelector(selector);
          if (btnSend){
            btnSend.click();
          } 
        }
      }, function() {
          if(DEBUG) console.log('BTN_SENT CLICKED')
      });
    }
  );
}