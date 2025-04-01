import {openAI} from "./llms/index.js"
import {createMessage} from "./db_new.js";

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
    if (msg.type === "user" && msg.message.ctxs.length > 0) {
      let tabCtx = ""
      let highlightCtx = ""
      for (const ctx of msg.message.ctxs) {
        if (ctx.type === "tab" && ctx.tabId) {
          let ret = await chrome.scripting.executeScript({
            target: {tabId: parseInt(ctx.tabId)},
            args: [],
            func: () => document.body.innerText
          })
          tabCtx += `\n -- text content of ${ctx.tabUrl} -- \n` + ret[0].result
          continue
        }
        if (ctx.type === "highlight" && ctx.text) {
          highlightCtx += `\n -- highlight -- \n` + ctx.text
          continue
        }
      }
      return {tabCtx, highlightCtx}
    }
    return {tabCtx: "", highlightCtx: ""}
  }

  async send(msg) {
    this.lastUsed = Date.now();
    let ctxs = await this.buildContext(msg)
    let systemPrompt = BASE + ctxs.tabCtx 
    let userPrompt = msg.message.text + ctxs.highlightCtx 
    console.log(userPrompt)
    this.backend({systemPrompt, userPrompt, ...msg}, this.onResponse)
  }

  async onResponse(r) {
    console.log("processResponse")
    console.log(r)
    let msg = await createMessage({
      conversationId: r.conversationId,
      tabId: r.tabId,
      tabTitle: r.tabTitle,
      tabUrl: r.tabUrl,
      type: "assistant",
      message: {
        id: r.responseId,
        text: r.text,
        model: r.model,
      },
    })
    chrome.tabs.sendMessage(r.tabId, { action: "NEW_MESSAGE", payload: msg }); 
  }

  static getModels = () => Provider.all.map(p => p.models).flat() 
  static findByModel = (model) => Provider.all.filter(p => p.models.includes(model))[0] 
}

new Provider('openai', openAI, ["gpt-4o"])