const DB_NAME = 'askintabDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('spaces')) db.createObjectStore('spaces', { keyPath: 'id' });

      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messageStore.createIndex('spaceId', 'spaceId', { unique: false });
      }

      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');

    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function crudOperation(debug, storeName, method, value, key = undefined) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const mode = method === 'get' ? 'readonly' : 'readwrite';
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      if(debug) console.log("crudOperation", storeName, method, value, key)
      const request = key === undefined ? store[method](value) : store[method](value, key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

/* ================= CRUD OPERATIONS ================= */

const db = (debug = false) => {
  crudOperation = crudOperation.bind(null, debug)
  return {
    addSpace: async (space) => crudOperation('spaces', 'add', space),
    getSpace: async (id) => crudOperation('spaces', 'get', id),
    getSpaces: async () => crudOperation('spaces', 'getAll'),
    updateSpace: async (space) => crudOperation('spaces', 'put', space),
    deleteSpace: async (id) => crudOperation('spaces', 'delete', id),
    
    // Messages
    addMessage: async (message) => crudOperation('messages', 'add', message),
    getMessages: async () => crudOperation('messages', 'getAll'),
    clearMessages: async (spaceId) => {
      if (!spaceId) return [];
      const messages = await crudOperation('messages', 'getAll');
      for (const message of messages) {
        if (message.spaceId === spaceId) {
          await crudOperation('messages', 'delete', message.id);
        }
      };
      return messages;
    },
    getMessagesBySpaceId: async (spaceId) => {
      if (!spaceId) return [];
      
      return openDB().then(db => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction('messages', 'readonly');
          const store = tx.objectStore('messages');
          const index = store.index('spaceId');
          const request = index.getAll(spaceId);
          
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      });
    },
    

    // Config
    addConfig: async (key, config) => crudOperation('config', 'add', config, key),
    getConfig: async (key) => crudOperation('config', 'get', key),
    updateConfig: async (key, config) => crudOperation('config', 'put', config, key),
    deleteConfig: async (key) => crudOperation('config', 'delete', key)
  }
};
export default db;