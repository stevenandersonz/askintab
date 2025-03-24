import {grok, chatgpt} from "./llms/index.js"

const TIMEOUT_AFTER = 1000*60*10
const DEBUG = true

export default class LLM {
  static llms = []
  constructor(name, domain, send, mockResponse=false) {
    this.name = name;
    this.domain = domain;
    this.lastUsed = null;
    this.tabId = null;
    this.queue = [];
    this.processing = false;
    this.debuggerAttached = false;
    this.processRequest = send;
    this.mockResponse = mockResponse;
    LLM.llms.push(this)
  }

  send() {

    if (DEBUG) {
      console.log(`${this.name.toUpperCase()} IS PROCESSING REQUEST: \n ${JSON.stringify(this.currentRequest)} \n`);
    }

    if (this.mockResponse) {
      setTimeout(async() => {
        this.currentRequest.saveResponse("### " + this.currentRequest.id + " Mock Response\n this is a test \n - 1 \n - 2 \n - 3", '#', ['q1','q2','q3'].map(q => this.currentRequest.id + "-" +q))
        try {
          await this.currentRequest.sync() 
        }catch(e){
          console.log(e)
        }
        chrome.tabs.sendMessage(this.currentRequest.sender.id, { type: "LLM_RESPONSE", payload: this.currentRequest}); 
        this.processing = false
        this.currentRequest = null
        this.processQueue()
      }, 1000)
      
    } else {
      this.processRequest(this);
    } 

  }
  

  async getURL() {
    let tab = await chrome.tabs.get(this.tabId);
    if (DEBUG) console.log(`${this.name.toUpperCase()} URL: ${tab.url}`);
    return tab.url;
  }


  processQueue() {
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

  static getMap(){
    return LLM.llms.reduce((map, llm) => {
      map[llm.name] = llm
      return map
    }, {})
  }

  static get(name){
   let llm = LLM.llms.find(llm => llm.name === name && llm.tabId) 
   return llm === undefined ? null : llm
  }

  static async loadAvailable (){
    for(let llm of LLM.llms){
      const urlPattern = `*://*.${llm.domain}/*`;
      let tabs = await chrome.tabs.query({ url: urlPattern })
      console.log(tabs)
      if(tabs.length <= 0) continue
      if(tabs.length > 1) console.log(`more than one tab for ${llm.domain} is present`) 
      llm.tabId = tabs[0].id
    }
    console.log("preloading completed")
  }
}

new LLM('grok', 'grok.com', grok, true)
new LLM('chatgpt', 'chatgpt.com', chatgpt, false)