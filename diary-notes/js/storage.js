// storage.js — IndexedDB foundation
// DIARY Notes · 3C Thread To Success™
//
// This is the ONLY file that knows where data lives. To move DIARY Notes to a
// Cloudflare Worker + D1 later, replace the functions below and nothing else changes.

const DB_NAME    = 'diary-notes';
const DB_VERSION = 2;   // 2: added the renewals store (older diaries upgrade automatically)

// store name → key field
const STORES = {
  entries:    'id',     // day planner entries (title + note or to-do list + time)
  reminders:  'id',     // Work / Personal reminder lines
  renewals:   'id',     // Renewals: card expiry, subscriptions, insurance (name + expiry month)
  journal:    'date',   // one journal text per day
  ratings:    'id',     // 1–5 ratings, id = `${date}|${categoryId}`
  categories: 'id',     // the rating list (Eating, Water, …)
  selfcare:   'id',     // bullet points in the six Self-Care blocks
  meta:       'key',    // seeded flag
};

export const DATA_STORES = ['entries', 'reminders', 'renewals', 'journal', 'ratings', 'categories', 'selfcare'];

// ── Open DB ────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      Object.entries(STORES).forEach(([name, keyPath]) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Run one transaction; resolve only when it has fully committed ──
async function transact(storeNames, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    try {
      result = work(tx);
    } catch (err) {
      db.close();
      reject(err);
      return;
    }
    tx.oncomplete = () => { db.close(); resolve(result && 'result' in result ? result.result : result); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
    tx.onabort    = () => { db.close(); reject(tx.error || new Error('Transaction aborted')); };
  });
}

// ── Records ────────────────────────────────────────────────
export function getAll(store) {
  return transact(store, 'readonly', tx => tx.objectStore(store).getAll());
}

export function put(store, record) {
  return transact(store, 'readwrite', tx => { tx.objectStore(store).put(record); });
}

export function putMany(store, records) {
  return transact(store, 'readwrite', tx => {
    const os = tx.objectStore(store);
    records.forEach(r => os.put(r));
  });
}

export function remove(store, key) {
  return transact(store, 'readwrite', tx => { tx.objectStore(store).delete(key); });
}

export function removeMany(store, keys) {
  return transact(store, 'readwrite', tx => {
    const os = tx.objectStore(store);
    keys.forEach(k => os.delete(k));
  });
}

// ── Meta ───────────────────────────────────────────────────
export async function getMeta(key, fallback = null) {
  const rec = await transact('meta', 'readonly', tx => tx.objectStore('meta').get(key));
  return rec && 'value' in rec ? rec.value : fallback;
}

export function setMeta(key, value) {
  return transact('meta', 'readwrite', tx => { tx.objectStore('meta').put({ key, value }); });
}

// ── Export / import ────────────────────────────────────────
export async function exportAll() {
  const out = { app: 'diary-notes', version: 2, exportedAt: new Date().toISOString() };
  for (const name of DATA_STORES) out[name] = await getAll(name);
  return out;
}

/** Replace everything (all data stores + meta) in one transaction. */
export function replaceAll(data, meta) {
  return transact([...DATA_STORES, 'meta'], 'readwrite', tx => {
    DATA_STORES.forEach(name => {
      const os = tx.objectStore(name);
      os.clear();
      (data[name] || []).forEach(r => os.put(r));
    });
    const ms = tx.objectStore('meta');
    ms.clear();
    Object.entries(meta).forEach(([key, value]) => ms.put({ key, value }));
  });
}
