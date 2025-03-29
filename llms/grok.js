import { submitPrompt, selectAndWriteTextArea, watchForResponse } from "../helpers.js"

const BTN_SEND = 'form button[type="submit"]:not(#companion-btn-ask)'
const TEXTAREA = '.query-bar textarea'

export async function grok(provider){
  const {tabId, promptId, prompt} = provider
  await chrome.scripting.executeScript({target: {tabId}, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  await chrome.scripting.executeScript({target: {tabId}, args: [promptId, "grok"], func: watchForResponse})
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
}