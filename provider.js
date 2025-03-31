import {mock, openAI} from "./llms/index.js"
import db from "./db.js"

const BASE = `if user request diagrams default to mermaid.js and return the graph syntax inside \`\`\`mermaid \`\`\`,
for your graphs do not use parenthesis for text labels, and make sure the syntax is correct.`
const FUS = `Add 3 follow up question to expand on your response, and phrase them as further prompts to yourself.
  each question should be surrounded by <q> </q>
`

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
    let tabContext ="" 
    if (r.badges && r.badges.length > 0) {
      for (const badge of r.badges) {
        if (badge.type === "tab" && badge.tabId) {
          let ret = await chrome.scripting.executeScript({
            target: {tabId: parseInt(badge.tabId)},
            args: [],
            func: () => document.body.innerText
          })
          tabContext += `\n -- text content of ${badge.tabUrl} -- \n` + ret[0].result
        }
      }
    } 
    console.log("tabContext")
    console.log(tabContext)
    this.currentRequest = r
    if(this.mockResponse) return this.processResponse(mock(this))
    let systemPrompt = BASE + (cfg.returnFollowupQuestions ? FUS : "") + cfg[this.name+"Cfg"] + tabContext
    let userPrompt = this.currentRequest.input + "\n" + r.badges.filter(b => b.type !== "tab").map(b => b.text).join("\n")
    let res = await this.backend({...cfg, systemPrompt, userPrompt, ...this.currentRequest.provider})
    return await this.processResponse(res)
  }

  async processResponse(payload) {
    console.log("processResponse")
    console.log(payload)
    if(!this.currentRequest) return
    this.currentRequest.provider.responseId = payload.responseId
    this.currentRequest.provider.raw = payload.raw
    this.currentRequest.provider.responseAt = payload.responseAt
    this.currentRequest.status = "completed"
    await db.updateRequestLLM(this.currentRequest.id, this.currentRequest.provider)
    await chrome.tabs.sendMessage(this.currentRequest.sender.id, { action: "RESPONSE", payload: this.currentRequest.provider }); 
    this.currentRequest = null
  }

  static getModels = () => Provider.all.map(p => p.models).flat() 
  static findByModel = (model) => Provider.all.filter(p => p.models.includes(model))[0] 
}

new Provider('openai', openAI, ["gpt-4o"])