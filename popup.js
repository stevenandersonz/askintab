function cleanUrl(url) {
  try {
      const urlObj = new URL(url);
      // Return only protocol, hostname, and pathname
      return urlObj.protocol + '//' + urlObj.hostname + urlObj.pathname;
  } catch (e) {
      // Fallback for invalid URLs
      console.error('Invalid URL:', url, e);
      return url; // Return original if parsing fails
  }
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
  let ts = await chrome.storage.local.get(["tokenTimestamp"])
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  console.log(ts)
  console.log((Date.now() - ts.tokenTimestamp))

  if(ts && (Date.now() - ts.tokenTimestamp) < 1000*60*5){
    loginBtn.parentElement.classList.add("hidden")
    logoutBtn.parentElement.classList.remove("hidden")
  }

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
  console.log(urls)

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

  settingsBtn.addEventListener('click', () => {
      settingsPanel.classList.add('active');
  });

  closeSettings.addEventListener('click', () => {
      settingsPanel.classList.remove('active');
  });

  // Shortcut key functionality
  const shortcutInput = document.getElementById("shortcut");
  let keysPressed = new Set();

  shortcutInput.addEventListener("keydown", (event) => {
      event.preventDefault();
      keysPressed.add(event.key);
      shortcutInput.value = Array.from(keysPressed).join(" + ");

      // Save shortcut to Chrome storage
      chrome.storage.sync.set({ shortcut: shortcutInput.value });
  });

  shortcutInput.addEventListener("keyup", () => {
      keysPressed.clear();
  });

  // Load stored shortcut
  chrome.storage.sync.get("shortcut", (data) => {
      if (data.shortcut) {
          shortcutInput.value = data.shortcut;
      }
  });

  loginBtn.addEventListener("click", async function(){
    chrome.runtime.sendMessage({ type: "LOGIN" }, (response) => {
      if (response.status === "initiated") {
        console.log(response)
        //document.getElementById("user-info").innerText = "Logging in...";
      }
    });
  }) 

  logoutBtn.addEventListener("click", async function(){
    await chrome.storage.local.remove("tokenTimestamp,accessToken,refreshToken".split(",")) 
    console.log("logout")
    return
  }) 

}); 
  

