import {mock, openAI} from "./llms/index.js"
import db from "./db.js"

const BASE = `if prompted for diagrams default to mermaid.js and return the graph syntax inside \`\`\`mermaid \`\`\`,
for your graphs do not use parenthesis for text labels, and make sure the syntax is correct. do no append any styles to the div \n`
const FUS = `Add 3 follow up question to expand on your response, and phrase them as further prompts to yourself.
  each question should be surrounded by <q> </q>
  add 1 more question exactly as <q> I want to ask something else </q> \n`

export default class Provider {
  static all = []
  constructor(name, backend, models=[]) {
    this.name = name;
    this.lastUsed = null;
    this.tabId = null;
    this.currentRequest = null;
    this.backend = backend;
    this.models = models
    this.mockResponse = false
    this.returnFollowupQuestions = true
    Provider.all.push(this)
  }

  async processRequest(r) {
    this.lastUsed = Date.now();
    let cfg = await db.getCfg() 
    this.mockResponse = cfg.mockResponse
    this.returnFollowupQuestions = cfg.returnFollowupQuestions
    this.currentRequest = r
    if(this.mockResponse) return this.processResponse(mock(this))

    let {systemPrompt, userPrompt} = this.buildPrompt(cfg)
    let parentReq = null
    if(req.parentReqId) parentReq = await db.getRequestById(req.parentReqId)
    return await this.processResponse(await this.backend({...cfg, systemPrompt, userPrompt, responseId: parentReq?.llm?.responseId}))
  }

  async processResponse(payload) {
    console.log("processResponse")
    console.log(payload)
    if(!this.currentRequest) return
    this.currentRequest.provider.responseId = payload.responseId
    this.currentRequest.provider.raw = payload.raw
    this.currentRequest.provider.responseAt = payload.responseAt
    this.currentRequest.status = "completed"
    //this.currentRequest.llm.response = payload.raw.replaceAll(/<q>(.*?)<\/q>/gs, "<button class='askintab-followup-q'>\n$1\n</button>```");
    await db.updateRequestLLM(this.currentRequest.id, this.currentRequest.provider)
    await chrome.tabs.sendMessage(this.currentRequest.sender.id, { action: "RESPONSE", payload: this.currentRequest.provider }); 
    this.currentRequest = null
  }

  buildPrompt(cfg){
    const {highlightedText, question, type, local} = this.currentRequest
    let systemPrompt = BASE + (cfg.returnFollowupQuestions ? FUS : "") + cfg[this.name+"Cfg"] 
    let userPrompt = type === "INIT_CONVERSATION" ? highlightedText.text + "\n" + question : question 
    return {systemPrompt, userPrompt}
  }

  static getModels = () => Provider.all.map(p => p.models).flat() 
  static findByModel = (model) => Provider.all.filter(p => p.models.includes(model))[0] 
}

new Provider('openai', openAI, ["gpt-4o"])