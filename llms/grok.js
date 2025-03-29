import { submitPrompt, selectAndWriteTextArea, watchForResponse } from "../helpers.js"

const BTN_SEND = 'form button[type="submit"]:not(#companion-btn-ask)'
const TEXTAREA = '.query-bar textarea'

export async function grok(provider){
  const {tabId, systemPrompt, userPrompt} = provider
  let LOCAL_BASE = `Ignore the tag IGNORE<id> start your response with STARTREQ<id> end your response with ENDREQ<id> \n`
  const id = Math.floor(Math.random() * 1000) + 1
  LOCAL_BASE = LOCAL_BASE.replaceAll('<id>', id)
  let prompt = `${LOCAL_BASE}\n${systemPrompt}\n${userPrompt}`
  await chrome.scripting.executeScript({target: {tabId}, args: [TEXTAREA, prompt], func: selectAndWriteTextArea})
  await chrome.scripting.executeScript({target: {tabId}, args: [id, "grok"], func: watchForResponse})
  await chrome.scripting.executeScript({target: {tabId}, args: [BTN_SEND], func: submitPrompt})
}