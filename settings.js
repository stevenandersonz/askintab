// Settings panel toggle
document.addEventListener("DOMContentLoaded", async () => {
const clearDataBTN = document.getElementById('clear-data-btn');
const openaiKey = document.getElementById("openai-key");

document.addEventListener("click", (e) => {

  if (clearDataBTN.contains(e.target)) {
    clearDataBTN.disable = true
    clearDataBTN.innerHTML = `<svg width="1em" height="1em" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; display: inline;">
    <circle cx="25" cy="25" r="20" stroke="blue" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="0">
      <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
      <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite"/>
    </circle>
    </svg>`
    chrome.runtime.sendMessage({type: "CLEAR_MESSAGES"}, (ok) => {
      clearDataBTN.innerHTML = "Clear all data"
    })
  }
});

openaiKey.addEventListener("input", async ({target}) => {
  console.log(target.value)
  await chrome.runtime.sendMessage({type: "PUT_CONFIG", payload: {key:"openai_cfg", value: {key: target.value}}})
})

let cfg = await chrome.runtime.sendMessage({type: "GET_CONFIG", payload: "openai_cfg"})
openaiKey.value = cfg.key
})