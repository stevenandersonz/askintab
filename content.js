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

// Create the UI container (keeping the existing textarea and upload button)
function getClassName(className){
  if(Array.isArray(className)) return className.map(cls => EXT_NAME + '-' + cls).join(" ")
  if(typeof className === 'string') return EXT_NAME + '-' + className
}

const popover = document.createElement('div');
popover.classList = getClassName('popover')
popover.innerHTML = `
  <form class="${getClassName('popover-form')}">
    <textarea name="question" placeholder="ask anything"></textarea>
    <button type="submit">Ask</button>
  </form>
`;
document.addEventListener('click', (e) => {
  if (!popover.contains(e.target)) {
      popover.classList.remove('open');
      document.querySelector("."+getClassName("selection")).classList.remove(getClassName("selection"))
  }
});
document.body.appendChild(popover);

let selectedText = ""
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
      
          // TODO: this method will clone part of a selected object and insert it back into the parent. maybe selection should find the closest block?
          let extractedContents = range.extractContents();
          span.appendChild(extractedContents);
          range.insertNode(span);
          selectedText = range.toString()
        } 
      } 
    }
  });
});

let form = popover.querySelector("form")
form.addEventListener('submit', function (evt) {
  evt.preventDefault();
  let formData = new FormData(this); // Collects form data
  let question = formData.get("prompter");
  let llm = formData.get(getClassName("dropdown"));
  console.log(llm)
  let selection = document.querySelector(`.${getClassName('selection')}`);
  //console.log(selection)
  this.parentNode.style.display = "none";
  this.reset()
  chrome.runtime.sendMessage({ type: "LLM_REQUEST", payload: {question, llm, selectedText}}, function({id, status}){
    console.log(`id: ${id} - status ${status}`)
    if(status === 'failure') return
    if (selectedText.length > 0){
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
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "LLM_RESPONSE") {
    console.log("RESPONSE")
    console.log(request)
    let links = document.querySelectorAll(`[class^=${getClassName('link')}]`)
    let pendingLink = document.querySelector('.'+getClassName(`link-${request.payload.id}`));
    let responseCnt = document.createElement("div");
    responseCnt.className = getClassName(['response-'+request.payload.id])
    responseCnt.innerHTML = renderMarkdown(request.payload.raw)
    if(pendingLink){
      pendingLink.innerText = `[${links.length}]`;
      pendingLink.parentNode.appendChild(responseCnt);
      pendingLink.classList.remove(getClassName('loading'));
    }
    
    mermaid.run({ querySelector: ".mermaid" });
  }
  if (request.type === "LLM_TIMEOUT") {
    let pendingLink = document.querySelector('.'+getClassName(`link-${request.payload.id}`));
    pendingLink.innerText = `[retry]`;
    pendingLink.classList.remove(getClassName("loading"))
  }
    
});