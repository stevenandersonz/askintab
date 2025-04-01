/**
 * @fileoverview IndexedDB wrapper for managing configuration and messages.
 * Follows a functional approach with currying where beneficial.
 */

const DB_NAME = 'myAppDB';
const DB_VERSION = 1;
const STORES = {
  MESSAGES: 'messages',
  CONFIG: 'config',
};
const INDEXES = {
  CONVERSATION_ID: 'conversationId',
  TAB_URL: 'tabUrl',
  TYPE: 'type',
};

/**
 * Promisifies an IDBRequest.
 * @param {IDBRequest} request The IndexedDB request.
 * @returns {Promise<any>} A promise that resolves with the request result or rejects with an error.
 */
const promisifyRequest = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });

/**
 * Opens the IndexedDB database and handles upgrades.
 * @param {string} dbName The name of the database.
 * @param {number} version The version of the database.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
const openDB = (dbName, version) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Create Config Store (key-value)
      if (!db.objectStoreNames.contains(STORES.CONFIG)) {
        const configStore = db.createObjectStore(STORES.CONFIG); // Use key path directly
        // Add default values only when the store is first created
        console.log('Initializing default config values...');
        configStore.put(true, 'mock'); // Default mock value
        configStore.put({
          instructions: "You are the reincarnation of Dr Feynman, you don't know it so just play the role, and answer as Feynman would.",
          key: ""
        }, 'openai_cfg'); // Default OpenAI config
      }

      // Create Messages Store
      if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
        const messageStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        messageStore.createIndex(INDEXES.CONVERSATION_ID, INDEXES.CONVERSATION_ID, { unique: false });
        messageStore.createIndex(INDEXES.TAB_URL, INDEXES.TAB_URL, { unique: false });
        messageStore.createIndex(INDEXES.TYPE, INDEXES.TYPE, { unique: false });
      }
      // Handle future version upgrades here if needed
    };
  });

/**
 * Higher-order function to execute an operation within a transaction context.
 * @param {string} dbName The database name.
 * @param {number} dbVersion The database version.
 * @param {string | string[]} storeNames The name(s) of the object store(s).
 * @param {'readonly' | 'readwrite'} mode The transaction mode.
 * @param {(stores: IDBObjectStore | IDBObjectStore[]) => Promise<any>} operation The operation callback.
 * @returns {Promise<any>} A promise resolving with the result of the operation.
 */
const withTransaction = async (dbName, dbVersion, storeNames, mode, operation) => {
  const db = await openDB(dbName, dbVersion);
  const transaction = db.transaction(storeNames, mode);
  const stores = Array.isArray(storeNames)
    ? storeNames.map(name => transaction.objectStore(name))
    : transaction.objectStore(storeNames);

  return new Promise((resolve, reject) => {
    // Use a promise chain to ensure transaction completion is awaited *after* the operation promise resolves.
    Promise.resolve() // Start promise chain
      .then(() => operation(stores)) // Execute the operation
      .then(result => {
        // Operation succeeded, wait for transaction commit
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = (event) => {
          console.error('Transaction error:', event.target.error);
          reject(event.target.error); // Reject with transaction error
        };
        // Note: If operation returns a promise, its resolution is awaited before this point.
      })
      .catch(err => {
        // Operation failed or threw an error
        console.error('Operation error:', err);
        try {
          transaction.abort(); // Attempt to abort
        } catch (abortErr) {
          console.error('Error aborting transaction:', abortErr);
        }
        reject(err); // Reject with the original operation error
      });
  });
  // Note: We don't close the db here, manage lifecycle externally if needed.
};


// --- Transaction Helpers ---

/**
 * Executes an operation within a read-only transaction.
 * @param {string | string[]} storeName The name(s) of the object store(s).
 * @param {(stores: IDBObjectStore | IDBObjectStore[]) => Promise<any>} operation The operation callback.
 * @returns {Promise<any>} A promise resolving with the result of the operation.
 */
const withReadTransaction = (storeName, operation) =>
  withTransaction(DB_NAME, DB_VERSION, storeName, 'readonly', operation);

/**
 * Executes an operation within a read-write transaction.
 * @param {string | string[]} storeName The name(s) of the object store(s).
 * @param {(stores: IDBObjectStore | IDBObjectStore[]) => Promise<any>} operation The operation callback.
 * @returns {Promise<any>} A promise resolving with the result of the operation.
 */
const withWriteTransaction = (storeName, operation) =>
  withTransaction(DB_NAME, DB_VERSION, storeName, 'readwrite', operation);

// --- Config Store Operations ---

/**
 * Gets a configuration value by key.
 * @param {string} key The configuration key.
 * @returns {Promise<any>} The configuration value or undefined.
 */
export const getConfig = (key) =>
  withReadTransaction(STORES.CONFIG,
    (store) => promisifyRequest(store.get(key))
  );

/**
 * Updates or creates a configuration value.
 * @param {string} key The configuration key.
 * @param {any} value The configuration value.
 * @returns {Promise<IDBValidKey>} The key of the updated/created record.
 */
export const updateConfig = (key, value) =>
  withWriteTransaction(STORES.CONFIG,
    (store) => promisifyRequest(store.put(value, key))
  );

// --- Message Store Operations ---

/**
 * Creates a new message. Generates ID, createdAt, and conversationId if needed.
 * @param {object} messageData The message data (without id, createdAt).
 * @param {string | null} messageData.conversationId Optional conversation ID.
 * @param {string} messageData.tabUrl The tab URL.
 * @param {string} messageData.type The message type.
 * @param {object} messageData.message The message content.
 * @returns {Promise<object>} The created message object including id and createdAt.
 */
export const createMessage = (messageData) =>
  withWriteTransaction(STORES.MESSAGES, async (store) => {
    const messageToStore = {
      ...messageData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      conversationId: messageData.conversationId ?? crypto.randomUUID(),
    };
    await promisifyRequest(store.add(messageToStore));
    return messageToStore; // Return the full message object
  });

/**
 * Updates an existing message.
 * @param {string} id The ID of the message to update.
 * @param {object} updates An object containing fields to update.
 * @returns {Promise<object>} The updated message object.
 */
export const updateMessage = (id, updates) =>
  withWriteTransaction(STORES.MESSAGES, async (store) => {
    const existing = await promisifyRequest(store.get(id));
    if (!existing) {
      throw new Error(`Message with id ${id} not found.`);
    }
    const { id: _id, createdAt: _createdAt, ...safeUpdates } = updates;
    const updatedMessage = { ...existing, ...safeUpdates };
    await promisifyRequest(store.put(updatedMessage));
    return updatedMessage;
  });

/**
 * Gets a message by its ID.
 * @param {string} id The message ID.
 * @returns {Promise<object | undefined>} The message object or undefined if not found.
 */
export const getMessage = (id) =>
  withReadTransaction(STORES.MESSAGES,
    (store) => promisifyRequest(store.get(id))
  );

/**
 * Gets all messages.
 * @returns {Promise<object[]>} An array of all message objects.
 */
export const getAllMessages = () =>
  withReadTransaction(STORES.MESSAGES,
    (store) => promisifyRequest(store.getAll())
  );

/**
 * Gets all messages matching a query on a specific index.
 * @param {typeof INDEXES[keyof typeof INDEXES]} indexName The name of the index to query.
 * @param {IDBValidKey | IDBKeyRange} query The key or key range to query.
 * @returns {Promise<object[]>} An array of matching message objects.
 */
export const getAllMessagesByIndex = (indexName, query) =>
  withReadTransaction(STORES.MESSAGES,
    (store) => promisifyRequest(store.index(indexName).getAll(query))
  );
