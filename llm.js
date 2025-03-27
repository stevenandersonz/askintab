import {grok, chatgpt, mock} from "./llms/index.js"
import db from "./db.js"

const TIMEOUT_AFTER = 1000*60*10
const PRE_PROMPTS = {
  INIT_CONVERSATION: ({returnFollowupQuestions}) => {
    let base = "if prompted for diagrams default to mermaid.js and return the graph syntax inside <div class='mermaid'> </div>, for your graphs do not use parenthesis for text labels, and make sure the syntax is correct. do no append any styles to the div"
    let fus = " Add 3 follow up question to expand on your response. each followup question should be surrounded by <question> </question>, Rembember to phrase the follow-up questions as further prompts to yourself"
    return returnFollowupQuestions ? base + fus : base
  },
  FOLLOWUP: () => "Rembember to phrase the follow-up questions as further prompts to yourself",
  STANDALONE: () =>  "respond only with what you were asked"
} 
function buildPrompt(llm, cfg){
  const {highlightedText, question} = llm.currentRequest
  let userPrompt = (highlightedText ? highlightedText.text + "\n" : "") + question 
  let systemPrompt = cfg[llm.name+"Cfg"] + PRE_PROMPTS[llm.currentRequest.type](cfg)
  return function getProviderPrompt (pPrompt) { return `${pPrompt}\n${systemPrompt}\n${userPrompt}` } 
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

  async send(req) {
    this.currentRequest = req
    this.lastUsed = Date.now();
    this.timeoutId = setTimeout(() => {
      if (this.currentRequest === req) {
        console.log(`REQUEST TIMEOUT ${this.name}`);
        req.status="failed"
        this.clear()
      }
    }, TIMEOUT_AFTER);
    let cfg = await db.getCfg() 
    return this.provider(this, buildPrompt(this, cfg));
  }

  clear(){
    this.currentRequest = null;
  }

  async getURL() {
    let tab = await chrome.tabs.get(this.tabId);
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