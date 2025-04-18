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
  lastAssistantId: null,
};

/* ── DOM scaffold (same ids / classes as before) ────────────────────────── */
document.body.insertAdjacentHTML('beforeend', htmlTrim(`
  <div id="extension-side-chat">
    <div id="side-chat-container">
      <div class="chat-messages"></div>

      <div class="chat-input-container">
        <div class="badge-container"></div>
        <textarea class="chat-input" placeholder="Ask anything... (Shift+Enter for newline)"></textarea>
        <button class="send-btn" title="Send Message" disabled>Send</button>
        <select class="model-selector"></select>
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
};

/* ── Markdown & Mermaid ─────────────────────────────────────────────────── */
const md = (txt) => {
  if (typeof marked === 'undefined') return esc(txt);
  const r = new marked.Renderer();
  r.code = (code, lang) =>
    lang === 'mermaid'
      ? `<div class="mermaid">${esc(code)}</div>`
      : `<pre><code>${esc(code)}</code></pre>`;
  return marked.parse(txt, { renderer: r });
};

const renderMermaid = (host) => {
  if (typeof mermaid === 'undefined') return;
  $$('.mermaid', host).forEach(div => {
    const code = div.textContent;
    div.textContent = '';
    mermaid.render(`m${Math.random().toString(36).slice(2)}`, code)
      .then(({ svg }) => (div.innerHTML = svg))
      .catch(err   => (div.innerHTML = `<pre>Error: ${esc(err.message)}</pre>`));
  });
};

/* ── Message rendering ──────────────────────────────────────────────────── */
const addMsg = (m) => {
  const assistant = (m.role || m.type) === 'assistant';
  const wrap = e('div', {
    className: `message ${assistant ? 'assistant-message' : 'user-message'}`
  });

  if (assistant) {
    wrap.innerHTML = md(m.content);
    renderMermaid(wrap);
  } else {
    if (m.content) wrap.appendChild(e('div', { textContent: m.content }));

    if (S.space.sources?.length) {
      const bc = e('div', { className: 'message-badges' });
      S.space.sources.forEach(src => {
        bc.appendChild(e('span', {
          className: 'message-badge',
          textContent: `[${src.titlext}]`,
          title: src.fullText || src.text
        }));
      });
      wrap.appendChild(bc);
    }
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
  (UI.send.disabled = !(UI.input.value.trim() || S.sources.length));

const sendDraft = () => {
  const content = UI.input.value.trim();
  if (!content && !S.sources.length) return;

  const payload = { content, sources: S.sources, lastMessageId: S.lastAssistantId };
  addMsg({ role: 'user', content, sources: S.sources });

  chrome.runtime.sendMessage({ type: 'NEW_MESSAGE', payload })
    .catch(err => console.error('AskInTab: BG send error', err));

  UI.input.value = ''; UI.badges.textContent = '';
  updateSendBtn(); showTyping();
};

const acceptAssistant = (data) => {
  hideTyping();
  addMsg({ role: 'assistant', content: data.content, responseId: data.responseId });
  S.lastAssistantId = data.responseId;
};

const addBadge = (source) => {
  if (!S.space.sources?.length) return;
  const txt = source.title.length > 20 ? `${source.title.slice(0, 17)}…` : source.title;

  const badge = e('div', { className: 'custom-badge', title: source.title });
  const text  = e('span', { className: 'custom-badge-text', textContent: txt });
  const close = e('button', { className: 'custom-badge-close', textContent: '×', title: 'Remove Source' });

  close.onclick = async (ev) => {
    ev.stopPropagation();
    const ok = await chrome.runtime.sendMessage({ type: 'REMOVE_PAGE', payload: { spaceId: S.space.id, sourceId: source.id } });
    if (ok.success) {
      S.space.sources = S.space.sources.filter(s => s.id !== source.id);
      badge.remove();
      updateSendBtn();
    }
  };

  badge.append(text, close);
  UI.badges.insertBefore(badge, UI.badges.firstChild);
};

const addModelOption = (model) => {
  const option = e('option', { value: model.id, textContent: model.name, selected: model.id === S.space.model.id });
  
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

document.addEventListener('mouseup', onSelect);
document.addEventListener('click',  (e)=>{ if (!UI.pop.contains(e.target)) hidePop(); });

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SYNC_SPACE') {
    console.log("syncing space", msg.payload)
    S.space = msg.payload;
    UI.badges.innerHTML = '';
    UI.modelSelector.innerHTML = '';
    S.space.sources.forEach(addBadge);
    S.models.forEach(addModelOption);
  }
  if (msg.type === 'ASSISTANT_MESSAGE') {
    acceptAssistant(msg.payload);
  }
});


/* ── Bootstrap ──────────────────────────────────────────────────────────── */
(async () => {
  try {
    [S.msgs, S.space, S.models] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_MESSAGES_BY_SPACE_ID' }),
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_SPACE' }),
      chrome.runtime.sendMessage({ type: 'GET_MODELS' })
    ]);
    S.msgs.forEach(addMsg);
    S.space.sources.forEach(addBadge);
    S.models.forEach(addModelOption);
    S.lastAssistantId = S.msgs.filter(m => (m.role || m.type) === 'assistant').at(-1)?.responseId;
  } catch (e) { console.error('AskInTab init error', e); }
})();