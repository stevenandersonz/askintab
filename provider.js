import {mock, openAI} from "./llms/index.js"
import db from "./db.js";

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
    this.backend = backend;
    this.models = models
    this.userPrompt = ""
    this.systemPrompt = BASE 
    this.cxts = []
    Provider.all.push(this)
  }

  async handleSources(sources) {
    let sourceIds = []
    for (const source of sources) {
      if (source.type === "highlight" && source.text) {
        let ok = await db.addSource({ id: "123", type: "highlight", text: source.text, url: source.url, range: source.range })
        if (!ok) chrome.runtime.sendMessage({type: "ERROR", payload: {error: "Error adding highlight"}})
        sourceIds.push(ok.id)
        this.cxts.push(`\n -- start highlight -- \n` + source.text + `\n -- end highlight -- \n`)
      }
    }
    return sourceIds
  }

  async send({tab, content, sources, model, spaceId}) {
    // let sourceIds = await this.handleSources(sources)
    let ok = await db.addMessage({ url: tab.url, content, model, spaceId, role: "user", timestamp: Date.now()})
    if (!ok) chrome.runtime.sendMessage({type: "ERROR", payload: {error: "Error sending message to provider"}})
    this.lastUsed = Date.now();
    this.model = model
    this.spaceId = spaceId
    this.sender = tab
    this.cxts.push("\n -- user prompt -- \n" + content)
    this.backend.call(this)
  }

  async onResponse(r) {
    console.log("processResponse")
    console.log(r)
    let ok = await db.addMessage({ spaceId: this.spaceId, model: this.model, url: this.sender.url, role: "assistant", providerMsgId: r.responseId, content: r.content, timestamp: Date.now() })
    if (!ok) chrome.runtime.sendMessage({type: "ERROR", payload: {error: "Error returning response"}})
    chrome.tabs.sendMessage(this.sender.id, { action: "NEW_MESSAGE", payload: {content: r.content} }); 
  }

  static getModels = () => Provider.all.map(p => p.models).flat() 
  static findByModel = (model) => Provider.all.filter(p => p.models.includes(model))[0] 
}

new Provider('mock', mock, ["mock"])
new Provider('openai', openAI, ["gpt-4o"])
