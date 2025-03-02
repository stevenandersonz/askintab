document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ type: "GET_TEXT" }, (response) => {
      document.getElementById('selectedText').textContent = response.text || 'No text selected';
  });
});