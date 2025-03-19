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
    console.log("INSERTING TEXT: " + value)
    document.execCommand("insertText", false, value)
  } 
}

export function submitPrompt(selector) {
  let btnSend = document.querySelector(selector);
  if (btnSend){
    btnSend.click();
  } 
}
