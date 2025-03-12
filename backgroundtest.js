const annotations = {
  count: 0,
  saved: [],
  lastSaved: null,
  preprompt: "",
  selectedText: "",
  save: function(prompt,llm, cb){
    this.count += 1 
    let annotation = {
      count: annotations.count,
      waitingResponse:true,
      response: null,
      submittedAt: Date.now(),
      responseAt: null,
      selectedText: annotations.selectedText,
      prompt,
      llm,
    }
    this.saved.push(annotation)
    this.lastSaved = annotation
    this.selectedText = ""
    cb(this.lastSaved); 
  }
}


const LLMSETUP = {
  chatgpt: {
    // when answering it goes:
    // result-thinking -> result-streaming
    // result-streaming -> 

    selectors: {
      send:'button[data-testid="send-button"]',
      write:'#prompt-textarea',
      title: "div[title]"
    },
    present: false,
    tabId: null,
    domain: "chatgpt.com",
    mutationObserverConfig: {},

  },
  grok: {
    domain: "grok.com",
    selectors: {
      // TODO: grok doesnt use ids in its forms and since the extension appends a extra form we make sure whe don't select it
      send:'form button[type="submit"]:not(#companion-btn)',
      write:'form textarea:not(#companion-textarea)',
    },
    useNetworkDebugger: true,
    networkDebuggerConfig: {
      watchFor: "https://grok.com/rest/app-chat/conversations",
      onResponse: (d) => {
        d = d.split('\n')
        d = JSON.parse(d[d.length-2]) // final result comes here, prev items are tokens streamed
        //TODO: validate response
        console.log(`Parsed response ${JSON.stringify(d)}`)
        return d.result.modelResponse.message
      }
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
    const {tabId, networkDebuggerConfig, mutationObserverConfig} = LLMSETUP[llm]
    activeLLM = llm
    senderId = sender.tab.id
    console.log(`SENDING REQUEST from tab ${senderId} TO ${llm} at tab id: ${tabId}`)

    let fullPrompt =`${annotations.preprompt} \n ${prompt} \n  ${annotations.selectedText}`

    chrome.debugger.attach({ tabId }, "1.3", function() {
      console.log(`Attaching debugger to for request at tab id: ${tabId}`)
      debuggerAttached = true
      if(networkDebuggerConfig){
        console.log(`Using Network debugger at tab id: ${tabId}`)
        // Enable Network domain to watch for net request made through the llm
        chrome.debugger.sendCommand(
          { tabId },
          "Network.enable",
          {},
          // as soon as we watch the network make llm specific request
          function() {
            handlePrompt(fullPrompt)
          }
        );
      } 
      if(mutationObserverConfig){
        console.log(`Using MutationObserver at tab id: ${tabId}`)
        handlePrompt(fullPrompt)
      }
    });

    annotations.save(prompt, llm, sendResponse) 
  }
  if (type === "LLM_RESPONSE") {
    console.log(`Sending response to tab: ${senderId}}`)
    annotations.lastSaved.response = payload
    annotations.lastSaved.waitingResponse = false
    chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: annotations.lastSaved }); 
  }
});

function handlePrompt(prompt){
  const {selectors, tabId, mutationObserverConfig} = LLMSETUP[activeLLM] 
  // executeScript sents func and executes it into the tab web context
  chrome.scripting.executeScript({
    target: { tabId },
    func: function (selectors) {
      let textArea = document.querySelector(selectors.write);
      if (textArea){
        console.log(`Found selector ${selectors.write}`)
        textArea.focus();
      } 
    },
    args: [selectors]},
    // this callback is executed after func in the serviceWorker context
    async () => {
      // debugger.command is needed since llm like grok checks for event.isTrusted === true
      await new Promise(resolve => 
        chrome.debugger.sendCommand(
          { tabId },
          "Input.insertText",
          { text: prompt },
          resolve
        )
      );

      chrome.scripting.executeScript({
        target: { tabId },
        args: [selectors, mutationObserverConfig ? mutationObserverConfig : false],
        func: function(selectors, mutationObserverConfig) {
          let btnSend = document.querySelector(selectors.send);
          if (btnSend){
            if (mutationObserverConfig){
              // Observe the mutations on the DOM, and return the text if match watchFor
              const observer = new MutationObserver(function(mutationsList) {
                for (const mutation of mutationsList) {
                  if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                      if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                        let watchFor = "ChatGPT" + document.title
                        if (node.textContent.trim().startsWith(watchFor)) {
                          console.log("Found Match, sending response")
                          chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload: node.textContent.trim().slice(watchFor.length) });
                          observer.disconnect()
                        }
                      }
                    });
                  }
                }
              });
              observer.observe(document.body, { childList: true, subtree: true, characterData: true});
            }
            btnSend.click();
            console.log(`Selector ${selectors.write} clicked`)
          } 
        }
      }, function() {
        console.log("Detaching debugger")
        if(!mutationObserverConfig) return true
        debuggerAttached = false
        chrome.debugger.detach({ tabId }) 
      });
    }
  );
}

let targetRequestId = null;
chrome.debugger.onEvent.addListener(function (source, method, params) {
  const {watchFor, onResponse} = LLMSETUP[activeLLM].networkDebuggerConfig
  // Step 1: Catch the response and store the requestId
  if (method === "Network.responseReceived") {
    if (params.response.url.startsWith(watchFor)){
      console.log(`response received from: ${watchFor}`)
      targetRequestId = params.requestId; // Save the requestId
    }
  }
  // Step 3: Get the body when the response is "finished"
  else if (method === "Network.loadingFinished") {
    if (params.requestId === targetRequestId) {
      // Now try to fetch the response body
      chrome.debugger.sendCommand(
        { tabId: source.tabId },
        "Network.getResponseBody",
        { requestId: targetRequestId },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error("Error getting response body:", chrome.runtime.lastError.message);
          } else if (response) {
            if(typeof response.body !== 'string') return
            console.log(`Sending body content to tab: ${senderId}`)
            annotations.lastSaved.response = onResponse(response.body) 
            annotations.lastSaved.waitingResponse = false
            chrome.tabs.sendMessage(senderId, { type: "LLM_RESPONSE", payload: annotations.lastSaved }); 
            chrome.debugger.detach({ tabId: LLMSETUP[activeLLM].tabId });
            debuggerAttached=false
            activeLLM=null
            senderId=null
          }
        }
      );
    }
  }
});

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
    annotations.selectedText = info.selectionText
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
    span.className = EXT_NAME + "-selection";

    // // Extract the selected content and append it to the span
    // TODO: this method will clone part of a selected object and insert it back into the parent. maybe selection should find the closest block?
    let extractedContents = range.extractContents();
    span.appendChild(extractedContents);

    // // Insert the span back into the document
    range.insertNode(span);

    let prompterContainer = document.querySelector(`.${EXT_NAME}-container`)
    let prompterInput = document.querySelector(`.${EXT_NAME}-textarea`)
    if(prompterContainer){
      prompterContainer.style.display = "block"
      prompterInput.focus()
    }
  }
  // Perform the annotation action
}