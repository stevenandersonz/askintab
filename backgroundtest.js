const LLMSETUP = {
  chatgpt: {
    selectors: {
      send:'button[data-testid="send-button"]',
      write:'#prompt-textarea',
      title: "div[title]"
    },
    watchFor: "https://chatgpt.com/backend-api/conversation",
    present: false,
    tabId: null,
    domain: "chatgpt.com",
    useMutationObserver: true,
    watchFor: "ChatGPT"
  },
  grok: {
    domain: "grok.com",
    selectors: {
      // TODO: grok doesnt use ids in its forms and since the extension appends a extra form we make sure whe don't select it
      send:'form button[type="submit"]:not(#companion-btn)',
      write:'form textarea:not(#companion-textarea)',
    },
    useMutationObserver: false,
    useNetworkDebugger: true,
    watchFor: "https://grok.com/rest/app-chat/conversations",
    dataParser: (d) => {
      d = d.split('\n')
      d = JSON.parse(d[d.length-2]) // final result comes here, prev items are tokens streamed
      //TODO: validate response
      console.log(`Parsed response ${JSON.stringify(d)}`)
      return d.result.modelResponse.message
    },
    present: false,
    tabId: null
  }
} 

// Check availables LLMS
for(let llm of Object.keys(LLMSETUP)){
  const urlPattern = `*://*.${LLMSETUP[llm].domain}/*`;
  chrome.tabs.query({ url: urlPattern }, function(tabs) {
    if(tabs.length <= 0) return
    if(tabs.length > 1) console.log(`more than one tab for ${llm} is present`) 
    console.log(`${llm} is avaible at tab id: ${tabs[0].id}`)
    LLMSETUP[llm].present = true 
    LLMSETUP[llm].tabId = tabs[0].id 
  });
}

let debuggerAttached = false
let activeLLM = null
let senderId = null //TODO: maybe future can hold multiple senders?

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    const { prompt, llm } = payload
    if (!LLMSETUP[llm].present && !LLMSETUP[llm].tabId) return  
    if (debuggerAttached) return
    const {tabId, selectors, useMutationObserver, useNetworkDebugger, watchFor} = LLMSETUP[llm]
    activeLLM = llm
    senderId = sender.tab.id
    console.log(`SENDING REQUEST from tab ${senderId} TO ${llm} at tab id: ${tabId}`)

    chrome.debugger.attach({ tabId }, "1.3", function() {
      console.log(`Attaching debugger to for request at tab id: ${tabId}`)
      debuggerAttached = true
      if(useNetworkDebugger){
        console.log(`Using Network debugger at tab id: ${tabId}`)
        // Enable Network domain to watch for net request made through the llm
        chrome.debugger.sendCommand(
          { tabId },
          "Network.enable",
          {},
          // as soon as we watch the network make llm specific request
          function() {
            chrome.scripting.executeScript({
              target: { tabId },
              func: selectPrompter,
              args: [selectors]
            }, () => onPrompterSelected(tabId, prompt, selectors));
          }
        );
      } 
      if(useMutationObserver){
        console.log(`Using MutationObserver at tab id: ${tabId}`)
        chrome.scripting.executeScript({
          target: { tabId },
          func: selectPrompter,
          args: [selectors]
        }, () => onPrompterSelected(tabId, prompt, selectors, useMutationObserver, senderId, watchFor));
      }
      

    });
  }
  if (type === "LLM_RESPONSE") {
    console.log(`Sending response to tab: ${senderId}}`)
    chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: payload }); 
  }
});


let targetRequestId = null;
chrome.debugger.onEvent.addListener(function (source, method, params) {
  // Step 1: Catch the response and store the requestId
  if (method === "Network.responseReceived") {
    if (params.response.url.startsWith(LLMSETUP[activeLLM].watchFor)) {
      targetRequestId = params.requestId; // Save the requestId
      // Check for streaming indicators
      const transferEncoding = params.response.headers["Transfer-Encoding"];
      console.log("Is it chunked?", transferEncoding || "No Transfer-Encoding header");
    }
  }
  // Step 3: Get the body when the response is "finished"
  else if (method === "Network.loadingFinished") {
    if (params.requestId === targetRequestId) {
      console.log("Loading finished for Request ID:", params.requestId);
      console.log("Total encoded data length:", params.encodedDataLength);

      // Now try to fetch the response body
      chrome.debugger.sendCommand(
        { tabId: source.tabId },
        "Network.getResponseBody",
        { requestId: targetRequestId },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error("Error getting response body:", chrome.runtime.lastError.message);
          } else if (response) {
            console.log(response)
            if(typeof response.body !== 'string') return
            chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: LLMSETUP[activeLLM].dataParser(response.body)});
            chrome.debugger.detach({ tabId: LLMSETUP[activeLLM].tabId });
            activeLLM=null
            senderId=null
          }
        }
      );
    }
  }
});

function selectPrompter(selectors) {
  var textArea = document.querySelector(selectors.write);
  if (textArea){
    console.log(`Found selector ${selectors.write}`)
    textArea.focus();
  } 
}

async function onPrompterSelected(tabId, prompt, selectors, useMutationObserver=false, senderId="", watchFor="") {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    chrome.debugger.detach({ tabId: tabId });
    debuggerAttached=false
    sendResponse({ success: false });
    return;
  }
  console.log(prompt)
  // we need the debugger because -> grok checks event.isTrusted - chatgpt doesnt
  await new Promise(resolve => 
    chrome.debugger.sendCommand(
      { tabId },
      "Input.insertText",
      { text: prompt },
      resolve
    )
  );
  console.log("----")
  console.log(tabId, prompt, selectors, useMutationObserver, senderId, watchFor)
  console.log("----")
  //TODO: I need to clean the params
  chrome.scripting.executeScript({
    target: { tabId },
    args: [selectors, senderId, useMutationObserver, watchFor],
    func: function(selectors, senderId, useMutationObserver=false, watchFor="") {
      console.log(`params: id:${senderId}, mo:${useMutationObserver}, WF:${watchFor}`)
      let btnSend = document.querySelector(selectors.send);
      if (btnSend){
        if (useMutationObserver){
          const targetNode = document.body;
          const config = { childList: true, subtree: true, characterData: true };
        
          const observer = new MutationObserver(function(mutationsList) {
            for (const mutation of mutationsList) {
              if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                    const text = node.textContent.trim();
                    //todo: title is only for gpt
                    const title = document.querySelector(selectors.title).title
                    if (text.startsWith(watchFor+title)) {
                      console.log("sending " + text.slice((watchFor+title).length))
                      chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload: text.slice((watchFor+title).length) });
                      chrome.debugger.detach({ tabId: senderId });
                      observer.disconnect()
                    }
                  }
                });
              }
            }
          });
          console.log("SEtting observer")
          observer.observe(targetNode, config);
        }
        console.log(`Found selector ${selectors.send}`)
        btnSend.click();
        console.log(`Selector ${selectors.write} clicked`)
      } 
    }
  }, function() {
    // detached debugger was here 
  });
}


// --- HANDLE Right click over selection and shows ask ai option
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
      id: "annotateText",
      title: "Annotate Selection",
      contexts: ["selection"] // Ensures it only appears when text is selected
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "annotateText" && info.selectionText) {
      chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: annotateSelection,
          args: [info.selectionText]
      });
  }
});

function annotateSelection(selectedText) {
  const EXT_NAME = "companion"
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    let range = selection.getRangeAt(0)
    let span = document.createElement("span");
    span.className = EXT_NAME + "-pending";

    // Extract the selected content and append it to the span
    let extractedContents = range.extractContents();
    span.appendChild(extractedContents);

    // Insert the span back into the document
    range.insertNode(span);

    let prompterContainer = document.querySelector(`.${EXT_NAME}-container`)
    let prompterInput = document.querySelector(`.${EXT_NAME}-textarea`)
    let selectionSpan = document.querySelector(`.${EXT_NAME}-pending`)
    if(prompterContainer){
      selectionSpan.classList.add(EXT_NAME + "-selection-effect")
      prompterContainer.style.display = "block"
      prompterInput.focus()
    }
  }
  // Perform the annotation action
}