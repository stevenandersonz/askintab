document.addEventListener('DOMContentLoaded', async function onDOMContentLoaded() {
  // --- State ---
  let state = {
    models: [], // Added more models
    spaces: [],
    hotKeys: [{ description: "open side chat", id: "cmd+k" }],
    sourceTypes: ['website', 'folder', 'pdf'] // Available source types
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
    [state.models, state.spaces] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_MODELS" }),
      chrome.runtime.sendMessage({ type: "GET_SPACES" })
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

  function renderGeneralSettings() {
    contentArea.innerHTML = `
      <h2>General Settings</h2>
      <div class="form-group">
        <label for="current-space-select">Current Space</label>
        <select id="current-space-select">
          ${state.spaces.map(space =>
            `<option value="${space.id}" ${space.selected ? 'selected' : ''}>${space.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Hotkeys</label>
        <ul id="hotkeys-list">
          ${state.hotKeys.map(hotkey =>
            `<li class="hotkey-item"><strong>${hotkey.id}</strong> ${hotkey.description}</li>`
          ).join('')}
        </ul>
      </div>
    `;
    // Add event listener for current space change
    let currentSpaceSelect = document.getElementById('current-space-select');
    if(currentSpaceSelect) {
      currentSpaceSelect.addEventListener('change', async function handleCurrentSpaceChange(event) {
        let space = state.spaces.find(s => s.id === event.target.value);
        let ok = await chrome.runtime.sendMessage({ type: "UPDATE_SPACE", payload:{...space, selected: true }});
        if(ok.success) {
          console.log(`Selected space changed to: ${space.id}`);
        }
      });
    }
  }

  function renderSpaceSettings() {
    let {spaceid} = getParams();
    let space = state.spaces.find(s => s.id === spaceid);
    if (!space) return;

    contentArea.innerHTML = `
      <h2>Edit Space: ${space.name}</h2>
      <div class="form-group">
        <label for="space-name-input">Name</label>
        <input type="text" id="space-name-input" value="${space.name}">
      </div>
      <div class="form-group">
        <label for="space-model-select">Model</label>
        <select id="space-model-select">
          ${state.models.map(model =>
            `<option value="${model}" ${space.model === model ? 'selected' : ''}>${model}</option>`
          ).join('')}
        </select>
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
        renderSidebar();
      }
    });
  }


  function renderSourcesList(sources, spaceId) {
    return sources.map((source, index) => `
      <li class="list-item" data-index="${index}">
        <span>${source.url} (${source.type})</span>
        <button class="remove-btn" data-space-id="${spaceId}" data-index="${index}">Remove</button>
      </li>
    `).join('');
  }

  // --- Start the app ---
  initialize();
});
