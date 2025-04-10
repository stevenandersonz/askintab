import Provider from "./provider.js"
import db from "./db.js"

const DEBUG = true

// --- Injection and Toggling Logic ---

const CONTENT_SCRIPTS = ["libs/marked.min.js", "libs/mermaid.min.js", "content.js"];

async function injectOrToggleChat(tab) {
  if (!tab || !tab.id) {
    console.error("AskInTab: Invalid tab provided.");
    return;
  }

  // Don't inject into chrome:// or other restricted pages
  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("about:")) {
      console.log(`AskInTab: Cannot inject into ${tab.url}`);
      // Optionally, briefly change the icon or show a notification
      return;
  }

  try {
    // 1. Try sending a message to toggle first
    await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_CHAT" });
    if (DEBUG) console.log(`AskInTab: Sent TOGGLE_CHAT to tab ${tab.id}`);
    // If message sends successfully, the content script exists and will handle the toggle.
  } catch (error) {
    // 2. If error (likely no content script), inject the scripts
    if (DEBUG) console.log(`AskInTab: Content script not found in tab ${tab.id} (or error sending message: ${error.message}). Injecting...`);
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: CONTENT_SCRIPTS,
      });
      if (DEBUG) console.log(`AskInTab: Injected scripts into tab ${tab.id}`);
      // The content script's initialization logic should handle showing the chat the first time.
    } catch (injectionError) {
      console.error(`AskInTab: Failed to inject scripts into tab ${tab.id}:`, injectionError);
    }
  }
}

// --- Event Listeners ---

// Listener for Browser Action Click (Extension Icon)
chrome.action.onClicked.addListener((tab) => {
  if (DEBUG) console.log("AskInTab: Action clicked.");
  injectOrToggleChat(tab);
});

// Listener for Keyboard Shortcut
chrome.commands.onCommand.addListener((command, tab) => {
  if (DEBUG) console.log(`AskInTab: Command received: ${command}`);
  if (command === "toggle-chat") {
    injectOrToggleChat(tab);
  }
});


// Listener for messages from content scripts or other parts
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  const { type, payload } = msg;

  // --- Existing Message Handlers ---
  if (type === "NEW_MESSAGE") {
    if (!payload.model) sendResponse({ error: `LLM is missing` });
    let provider = Provider.findByModel(payload.model)
    if (DEBUG) console.log("provider", provider);
    if (!provider) sendResponse({ error: `provider of model ${payload.model} is not available` });
    sendResponse({ success: true });
    console.log("payload", payload)
    console.log("sender", sender)
    provider.send({ tab: sender.tab, content: payload.content, sources: payload.sources, model: payload.model, spaceId: payload.space.id })
    return false; // Early return for async response
  }

  if(type === "GET_MESSAGES"){
    console.log("GET_MESSAGES", payload)
    db.getMessages().then(messages => {
      sendResponse(messages)
    })
    return true
  }

  if(type === "GET_SPACES"){
    db.getSpaces().then(spaces => {
      sendResponse(spaces);
    }).catch(error => {
         console.error("Error getting spaces:", error);
         sendResponse([]); // Send empty array on error
    });
    return true;
  }
  // Add new space
  if (type === 'ADD_SPACE') {
      let newSpace = {
        id: 'space-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8), // More unique ID
        name: 'New Space',
        createdAt: Date.now(),
        model: 'gpt-4o',
        selected: false,
        sources: [], // Start with empty sources
      }
      db.addSpace(newSpace).then(() => sendResponse({ success: true, space: newSpace }))
        .catch(error => sendResponse({ success: false, error: error.message || "Failed to save space" }));
      return true; // Indicate async response
  }

   // Update existing space (currently just for model)
   if (type === 'UPDATE_SPACE') {
    if (!payload && !payload.id) { // Check for model specifically
      sendResponse({ success: false, error: "Missing space ID or model" });
      return false;
    }
    console.log("Updating space:", payload.id);

    db.updateSpace(payload)
      .then((updatedSpace) => {
        console.log("Space updated successfully", updatedSpace);
        sendResponse({ success: true, space: updatedSpace });
      })
      .catch(error => {
        console.error("Error updating space:", error);
        sendResponse({ success: false, error: error.message || "Failed to update space" });
      });
    return true; // Indicate async response
   }

  // PUT_CONFIG handling (keep for generic config like API keys)
  if (type === 'PUT_CONFIG') {
    // Expected: { type: "PUT_CONFIG", key, config }
    db.updateConfig(payload.key, payload.value)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error });
      });
    return true; // Early return for async response
  }

  if(type === "GET_CONFIG"){
    console.log("GET_CONFIG", payload)
    db.getConfig(payload).then(cfg => {
      sendResponse(cfg)
    })
    return true
  }

  if(type === "CLEAR_MESSAGES"){
    db.clearMessages().then(() => {
      sendResponse({ success: true });
    })
    return true
  }

  if(type === "GET_TABS"){
    chrome.tabs.query({}, (tabs) => {
      console.log("GET_TABS", tabs)
      sendResponse(tabs);
    });
    return true
  }

  if(type === "GET_MODELS") {
    sendResponse(Provider.getModels());
    return false; // Sync
  }

  if (type === "OPEN_SETTINGS") {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
    // No response needed, return false or nothing
    return false;
  }
});

// Handle extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  // Check if this is a first install or an update
  if (details.reason === 'install' || details.reason === 'update') {
    try {
      let spaces = await db.getSpaces()
      console.log("spaces", spaces)
      if (!spaces || spaces.length === 0) {
       await db.addSpace({
          id: 'default-' + Date.now(),
          name: 'default',
          createdAt: Date.now(),
          selected: true,
          sources: []
        });
      }
    } catch (error) {
      console.error('Error setting up initial space:', error);
    }
  }
});