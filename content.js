const askInTabExt = (() => {
  //---
  // GLOBALS
  //---  
  const EXT_NAME = "companion"
  let savedRange = null
  let focusedElement = null

  const styles = `
    .popover {
      position: absolute;
      background-color: #2c2c2e;
      border-radius: 8px;
      padding: 5px;
      width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease-out;
      z-index: 1000;
      font-size: 14px;
    }

    .popover::before {
      content: '';
      position: absolute;
      width: 0;
      height: 0;
      border: 6px solid transparent;
      border-bottom-color: #2c2c2e;
      top: -12px;
      left: calc(50% - 6px);
    }

    .open {
      opacity: 1;
      visibility: visible;
    }

    .popover-close {
      border: none;
      background-color: transparent;
      height: 15px;
      width: 15px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      padding: 0;
      top: -3px; 
      right: -2px;
      position:absolute;
    }

    .popover-close:hover {
      border: 1px solid #3f3f41;
      color: black;
      border-radius: 8px;
    }

    .cnt-ask button {
      align-self: center;
      border: 1px solid #2c2c2e; /* Match the crew */
      color: #000000; /* Black icon/text */
      height: 30px;
      width: 30px;
      background-color: #ffffff;
      border-radius: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: Arial, sans-serif; /* Same font */
      font-size: 16px; /* Slightly bigger for button */
      cursor: pointer; /* Clickable vibe */
      padding: 0; /* No extra fluff */
    }

    .cnt-ask button:hover { background-color: #c3c2c2; }

    textarea {
      width:100%;
      color: white;
      caret-color: white;
      background-color: #2c2c2e; /* Match button bg for consistency */
      border: 1px solid #2c2c2e; /* Clear border, no surprises */
      border-radius: 4px; /* Soft corners */
      font-family: Arial, sans-serif; /* Standard font */
      font-size: 14px; /* Readable size */
      line-height: 1.5; /* Nice spacing */
      resize: vertical; /* Only stretch up/down */
      min-height: 60px; /* Minimum size */
    }

    textarea:focus {
      outline: none;
    }

    select {
      width: 80px;
      background-color: #2c2c2e; /* Keep your dark vibe */
      border: 1px solid #2c2c2e; /* Match textarea */
      border-radius: 4px; /* Consistent corners */
      padding: 8px; /* Same as textarea */
      font-family: Arial, sans-serif; /* Same font */
      font-size: 14px; /* Same size */
      line-height: 1.5; /* Same spacing */
      color: #ffffff; /* White text stays */
      appearance: none; /* Kill browser defaults */
      cursor: pointer; /* Feels clickable */
      background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>');
      background-repeat: no-repeat;
      background-position: right 8px center; /* Arrow on the right */
      background-size: 12px; /*
    }
`
  
  //---
  // UI
  //--- 

  const highlight = document.createElement("span");
  highlight.className = getClassName("selection");

  const spinner = `<svg width="1em" height="1em" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; display: inline;">
  <circle cx="25" cy="25" r="20" stroke="blue" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="0">
    <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite"/>
  </circle>
  </svg>`

  const rLink = document.createElement("a");
  rLink.href=`#`
  rLink.className=getClassName("link")
  rLink.setAttribute('style',"z-index: 1000; text-decoration: underline; cursor: pointer; color: blue;")
  rLink.innerHTML = `[${spinner}]`;

  const shadowContainer = document.createElement('div');
  shadowContainer.id = 'popover-shadow-container';

  const popover = document.createElement('div');
  popover.classList = 'popover'

  const shadowRoot = shadowContainer.attachShadow({ mode: 'open' });

  const style = document.createElement("style")
  style.textContent = styles

  popover.innerHTML = `
    <form style="display: flex; flex-direction: column; gap: 5px; margin-block-end: 0px;">
      <div style="position: relative; width:100%;">
      <button type="button" class="popover-close">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
      </button>
      <textarea name="question" placeholder="ask anything"></textarea>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: #3f3f41 solid 2px; padding: 8px;" class='cnt-ask'>
        <select name="llm"></select>
        <button type="submit">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-2xl"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.1918 8.90615C15.6381 8.45983 16.3618 8.45983 16.8081 8.90615L21.9509 14.049C22.3972 14.4953 22.3972 15.2189 21.9509 15.6652C21.5046 16.1116 20.781 16.1116 20.3347 15.6652L17.1428 12.4734V22.2857C17.1428 22.9169 16.6311 23.4286 15.9999 23.4286C15.3688 23.4286 14.8571 22.9169 14.8571 22.2857V12.4734L11.6652 15.6652C11.2189 16.1116 10.4953 16.1116 10.049 15.6652C9.60265 15.2189 9.60265 14.4953 10.049 14.049L15.1918 8.90615Z" fill="currentColor"></path></svg> 
        </button>
        <input type="hidden" name="reqType"></input>
        <input type="hidden" name="parentReqId"></input>
      </div>
    </form>
  `;

  shadowRoot.appendChild(style);
  shadowRoot.appendChild(popover);

  const form = popover.querySelector("form")
  const popoverCloseBtn = popover.querySelector(".popover-close")
  const textarea = popover.querySelector("textarea")
  const llmSelect = popover.querySelector("select")
  const reqTypeInput = popover.querySelector("input[name='reqType']")
  const parentReqIdInput = popover.querySelector("input[name='parentReqId']")

  //response UI
  const mdCnt = document.createElement("div");
  mdCnt.classList.add(getClassName("md-content"))
  mdCnt.setAttribute('style',"background-color: transparent; padding: 0; margin: 0;")


  const followUpsCnt = document.createElement("div"); 
  followUpsCnt.classList.add(getClassName("followups-cnt"))

  const responseCnt = document.createElement("div");
  responseCnt.className = getClassName(['response-cnt', "hidden", getColorMode()])
  responseCnt.appendChild(mdCnt)
  responseCnt.appendChild(followUpsCnt)


  //---
  //UTILS
  //---
  // content.js
 

  function setPasteEvent(text){
    let pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer()
    });
    pasteEvent.clipboardData.setData("text/plain", text);
    return pasteEvent
  }

  function setSpinner(){
    const rect = focusedElement.getBoundingClientRect();
    const spinnerCnt = document.createElement("div")
    spinnerCnt.id = getClassName("waiting")
    spinnerCnt.style.position = "absolute";
    spinnerCnt.style.fontSize = '1.5rem';
    spinnerCnt.style.left = `${rect.left}px`;
    spinnerCnt.style.top = `${rect.top}px`; // above the element
    spinnerCnt.style.zIndex = 10000 
    spinnerCnt.innerHTML = spinner
    document.body.appendChild(spinnerCnt);
  }  
  

  function getClassName(className){
    if(Array.isArray(className)) return className.map(cls => EXT_NAME + '-' + cls).join(" ")
    if(typeof className === 'string') return EXT_NAME + '-' + className
  }

  function renderMarkdown(payload){
    const renderer = new marked.Renderer();
    renderer.code = (tokens) => {
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

  function getFocusedEditableElement() {
    const activeElement = document.activeElement;
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') return activeElement;
    if (activeElement.isContentEditable) return activeElement;
    return null;
  }

  //---
  // DOM MANIPULATION
  //---  


  function createHighlight(selection, id="pending"){
    let range = selection.getRangeAt(0)
    clonedHighlight = highlight.cloneNode()
    clonedHighlight.id = getClassName("request-"+id)
    let extractedContents = range.extractContents();
    clonedHighlight.appendChild(extractedContents);
    range.insertNode(clonedHighlight);
    selection.removeAllRanges();
    return clonedHighlight 
  }

  function createLink(){
    let link = rLink.cloneNode(true)
    link.addEventListener("click", function(e){
      e.preventDefault(); // Prevent default link behavior
      let responseCnt = this.nextElementSibling
      if (responseCnt && responseCnt.tagName === "DIV"){
        responseCnt.classList.toggle(getClassName('hidden')); // Toggle visibility
        if(!responseCnt.classList.contains("hidden"))
          mermaid.run({ querySelector: ".mermaid" }); 
      }
    });
    return link
  }
  
  function createResponseCnt(req){
    let newResponseCnt = responseCnt.cloneNode(true);
    newResponseCnt.children[0].innerHTML = renderMarkdown(`### ${req.question} \n ${req.response}`) 
    newResponseCnt.children[0].id = getClassName("md-"+req.id)

    for(let fu of [...req.followUps, "I want to ask something else"]){
      let btn = document.createElement("button")
      btn.className = getClassName("followup-btn") 
      btn.innerText = fu
      newResponseCnt.children[1].appendChild(btn)
    }
    newResponseCnt.addEventListener("click", async (evt) => {
      if (evt.target.className === getClassName("followup-btn")){
        let parentId = newResponseCnt.parentElement.id.split('-').pop()
        let clone = mdCnt.cloneNode(false)
        newResponseCnt.lastChild.before(clone)
        positionPopover(evt.target)
        openPopover("FOLLOWUP", Number(parentId))
        if(evt.target.textContent.toUpperCase() !== "I want to ask something else".toUpperCase()){
          textarea.value = evt.target.textContent 

        }
        return
      }
      
    })

    return newResponseCnt
  }

  function positionPopover(el) {
    const rect = el.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth;
  
    let top = rect.bottom + window.scrollY + 10;
    let selectionMidpoint = rect.left + (rect.width / 2);
    let left = selectionMidpoint - (popoverWidth / 2) + window.scrollX;
  
    if (left < 10) left = 10;
    if (left + popoverWidth > window.innerWidth - 10) left = window.innerWidth - popoverWidth - 10;
  
    shadowContainer.style.position = 'absolute';
    shadowContainer.style.top = `${top}px`;
    shadowContainer.style.left = `${left}px`; 
  }

  async function openPopover(reqType, parentReqId=null){
    popover.classList.add("open")
    textarea.focus()

    let llms = await chrome.runtime.sendMessage({ type: "LLM_INFO" })
    console.log(llms)
    llmSelect.innerHTML = ""
    for(let llm of llms){
      let option = document.createElement("option")
      option.value = llm
      option.innerHTML = llm
      llmSelect.appendChild(option)
    }
    reqTypeInput.value = reqType
    parentReqIdInput.value = parentReqId
  }
  
  function loadResponse(responses) {
    if (!responses.length) return;
    console.log(responses)
    for (let r of responses){
      if(r.type === "INIT_CONVERSATION"){
        const { startContainerPath, startOffset, endContainerPath, endOffset} = r.savedRange;
        const startNode = findNodeByPath(startContainerPath);
        const endNode = findNodeByPath(endContainerPath);
        const range = document.createRange();
        range.setStart(startNode, Math.min(startOffset, startNode.length || 0));
        range.setEnd(endNode, Math.min(endOffset, endNode.length || 0));
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        let highlight = createHighlight(selection, r.id)
        let link = createLink(r.id)
        highlight.appendChild(link);
        highlight.classList.remove(getClassName("selection"))
        highlight.appendChild(link)
        link.innerHTML = `[${document.querySelectorAll("."+ rLink.className).length}]`
        let newResponseCnt = createResponseCnt(r)
        highlight.appendChild(newResponseCnt)
      }
      if(r.type === "FOLLOWUP"){
        let resCnt = document.querySelector("#" + getClassName("request-" + r.parentId)+" ."+getClassName("response-cnt")) 
        console.log(resCnt)
        let newMdCnt = mdCnt.cloneNode(false) 
        newMdCnt.innerHTML = renderMarkdown(`### ${r.question} \n ${r.response}`)
        newMdCnt.id = r.id 
        resCnt.lastChild.before(newMdCnt)
        fuCnt = newMdCnt.nextElementSibling
        for (let i = 0; i < r.followUps.length; i++){
          fuCnt.children[i].innerText = r.followUps[i]
        }
      }
    }
    
  }

  // Initialization
  function init(){
    mermaid.initialize({ startOnLoad: true });
    document.body.appendChild(shadowContainer);
    setupEventListeners();
    setupChromeRuntimeListeners()
  };

  function setupEventListeners(){

    window.addEventListener('hashchange', () => {
      let mdCnt = document.querySelector(window.location.hash)
      mdCnt.parentElement.classList.remove(getClassName("hidden"))
      mdCnt.scrollIntoView({behavior: 'smooth'})
    })

    window.addEventListener('load', async () => {
      let res = await chrome.runtime.sendMessage({ type: "LOAD_PAGE" })
      if(res.requests.length > 0) loadResponse(res.requests)
      if(window.location.hash){
        let mdCnt = document.querySelector(window.location.hash)
        if(!mdCnt)return
        mdCnt.parentElement.classList.remove(getClassName("hidden"))
        mdCnt.scrollIntoView({behavior: 'smooth'})
      }
    });
    
    popoverCloseBtn.addEventListener('click', (e) => {
      popover.classList.remove('open')
      let sel = document.querySelector("."+getClassName("selection"))
      if (sel) sel.classList.remove(getClassName("selection"))
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
          if (selection.rangeCount === 1) {
            let range = selection.getRangeAt(0)
            if (range.startOffset === range.endOffset){
              let editableElement = getFocusedEditableElement()
              if (editableElement){
                focusedElement = editableElement
                positionPopover(editableElement, popover); 
                openPopover("STANDALONE")
              }
              return
            } 
            saveRange(range)
            createHighlight(selection) 
            positionPopover(range, popover);
            openPopover("INIT_CONVERSATION")
            return
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
      let type = formData.get("reqType");
      let llm = formData.get("llm");
      let parentReqId = formData.get("parentReqId");
      let highlight = document.querySelector(`#${getClassName('request-pending')}`);
      form.querySelectorAll("input, textarea").forEach(input => input.value = "");
      popover.classList.remove('open')
      this.reset()
      let ret; 
      let payload=null
      if(type === "STANDALONE"){
        setSpinner() 
        payload = {question, llm, type} 
      } 
      if(type === "INIT_CONVERSATION") payload = {question, selectedText: highlight.textContent, llm, savedRange, type}
      if(type === "FOLLOWUP"){
        let rCnt = document.querySelector(`#${getClassName('request')}-${parentReqId}`).lastChild 
        let fuCnt = rCnt.lastChild
        fuCnt.classList.add(getClassName("hidden"))
        fuCnt.previousElementSibling.innerHTML = spinner
        fuCnt.previousElementSibling.classList.add(getClassName("loading"))
        payload = {question, llm, type, parentReqId}
      }

      ret = await chrome.runtime.sendMessage({ type: "LLM_REQUEST", payload })
      if (type === "INIT_CONVERSATION" && highlight.textContent.length > 0){
        highlight.id = getClassName("request-" + ret.id)
        let link = createLink(ret.id)
        highlight.appendChild(link);
        highlight.classList.remove(getClassName("selection"))
      }
    });
  }

  function setupChromeRuntimeListeners(){
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "LLM_RESPONSE") {
        console.log(msg.payload)
        const {type, id, parentId, question, response, followUps } = msg.payload
        if(type === "STANDALONE" && focusedElement){
          document.querySelector("#"+getClassName("waiting")).remove()
          let pasteEvt = setPasteEvent(response) 
          focusedElement.focus()
          document.activeElement.dispatchEvent(pasteEvt)
          return
        }

        if(type === "INIT_CONVERSATION" ){
          let req = document.querySelector("#" + getClassName("request-" + id)) 
          let pendingLink = req.querySelector('.'+rLink.className)
          pendingLink.innerHTML = `[${document.querySelectorAll(`[id^='${getClassName("request-")}']`).length}]`
          let newResponseCnt = createResponseCnt(msg.payload)
          pendingLink.parentElement.appendChild(newResponseCnt)
          return
        } 

        if(type === "FOLLOWUP" ){
          let req = document.querySelector("#" + getClassName("request-" + parentId)) 
          let mdCnt = req.querySelector("."+getClassName("loading"))
          mdCnt.classList.remove(getClassName('loading'));
          mdCnt.id=getClassName("md-"+id)
          mdCnt.innerHTML = renderMarkdown(renderMarkdown(`### ${question} \n ${response}`))
          fuCnt = mdCnt.nextElementSibling
          fuCnt.classList.remove(getClassName("hidden"))
          for (let i = 0; i < followUps.length; i++){
            fuCnt.children[i].innerText = followUps[i]
          }
          return
        }
      }
      // Send data to popup when requested

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
