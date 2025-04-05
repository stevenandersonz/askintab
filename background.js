import Provider from "./provider.js"
import db from "./db_new.js"

const DEBUG = true

// --- Injection and Toggling Logic ---

const CONTENT_SCRIPTS = ["libs/marked.min.js", "libs/mermaid.min.js", "content_new.js"];

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
    // Expected: { type: "NEW_MESSAGE", text, model, sources, spaceId (optional) }
    sendResponse({ success: true });
    console.log("payload", payload)
    console.log("sender", sender)
    provider.send({ tabId: sender.tab.id, content: payload.content, sources: payload.sources, model: payload.model, spaceId: payload.space.id })
    return false; // Early return for async response
  }

  if(type === "GET_MESSAGES_BY_SPACE"){
    console.log("GET_MESSAGES_BY_SPACE", payload)
    db.getMessagesBySpace(payload).then(messages => {
      sendResponse(messages)
    })
    return true
  }

  if(type === "GET_SPACES"){
    db.getSpaces().then(spaces => {
      sendResponse(spaces)
    })
    return true
  }
  // PUT_CONFIG handling
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
      // If no spaces exist, create the draftbox space
      console.log("spaces", spaces)
      if (!spaces || spaces.length === 0) {
        const draftboxSpace = {
          id: 'draftbox-' + Date.now(),
          name: 'draftbox',
          created: Date.now(),
          sourceIds: []
        };
        
        await db.addSpace(draftboxSpace);
        console.log('Created default draftbox space');
      }
    } catch (error) {
      console.error('Error setting up initial space:', error);
    }
  }
});