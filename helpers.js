export function cleanUrl(url) {
  try {
      const urlObj = new URL(url);
      return urlObj.protocol + '//' + urlObj.hostname + urlObj.pathname;
  } catch (e) {
      console.error('Invalid URL:', url, e);
      return url; 
  }
}

export function selectTextArea(selector){
  let textArea = document.querySelector(selector);
  if (textArea){
    textArea.focus();
  } 
}

export function selectAndWriteTextArea(selector,value){
  let textArea = document.querySelector(selector);
  if (textArea){
    textArea.focus();
    console.log("INSERTING TEXT: " + value)
    document.execCommand("insertText", false, value)
  } 
}

export function submitPrompt(selector) {
  let btnSend = document.querySelector(selector);
  if (btnSend){
    btnSend.click();
  } 
}

export function watchForResponse (id, name){
  let log = (msg) => chrome.runtime.sendMessage({type: "DEBUG", payload: msg})
  const observer = new MutationObserver(function(mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            let text = node.textContent.trim()
            log("MUTATION: " + node.textContent)
            chrome.runtime.sendMessage({ type: "PING", payload:{name}});
            if(typeof text === "string" && text.includes("STARTREQ"+id) && !text.includes("IGNORE"+id) && text.includes("ENDREQ"+id)){
              let responses = document.querySelectorAll(".prose")
              let raw = responses[responses.length-1]
              raw = raw.textContent.split('\n').slice(1, -1).join('\n'); 
              chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{raw, name, responseAt: new Date()}});
              observer.disconnect()
            }
         }
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true});
}
