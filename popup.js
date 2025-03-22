const EXT_NAME = "COMPANION"
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
    document.querySelector("#no-data").remove()
    document.querySelector("#main-panel").classList.remove("hidden")
    console.log("----")
    console.log(Object.keys(urls), cleanUrl(activeTab[0].url))
    console.log("----")
    let urlSorted = prioritizeActiveUrl(Object.keys(urls), cleanUrl(activeTab[0].url))
    for(let url of urlSorted){
      let o = document.createElement("option")
      o.value = url
      o.textContent = foldText(urls[url][0].sender.title)
      conversations.appendChild(o)
    }
  }

  conversations.value = conversations.children[0].value

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
  conversations.value = conversations.children[0].value
  conversations.dispatchEvent(new Event('change', { bubbles: true }))
  

  document.getElementById("export-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({type:"DOWNLOAD"}, (res) => {
      const blob = new Blob([res], { type: "text/plain" });

      // Create a temporary download link
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "exported_file.txt"; // File name

      // Simulate click to trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a); // Clean up
    })
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
}); 
  

