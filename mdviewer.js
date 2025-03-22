window.addEventListener("DOMContentLoaded", async function(){
  const params = new URLSearchParams(window.location.search)
  const id = params.get('view')
  console.log(id)
  let text = await chrome.runtime.sendMessage({type: "EXPORT_CONVERSATION", payload:{id}})
  console.log(text)
  let md = document.getElementById("markdownDisplay")
  md.innerText=text

  document.addEventListener("click", (evt) => {
    const copyBtn = evt.target.closest("#copy");
    const downloadBtn = evt.target.closest("#download");
  
    if (copyBtn) copyToClipboard();
    if (downloadBtn) downloadMarkdown();
  });
  function copyToClipboard() {
    const markdown = document.getElementById('markdownDisplay').innerText;
    navigator.clipboard.writeText(markdown);
    alert('Copied to clipboard!');
  }

  function downloadMarkdown() {
    const markdown = document.getElementById('markdownDisplay').innerText;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'markdown.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
})