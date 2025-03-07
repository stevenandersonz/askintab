const LLMSETUP = {
  chatgpt: {
    selectors: {
      send:'button[data-testid="send-button"]',
      write:'#prompt-textarea',
    },
    responseStartsWith: "ChatGPT",
    present: false,
    tabId: null,
    domain: "chatgpt.com",
  },
  grok: {
    domain: "grok.com",
    selectors: {
      // TODO: grok doesnt use ids in its forms and since the extension appends a extra form we make sure whe don't select it
      send:'form button[type="submit"]:not(#companion-btn)',
      write:'form textarea:not(#companion-textarea)',
    },
    responseStartsWith: "",
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

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  const { type, payload } = message
  if (type === "LLM_REQUEST") {
    const { prompt, llm } = payload
    if (!LLMSETUP[llm].present && !LLMSETUP[llm].tabId) return  
    if (debuggerAttached) return
    const {tabId, selectors } = LLMSETUP[llm]
    console.log(`SENDING REQUEST TO ${llm} at tab id: ${tabId}`)

    chrome.debugger.attach({ tabId }, "1.3", function() {
      console.log(`Attaching debugger to for request at tab id: ${tabId}`)
      debuggerAttached = true
      
      // Enable Network domain
      chrome.debugger.sendCommand(
        { tabId },
        "Network.enable",
        {},
        function(error) {
          console.log(`Network debugging enabled for tab ${tabId}`);

          // Execute script after Network is enabled
          chrome.scripting.executeScript({
            target: { tabId },
            func: (sel) => selectPrompter(sel),
            args: [selectors]
          }, () => onPrompterSelected(tabId, prompt, selectors));
        }
      );

    });
  }
});


let targetRequestId = null;

chrome.debugger.onEvent.addListener(function (source, method, params) {
  // Step 1: Catch the response and store the requestId
  if (method === "Network.responseReceived") {
    if (params.response.url.startsWith("https://grok.com/rest/app-chat/conversations")) {
      targetRequestId = params.requestId; // Save the requestId
      console.log("Response received:", params.response.url);
      console.log("Type:", params.type); // "Fetch"
      console.log("Status:", params.response.status);
      console.log("Headers:", params.response.headers);
      console.log("Request ID:", targetRequestId);
      
      // Check for streaming indicators
      const transferEncoding = params.response.headers["Transfer-Encoding"];
      console.log("Is it chunked?", transferEncoding || "No Transfer-Encoding header");
    }
  }

  // Step 2: Monitor data as it arrives
  else if (method === "Network.dataReceived") {
    if (params.requestId === targetRequestId) {
      console.log("Data received - Chunk size:", params.dataLength, "bytes");
      console.log("Timestamp:", params.timestamp);
      // No raw data here, just confirming chunks are arriving
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
            //TODO: Response is NDJSON
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

async function onPrompterSelected(tabId, prompt, selectors) {
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

  chrome.scripting.executeScript({
    target: { tabId },
    args: [selectors],
    func: function(selectors) {
      let btnSend = document.querySelector(selectors.send);
      if (btnSend){
        console.log(`Found selector ${selectors.send}`)
        btnSend.click();
        console.log(`Selector ${selectors.write} clicked`)
      } 
    }
  }, function() {
    // detached debugger was here 
  });

   
}

setTimeout(()=>{
  console.log("detaching")
  chrome.debugger.detach({ tabId: LLMSETUP["grok"].tabId });
   debuggerAttached=false 
}, 1000*60*2)


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