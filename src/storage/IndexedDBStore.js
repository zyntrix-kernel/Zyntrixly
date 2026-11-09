// ════════════════════════════════════════════════
//  ZYNTRIXLY 2.0 — src/storage/IndexedDBStore.js
//  Client-Side Encrypted Storage & Offline Store
// ════════════════════════════════════════════════

const ZxStorage = (() => {
  const DB_NAME = 'zyntrixly_db_v2';
  const DB_VERSION = 1;

  // In-memory fallback map if IndexedDB is not available
  const memStore = {
    messages: new Map(),
    conversations: new Map(),
    outbox: new Map(),
    call_history: new Map(),
    key_store: new Map()
  };

  let dbPromise = null;

  function hasIndexedDB() {
    return typeof indexedDB !== 'undefined';
  }

  function getDB() {
    if (!hasIndexedDB()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains('messages')) {
          const mStore = db.createObjectStore('messages', { keyPath: 'id' });
          mStore.createIndex('conversationId', 'conversationId', { unique: false });
          mStore.createIndex('sentAt', 'sentAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const oStore = db.createObjectStore('outbox', { keyPath: 'id' });
          oStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('call_history')) {
          const cStore = db.createObjectStore('call_history', { keyPath: 'callId' });
          cStore.createIndex('startedAt', 'startedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('key_store')) {
          db.createObjectStore('key_store', { keyPath: 'keyId' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[ZxStorage] IndexedDB open error, falling back to in-memory store:', req.error);
        resolve(null);
      };
    });

    return dbPromise;
  }

  // Generic store operation helper
  async function withStore(storeName, mode, callback) {
    const db = await getDB();
    if (!db) {
      return callback({
        get: (k) => Promise.resolve(memStore[storeName]?.get(k)),
        put: (v) => { memStore[storeName]?.set(v.id || v.callId || v.keyId, v); return Promise.resolve(v); },
        delete: (k) => { memStore[storeName]?.delete(k); return Promise.resolve(); },
        getAll: () => Promise.resolve(Array.from(memStore[storeName]?.values() || []))
      });
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = callback({
          get: (k) => wrapReq(store.get(k)),
          put: (v) => wrapReq(store.put(v)),
          delete: (k) => wrapReq(store.delete(k)),
          getAll: () => wrapReq(store.getAll()),
          store
        });
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  function wrapReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ── MESSAGES ───────────────────────────────────────────────────
  async function putMessage(message) {
    if (!message || !message.id) return;
    const db = await getDB();
    if (!db) {
      memStore.messages.set(message.id, message);
      return message;
    }
    return withStore('messages', 'readwrite', async s => s.put(message));
  }

  async function getMessage(messageId) {
    const db = await getDB();
    if (!db) return memStore.messages.get(messageId) || null;
    return withStore('messages', 'readonly', async s => s.get(messageId));
  }

  async function getMessagesByConversation(conversationId, limit = 50) {
    const db = await getDB();
    if (!db) {
      const all = Array.from(memStore.messages.values())
        .filter(m => m.conversationId === conversationId)
        .sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0));
      return all.slice(-limit);
    }

    return new Promise(async (resolve) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('conversationId');
      const req = index.getAll(conversationId);
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0));
        resolve(sorted.slice(-limit));
      };
      req.onerror = () => resolve([]);
    });
  }

  async function deleteMessage(messageId) {
    const db = await getDB();
    if (!db) {
      memStore.messages.delete(messageId);
      return;
    }
    return withStore('messages', 'readwrite', async s => s.delete(messageId));
  }

  // ── CONVERSATIONS ──────────────────────────────────────────────
  async function putConversation(conv) {
    if (!conv || !conv.id) return;
    const db = await getDB();
    if (!db) {
      memStore.conversations.set(conv.id, conv);
      return conv;
    }
    return withStore('conversations', 'readwrite', async s => s.put(conv));
  }

  async function getConversations() {
    const db = await getDB();
    if (!db) return Array.from(memStore.conversations.values());
    return withStore('conversations', 'readonly', async s => s.getAll());
  }

  // ── OUTBOX (Offline Outgoing Queue) ───────────────────────────
  async function enqueueOutbox(item) {
    const queueItem = {
      ...item,
      id: item.id || ('out_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
      clientMessageId: item.clientMessageId || ('cm_' + Math.random().toString(36).substring(2, 10)),
      status: 'queued',
      createdAt: Date.now(),
      retryAttempts: 0
    };

    const db = await getDB();
    if (!db) {
      memStore.outbox.set(queueItem.id, queueItem);
      return queueItem;
    }
    await withStore('outbox', 'readwrite', async s => s.put(queueItem));
    return queueItem;
  }

  async function getPendingOutbox() {
    const db = await getDB();
    if (!db) {
      return Array.from(memStore.outbox.values())
        .filter(item => item.status === 'queued' || item.status === 'failed')
        .sort((a, b) => a.createdAt - b.createdAt);
    }

    return new Promise(async (resolve) => {
      const tx = db.transaction('outbox', 'readonly');
      const store = tx.objectStore('outbox');
      const req = store.getAll();
      req.onsuccess = () => {
        const filtered = (req.result || []).filter(item => item.status === 'queued' || item.status === 'failed');
        resolve(filtered.sort((a, b) => a.createdAt - b.createdAt));
      };
      req.onerror = () => resolve([]);
    });
  }

  async function removeOutboxItem(id) {
    const db = await getDB();
    if (!db) {
      memStore.outbox.delete(id);
      return;
    }
    return withStore('outbox', 'readwrite', async s => s.delete(id));
  }

  async function updateOutboxStatus(id, status, errorMsg = null) {
    const db = await getDB();
    if (!db) {
      const item = memStore.outbox.get(id);
      if (item) {
        item.status = status;
        if (errorMsg) item.lastError = errorMsg;
        if (status === 'failed') item.retryAttempts = (item.retryAttempts || 0) + 1;
        memStore.outbox.set(id, item);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('outbox', 'readwrite');
        const s = tx.objectStore('outbox');
        const req = s.get(id);
        req.onsuccess = () => {
          const item = req.result;
          if (item) {
            item.status = status;
            if (errorMsg) item.lastError = errorMsg;
            if (status === 'failed') item.retryAttempts = (item.retryAttempts || 0) + 1;
            s.put(item);
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ── CALL HISTORY ───────────────────────────────────────────────
  async function addCallLog(callRecord) {
    const record = {
      ...callRecord,
      callId: callRecord.callId || ('cl_' + Date.now()),
      startedAt: callRecord.startedAt || Date.now()
    };
    const db = await getDB();
    if (!db) {
      memStore.call_history.set(record.callId, record);
      return record;
    }
    await withStore('call_history', 'readwrite', async s => s.put(record));
    return record;
  }

  async function getCallHistory(limit = 100) {
    const db = await getDB();
    if (!db) {
      return Array.from(memStore.call_history.values())
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit);
    }

    return new Promise(async (resolve) => {
      const tx = db.transaction('call_history', 'readonly');
      const store = tx.objectStore('call_history');
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => b.startedAt - a.startedAt);
        resolve(sorted.slice(0, limit));
      };
      req.onerror = () => resolve([]);
    });
  }

  // ── KEY STORE ──────────────────────────────────────────────────
  async function putKey(keyId, keyData) {
    const record = { keyId, data: keyData, updatedAt: Date.now() };
    const db = await getDB();
    if (!db) {
      memStore.key_store.set(keyId, record);
      return record;
    }
    await withStore('key_store', 'readwrite', async s => s.put(record));
    return record;
  }

  async function getKey(keyId) {
    const db = await getDB();
    if (!db) {
      const r = memStore.key_store.get(keyId);
      return r ? r.data : null;
    }
    const res = await withStore('key_store', 'readonly', async s => s.get(keyId));
    return res ? res.data : null;
  }

  // ── PURGE / DATA SHREDDING ─────────────────────────────────────
  async function shredAllLocalData() {
    memStore.messages.clear();
    memStore.conversations.clear();
    memStore.outbox.clear();
    memStore.call_history.clear();
    memStore.key_store.clear();

    if (hasIndexedDB()) {
      return new Promise((resolve) => {
        if (dbPromise) {
          dbPromise.then(db => {
            if (db) db.close();
            const delReq = indexedDB.deleteDatabase(DB_NAME);
            delReq.onsuccess = () => { dbPromise = null; resolve(true); };
            delReq.onerror = () => resolve(false);
          });
        } else {
          const delReq = indexedDB.deleteDatabase(DB_NAME);
          delReq.onsuccess = () => resolve(true);
          delReq.onerror = () => resolve(false);
        }
      });
    }
  }

  return {
    putMessage,
    getMessage,
    getMessagesByConversation,
    deleteMessage,
    putConversation,
    getConversations,
    enqueueOutbox,
    getPendingOutbox,
    removeOutboxItem,
    updateOutboxStatus,
    addCallLog,
    getCallHistory,
    putKey,
    getKey,
    shredAllLocalData
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZxStorage;
}
if (typeof window !== 'undefined') {
  window.ZxStorage = ZxStorage;
}
