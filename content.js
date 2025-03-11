const EXT_NAME = "companion"
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
    <button type="submit" id="${EXT_NAME}-btn" class="${getClassName('upload-button')}">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5V19M12 5L6 11M12 5L18 11" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>  
    </button>
  </form>
`;

// Append the UI to the body and position it at the bottom
uiContainer.style.position = 'fixed';
uiContainer.style.bottom = '20px';
uiContainer.style.left = '50%';
uiContainer.style.transform = 'translateX(-50%)';
uiContainer.style.zIndex = '1000';
uiContainer.style.display = 'none';
document.body.appendChild(uiContainer);
document.querySelector(`.${getClassName('close-btn')}`).addEventListener("click", function(){
  document.querySelector(`.${getClassName('container')}`).style.display = 'none'
  document.querySelector(`.${getClassName('selection')}`).classList.remove(`${getClassName('selection')}`);
})
// Variables for selection, position, and annotations
let selectionPosition = { x: 0, y: 0 };
let annotationCounter = 0; // Track the number of annotations
const annotations = new Map(); // Map to store annotations and their linked <p> nodes

document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.key === "k") {
      event.preventDefault(); // Prevents default browser behavior (like search or hyperlink focus)
      console.log("Hello");
  }
});

let form = document.querySelector(`#${getClassName('prompt')}`)
form.addEventListener('submit', function (evt) {
  evt.preventDefault();
  let formData = new FormData(this); // Collects form data
  let prompt = formData.get("prompter");
  let selection = document.querySelector(`.${getClassName('selection')}`);
  //console.log(selection)
  this.parentNode.style.display = "none";
  this.reset()
  chrome.runtime.sendMessage({ type: "LLM_REQUEST", payload: {prompt, llm: "chatgpt"} }, function(annotation){
    console.log("-----")
    console.log(annotation)
    console.log("-----")
    let annotationLink = document.createElement("a");
    annotationLink.href=`#`
    annotationLink.className = `${getClassName(["annotation-link", `link-${annotation.submittedAt}`, "loading"])}`;
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
    selection.classList.add(getClassName(`annotation-${annotation.submittedAt}`))
  })
});
//todo:
// - wire response from llm 
// - test placing <selection> + <annotation> + <response>  what if selection is half <p> || <ul> ?   
// - save location of annotation for future visits

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "LLM_RESPONSE") {
    let llm = "chatGPT"
    let urlChat = "https://chatgpt.com/c/67ce6143-1008-800d-a4a6-59ae1306142e"
    let pendingAnnotation = document.querySelector('.'+getClassName("loading"));
    pendingAnnotation.innerText = `[${request.payload.count}]`;
    // Append the spinner inside the annotation span
    
    let annotationBox = document.createElement("div");
    annotationBox.className = getClassName('annotation-box')
    annotationBox.innerHTML = marked.parse(request.payload.response) 
    console.log(pendingAnnotation)
    pendingAnnotation.parentNode.insertBefore(annotationBox, pendingAnnotation.nextSibling);
    pendingAnnotation.classList.remove(getClassName('loading'));
  }
    
});