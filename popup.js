function cleanUrl(url) {
  const urlObj = new URL(url);
  return urlObj.protocol + '//' + urlObj.hostname + urlObj.pathname;
}

function foldText(text){
  return text.substring(0, 20) + (text.length > 25 ? '...' : '');
}

function prioritizeActiveUrl(urls, activeUrl) {
  const index = urls.indexOf(activeUrl);
  if (index !== -1) {
      // Remove the active URL from its current position and add it to the start
      urls.splice(index, 1);
      urls.unshift(activeUrl);
  }
  return urls;
}

async function setCfg(id, value){
  try {
    let {askintab_cfg} = await chrome.storage.local.get("askintab_cfg")
    askintab_cfg[id] = value
    await chrome.storage.local.set({askintab_cfg})
  }catch(e){
    console.log(e)
  }
}

function updateStorageInfo() {
  const rawVersion = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./) 
  const chromeVersion = rawVersion ? parseInt(rawVersion[2], 10) : false;
  const totalStorageInBytes = 1048576 * (chromeVersion && chromeVersion >= 114 ? 10 : 5)


  chrome.storage.local.getBytesInUse(function(bytesInUse) {
    const bytesLeft = totalStorageInBytes - bytesInUse;
    
    const usedMB = (bytesInUse / 1048576).toFixed(2);
    const leftMB = (bytesLeft / 1048576).toFixed(2);
    
    document.getElementById('storage-info').textContent = 
        `Storage: ${usedMB}MB used / ${leftMB}MB free`;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  updateStorageInfo();
  chrome.storage.onChanged.addListener(function() {
      updateStorageInfo();
  });

  let dataSection = document.querySelector("#data")
  let conversations = document.querySelector("#conversations")
  let rs = await chrome.runtime.sendMessage({ type: 'GET_ALL'})
  let activeTab = await chrome.tabs.query({ active: true, currentWindow: true })
  let urls = rs.reduce((acc, r) => {
    if (!acc[r.sender.url])
      acc[r.sender.url] = []
    acc[r.sender.url].push(r)
    return acc
  }, {})

  if(Object.keys(urls).length > 0){
    dataSection.classList.remove("hidden")
    document.querySelector("#no-data").classList.add("hidden")
    let urlSorted = prioritizeActiveUrl(Object.keys(urls), cleanUrl(activeTab[0].url))
    for(let url of urlSorted){
      let o = document.createElement("option")
      o.value = url
      o.textContent = foldText(urls[url][0].sender.title)
      conversations.appendChild(o)
    }
  }

  conversations.addEventListener("change", async function(evt){
    const questions = urls[evt.target.value].map(r => ({text: r.question, id: "companion-md-" + r.id }));
    const questionCount = questions.length
    if(questionCount > 0){
      document.getElementById('question-count').textContent = questionCount;

      const questionList = document.getElementById('questions-list');
      questionList.innerHTML=""
      questions.forEach((question, index) => {
          const li = document.createElement('li');
          li.textContent = foldText(question.text)
          console.log(question.id)
          li.title = question.text;
          
          li.addEventListener('click', () => {
            chrome.tabs.update({ url: evt.target.value + '#' + question.id })
          });
          
          questionList.appendChild(li);
      });
    }

  })

  if(conversations.children.length>0){
    conversations.value = conversations.children[0].value
    conversations.dispatchEvent(new Event('change', { bubbles: true }))
  }
  

  document.getElementById("export-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: `mdviewer.html?view=${urls[conversations.value].filter((r) => r.type==="INIT_CONVERSATION")[0].id}` }) 
  }) 

  // Settings panel toggle
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettings = document.getElementById('close-settings');
  const llmCfg = document.getElementById("llm-cfg");
  const promptShorcutInput = document.getElementById("prompterShortcut");

  document.addEventListener("click", (e) => {
    if (settingsBtn.contains(e.target)) {
      settingsPanel.classList.add("active");
    }
  
    if (closeSettings.contains(e.target)) {
      settingsPanel.classList.remove("active");
    }
  });

  llmCfg.addEventListener("change", async ({target}) => {
    await setCfg(target.id, target.checked)
  })

  let keysPressed = new Set();

  promptShorcutInput.addEventListener("keydown", async (event) => {
      event.preventDefault();
      keysPressed.add(event.key);
      promptShorcutInput.value = Array.from(keysPressed).join(" + ");
      console.log( Array.from(keysPressed).join(" + "))
      await setCfg(promptShorcutInput.id, promptShorcutInput.value)
  });

  promptShorcutInput.addEventListener("keyup", () => {
      keysPressed.clear();
  });
   

  let cfg = await chrome.storage.local.get("askintab_cfg")
  if(Object.keys(cfg).length <= 0) return
  cfg = cfg.askintab_cfg
  console.log(cfg)
  promptShorcutInput.value = cfg.prompterShortcut;
  // TODO it will break if add an input of another type
  for (let el of llmCfg.querySelectorAll("input")){
    el.checked = cfg[el.id]
  }

}); 
  

