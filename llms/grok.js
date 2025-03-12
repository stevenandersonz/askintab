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
export function grok(tabId, senderId, annotation){
  if(DEBUG) console.log(`INITIALIZNG GROK: TAB ${tabId} - SENDER ${senderId} - ANNOTATION: ${annotation}`)
  chrome.debugger.attach({ tabId }, "1.3", function() {
    if(DEBUG) console.log(`ATTACHED DEBUGGER @ TAB: ${tabId}`)
    // Enable Network Debugger to watch for requests coming out of grok 
    chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, function() {
      if(DEBUG) console.log(`ENABLING NETWORK SNIFFER @ TAB: ${tabId}`)
      handlePrompt(annotation.fullPrompt, tabId) 
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
                annotation.response = parseResponseBody(response.body) 
                annotation.waitingResponse = false
                // Sends response directly to origin tab
                chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: annotation }); 

                if(DEBUG) console.log(`DETACHING FROM TAB: ${tabId}`)
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