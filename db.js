class DB {
  constructor() {
    this.DEFAULT_CFG = {
      mockResponse: false,
      returnFollowupQuestions: true,
      prompterShortcut: "Meta + k"
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
        db.createObjectStore("requests", { autoIncrement: true });
        db.createObjectStore("config", { keyPath: "key" });
        db.createObjectStore("llms", { keyPath: "name" });
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

  async createRequest(request) {
    return this.transact("requests", "readwrite", (store) => {
      return new Promise((resolve) => {
        const requestOp = store.add(request);
        requestOp.onsuccess = () => {
          const newId = requestOp.result; // The auto-generated ID
          const newRequest = { ...request, id: newId };
          resolve(newRequest);
        };
        requestOp.onerror = () => resolve(null); 
      });
    });
  }

  async updateRequest(requestUpdates) {
    const currentReq = await this.getRequestById(requestUpdates.id);
    if (!currentReq) return null;
    const updatedReq = { ...currentReq, ...requestUpdates };
    return this.transact("requests", "readwrite", (store) => {
      return new Promise((resolve) => {
        const requestOp = store.put(updatedReq);
        requestOp.onsuccess = () => resolve(updatedReq);
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
    const currentCfg = await this.getCfg();
    const updatedCfg = { ...currentCfg, ...cfg };
    return this.transact("config", "readwrite", (store) => {
      return new Promise((resolve) => {
        const request = store.put({ key: "cfg", value: updatedCfg });
        request.onsuccess = () => resolve(updatedCfg);
      });
    });
  }

  // // LLM Operations
  // async getLLMs() {
  //   return this.transact("llms", "readonly", (store) => {
  //     return new Promise((resolve) => {
  //       const request = store.getAll();
  //       request.onsuccess = () => resolve(request.result);
  //     });
  //   });
  // }

  // async setLLM(llm) {
  //   return this.transact("llms", "readwrite", (store) => {
  //     return new Promise((resolve) => {
  //       const request = store.put(llm);
  //       request.onsuccess = () => resolve(llm);
  //     });
  //   });
  // }
}

export default new DB()