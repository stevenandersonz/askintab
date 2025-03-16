const askInTabExt = (() => {
  //---
  // GLOBALS
  //---  
  const EXT_NAME = "companion"
  let savedRange = null

  //---
  //UTILS
  //---
  function getClassName(className){
    if(Array.isArray(className)) return className.map(cls => EXT_NAME + '-' + cls).join(" ")
    if(typeof className === 'string') return EXT_NAME + '-' + className
  }

  function renderMarkdown(payload){
    const renderer = new marked.Renderer();
    renderer.code = (tokens) => {
      console.log(tokens)
      if (tokens.lang === "mermaid") {
        return `<div class="mermaid">${tokens.text}</div>`;
      }
      return `<pre><code class="${tokens.lang}">${tokens.raw}</code></pre>`;
    };
    return marked.parse(payload, {renderer})
  }
  
  function getColorMode (){
    const bgColor = getComputedStyle(document.body).backgroundColor; 
    const rgb = bgColor.match(/\d+/g).map(Number); 
    const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    return luminance > 0.5 ?'light':'dark'
  }

  function getElementPath(node) {
    const path = [];
    let current = node; 
    while (current) {
      if (current.tagName === "BODY") break
      const index = Array.prototype.indexOf.call(current.parentElement.childNodes, current);
      path.unshift(index);
      current = current.parentElement;
    }
    return path;
  }

  function findNodeByPath(path) {
    let current = document.body;
    for (let index of path) {
      current = current.childNodes[index];
    }
    return current; // Fallback to element if no text node
  }

  function saveRange(range){
    savedRange = {
      startContainerPath: getElementPath(range.startContainer),
      startOffset: range.startOffset,
      endContainerPath: getElementPath(range.endContainer),
      endOffset: range.endOffset
    }; 
  }

  //---
  // DOM MANIPULATION
  //---  

  function insertParentToSelection(selection, el="span"){
    let range = selection.getRangeAt(0)
    el = document.createElement(el);
    el.className = getClassName(["selection"]);
    let extractedContents = range.extractContents();
    el.appendChild(extractedContents);
    range.insertNode(el);
    selection.removeAllRanges();
    return el
  }

  function appendResponseLink(selection, id){
    let link = document.createElement("a");
    link.href=`#`
    link.className = `${getClassName(['link-'+id, "loading"])}`;
    link.innerHTML = `[<svg width="1em" height="1em" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; display: inline;">
        <circle cx="25" cy="25" r="20" stroke="blue" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="0">
          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
          <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite"/>
        </circle>
      </svg>]`;

    link.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent default link behavior
      let responseCnt = document.querySelector(`.${getClassName('response-'+id)}`) 
      if (responseCnt){
        responseCnt.classList.toggle(getClassName('hidden')); // Toggle visibility
        if(!responseCnt.classList.contains("hidden"))
          mermaid.run({ querySelector: ".mermaid" }); 
      }
      
    });

    selection.appendChild(link);
    selection.classList.remove(getClassName("selection"))
    selection.classList.add(getClassName('request-'+id))
  }
  
  function appendResponseBox(id, conversationURL, response){
    let links = document.querySelectorAll(`[class^=${getClassName('link')}]`)
    let pendingLink = document.querySelector('.'+getClassName(`link-${id}`));
    pendingLink.innerHTML=`[${links.length}]`
    let responseCnt = document.createElement("div");
    responseCnt.className = getClassName(['response-'+id, "hidden", getColorMode()])
    responseCnt.innerHTML = `
      <a href="${conversationURL}" target="_blank" rel="noopener noreferrer" class="${getClassName("llm-link")}">See in LLM</a>
    `
    let md = renderMarkdown(response)
    responseCnt.innerHTML += md
    if(pendingLink){
      pendingLink.parentNode.appendChild(responseCnt);
      pendingLink.classList.remove(getClassName('loading'));
    }
  }

  function loadResponse(responses) {
    if (!responses.length) return;
  
    const { startContainerPath, startOffset, endContainerPath, endOffset} = responses[0].rangeData;
    
    const startNode = findNodeByPath(startContainerPath);
    const endNode = findNodeByPath(endContainerPath);
    const range = document.createRange();
    range.setStart(startNode, Math.min(startOffset, startNode.length || 0));
    range.setEnd(endNode, Math.min(endOffset, endNode.length || 0));
    
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    let ret = insertParentToSelection(selection)
    appendResponseLink(ret, responses[0].id)
    appendResponseBox(responses[0].id, responses[0].conversationURL, responses[0].response)
  }

  function positionPopover(range, popover) {
    const rect = range.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth;
  
    // Position below selection, centered with selection midpoint
    let top = rect.bottom + window.scrollY + 10;
    let selectionMidpoint = rect.left + (rect.width / 2);
    let left = selectionMidpoint - (popoverWidth / 2) + window.scrollX;
  
    // Boundary checks
    if (left < 10) {
        left = 10;
    }
    if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
    }
  
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }



  //---
  // UI
  //--- 
  const popover = document.createElement('div');
  popover.classList = getClassName('popover')
  popover.innerHTML = `
    <form class="${getClassName('popover-form')}">
      <textarea id="${getClassName('textarea-ask')}" name="question" placeholder="ask anything"></textarea>
      <div class="${getClassName('cnt-ask')}">
        <select id="${getClassName('select-ask')}" name="llm"></select>
        <button id="${getClassName('btn-ask')}" type="submit">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-2xl"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.1918 8.90615C15.6381 8.45983 16.3618 8.45983 16.8081 8.90615L21.9509 14.049C22.3972 14.4953 22.3972 15.2189 21.9509 15.6652C21.5046 16.1116 20.781 16.1116 20.3347 15.6652L17.1428 12.4734V22.2857C17.1428 22.9169 16.6311 23.4286 15.9999 23.4286C15.3688 23.4286 14.8571 22.9169 14.8571 22.2857V12.4734L11.6652 15.6652C11.2189 16.1116 10.4953 16.1116 10.049 15.6652C9.60265 15.2189 9.60265 14.4953 10.049 14.049L15.1918 8.90615Z" fill="currentColor"></path></svg> 
        </button>
      </div>
    </form>
  `;
  let form = popover.querySelector("form")
  let textarea = popover.querySelector("textarea")



  // Initialization
  function init(){
    mermaid.initialize({ startOnLoad: true });
    document.body.appendChild(popover);
    setupEventListeners();
    setupChromeRuntimeListeners()
  };

  function setupEventListeners(){

    console.log("here")
    window.addEventListener('load', async () => {
      let res = await chrome.runtime.sendMessage({ type: "LOAD_PAGE" })
      if(res.requests.length > 0) loadResponse(res.requests)
    });
    
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target)) {
        popover.classList.remove(getClassName('open'));
        let sel = document.querySelector("."+getClassName("selection"))
        if (sel) sel.classList.remove(getClassName("selection"))
      }
    });
    
    document.addEventListener("keydown", async (event) => {
      let data = await chrome.storage.sync.get("shortcut")
      if (data.shortcut) {
        
        let shortcut = data.shortcut.toLowerCase();
        let pressedKeys = [];
        if (event.ctrlKey) pressedKeys.push("control");
        if (event.shiftKey) pressedKeys.push("shift");
        if (event.altKey) pressedKeys.push("alt");
        if (event.metaKey) pressedKeys.push("meta"); // Cmd on Mac

        pressedKeys.push(event.key.toLowerCase());
        if (pressedKeys.join(" + ") === shortcut) {
          event.preventDefault();
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            let range = selection.getRangeAt(0)
            saveRange(range)
            insertParentToSelection(selection) 

            positionPopover(range, popover);
            popover.classList.add(getClassName("open"))

            let input = popover.querySelector("textarea")
            input.focus()

            let llms = await chrome.runtime.sendMessage({ type: "LLM_INFO" })
            let llmDropdown = popover.querySelector("select")
            llmDropdown.innerHTML = ""
            for(let llm of llms){
              let option = document.createElement("option")
              option.value = llm.name
              option.innerHTML = llm.name
              llmDropdown.appendChild(option)
            }
          } 
        } 
      }
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { 
          e.preventDefault(); 
          form.dispatchEvent(new Event('submit'));
      }
    });
    
    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      let formData = new FormData(this); // Collects form data
      let question = formData.get("question");
      let llm = formData.get("llm");
      let selection = document.querySelector(`.${getClassName('selection')}`);
      popover.classList.remove(getClassName('open'))
      this.reset()
      let ret = await chrome.runtime.sendMessage({ type: "LLM_REQUEST", payload: {question, selectedText: selection.textContent, llm, savedRange}})
      if(ret.status === 'failure') return
      if (selection.textContent.length > 0){
        appendResponseLink(selection, ret.id)
      }
    });

  }
  function setupChromeRuntimeListeners(){
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "LLM_RESPONSE") {
        console.log(msg.payload)
        const {id, response, conversationURL} = msg.payload
        appendResponseBox(id, conversationURL, response)
      }
    
      if (msg.type === "LLM_TIMEOUT") {
        const { id } = msg.payload
        let pendingLink = document.querySelector('.'+getClassName(`link-${id}`));
        pendingLink.innerText = `[retry]`;
        pendingLink.classList.remove(getClassName("loading"))
      }
        
    });
  }
  return {init}
})()

askInTabExt.init();