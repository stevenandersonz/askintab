const EXT_NAME = "companion"
mermaid.initialize({ startOnLoad: true });

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

// Create the UI container (keeping the existing textarea and upload button)
function getClassName(className){
  if(Array.isArray(className)) return className.map(cls => EXT_NAME + '-' + cls).join(" ")
  if(typeof className === 'string') return EXT_NAME + '-' + className
}

const popover = document.createElement('div');
popover.classList = getClassName('popover')
popover.innerHTML = `
  <form class="${getClassName('popover-form')}">
    <textarea name="question" placeholder="ask anything then hit enter"></textarea>
  </form>
`;



document.addEventListener('click', (e) => {
  if (!popover.contains(e.target)) {
    popover.classList.remove('open');
    let sel = document.querySelector("."+getClassName("selection"))
    if (sel) sel.classList.remove(getClassName("selection"))
  }
});

document.body.appendChild(popover);

let storedShortcut = "";

// Load the stored shortcut
chrome.storage.sync.get("shortcut", (data) => {
    if (data.shortcut) storedShortcut = data.shortcut.toLowerCase();
});

function positionPopover(range) {
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

// Listen for keydown events
document.addEventListener("keydown", (event) => {
  chrome.storage.sync.get("shortcut", (data) => {
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
          console.log(selection)
          let range = selection.getRangeAt(0)
          popover.classList.toggle("open")
          positionPopover(range);
          let span = document.createElement("span");
          span.className = getClassName(["selection"]);
          let input = popover.querySelector("textarea")
          input.focus()
      
          let extractedContents = range.extractContents();
          span.appendChild(extractedContents);
          range.insertNode(span);
        } 
      } 
    }
  });
});
let form = popover.querySelector("form")
let textarea = popover.querySelector("textarea")

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      form.dispatchEvent(new Event('submit'));
  }
});

form.addEventListener('submit', function (evt) {
  evt.preventDefault();
  let formData = new FormData(this); // Collects form data
  let question = formData.get("question");
  let selection = document.querySelector(`.${getClassName('selection')}`);
  console.log(selection.textContent)
  this.parentNode.style.display = "none";
  this.reset()
  chrome.storage.sync.get("selectedLLM").then((llm)=>{
    chrome.runtime.sendMessage({ type: "LLM_REQUEST", payload: {question, selectedText: selection.textContent, llm: llm.selectedLLM}}, function(res){
      console.log(res)
      const {id, status} = res
      console.log(`id: ${id} - status ${status}`)
      if(status === 'failure') return
      if (selection.textContent.length > 0){
        let link = document.createElement("a");
        link.href=`#`
        link.className = `${getClassName(['link-'+id, "loading"])}`;
        link.addEventListener("click", (e) => {
          e.preventDefault(); // Prevent default link behavior
          console.log("here")
          let responseCnt = document.querySelector(`.${getClassName('response-'+id)}`) 
          if (responseCnt) {
              responseCnt.classList.toggle(getClassName('hidden')); // Toggle visibility
              return;
          }
        });
        // Append the spinner inside the annotation span
        selection.appendChild(document.createTextNode(" ")); // Space before the spinner
        selection.appendChild(link);
        selection.classList.remove(getClassName("selection"))
        selection.classList.add(getClassName('request-'+id))
      } 
    })
  })
});

chrome.runtime.onMessage.addListener((response, sender, sendResponse) => {
  if (response.type === "LLM_RESPONSE") {
    console.log(response)
    let links = document.querySelectorAll(`[class^=${getClassName('link')}]`)
    let pendingLink = document.querySelector('.'+getClassName(`link-${response.id}`));
    let responseCnt = document.createElement("div");
    responseCnt.className = getClassName(['response-'+response.id, "hidden", getColorMode()])
    responseCnt.innerHTML = `
      <a href="${response.conversationURL}" target="_blank" rel="noopener noreferrer" class="${getClassName("llm-link")}">See in LLM</a>
    `
    responseCnt.innerHTML += renderMarkdown(response.raw)
    if(pendingLink){
      pendingLink.innerText = `[${links.length}]`;
      pendingLink.parentNode.appendChild(responseCnt);
      pendingLink.classList.remove(getClassName('loading'));
    }
    
    mermaid.run({ querySelector: ".mermaid" }); 
  }
  if (response.type === "LLM_TIMEOUT") {
    let pendingLink = document.querySelector('.'+getClassName(`link-${response.id}`));
    pendingLink.innerText = `[retry]`;
    pendingLink.classList.remove(getClassName("loading"))
  }
    
});
