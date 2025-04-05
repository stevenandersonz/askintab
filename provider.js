import {mock, openAI} from "./llms/index.js"
import db from "./db_new.js";

const BASE = `if user request diagrams default to mermaid.js and return the graph syntax inside \`\`\`mermaid \`\`\`,
for your graphs do not use parenthesis for text labels, and make sure the syntax is correct.
Add 3 follow up question to expand on your response, and phrase them as further prompts to yourself.
each question should be surrounded by <q> </q>
`

export default class Provider {
  static all = []
  constructor(name, backend, models=[]) {
    this.name = name;
    this.lastUsed = null;
    this.tabId = null;
    this.backend = backend;
    this.models = models
    Provider.all.push(this)
  }

  async buildContext(msg) {
    if (msg.sources.length > 0) {
      let tabCtx = ""
      let highlightCtx = ""
      for (const source of msg.sources) {
        if (source.type === "tab" && source.tabId) {
          let ret = await chrome.scripting.executeScript({
            target: {tabId: parseInt(source.tabId)},
            args: [],
            func: () => document.body.innerText
          })
          tabCtx += `\n -- text content of ${source.tabUrl} -- \n` + ret[0].result
          continue
        }
        if (source.type === "highlight" && source.text) {
          highlightCtx += `\n -- highlight -- \n` + source.text
          continue
        }
      }
      return {tabCtx, highlightCtx}
    }
    return {tabCtx: "", highlightCtx: ""}
  }

  async send(msg) {
    console.log("send", msg)
    this.lastUsed = Date.now();
    let ctxs = await this.buildContext(msg)
    let systemPrompt = BASE + ctxs.tabCtx 
    let userPrompt = msg.content + ctxs.highlightCtx 
    console.log(userPrompt)
    let ok = await db.addMessage({ ...msg, role: "user",hidden: false,timestamp: Date.now()})
    if (!ok) chrome.runtime.sendMessage({type: "ERROR", payload: {error: "Error sending message to provider"}})
    this.backend({systemPrompt, userPrompt, ...msg}, this.onResponse)
  }

  async onResponse(r) {
    console.log("processResponse")
    console.log(r)
    let msg = { spaceId: r.prevMsg.spaceId, model: r.prevMsg.model, providerMsgId: r.responseId, tabId: r.prevMsg.tabId, role: "assistant", content: r.content, hidden: false, timestamp: Date.now() }
    let ok = await db.addMessage(msg)
    if (!ok) chrome.runtime.sendMessage({type: "ERROR", payload: {error: "Error returning response"}})
    chrome.tabs.sendMessage(r.prevMsg.tabId, { action: "NEW_MESSAGE", payload: msg }); 
  }

  static getModels = () => Provider.all.map(p => p.models).flat() 
  static findByModel = (model) => Provider.all.filter(p => p.models.includes(model))[0] 
}

new Provider('mock', mock, ["mock"])
new Provider('openai', openAI, ["gpt-4o"])
