/**
 * Hashes a string with the given algorithm.
 * @param {string} str — Input text.
 * @param {'SHA-1'|'SHA-256'} [alg='SHA-1'] — Hash algorithm.
 * @returns {Promise<string>} — Hex‑encoded digest.
 */

async function hashString(str, alg = 'SHA-1') {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest(alg, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}


document.addEventListener('DOMContentLoaded', async function onDOMContentLoaded() {
  let clipBtn = document.getElementById('clip-btn')
  let spaceName = document.getElementById('space-name')
  let metadataSource = document.getElementById('metadata-source')
  let metadataTitle = document.getElementById('metadata-title')
  let settingsBtn = document.getElementById('open-settings')
  let pageContentField = document.getElementById('page-content-field')

  let space = await chrome.runtime.sendMessage({ type: "GET_CURRENT_SPACE" })
  spaceName.innerText = space.name

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {                         // Guard – nothing useful without a tab
    console.error('readercompanion: active tab not found');
    return;                               // Early return per style guide
  }

 /* ----------------------------------------------
  *  Collect page text inside the tab
  * ---------------------------------------------- */
  const [{ result: pageText }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Candidate “main content” roots, in priority order
      const CANDIDATES = ['main', 'article', '[role="main"]', '#main', 'body'];
      // Elements that rarely contain user‑relevant prose
      const EXCLUDE = ['header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript'];

      const pickRoot = () => {
        for (const sel of CANDIDATES) {
          const node = document.querySelector(sel);
          if (node) return node;
        }
        return document.body;            // Fallback – should never be null
      };

      const clone = pickRoot().cloneNode(true);
      clone.querySelectorAll(EXCLUDE.join(',')).forEach(n => n.remove());
      return clone.innerText.trim();     // Visible text only
    }
  });

  const text = pageText ?? '';
  const hash = await hashString(text, 'SHA-1');
  pageContentField.innerText = text;
  metadataSource.innerText = tab.url;
  metadataTitle.innerText = tab.title;

  if (space.sources.find(src => src.hash === hash)) {   // concise lookup
    clipBtn.innerText = 'In Sources';
    clipBtn.disabled = true;
  }

  settingsBtn.addEventListener('click', async function onSettingsBtnClick() {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
  })

  clipBtn.addEventListener('click', async function onClipBtnClick() {
   if (clipBtn.disabled) return;        // Early return – already clipped
    let response = await chrome.runtime.sendMessage({
      type: 'ADD_SOURCE',
      payload: {
        spaceId: space.id,
        type: "page",
        url: tab.url,
        title: tab.title,
        content: text,
        hash: hash
      }
    })
    if(response.success) {
      chrome.runtime.sendMessage({ type: "SYNC_SPACE" })
      clipBtn.innerText = "In Sources"
      clipBtn.disabled = true 
    }
  })
})