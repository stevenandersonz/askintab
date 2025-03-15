document.addEventListener("DOMContentLoaded", () => {
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


  let dropdown = document.querySelector('#llms')
  dropdown.addEventListener("change", (event) => {
    const selectedLLM = event.target.value;
    chrome.storage.sync.set({ selectedLLM: selectedLLM }, () => {
        console.log("Selected LLM saved:", selectedLLM);
    });
  });
  chrome.runtime.sendMessage({ type: "LLM_INFO"}, function(llms){
    dropdown.innerHTML = ""
    for(let llm of llms){
      let option = document.createElement("option")
      option.value=llm.name
      option.innerHTML=llm.name
      dropdown.appendChild(option)
    }
    chrome.storage.sync.get("selectedLLM", (data) => {
      if (data.selectedLLM) {
        dropdown.value = data.selectedLLM;
      }
    });
  })

});