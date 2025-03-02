let selectedText = '';
let selectionRange = null;

// Remove existing tooltip or prompter if present
function removeExistingElements() {
  const existingTooltip = document.getElementById('ask-tooltip');
  const existingPrompter = document.getElementById('question-prompter');
  if (existingTooltip) {
    console.log("Removing existing tooltip");
    existingTooltip.remove();
  }
  if (existingPrompter) {
    console.log("Removing existing prompter");
    existingPrompter.remove();
  }
}

// Show tooltip near the selection
function showTooltip() {
  removeExistingElements();

  const selection = window.getSelection();
  if (!selection.rangeCount) {
    console.log("No selection range available.");
    return;
  }

  selectedText = selection.toString().trim();
  selectionRange = selection.getRangeAt(0).cloneRange(); // Preserve selection

  if (!selectedText) {
    console.log("Selection text is empty.");
    return;
  }

  const rangeRect = selectionRange.getBoundingClientRect();
  const tooltip = document.createElement('div');
  tooltip.id = 'ask-tooltip';
  tooltip.textContent = 'Ask Question';
  tooltip.style.position = 'absolute';
  tooltip.style.left = `${rangeRect.left + window.scrollX}px`;
  tooltip.style.top = `${rangeRect.bottom + window.scrollY + 5}px`;
  tooltip.style.backgroundColor = '#333';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '5px 10px';
  tooltip.style.borderRadius = '3px';
  tooltip.style.cursor = 'pointer';
  tooltip.style.zIndex = '10000';
  tooltip.style.userSelect = 'none';
  document.body.appendChild(tooltip);

  console.log("Tooltip added at", tooltip.style.left, tooltip.style.top);

  tooltip.addEventListener('click', () => {
    console.log('Tooltip clicked, showing prompter');
    showPrompter();
  });
}

// Show prompter at the bottom of the screen
function showPrompter() {
  console.log('showPrompter called');
  removeExistingElements();

  const prompter = document.createElement('div');
  prompter.id = 'question-prompter';
  prompter.innerHTML = `
    <textarea id="prompt-input" placeholder="Enter your prompt..."></textarea>
    <button id="send-prompt">Send</button>
    <button id="close-prompter">Close</button>
  `;
  prompter.style.position = 'fixed';
  prompter.style.bottom = '0';
  prompter.style.left = '0';
  prompter.style.width = '100%';
  prompter.style.backgroundColor = '#f0f0f0';
  prompter.style.padding = '10px';
  prompter.style.boxSizing = 'border-box';
  prompter.style.zIndex = '10000';
  prompter.style.display = 'flex';
  prompter.style.gap = '10px';
  document.body.appendChild(prompter);

  const textarea = document.getElementById('prompt-input');
  textarea.style.width = '70%';
  textarea.style.height = '60px';
  textarea.style.resize = 'none';

  document.getElementById('send-prompt').addEventListener('click', () => {
    const prompt = textarea.value.trim();
    if (prompt && selectedText) {
      const combinedText = `${prompt}\n${selectedText}`;
      console.log('Sending combined text:', combinedText);
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: "ASK_QUESTION",
          text: combinedText
        });
      }
      removeExistingElements();
    }
  });

  document.getElementById('close-prompter').addEventListener('click', () => {
    console.log('Closing prompter');
    removeExistingElements();
  });
}

// Capture selection and show tooltip, but do nothing if the prompter is already open
function captureSelection() {
  if (document.getElementById('question-prompter')) return;
  const selectionText = window.getSelection().toString().trim();
  if (selectionText) {
    console.log('Selection captured:', selectionText);
    showTooltip();
  } else {
    removeExistingElements();
  }
}

// Listen for selection changes
document.addEventListener('mouseup', () => {
  setTimeout(captureSelection, 0);
});
document.addEventListener('keyup', captureSelection);
document.addEventListener('selectionchange', () => {
  setTimeout(captureSelection, 0);
});

// Handle AI response and insert it below selection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RETURN_RESPONSE") {
      console.log("Received AI response:", message.text);
      insertResponseBelowSelection(message.text);
  }
});

// Function to append AI response below the selected text
function insertResponseBelowSelection(responseText) {
  if (!selectionRange) {
    console.log("No selection range available to insert response.");
    return;
  }

  const responseNode = document.createElement("p");
  responseNode.textContent = "AI Response: " + responseText;
  responseNode.style.backgroundColor = "#f0f0f0";
  responseNode.style.padding = "10px";
  responseNode.style.border = "1px solid #ccc";
  responseNode.style.marginTop = "10px";

  const parentNode = selectionRange.commonAncestorContainer;

  if (parentNode.nodeType === Node.TEXT_NODE) {
    // If selected inside a text node, insert after its parent
    parentNode.parentNode.insertAdjacentElement('afterend', responseNode);
  } else {
    // If selected inside an element, insert directly below it
    parentNode.insertAdjacentElement('afterend', responseNode);
  }

  console.log("Response inserted below selection.");
}
