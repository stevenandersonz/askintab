/* AskInTab – compact content script ─────────────────────────────────────── */
//if (window.hasInitializedAskInTabSideChat) return;
window.hasInitializedAskInTabSideChat = true;

/* ── Helpers ────────────────────────────────────────────────────────────── */
const e  = (t, p = {})       => Object.assign(document.createElement(t), p);
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const htmlTrim = (s) => s.replace(/\s*\n\s*/g, '');
const esc = (t = '') => t.replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* ── State ──────────────────────────────────────────────────────────────── */
const S = {
  space: null,
  msgs: [],
  models: [],
  draft: '',
  search: false,
  standalone: false,
};

/* ── DOM scaffold (same ids / classes as before) ────────────────────────── */
document.body.insertAdjacentHTML('beforeend', htmlTrim(`
  <div id="extension-side-chat">
    <div id="side-chat-container">
      <div class="chat-messages"></div>

      <div class="chat-input-container">
        <div class="badge-container"></div>
        <textarea class="chat-input" placeholder="type / to open the command menu"></textarea>
        <button class="send-btn" title="Send Message" disabled>Send</button>
        <select class="model-selector"></select>
        <div class="slash-menu hidden"></div>
      </div>
    </div>

  </div>
`));

const UI = {
  root    : $('#extension-side-chat'),
  list    : $('.chat-messages'),
  input   : $('.chat-input'),
  send    : $('.send-btn'),
  badges  : $('.badge-container'),
  modelSelector: $('.model-selector'),
  slashMenu: $('.slash-menu'),
};

/* ── Markdown & Mermaid ─────────────────────────────────────────────────── */
const md = (txt) => {
  if (typeof marked === 'undefined') return esc(txt);
  const r = new marked.Renderer();
  r.code = (toks) =>
    toks.lang === 'mermaid'
      ? `<div class="mermaid">${esc(toks.text)}</div>`
      : `<pre><code>${esc(toks.text)}</code></pre>`;
  return marked.parse(txt, { renderer: r });
};

const renderMermaid = (host) => {
  if (typeof mermaid === 'undefined') return;
  $$('.mermaid', host).forEach(div => {
    const code = div.textContent;
    div.textContent = '';
    let id = `m${Math.random().toString(36).slice(2)}`;
    mermaid.render(id, code)
      .then(({ svg }) => {
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
        const btn = `
        <a class="download-svg-btn" href="${url}" download="${id}.svg">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
            xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <path d="M10 2v10m0 0l-4-4m4 4l4-4M4 16h12" stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      `;
        div.innerHTML = btn + '<br>' + svg;
      })
      .catch(err => {
        div.innerHTML = `<pre>Error: ${esc(err.message)}</pre>`;
      });
  });
};

/*
-- slash menu UTILS --
*/
const openSlashMenu = () => {
  UI.slashMenu.innerHTML = `
    <div class="slash-item" data-action="standalone">Standalone</div>
    <div class="slash-item" data-action="search">Search</div>
    <div class="slash-item" data-action="sources">Sources</div>`;
  UI.slashMenu.classList.remove('hidden');
};

const closeSlashMenu = () => UI.slashMenu.classList.add('hidden'); 

const showSourceList = () => {
  const list = S.space.sources.filter(s => !s.addToCtx);
  console.log("list", list)
  UI.slashMenu.innerHTML = list.length
    ? list.map(s =>
        `<div class="slash-item" data-action="source"
             data-page-id="${s.id}">${esc(s.title)}</div>`).join('')
    : '<div class="slash-item">‑‑ no sources ‑‑</div>';
  UI.slashMenu.classList.remove('hidden');
};


/* ── Message rendering ──────────────────────────────────────────────────── */
const addMsg = (m) => {
  const assistant = m.role === 'assistant';
  const wrap = e('div', {
    className: `message ${assistant ? 'assistant-message' : 'user-message'}`
  });

  if (assistant) {
    wrap.innerHTML = md(m.content);
    console.log("m.annotations", m.annotations)
    if (m.annotations && m.annotations.length > 0) {
      const bc = e('div', { className: 'message-badges' });
      m.annotations.forEach(a => {
        bc.appendChild(e('a', {
          className: 'message-badge',
          textContent: `${a.url_citation.title}`,
          title: a.url_citation.title,
          href: a.url_citation.url,
          target: '_blank',
          rel: 'noopener noreferrer'
        }));
      });
      wrap.appendChild(bc);
    }
    renderMermaid(wrap);
    hideTyping();
  } else {
    if (m.content) wrap.appendChild(e('div', { textContent: m.content }));

    
  }
  UI.list.appendChild(wrap);
  UI.list.scrollTop = UI.list.scrollHeight;
};

/* ── Typing indicator ───────────────────────────────────────────────────── */
const showTyping = () => {
  if ($('.typing-indicator', UI.list)) return;
  const ti = e('div', { className: 'typing-indicator' });
  for (let i = 0; i < 3; i++) ti.appendChild(e('div', { className: 'typing-dot' }));
  UI.list.appendChild(ti);
  UI.list.scrollTop = UI.list.scrollHeight;
};
const hideTyping = () => $('.typing-indicator', UI.list)?.remove();

/* ── Chat flow helpers ──────────────────────────────────────────────────── */
const updateSendBtn = () =>
  (UI.send.disabled = !(UI.input.value.trim()));

const sendDraft = () => {
  const content = UI.input.value.trim();
  if (!content) return;

  addMsg({ role: 'user', content });

  chrome.runtime.sendMessage({ type: 'NEW_MESSAGE', payload: { content, search: S.search, standalone: S.standalone } })

  UI.input.value = '';
  updateSendBtn();
  showTyping();
};

const addBadge = ({title, type, id}) => {
  const txt = title.length > 20 ? `${title.slice(0, 17)}…` : title;

  const badge = e('div', { className: 'custom-badge', title });
  const text  = e('span', { className: 'custom-badge-text', textContent: txt });
  const close = e('button', { className: 'custom-badge-close', textContent: '×', title: 'Remove Source' });

  close.onclick = async (ev) => {
    ev.stopPropagation();
    console.log("type", type)
    if(type === 'page') {
      const ok = await chrome.runtime.sendMessage({ type: 'TOGGLE_SOURCE_CTX', payload: { spaceId: S.space.id, sourceId: id } });
      if (ok.success) {
        badge.remove();
        updateSendBtn();
      }
    }

    if(type === 'search') {
      badge.remove();
      S.search = false;
    }

    if(type === 'standalone') {
      badge.remove();
      S.standalone = false;
    }
  };

  badge.append(text, close);
  UI.badges.insertBefore(badge, UI.badges.firstChild);
};

const addModelOption = (model) => {
  const option = e('option', { value: model.id, textContent: model.name, selected: model.id === S.space.model });
  
  UI.modelSelector.appendChild(option);
};

/* ── Event wiring ───────────────────────────────────────────────────────── */
UI.input.oninput     = updateSendBtn;
UI.input.onkeypress  = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDraft(); }};
UI.send.onclick      = sendDraft;
UI.modelSelector.onchange = async (e) => {
  const ok = await chrome.runtime.sendMessage({ type: 'UPDATE_SPACE', payload: { ...S.space, model: e.target.value } });
  if (ok.success) {
    S.space.model = e.target.value;
  }
};
UI.input.addEventListener('keydown', (e) => {
  // open only when the user literally types '/'
  if (e.key === '/' && !e.shiftKey) {
    e.preventDefault();                 // don’t insert the slash
    openSlashMenu();
  }
  // quick escape
  if (e.key === 'Escape') closeSlashMenu();
});
UI.slashMenu.onclick = async (ev) => {
  ev.stopPropagation();
  const el = ev.target.closest('.slash-item');
  if (!el) return;
  let {action} = el.dataset;
  let msgCfgBadges = ["search", "standalone"]
  if(msgCfgBadges.includes(action)) {
    if (!S[action]) { addBadge({title: `#${action}`, type: action}); S[action] = true; } 
    closeSlashMenu();
  }
  if(action === 'sources') {
    showSourceList();              // open list in‑place
  }
  if(action === 'source') {
    const src = S.space.sources.find(s => s.id === el.dataset.pageId);
    if (!src) return;
    addBadge(src);                 // reuse existing helper
    await chrome.runtime.sendMessage({
      type   : 'TOGGLE_SOURCE_CTX',
      payload: { spaceId: S.space.id, sourceId: src.id }
    });
    closeSlashMenu();
  }
};

document.addEventListener('click', (e) => {
  if (!UI.slashMenu.contains(e.target) && e.target !== UI.input) closeSlashMenu();
});


chrome.runtime.onMessage.addListener(async (msg) => {

  if (msg.type === 'SYNC_SPACE') {
    UI.badges.innerHTML = '';
    UI.modelSelector.innerHTML = '';
    UI.list.innerHTML = '';
    await init();
  }

  if (msg.type === 'ASSISTANT_MESSAGE') {
    addMsg({ role: 'assistant', content: msg.payload.content, annotations: msg.payload.annotations });
  }

});

async function init() {
  try {
    [S.msgs, S.space, S.models] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_MESSAGES_BY_SPACE_ID' }),
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_SPACE' }),
      chrome.runtime.sendMessage({ type: 'GET_MODELS' })
    ]);
    S.msgs.forEach(addMsg);
    S.space.sources.filter(s => s.addToCtx).forEach(addBadge);
    S.models.forEach(addModelOption);
  } catch (e) { console.error('AskInTab init error', e); }
}
/* ── Bootstrap ──────────────────────────────────────────────────────────── */
(async () => {
  await init();
})();