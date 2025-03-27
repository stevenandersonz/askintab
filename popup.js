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

  if(urls.length > 0){ 
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

  }

  document.getElementById("settings-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: `settings.html` });
  }) 
}); 
  

