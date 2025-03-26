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


document.addEventListener('DOMContentLoaded', async () => {
  let dataSection = document.querySelector("#data")
  let conversations = document.querySelector("#conversations")
  let urls = await chrome.runtime.sendMessage({ type: 'GET_URLS'})
  console.log("URLS")
  console.log(urls)
  let activeTab = await chrome.tabs.query({ active: true, currentWindow: true })

  if(urls.length <= 0) return
  dataSection.classList.remove("hidden")
  document.querySelector("#no-data").classList.add("hidden")
  let urlSorted = prioritizeActiveUrl(urls, cleanUrl(activeTab[0].url))
  for(let url of urlSorted){
    let o = document.createElement("option")
    o.value = url
    o.textContent = foldText(url)
    conversations.appendChild(o)
  }

  conversations.addEventListener("change", async function(evt){
    const reqs = await chrome.runtime.sendMessage({type: "GET_BY_URL", payload: evt.target.value})
    const questions = reqs.map(r => ({text: r.question, id: "companion-md-" + r.id }));
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
    chrome.tabs.create({ url: `mdviewer.html?url=${encodeURIComponent(conversations.value)}` });
  }) 

  // Settings panel toggle
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettings = document.getElementById('close-settings');
  const clearDataBTN = document.getElementById('clear-data-btn');
  const llmCfg = document.getElementById("llm-cfg");
  const promptShorcutInput = document.getElementById("prompterShortcut");

  document.addEventListener("click", (e) => {
    if (settingsBtn.contains(e.target)) {
      settingsPanel.classList.add("active");
    }
  
    if (closeSettings.contains(e.target)) {
      settingsPanel.classList.remove("active");
    }

    if (clearDataBTN.contains(e.target)) {
      clearDataBTN.disable = true
      clearDataBTN.innerHTML = `<svg width="1em" height="1em" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; display: inline;">
      <circle cx="25" cy="25" r="20" stroke="blue" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="0">
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
        <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite"/>
      </circle>
      </svg>`
      chrome.runtime.sendMessage({type: "CLEAR_REQ"}, (ok) => {
        clearDataBTN.innerHTML = "Clear all data"
      })
    }
  });

  llmCfg.addEventListener("change", async ({target}) => {
    await chrome.runtime.sendMessage({type: "PUT_CFG", payload: {[target.id]: target.checked}})
  })

  let keysPressed = new Set();

  promptShorcutInput.addEventListener("keydown", async (event) => {
      event.preventDefault();
      keysPressed.add(event.key);
      promptShorcutInput.value = Array.from(keysPressed).join(" + ");
      console.log( Array.from(keysPressed).join(" + "))
      await chrome.runtime.sendMessage({type: "PUT_CFG", payload: {[promptShorcutInput.id]: promptShorcutInput.value}})
  });

  promptShorcutInput.addEventListener("keyup", () => {
      keysPressed.clear();
  });
   

  let cfg = await chrome.runtime.sendMessage({type: "GET_CFG"})
  promptShorcutInput.value = cfg.prompterShortcut;
  // TODO it will break if add an input of another type
  for (let el of llmCfg.querySelectorAll("input")){
    el.checked = cfg[el.id]
  }

}); 
  

