class DB {
  constructor() {
    this.DEFAULT_CFG = {
      mockResponse: false,
      returnFollowupQuestions: true,
      prompterShortcut: "Control + k"
    };
    this.dbName = "askintab_db";
    this.dbVersion = 1;
    this.dbPromise = this.init();
  }

  // Initialize IndexedDB
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const store = db.createObjectStore("requests", { autoIncrement: true });
        store.createIndex("by_url", "sender.url", { unique: false });
        db.createObjectStore("config", { keyPath: "key" });
        db.createObjectStore("llms", { keyPath: "name" });
        db.createObjectStore("pages", { keyPath: "url" });
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Helper to execute transactions
  async transact(storeName, mode, callback) {
    const db = await this.dbPromise;
    const transaction = db.transaction([storeName], mode);
    const store = transaction.objectStore(storeName);
    return callback(store, transaction);
  }

  // Request Operations
  async getRequestById(id) {
    return this.transact("requests", "readonly", (store) => {
      return new Promise((resolve) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
      });
    });
  }

  async getRequests() {
    return this.transact("requests", "readonly", (store) => {
      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
      });
    });
  }

  async getRequestsByUrl(url) {
    return this.transact("requests", "readonly", (store) => {
      return new Promise((resolve) => {
        const index = store.index("by_url"); // Use the index
        const request = index.getAll(url);   // Get all records where sender.url matches
        console.log(request)
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]); // Fallback to empty array on error
      });
    });
  }

  async createRequest(request) {
    return this.transact("requests", "readwrite", (store) => {
      return new Promise((resolve) => {
        const requestOp = store.add(request);
        requestOp.onsuccess = () => {
          request.id = requestOp.result; // The auto-generated ID
          store.put(request, request.id)
          resolve(request);
        };
        requestOp.onerror = () => resolve(null); 
      });
    });
  }

  async updateRequestLLM(id, llm) {
    let currentReq = await this.getRequestById(id);
    if (!currentReq) return null;
    currentReq.llm = llm;
    return this.transact("requests", "readwrite", (store) => {
      return new Promise((resolve) => {
        const requestOp = store.put(currentReq, id);
        requestOp.onsuccess = () => resolve(currentReq);
        requestOp.onerror = () => resolve(null);
      });
    });
  }

  async clearRequests() {
    return this.transact("requests", "readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          console.log("All data in 'requests' store cleared");
          resolve(true);
        };
        request.onerror = () => {
          console.error("Error clearing 'requests' store:", request.error);
          reject(request.error);
        };
      });
    });
  }

  // Config Operations
  async getCfg() {
    return this.transact("config", "readonly", (store) => {
      return new Promise((resolve) => {
        const request = store.get("cfg");
        request.onsuccess = () => resolve(request.result?.value || this.DEFAULT_CFG);
      });
    });
  }

  async updateCfg(cfg) {
    console.log(cfg)
    const currentCfg = await this.getCfg();
    const updatedCfg = { ...currentCfg, ...cfg };
    return this.transact("config", "readwrite", (store) => {
      return new Promise((resolve) => {
        const request = store.put({ key: "cfg", value: updatedCfg });
        request.onsuccess = () => resolve(updatedCfg);
      });
    });
  }


  async getPages() {
    return this.transact("pages", "readonly", (store) => {
      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.map(r => r.url));
      });
    });
  }

  async addPage(url) {
    return this.transact("pages", "readwrite", (store) => {
      return new Promise((resolve) => {
        const request = store.put({ url });
        request.onsuccess = () => resolve(url);
      });
    });
  }

}

export default new DB()