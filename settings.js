document.addEventListener('DOMContentLoaded', async function onDOMContentLoaded() {
  // --- State ---
  let state = {
    models: [], // Added more models
    spaces: [],
    hotKeys: [{ description: "open side chat", id: "cmd+k" }],
    openRouterApiKey: '',
    currentSpace: '',//id of the current space
  };
  // utils
  const $ = (selector) => document.querySelector(selector);
  // --- DOM Elements ---
  let addSpaceBtn = $('#add-space-btn');
  let spacesList = $('#spaces-list');
  let contentArea = $('#content-area');
  let sidebarLinks = document.querySelectorAll('.sidebar-menu .sidebar-menu-item');

  // --- Initialization ---
  async function initialize() {
    [state.models, state.spaces, state.currentSpace, state.openRouterApiKey, state.tabs] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_MODELS" }),
      chrome.runtime.sendMessage({ type: "GET_SPACES" }),
      chrome.runtime.sendMessage({ type: "GET_CONFIG", payload: "currentSpace" }),
      chrome.runtime.sendMessage({ type: "GET_CONFIG", payload: "openRouterApiKey" }),
    ]);
    console.log("state.models", state.models)
    console.log("state.spaces", state.spaces)
    renderSidebar();
    renderContent();
    addSpaceBtn.addEventListener('click', async function newSpace() {
      let newSpace = await chrome.runtime.sendMessage({ type: "ADD_SPACE" });
      if(newSpace.success) {
        state.spaces.push(newSpace.space);
        // Set the URL hash to navigate to the new space
        window.location.hash = `#section=spaces&space=${newSpace.space.id}`;
        renderSidebar()
      }
     });
     // Handle browser back/forward navigation
     window.addEventListener('hashchange', function handleHashChange() {
      console.log("hashchange", window.location.hash);
      renderSidebar();
      renderContent();
     });

     document.addEventListener('click', async function handleRemoveSource(event) {
      if(event.target.dataset.pageId) {
        let response = await chrome.runtime.sendMessage({ type: "TOGGLE_SOURCE_CTX", payload:{spaceId: state.currentSpace, sourceId: event.target.dataset.pageId} });
        if(response.success) {
          let space = state.spaces.find((space)=>space.id === state.currentSpace);
          let source = space.sources.find((source)=>source.id === event.target.dataset.pageId);
          source.addToCtx = !(source.addToCtx);
          renderSpaceSettings();
          await chrome.runtime.sendMessage({ type: "SYNC_SPACE" });
        }
      }
    });
  }

  // --- Routing ---
  function getParams() {
    let params = new URLSearchParams(window.location.hash.substring(1));
    return {section: params.get('section') || 'general', spaceid: params.get('space') || state.spaces.find(s => s.selected)?.id || state.spaces[0]?.id || null};
  }

  // --- Rendering ---
  function renderSidebar() {
    // Clear existing spaces
    spacesList.innerHTML = '';

    let {section, spaceid} = getParams();
    // Render spaces
    state.spaces.forEach(function renderSpaceItem(space) {
      let li = document.createElement('li');
      let a = document.createElement('a');
      a.href = `#section=spaces&space=${space.id}`;
      a.textContent = space.name;
      if (section === 'spaces' && spaceid === space.id) a.classList.add('active');
      li.appendChild(a);
      spacesList.appendChild(li);
    });

     // Update active state for general links
    sidebarLinks.forEach(function updateGeneralLinkActive(link) {
      let {section} = getParams();
      if (section === 'general') link.classList.add('active');
      else link.classList.remove('active');
    });
  }

  function renderContent() {
    contentArea.innerHTML = ''; // Clear previous content

    let {section} = getParams();
    if (section === 'general') return renderGeneralSettings();
    if (section === 'spaces') return renderSpaceSettings();
  }

  async function renderGeneralSettings() {
    // Fetch the current API key
    contentArea.innerHTML = `
      <h2>General Settings</h2>
      <div>
        <div class="setting-item mod-horizontal">
          <div class="setting-info>
            <label for="current-space-select">Current Space</label>
            <div class="setting-item-description">Choose the current space for the extension.</div>
          </div>
          <div class="setting-item-control">
            <select id="current-space-select">
              ${state.spaces.map(space =>
                `<option value="${space.id}" ${state.currentSpace === space.id ? 'selected' : ''}>${space.name}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="setting-item mod-horizontal">
          <div class="setting-info>
            <label for="openrouter-api-key">OpenRouter API Key</label>
            <div class="setting-item-description">Enter your OpenRouter API key to use the extension.</div>
          </div>
          <div class="setting-item-control">
            <input type="password" id="openrouter-api-key" value="${state.openRouterApiKey}">
            <button id="show-btn" type="button">Show</button>
          </div>
        </div>
      </div>
      <div>
        <h3>Hotkeys</h3>
        <div class="list">
          ${state.hotKeys.map(hotkey =>
            `<div class="list-item">
              <span>${hotkey.description}</span>
              <span class="setting-hotkey">${hotkey.id}</span>
            </div>`
          ).join('')}
        </div>
      </div>
    `;
    // Add event listener for current space change
    let currentSpaceSelect = $('#current-space-select');
    if(currentSpaceSelect) {
      currentSpaceSelect.addEventListener('change', async function handleCurrentSpaceChange(event) {
        let ok = await chrome.runtime.sendMessage({ type: "UPDATE_CONFIG", payload:{key: "currentSpace", value: event.target.value }});
        if(ok.success) {
          console.log(`Selected space changed to: ${event.target.value}`);
        }
      });
    }

    // API Key change
    let apiKeyInput = $('#openrouter-api-key');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('change', async function handleApiKeyChange(event) {
        let ok = await chrome.runtime.sendMessage({ type: "UPDATE_CONFIG", payload: { key: "openRouterApiKey", value: event.target.value } });
      });
    }

    // API Key visibility toggle
    let showBtn = $('#show-btn');
    if (showBtn && apiKeyInput) {
      showBtn.addEventListener('click', function toggleVisibility() {
        const currentType = apiKeyInput.getAttribute('type');
        apiKeyInput.setAttribute('type', currentType === 'password' ? 'text' : 'password');
        showBtn.textContent = currentType === 'password' ? 'Hide' : 'Show';
      });
    }
  }

  function renderSpaceSettings() {
    let {spaceid} = getParams();
    let space = state.spaces.find(s => s.id === spaceid);
    if (!space) return;

    contentArea.innerHTML = `
      <h2>Edit Space: ${space.name}</h2>
      <div>
        <div class="setting-item mod-horizontal">
          <div class="setting-info">
            <label for="space-name-input">Name</label>
          </div>
          <div class="setting-item-control">
            <input type="text" id="space-name-input" value="${space.name}">
          </div>
        </div>
        <div class="setting-item mod-horizontal">
          <div class="setting-info">
            <label for="space-model-select">Model</label>
          </div>
          <div class="setting-item-control">
          <select id="space-model-select">
              ${state.models.map(model =>
                `<option value="${model.id}" ${space.model === model.id ? 'selected' : ''}>${model.name}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="setting-item mod-horizontal">
          <div class="setting-info">
            <label for="space-messages-select">Messages</label>
          </div>
          <div class="setting-item-control">
            <button id="delete-messages-btn">Delete Messages</button>
          </div>
        </div>
      </div>
      <div>
        <h3>Pages</h3>
        <div>
        ${space.sources.map(source => `
          <div class="setting-item mod-horizontal">
            <div class="setting-info">
              <span>${source.url}</span>
            </div> 
            <div class="setting-item-control">
              <button data-page-id="${source.id}"> ${source.addToCtx ? 'remove from context' : 'add to context'} </button>
            </div> 
          </div> 
        `).join('')}
        </div>
      </div>
    `;

    

    $(`#space-name-input`).addEventListener('change', async function handleNameChange(event) {
      let response = await chrome.runtime.sendMessage({ type: "UPDATE_SPACE", payload:{...space, name: event.target.value }});
      if(response.success) {
        space.name = event.target.value;
        renderSidebar();
      }
    });
  
    $(`#space-model-select`).addEventListener('change', async function handleModelChange(event) {
      let response = await chrome.runtime.sendMessage({ type: "UPDATE_SPACE", payload:{...space, model: event.target.value }});
      if(response.success) {
        space.model = event.target.value;
        await chrome.runtime.sendMessage({ type: "SYNC_SPACE" });
        renderSidebar();
      }
    });

    $(`#delete-messages-btn`).addEventListener('click', async function handleDeleteMessages(event) {
      let response = await chrome.runtime.sendMessage({ type: "DELETE_MESSAGES", payload:{spaceId: space.id} });
      if(response.success) {
        await chrome.runtime.sendMessage({ type: "SYNC_SPACE" });
      }
    });

  }
  // --- Start the app ---
  initialize();
});
