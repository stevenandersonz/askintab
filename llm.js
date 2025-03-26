import {grok, chatgpt, mock} from "./llms/index.js"

const TIMEOUT_AFTER = 1000*60*10
const DEBUG = true

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

  send(req) {
    this.currentRequest = req
    console.log("---current---")
    console.log(this.currentRequest)
    console.log("------")
    if (DEBUG) console.log(`${this.name.toUpperCase()} IS PROCESSING REQUEST: \n ${JSON.stringify(this.currentRequest)} \n`);
    this.lastUsed = Date.now();
    this.timeoutId = setTimeout(() => {
      if (this.currentRequest === req) {
        console.log(`REQUEST TIMEOUT ${this.name}`);
        req.status="failed"
        this.clear()
      }
    }, TIMEOUT_AFTER);
    return this.provider(this);
  }

  clear(){
    this.currentRequest = null;
  }

  async getURL() {
    let tab = await chrome.tabs.get(this.tabId);
    if (DEBUG) console.log(`${this.name.toUpperCase()} URL: ${tab.url}`);
    return tab.url;
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
new LLM('chatgpt', 'chatgpt.com', chatgpt)
new LLM('mock', 'mock.test', mock)