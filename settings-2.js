// Settings panel toggle
document.addEventListener("DOMContentLoaded", async () => {
const clearDataBTN = document.getElementById('clear-data-btn');
const openaiKey = document.getElementById("openai-key");
const toggleKeyVisibility = document.getElementById("toggle-key-visibility");

// Space related elements
const addSpaceBtn = document.getElementById("add-space-btn");
const newSpaceForm = document.getElementById("new-space-form"); // The container div
const newSpaceNameInput = document.getElementById("new-space-name-input"); // Input inside the form
const saveSpaceBtn = document.getElementById("save-space-btn"); // Save button inside the form
const cancelSpaceBtn = document.getElementById("cancel-space-btn"); // Cancel button inside the form
const spacesListDiv = document.getElementById("spaces-list");

let availableModels = [];
let currentSpaces = [];

// --- Helper Functions ---
const renderSpaces = () => {
  spacesListDiv.innerHTML = ''; // Clear existing list
  if (!currentSpaces || currentSpaces.length === 0) {
      spacesListDiv.innerHTML = '<p style="color: #888;">No spaces configured yet.</p>';
      return;
  }

  currentSpaces.forEach(space => {
    const spaceItem = document.createElement('div');
    spaceItem.className = 'setting-item';
    spaceItem.dataset.spaceId = space.id; // Store space ID

    const label = document.createElement('label');
    label.textContent = space.name;
    // Prevent editing draftbox name? Or add delete button later? For now, allow changing model.

    const modelSelect = document.createElement('select');
    modelSelect.id = `model-select-${space.id}`;

    availableModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model; // Assuming model object has an id
      option.textContent = model; // Assuming model object has a name
      if (space.model === model) { // Check if this space uses this model
          option.selected = true;
      }
      modelSelect.appendChild(option);
    });

    modelSelect.addEventListener('change', handleModelChange);

    spaceItem.appendChild(label);
    spaceItem.appendChild(modelSelect);
    spacesListDiv.appendChild(spaceItem);
    });
};

const fetchModels = async () => {
  try {
      availableModels = await chrome.runtime.sendMessage({ type: "GET_MODELS" });
      console.log("Available models:", availableModels)
      if (!availableModels) availableModels = []; // Ensure it's an array
        console.log("Fetched models:", availableModels);
  } catch (error) {
      console.error("Error fetching models:", error);
      availableModels = [];
  }
};

const fetchSpaces = async () => {
  try {
    currentSpaces = await chrome.runtime.sendMessage({ type: "GET_SPACES" });
    if (!currentSpaces) currentSpaces = []; // Ensure it's an array
    console.log("Fetched spaces:", currentSpaces);
  } catch (error) {
    console.error("Error fetching spaces:", error);
    currentSpaces = [];
  }
};

const handleModelChange = async (event) => {
    const selectElement = event.target;
    const spaceId = selectElement.closest('.setting-item').dataset.spaceId;
    const newModelId = selectElement.value;

    console.log(`Updating space ${spaceId} to model ${newModelId}`);
    const spaceToUpdate = currentSpaces.find(s => s.id === spaceId);
    if (spaceToUpdate) {
        spaceToUpdate.model = newModelId; // Update local copy
    }

    // Send update to background script
    try {
        const response = await chrome.runtime.sendMessage({
            type: "UPDATE_SPACE",
            payload: { id: spaceId, model: newModelId }
        });
        if (!response || !response.success) {
            console.error("Failed to update space model:", response?.error);
             // Optionally revert local change and re-render or show error message
             await fetchSpaces(); // Re-fetch to be sure
             renderSpaces();
        } else {
            console.log("Space model updated successfully");
            // Maybe add a visual confirmation briefly
        }
    } catch (error) {
        console.error("Error sending UPDATE_SPACE message:", error);
         await fetchSpaces(); // Re-fetch on error
         renderSpaces();
    }
};

// --- UI State Management for New Space Form ---
const toggleNewSpaceForm = (show) => {
  newSpaceForm.style.display = show ? 'flex' : 'none'; // Use 'flex' to match CSS
  newSpaceNameInput.value = ''; // Clear previous input
  show && newSpaceNameInput.focus();
};

const handleSaveSpace = async () => {
  const newName = newSpaceNameInput.value.trim();
  if (!newName) return newSpaceNameInput.focus()

  saveSpaceBtn.disabled = true;
  cancelSpaceBtn.disabled = true;
  saveSpaceBtn.textContent = 'Saving...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: "ADD_SPACE",
      payload: newName
    });

    if (response && response.success) {
      currentSpaces.push({
        id: response.id,
        name: response.name,
        model: response.model
      });
      renderSpaces(); // Re-render the list
      toggleNewSpaceForm(false); // Hide form on success
    } else {
      console.error("Failed to create space:", response?.error);
      newSpaceNameInput.focus(); // Keep focus on input on error
    }
  } catch (error) {
    newSpaceNameInput.focus();
  } finally {
    saveSpaceBtn.disabled = false;
    cancelSpaceBtn.disabled = false;
    saveSpaceBtn.textContent = 'Save';
  }
};

// --- Event Listeners Setup ---
addSpaceBtn.addEventListener("click", () => {
  const isVisible = newSpaceForm.style.display === 'flex';
  toggleNewSpaceForm(!isVisible);
});

cancelSpaceBtn.addEventListener("click", () => {
  toggleNewSpaceForm(false); // Hide the form
});

saveSpaceBtn.addEventListener("click", handleSaveSpace); // Save with form button

// Optional: Allow saving with Enter key in the form input field
newSpaceNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSaveSpace();
  if (e.key === 'Escape' && newSpaceForm.style.display === 'flex') toggleNewSpaceForm(false);
});

// Clear Data Button Listener
clearDataBTN.addEventListener("click", () => {
    // Consider adding a confirmation dialog here
    if (!confirm("Are you sure you want to clear ALL data? This cannot be undone.")) {
        return;
    }
    clearDataBTN.disabled = true; // Use 'disabled' property
    clearDataBTN.innerHTML = `<svg width="1em" height="1em" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; display: inline;">
<circle cx="25" cy="25" r="20" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="0">
  <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
  <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite"/>
</circle>
</svg> Clearing...`; // Indicate processing

    chrome.runtime.sendMessage({ type: "CLEAR_MESSAGES" }, (response) => {
        if (response && response.success) {
            alert("All data cleared successfully.");
            // Reload settings or clear relevant UI parts if needed
             fetchSpaces().then(renderSpaces); // Re-fetch spaces as they are cleared too
             toggleNewSpaceForm(false); // Ensure form is hidden after clear
        } else {
            alert("Failed to clear data.");
            console.error("Clear data failed:", response?.error);
        }
        clearDataBTN.innerHTML = "Clear All Data";
        clearDataBTN.disabled = false;
    });
});

// Toggle API Key Visibility Listener
toggleKeyVisibility.addEventListener("click", () => {
    const isPassword = openaiKey.type === "password";
    openaiKey.type = isPassword ? "text" : "password";
    toggleKeyVisibility.textContent = isPassword ? "Hide" : "Show";
});

// API Key Input Listener
openaiKey.addEventListener("input", async ({ target }) => {
    console.log("Updating OpenAI Key");
    await chrome.runtime.sendMessage({ type: "PUT_CONFIG", payload: { key: "openai_cfg", value: { key: target.value } } });
});

// --- Initialization ---
console.log("Initializing settings page...");
await fetchModels(); // Fetch models first
await fetchSpaces(); // Then fetch spaces
renderSpaces(); // Render the spaces list

// Load OpenAI key
let cfg = await chrome.runtime.sendMessage({ type: "GET_CONFIG", payload: "openai_cfg" });
if (cfg && cfg.key) {
    openaiKey.value = cfg.key;
} else {
    console.log("No OpenAI config found or key is missing.");
     openaiKey.value = ''; // Ensure it's empty if no key
}
console.log("Settings page initialized.");
})