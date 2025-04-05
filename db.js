const DB_NAME = 'aiChatDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('spaces')) {
        const spaceStore = db.createObjectStore('spaces', { keyPath: 'id' });
        spaceStore.createIndex('name', 'name', { unique: false });
        spaceStore.createIndex('sourceIds', 'sourceIds', { multiEntry: true });
      }

      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messageStore.createIndex('spaceId', 'spaceId', { unique: false });
        messageStore.createIndex('spaceId_timestamp', ['spaceId', 'timestamp'], { unique: false });
        messageStore.createIndex('referenceIds', 'referenceIds', { multiEntry: true });
      }

      if (!db.objectStoreNames.contains('sources')) {
        const sourceStore = db.createObjectStore('sources', { keyPath: 'id' });
        sourceStore.createIndex('byUrl', 'url', { unique: false });
        sourceStore.createIndex('byUrlContent', ['url', 'content'], { unique: true });
        sourceStore.createIndex('spaceRef', 'spaceRef', { unique: false });
      }

      if (!db.objectStoreNames.contains('config')) {
        // The config store doesn't use a keyPath; keys are provided externally.
        db.createObjectStore('config');
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function crudOperation(storeName, method, value, key = undefined) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const mode = method === 'get' ? 'readonly' : 'readwrite';
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      console.log("crudOperation", storeName, method, value, key)
      const request = key === undefined ? store[method](value) : store[method](value, key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

function getAllFromIndex(index, keyRange) {
  return new Promise((resolve, reject) => {
    const items = [];
    const request = index.openCursor(keyRange);
    request.onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
}

/* ================= CRUD OPERATIONS ================= */

const db = {
  addSpace: async (space) => crudOperation('spaces', 'add', space),
  getSpace: async (id) => crudOperation('spaces', 'get', id),
  getSpaces: async () => crudOperation('spaces', 'getAll'),
  updateSpace: async (space) => crudOperation('spaces', 'put', space),
  deleteSpace: async (id) => crudOperation('spaces', 'delete', id),
  
  // Messages
  addMessage: async (message) => crudOperation('messages', 'add', message),
  getMessage: async (id) => crudOperation('messages', 'get', id),
  getMessages: async () => crudOperation('messages', 'getAll'),
  updateMessage: async (message) => crudOperation('messages', 'put', message),
  deleteMessage: async (id) => crudOperation('messages', 'delete', id),
  clearMessages: async () => crudOperation('messages', 'clear'),
  getMessagesBySpace: async (spaceId) => {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('spaceId_timestamp');
      const keyRange = IDBKeyRange.bound([spaceId, 0], [spaceId, Infinity]);
      getAllFromIndex(index, keyRange)
        .then(messages => resolve(messages))
        .catch(err => reject(err));
    });
  },
  
  // Sources
  addSource: async (source) => crudOperation('sources', 'add', source),
  getSource: async (id) => crudOperation('sources', 'get', id),
  updateSource: async (source) => crudOperation('sources', 'put', source),
  deleteSource: async (id) => crudOperation('sources', 'delete', id),
  
  // Config
  addConfig: async (key, config) => crudOperation('config', 'add', config, key),
  getConfig: async (key) => crudOperation('config', 'get', key),
  updateConfig: async (key, config) => crudOperation('config', 'put', config, key),
  deleteConfig: async (key) => crudOperation('config', 'delete', key)
};
export default db;