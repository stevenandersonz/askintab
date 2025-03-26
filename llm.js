import {grok, chatgpt, mock} from "./llms/index.js"

const TIMEOUT_AFTER = 1000*60*10
const DEBUG = true

export default class LLM {
  static llms = []
  constructor(name, domain, send) {
    this.name = name;
    this.domain = domain;
    this.lastUsed = null;
    this.tabId = null;
    this.queue = [];
    this.processing = false;
    this.processRequest = send;
    LLM.llms.push(this)
  }

  send() {
    if (DEBUG) console.log(`${this.name.toUpperCase()} IS PROCESSING REQUEST: \n ${JSON.stringify(this.currentRequest)} \n`);
    console.log("---current---")
    console.log(this.currentRequest)
    console.log("------")
    return this.processRequest(this);
  }

  async getURL() {
    let tab = await chrome.tabs.get(this.tabId);
    if (DEBUG) console.log(`${this.name.toUpperCase()} URL: ${tab.url}`);
    return tab.url;
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    const req = this.queue.shift();
    this.processing = true;
    this.lastUsed = Date.now();

    req.timeoutId = setTimeout(() => {
      if (this.processing && this.currentRequest === req) {
        console.log(`REQUEST TIMEOUT ${this.name}`);
        req.status="failed"
        this.processing = false;
        this.currentRequest = null;
        this.processQueue();
      }
    }, TIMEOUT_AFTER);

    this.currentRequest = req;
    this.send();
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