import {grok, mock, openAI} from "./llms/index.js"
import db from "./db.js"

const TIMEOUT_AFTER = 1000*60*2

const BASE = `if prompted for diagrams default to mermaid.js and return the graph syntax inside \`\`\`mermaid \`\`\`,
for your graphs do not use parenthesis for text labels, and make sure the syntax is correct. do no append any styles to the div \n`
const FUS = `Add 3 follow up question to expand on your response, and phrase them as further prompts to yourself.
  each question should be surrounded by <q> </q>
  add 1 more question exactly as <q> I want to ask something else </q> \n`

export default class LLM {
  static llms = []
  constructor(name, domain, provider, local=false) {
    this.name = name;
    this.local=local
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
    if(cfg.mockResponse) return mock(this)
    let {systemPrompt, userPrompt} = this.buildPrompt(cfg)
    if(this.local) return this.provider({...cfg, systemPrompt, userPrompt, tabId: this.tabId})
    let parentReq = null
    if(req.parentReqId) parentReq = await db.getRequestById(req.parentReqId)
    return await this.processResponse(await this.provider({...cfg, systemPrompt, userPrompt, responseId: parentReq?.llm?.responseId}))
  }

  async processResponse(payload) {
    if(!this.currentRequest) return
    this.currentRequest.llm.responseId = payload.responseId
    this.currentRequest.llm.response = payload.raw.replaceAll(/<q>(.*?)<\/q>/gs, "<button class='askintab-followup-q'>\n$1\n</button>```");
    this.currentRequest.llm.raw = payload.raw
    this.currentRequest.llm.responseAt = payload.responseAt
    this.currentRequest.status = "completed"
    await db.updateRequestLLM(this.currentRequest.id, this.currentRequest.llm)
    await chrome.tabs.sendMessage(this.currentRequest.sender.id, { type: "LLM_RESPONSE", payload: this.currentRequest }); 
    this.currentRequest = null
  }

  setTimer (timerOffset=0){
    if(!this.currentRequest) return
    if(this.timeoutId) clearTimeout(this.timeoutId)
    this.timeoutId = setTimeout(() => {
      console.log(`REQUEST TIMEOUT ${this.name}`);
      this.currentRequest.status="failed"
      chrome.tabs.sendMessage(this.currentRequest.sender.id, {type: "ERROR", payload: this.currentRequest})
      this.currentRequest=null
    }, TIMEOUT_AFTER + timerOffset); 
  }

  buildPrompt(cfg){
    const {highlightedText, question, type, local} = this.currentRequest
    let systemPrompt = BASE + (cfg.returnFollowupQuestions ? FUS : "") + cfg[this.name+"Cfg"] 
    let userPrompt = type === "INIT_CONVERSATION" ? highlightedText.text + "\n" + question : question 
    return {systemPrompt, userPrompt}
  }

  static get(name){
    let llm = LLM.llms.find(llm => llm.name === name) 
    return llm === undefined ? null : llm
  }

  static async loadAvailable (){
    for(let llm of LLM.llms){
      if(!llm.local) continue
      const urlPattern = `*://*.${llm.domain}/*`;
      let tabs = await chrome.tabs.query({ url: urlPattern })
      if(tabs.length <= 0) continue
      if(tabs.length > 1) console.log(`more than one tab for ${llm.domain} is present`) 
      llm.tabId = tabs[0].id
    }
  }
}

new LLM('grok', 'grok.com', grok, true)
new LLM('openai', 'https://api.openai.com/v1/responses', openAI, false)