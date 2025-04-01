import Provider from "./provider.js"
import db from "./db.js"
import {cleanUrl} from"./helpers.js"

const DEBUG = true

// --- Injection and Toggling Logic ---

const CONTENT_SCRIPTS = ["libs/marked.min.js", "libs/mermaid.min.js", "content_new.js"];

/**
 * Injects or toggles the side chat in the specified tab.
 * @param {chrome.tabs.Tab} tab The target tab.
 */
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
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  const { action, type, payload } = message;

  // --- Existing Message Handlers ---
  if (action === "REQUEST") {
    if (!payload.model) {
        sendResponse({ error: `LLM is missing` });
        return false; // Use false for synchronous response or if not returning true
    }
    let provider = Provider.findByModel(payload.model)
    if (DEBUG) console.log("provider", provider);
    if (!provider) {
        sendResponse({ error: `provider of model ${payload.model} is not available` });
        return false;
    }
    const req = {
      createdAt: Date.now(),
      input: payload.input,
      badges: payload.badges || [],
      provider: {
        lastMessageId: payload.lastMessageId,
        model: payload.model,
      },
      sender: {
        id: sender.tab?.id, // Sender might not always be a tab (e.g., popup)
        title: sender.tab?.title,
        url: sender.tab?.url ? cleanUrl(sender.tab.url) : null
      },
      status: "pending",
    }
    if (DEBUG) console.log("createRequest", req);

    // Ensure sender URL exists before adding page
    if (req.sender.url) {
        db.addPage(req.sender.url);
    }

    db.createRequest(req).then(r => {
      sendResponse(r); // Send response back to content script immediately
      provider.processRequest(r); // Process request asynchronously
    }).catch(err => {
        console.error("Error creating/processing request:", err);
        // Consider sending an error response back if appropriate
        // sendResponse({ error: "Failed to process request" });
    });

    return true; // Indicate async response is being handled by the promise
  }

  if(action === "GET_TABS") {
    chrome.tabs.query({}, function(tabs) { sendResponse(tabs) });
    return true; // Async
  }
  if(action === "GET_MODELS") {
    sendResponse(Provider.getModels());
    return false; // Sync
  }
  if(type === "CLEAR_REQ") {
    db.clearRequests().then(ok => sendResponse(ok));
    return true; // Async
  }
  if(type === "GET_CFG") {
    db.getCfg().then(cfg => sendResponse(cfg));
    return true; // Async
  }
  if(type === "PUT_CFG") {
    db.updateCfg(payload).then(cfg => sendResponse(cfg));
    return true; // Async
  }
  if (type === 'GET_ALL') {
    db.getRequests().then(reqs => sendResponse(reqs));
    return true; // Async
  }
  if(type === "GET_BY_URL") {
    if (!payload) {
        sendResponse({ error: "URL payload missing for GET_BY_URL" });
        return false;
    }
    db.getRequestsByUrl(cleanUrl(payload)).then(reqs => sendResponse(reqs));
    return true; // Async
  }
  if(type === "GET_URLS") {
    db.getPages().then(urls => sendResponse(urls));
    return true; // Async
  }
  if(type==="DEBUG" && DEBUG) {
    console.log(payload);
    return false; // Sync
  }

  // --- New Message Handler ---
  if (action === "OPEN_SETTINGS") {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
    // No response needed, return false or nothing
    return false;
  }

  // Default: Indicate message was not handled asynchronously
  // return false; // Can be omitted if no other async paths exist
});