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

const uiContainer = document.createElement('div');
uiContainer.className = getClassName('container');
uiContainer.innerHTML = `
  <button id="${EXT_NAME}-close-btn" class="${getClassName('close-btn')}">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 9L12 15L18 9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
  </button>
  <form id="${EXT_NAME}-prompt">
    <textarea name="prompter" id="${EXT_NAME}-textarea" class="${getClassName('textarea')}" placeholder="What do you want to know?"></textarea>
    <div class="${getClassName('action-container')}">
      <select name="${getClassName('dropdown')}" class="${getClassName('dropdown')}">
      </select>
    <button type="submit" id="${EXT_NAME}-btn" class="${getClassName('upload-button')}">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5V19M12 5L6 11M12 5L18 11" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>  
    </button>
    </div>
  </form>
`;

uiContainer.style.display = 'none';
document.body.appendChild(uiContainer);
document.querySelector(`.${getClassName('close-btn')}`).addEventListener("click", function(){
  document.querySelector(`.${getClassName('container')}`).style.display = 'none'
  document.querySelector(`.${getClassName('selection')}`).classList.remove(`${getClassName('selection')}`);
})

let selectedText = ""
document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.key === "k") {
    console.log("HERE")
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      chrome.runtime.sendMessage({ type: "LLM_INFO"}, function(llms){
        let range = selection.getRangeAt(0)
        let span = document.createElement("span");
        span.className = getClassName("selection");
    
        // // Extract the selected content and append it to the span
        // TODO: this method will clone part of a selected object and insert it back into the parent. maybe selection should find the closest block?
        let extractedContents = range.extractContents();
        span.appendChild(extractedContents);
    
        // // Insert the span back into the document
        range.insertNode(span);
        
        let prompterContainer = document.querySelector(`.${getClassName('container')}`)
        let llmDropdown = document.querySelector(`.${getClassName('dropdown')}`)
        llmDropdown.innerHTML = ""
        for(let llm of llms){
          let option = document.createElement("option")
          option.value=llm.name
          option.innerHTML=llm.name
          llmDropdown.appendChild(option)
        }
        let prompterInput = document.querySelector(`.${getClassName('textarea')}`)
        if(prompterContainer){
          selectedText = range.toString()
          prompterContainer.style.display = "block"
          prompterInput.focus({ preventScroll: true })
        }
      })
    } 
  }
});

let form = document.querySelector(`#${getClassName('prompt')}`)
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
    let annotationLink = document.createElement("a");
    annotationLink.href=`#`
    annotationLink.className = `${getClassName(["annotation-link", `link-${id}`, "loading"])}`;
    annotationLink.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent default link behavior
      console.log("here")
      let existingBox = annotationLink.nextElementSibling;
      if (existingBox && existingBox.classList.contains(getClassName('annotation-box'))) {
          existingBox.classList.toggle(getClassName('hidden')); // Toggle visibility
          return;
      }
    });
    // Append the spinner inside the annotation span
    selection.appendChild(document.createTextNode(" ")); // Space before the spinner
    selection.appendChild(annotationLink);
    selection.classList.remove(getClassName("selection"))
    selection.classList.add(getClassName(`annotation-${id}`))
  })
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "LLM_RESPONSE") {
    console.log(request)
    let pendingAnnotation = document.querySelector('.'+getClassName(`link-${request.payload.id}`));
    pendingAnnotation.innerText = `[${request.payload.count}]`;
    // Append the spinner inside the annotation span
    
    let annotationBox = document.createElement("div");
    annotationBox.className = getClassName('annotation-box')
    annotationBox.innerHTML = renderMarkdown(request.payload.raw)
    pendingAnnotation.parentNode.insertBefore(annotationBox, pendingAnnotation.nextSibling);
    pendingAnnotation.classList.remove(getClassName('loading'));
    mermaid.run({ querySelector: ".mermaid" });
  }
  if (request.type === "LLM_TIMEOUT") {
    console.log(request)
    let pendingAnnotation = document.querySelector('.'+getClassName(`link-${request.payload.id}`));
    console.log(pendingAnnotation)
    pendingAnnotation.innerText = `[retry]`;
    pendingAnnotation.classList.remove(getClassName("loading"))
  }
    
});