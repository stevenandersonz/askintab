const exportConversations = (reqArray) => {
  // Group INIT_CONVERSATION requests and initialize followupReqs.
  const initConvos = reqArray.filter(r => r.type === "INIT_CONVERSATION");
  if (!initConvos.length) return "";

  initConvos.forEach(init => init.followupReqs = []);

  // Group FOLLOWUP requests into their parent INIT_CONVERSATION using parentReqId.
  reqArray.forEach(r => {
    if (r.type !== "FOLLOWUP") return;
    if (!r.parentReqId) return;
    const parent = initConvos.find(init => init.id === r.parentReqId);
    if (!parent) return;
    parent.followupReqs.push(r);
  });

  // Generate export text using an easily editable template.
  const exportTexts = initConvos.map(init => {
    let text = `
      origin: ${init.sender.url}
      llm: ${init.llm.name}
      highlighted: ${init.highlightedText?.text || ""}
      ---
      ### ${init.question} 
      ${init.llm.response}
    `;

    init.followupReqs.forEach(followup => {
      text += `
        ---
        ### ${followup.question} 
        ${followup.llm.response}
      `;
    });
    return text;
  });

  return exportTexts.join("\n\n");
};
window.addEventListener("DOMContentLoaded", async function(){
  const params = new URLSearchParams(window.location.search)
  const url = params.get('url')
  let reqs = await chrome.runtime.sendMessage({type: "GET_BY_URL", payload:url})
  let text = exportConversations(reqs)
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