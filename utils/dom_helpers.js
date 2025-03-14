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
    textArea.innerHTML=value
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
  } 
}

export function submitPrompt(selector) {
  let btnSend = document.querySelector(selector);
  if (btnSend){
    btnSend.click();
  } 
}
