// Settings panel toggle
document.addEventListener("DOMContentLoaded", async () => {
const clearDataBTN = document.getElementById('clear-data-btn');
const llmCfg = document.getElementById("llm-cfg");
const promptShorcutInput = document.getElementById("prompterShortcut");

document.addEventListener("click", (e) => {

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
  console.log(target.id)
  await chrome.runtime.sendMessage({type: "PUT_CFG", payload: {[target.id]: target.checked}})
})

llmCfg.addEventListener("input", async ({target}) => {
  console.log(target.id)
  await chrome.runtime.sendMessage({type: "PUT_CFG", payload: {[target.id]: target.value}})
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
for (let el of llmCfg.querySelectorAll("input[type='checkbox']")){
  el.checked = cfg[el.id]
}

for (let el of llmCfg.querySelectorAll("input:not([type='checkbox']), textarea")){
  el.value = cfg[el.id]
}

})