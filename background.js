import {sendToProvider, models, DEFAULT_MODEL} from "./provider.js"
import setDB from "./db.js"

const DEBUG = true
const db = setDB(DEBUG)

async function toggleSidePanel(tab) {
  if (!tab || !tab.id) {
    console.error("AskInTab: Invalid tab provided for side panel toggle.");
    return;
  }
  try {
    const windowId = tab.windowId;
    if (!windowId) {
      console.error("AskInTab: Could not get window ID from tab.");
      return;
    }
    await chrome.sidePanel.open({ windowId });
  } catch (error) {
    console.error(`AskInTab: Failed to toggle side panel for window ${tab.windowId}:`, error);
  }
}

// Listener for Keyboard Shortcut
chrome.commands.onCommand.addListener((command, tab) => {
  if (DEBUG) console.log(`AskInTab: Command received: ${command}`);
  if (command === "toggle-chat") {
    toggleSidePanel(tab);
  }
});

const isPromise = v => !!v && typeof v.then === 'function';
/**
 * Builds a chrome.runtime.onMessage listener from a map of handlers.
 * Each handler receives (payload, sender) and returns either:
 *   – a plain value       -> sent back synchronously (return false)
 *   – a Promise           -> resolved value is sent back (return true)
 */
function createListener(handlerMap) {
  return (msg, sender, sendResponse) => {
    if (DEBUG) console.log('msg', msg);

    const handler = handlerMap[msg?.type];
    if (!handler) {
      if (DEBUG) console.error(`AskInTab: unknown message type "${msg?.type}"`);
      // No async work → close channel
      return false;
    }

    try {
      const result = handler(msg.payload, sender);

      if (isPromise(result)) {
        // Async → keep port open, fulfil later
        result
          .then(data => sendResponse(data))
          .catch(err => {
            console.error(err);
            sendResponse({ success: false, error: err?.message ?? String(err) });
          });
        return true;            // <‑‑ keep channel open
      }

      // Sync → answer immediately
      sendResponse(result);
      return false;             // <‑‑ close channel
    } catch (err) {
      console.error(err);
      sendResponse({ success: false, error: err?.message ?? String(err) });
      return false;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Handlers – just return data or a Promise. No sendResponse required */
/* ------------------------------------------------------------------ */
const handlers = {
  NEW_MESSAGE: ({ content, search }) => {
    sendToProvider(db, content, search, DEBUG);
    return { success: true };
  },

  GET_MESSAGES: async () => db.getMessages(),
  GET_MESSAGES_BY_SPACE_ID: async () => db.getMessagesBySpaceId(await db.getConfig('currentSpace')),

  DELETE_MESSAGES: async payload => {
    await db.clearMessages(payload.spaceId);
    return { success: true };
  },

  GET_SPACES: () => db.getSpaces(),

  ADD_SPACE: async () => {
    const newSpace = {
      id: crypto.randomUUID(),
      name: 'New Space',
      createdAt: Date.now(),
      model: DEFAULT_MODEL,
      sources: [],
    };
    await db.addSpace(newSpace);
    return { success: true, space: newSpace };
  },

  UPDATE_SPACE: async payload => {
    if (!payload?.id) {
      return { success: false, error: 'Missing space ID or model' };
    }
    const space = await db.updateSpace(payload);
    return { success: true, space };
  },

  GET_CURRENT_SPACE: async () => {
    const id = await db.getConfig('currentSpace');
    return db.getSpace(id);
  },

  UPDATE_CONFIG: async ({ key, value }) => {
    await db.updateConfig(key, value);
    return { success: true };
  },

  GET_CONFIG: key => db.getConfig(key),

  ADD_SOURCE: async payload => {
    const id = crypto.randomUUID();
    const space = await db.getSpace(payload.spaceId);
    space.sources.push({
      id,
      type: payload.type,
      url: payload.url,
      content: payload.content,
      title: payload.title,
      hash: payload.hash,
      addToCtx: true
    });
    await db.updateSpace(space);
    return { success: true, id };
  },

  TOGGLE_SOURCE_CTX: async payload => {
    const space = await db.getSpace(payload.spaceId);
    let source = space.sources.find(s => s.id === payload.sourceId);
    if(!source) return { success: false, error: 'Source not found' };
    source.addToCtx = !source.addToCtx;
    await db.updateSpace(space);
    return { success: true };
  },

  GET_MODELS: () => models,
};

// Register the single listener
chrome.runtime.onMessage.addListener(createListener(handlers));

// Handle extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  // Check if this is a first install or an update
  if (details.reason === 'install' || details.reason === 'update') {
    try {
      let spaces = await db.getSpaces()
      console.log("spaces", spaces)
      if (!spaces || spaces.length === 0) {
        let id = 'default-' + Date.now()
        await Promise.all([
          db.addSpace({
            id,
            name: 'default',
            createdAt: Date.now(),
            model: DEFAULT_MODEL,
            sources: []
          }),
          db.updateConfig("currentSpace", id),
          db.updateConfig("openRouterApiKey", "")
        ])
      }
    } catch (error) {
      console.error('Error setting up initial space:', error);
    }
  }
});