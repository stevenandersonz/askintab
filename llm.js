import {grok, mock} from "./llms/index.js"
import db from "./db.js"

const TIMEOUT_AFTER = 1000*60*2

const BASE = `
Ignore the tag IGNORE<id> start your response with STARTREQ<id> end your response with ENDREQ<id> \n`
const INLINE = `if prompted for diagrams default to mermaid.js and return the graph syntax inside <div class='mermaid'> </div>,
for your graphs do not use parenthesis for text labels, and make sure the syntax is correct. do no append any styles to the div \n`
const FUS = `Add 3 follow up question to expand on your response, and phrase them as further prompts to yourself.
  each question should be surrounded by <button class="askintab-followup-q"> </question>
  add 1 more question as <button class="askintab-followup-q"> Ask myself </question> \n`

function buildPrompt(llm, cfg){
  const {highlightedText, question, type} = llm.currentRequest
  let id = Math.floor(Math.random() * 1000) + 1 
  let systemPrompt = cfg[llm.name+"Cfg"] + BASE.replaceAll("<id>", id)
  let userPrompt = type === "INIT_CONVERSATION" ? highlightedText.text + "\n" + question : question 
  systemPrompt+= type !== "STANDALONE" ? INLINE + (cfg.returnFollowupQuestions ? FUS : "") : ""
  return {prompt: `${systemPrompt}\n${userPrompt}`, promptId:id, tabId: llm.tabId}
}

export default class LLM {
  static llms = []
  constructor(name, domain, provider) {
    this.name = name;
    this.domain = domain;
    this.lastUsed = null;
    this.tabId = null;
    this.queue = [];
    this.currentRequest = null;
    this.provider = provider;
    this.timeoutId = null
    LLM.llms.push(this)
  }

  async send(req, timerOffset=0) {
    this.lastUsed = Date.now();
    let cfg = await db.getCfg() 
    req.llm.mockResponse = cfg.mockResponse
    req.llm.name = cfg.mockResponse ? 'mock' : this.name,
    req.llm.returnFollowupQuestions = cfg.returnFollowupQuestions,
    this.currentRequest = req
    this.setTimer(timerOffset)
    return cfg.mockResponse ? mock(this) : this.provider(buildPrompt(this, cfg));
  }

  setTimer (timerOffset=0){
    if(this.timeoutId) clearTimeout(this.timeoutId)
    this.timeoutId = setTimeout(() => {
      console.log(`REQUEST TIMEOUT ${this.name}`);
      this.currentRequest.status="failed"
      chrome.tabs.sendMessage(this.currentRequest.sender.id, {type: "ERROR", payload: this.currentRequest})
      this.currentRequest=null
    }, TIMEOUT_AFTER + timerOffset); 
  }

  static get(name){
    let llm = LLM.llms.find(llm => llm.name === name) 
    return llm === undefined ? null : llm
  }

  static async loadAvailable (){
    for(let llm of LLM.llms){
      const urlPattern = `*://*.${llm.domain}/*`;
      let tabs = await chrome.tabs.query({ url: urlPattern })
      if(tabs.length <= 0) continue
      if(tabs.length > 1) console.log(`more than one tab for ${llm.domain} is present`) 
      llm.tabId = tabs[0].id
    }
  }
}

new LLM('grok', 'grok.com', grok)
// new LLM('chatgpt', 'chatgpt.com', chatgpt)