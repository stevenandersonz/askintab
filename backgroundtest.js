let debuggerAttached = false
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === "simulateInput") {
    console.log("New Message")
    var prompt = "hello" 
    chrome.tabs.query({ url: "*://grok.com/*" }, function(tabs) {
      if (tabs.length > 0) {
        var tabId = tabs[0].id;
        if (debuggerAttached) return
        chrome.debugger.attach({ tabId: tabId }, "1.3", function() {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            sendResponse({ success: false });
            return;
          }
          console.log(`attaching to tab: ${tabId}`)
          debuggerAttached = true
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: selectPrompter
          }, () => onPrompterSelected(tabId, prompt));
        });
        
      } else {
        console.log("No tab found with the specified URL.");
        sendResponse({ success: false });
      }
    });
    return true; // Keep message channel open for sendResponse
  }
});

function selectPrompter() {
  var textArea = document.querySelector('form textarea:not(#companion-textarea)');
  if (textArea){
    console.log("Prompter Selected")
    textArea.focus();
  } 
}

function onPrompterSelected(tabId, prompt) {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    chrome.debugger.detach({ tabId: tabId });
    debuggerAttached=false
    sendResponse({ success: false });
    return;
  }
  setTimeout(function() {
    for (var i = 0; i < prompt.length; i++) {
      var char = prompt[i];
      var code = getKeyCode(char);
      console.log(`typing... char: ${char} code: ${code}`)
      chrome.debugger.sendCommand({ tabId: tabId }, "Input.dispatchKeyEvent", {
        type: "keyDown",
        key: char,
        code: code,
        text: char
      }, function(error) {
        // this is throwing errors, but it doesn't end the execution
        if (error) console.error(error);
      });
      chrome.debugger.sendCommand({ tabId: tabId }, "Input.dispatchKeyEvent", {
        type: "keyUp",
        key: char,
        code: code,
        text: char
      }, function(error) {
        if (error) console.error(error);
      });
    }
    setTimeout(function() {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function() {
          var btnSend = document.querySelector('form button[type="submit"]:not(#companion-btn)');
          if (btnSend){
            console.log(btnSend)
            btnSend.click();
          } 
        }
      }, function() {
        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
      });
      setTimeout(function() {
        console.log(`dettaching to tab: ${tabId}`)
        chrome.debugger.detach({ tabId: tabId });
        debuggerAttached=false  
      }, 200);
    }, 100);

  }, 100);
}
// Helper function to get the correct key code
function getKeyCode(char) {
  if (/^[a-z]$/i.test(char)) {
    return "Key" + char.toLocaleUpperCase();
  } else if (/^[0-9]$/.test(char)) {
    return "Digit" + char;
  } else {
    return char; // Fallback for other characters
  }
}