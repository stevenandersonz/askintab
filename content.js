const EXT_NAME = "companion"
// Create the UI container (keeping the existing textarea and upload button)
const uiContainer = document.createElement('div');
uiContainer.className = EXT_NAME + '-container';
uiContainer.innerHTML = `
  <form id="${EXT_NAME}-prompt">
    <textarea name="prompter" id="${EXT_NAME}-textarea" class="${EXT_NAME}-textarea" placeholder="What do you want to know?"></textarea>
    <button type="submit" id="${EXT_NAME}-btn" class="${EXT_NAME}-upload-button">Upload</button>
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

let form = document.querySelector(`#${EXT_NAME}-prompt`)
form.addEventListener('submit', function (evt) {
  evt.preventDefault();
  let formData = new FormData(this); // Collects form data
  let prompt = formData.get("prompter");
  let ctx = document.querySelector("span." + EXT_NAME + "-pending");
  this.parentNode.style.display = "none";

  if (ctx) {
      // Create a spinner element
      //chrome.runtime.sendMessage({ type: "PROMPT_REQUEST",  })
    chrome.runtime.sendMessage({ type: "LLM_REQUEST", payload: {prompt:`${prompt} \n ${ctx.innerText}`, llm: "grok"} })
    let spinner = document.createElement("span");
    spinner.className = EXT_NAME + "-annotation-spinner";
    spinner.innerHTML = "⏳"; // Placeholder spinner icon (can be replaced with a proper CSS spinner)

    // Append the spinner inside the annotation span
    ctx.appendChild(document.createTextNode(" ")); // Space before the spinner
    ctx.appendChild(spinner);
    this.reset()
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "LLM_RESPONSE") {
    console.log("-----")
    console.log(request.payload)
    console.log("-----")
    if(typeof request.payload.data !== 'string') return
    let spinner = document.querySelector(`.${EXT_NAME}-annotation-spinner`)
    if(!spinner) return
    let annotations = document.querySelectorAll("a." + EXT_NAME + "-annotation-link") || [];
    let ctx = document.querySelector("span." + EXT_NAME + "-pending");
    ctx.className = `${EXT_NAME}-annotation-context ${EXT_NAME}-has-annotation`;

    // Create an <a> element with annotation number
    let annotationLink = document.createElement("a");
    annotationLink.className = EXT_NAME + "-annotation-link";
    annotationLink.textContent = `[${annotations.length}]`;
    annotationLink.href = "#"; // Placeholder, modify as needed

    ctx.replaceChild(annotationLink, spinner); 
    // Add hover event listeners
    annotationLink.addEventListener('mouseover', () => {
        ctx.style.textDecoration = 'underline';
    });

    annotationLink.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent default link behavior

      // Check if an annotation box already exists
      let existingBox = ctx.nextElementSibling;
      if (existingBox && existingBox.classList.contains(`${EXT_NAME}-annotation-box`)) {
          existingBox.classList.toggle("hidden"); // Toggle visibility
          return;
      }

      // Create annotation box
      let annotationBox = document.createElement("div");
      annotationBox.className = `${EXT_NAME}-annotation-box`

      // Create dummy content
      annotationBox.innerHTML = marked.parse(request.payload.data);

      // Insert the annotation box after the span
      ctx.parentNode.insertBefore(annotationBox, ctx.nextSibling);
    });

    annotationLink.addEventListener('mouseout', () => {
        ctx.style.textDecoration = 'none';
    });
  }
});