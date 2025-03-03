const EXT_NAME = "companion"
// Create the UI container (keeping the existing textarea and upload button)
const uiContainer = document.createElement('div');
uiContainer.className = EXT_NAME + '-container';
uiContainer.innerHTML = `
    <textarea id="prompter" class="${EXT_NAME}-textarea" placeholder="What do you want to know?"></textarea>
    <button id="ask-btn" class="${EXT_NAME}-upload-button">Upload</button>
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

btn = document.querySelector("#ask-btn")
btn.addEventListener('click', function () {
  let ctx = document.querySelector("span." + EXT_NAME + "-pending");
  let annotations = document.querySelectorAll("a." + EXT_NAME + "-annotation-link") || [];
  this.parentNode.style.display = "none";

  if (ctx) {
      // Finalize the annotation
      ctx.className = `${EXT_NAME}-annotation-context ${EXT_NAME}-has-annotation`;

      // Create a spinner element
      let spinner = document.createElement("span");
      spinner.className = EXT_NAME + "-annotation-spinner";
      spinner.innerHTML = "⏳"; // Placeholder spinner icon (can be replaced with a proper CSS spinner)

      // Append the spinner inside the annotation span
      ctx.appendChild(document.createTextNode(" ")); // Space before the spinner
      ctx.appendChild(spinner);

      // Simulate a 1-second delay before replacing the spinner with the annotation link
      setTimeout(() => {
          // Create an <a> element with annotation number
          let annotationLink = document.createElement("a");
          annotationLink.className = EXT_NAME + "-annotation-link";
          annotationLink.textContent = `[${annotations.length}]`;
          annotationLink.href = "#"; // Placeholder, modify as needed

          // Add hover event listeners
          annotationLink.addEventListener('mouseover', () => {
              ctx.style.textDecoration = 'underline';
          });

          annotationLink.addEventListener("click", (e) => {
              e.preventDefault(); // Prevent default link behavior

              // Check if an annotation box already exists
              let existingBox = ctx.nextElementSibling;
              if (existingBox && existingBox.classList.contains(EXT_NAME + "-annotation-box")) {
                  existingBox.classList.toggle("hidden"); // Toggle visibility
                  return;
              }

              // Create annotation box
              let annotationBox = document.createElement("div");
              annotationBox.className = EXT_NAME + "-annotation-box";

              // Create dummy content
              let annotationText = document.createElement("p");
              annotationText.className = EXT_NAME + "annotation-text";
              annotationText.textContent = "This is a dummy annotation text. Replace it with actual content.";

              // Append elements
              annotationBox.appendChild(annotationText);

              // Insert the annotation box after the span
              ctx.parentNode.insertBefore(annotationBox, ctx.nextSibling);
          });

          annotationLink.addEventListener('mouseout', () => {
              ctx.style.textDecoration = 'none';
          });

          // Replace spinner with annotation link
          ctx.replaceChild(annotationLink, spinner);

      }, 1000); // 1-second delay before replacing spinner with annotation link
  }
});

// Handle text selection on mouseup
document.addEventListener('mouseup', (e) => {
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
  }
});




// Ensure annotations stay within viewport on scroll and resize
window.addEventListener('scroll', () => {
    annotations.forEach((_, id) => {
        const annotation = document.querySelector(`.${EXT_NAME}-annotation[data-annotation-id="${id}"]`);
        if (annotation) {
            const rect = annotation.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
                annotation.style.top = `${parseInt(annotation.style.top) - window.scrollY}px`;
            }
        }
    });
});

window.addEventListener('resize', () => {
    annotations.forEach((_, id) => {
        const annotation = document.querySelector(`.${EXT_NAME}-annotation[data-annotation-id="${id}"]`);
        if (annotation) {
            const rect = annotation.getBoundingClientRect();
            if (rect.left < 0 || rect.right > window.innerWidth) {
                annotation.style.left = `${parseInt(annotation.style.left) - (rect.right - window.innerWidth) - 10}px`;
            }
        }
    });
});