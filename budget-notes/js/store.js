// storage.js — IndexedDB foundation
// BUDGET Notes · 3C Thread To Success™
//
// This is the ONLY file that knows where data lives. To move Budget Notes to a
// Cloudflare Worker + D1 later, replace the functions below and nothing else changes.

const DB_NAME    = 'budget-notes';
const DB_VERSION = 1;

const STORES = {
  LINES: 'lines',   // one record per budget line (see engine.js)
  META:  'meta',    // { key, value } — seeded flag, unlocked years
};

// ── Open DB ────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.LINES))
        db.createObjectStore(STORES.LINES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.META))
        db.createObjectStore(STORES.META, { keyPath: 'key' });
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

// ── Lines ──────────────────────────────────────────────────
function getAllLines() {
  return transact(STORES.LINES, 'readonly', tx => tx.objectStore(STORES.LINES).getAll());
}

function putLines(lines) {
  return transact(STORES.LINES, 'readwrite', tx => {
    const store = tx.objectStore(STORES.LINES);
    lines.forEach(line => store.put(line));
  });
}

function deleteLines(ids) {
  return transact(STORES.LINES, 'readwrite', tx => {
    const store = tx.objectStore(STORES.LINES);
    ids.forEach(id => store.delete(id));
  });
}

// ── Meta ───────────────────────────────────────────────────
async function getMeta(key, fallback = null) {
  const rec = await transact(STORES.META, 'readonly', tx => tx.objectStore(STORES.META).get(key));
  return rec && 'value' in rec ? rec.value : fallback;
}

function setMeta(key, value) {
  return transact(STORES.META, 'readwrite', tx => {
    tx.objectStore(STORES.META).put({ key, value });
  });
}

// ── Export / import ────────────────────────────────────────
async function exportAll() {
  const [lines, metaRecords] = await Promise.all([
    getAllLines(),
    transact(STORES.META, 'readonly', tx => tx.objectStore(STORES.META).getAll()),
  ]);
  const meta = {};
  metaRecords.forEach(r => { meta[r.key] = r.value; });
  return {
    app: 'budget-notes',
    version: 1,
    exportedAt: new Date().toISOString(),
    lines,
    meta,
  };
}

/** Replace everything (lines + meta) in one transaction. */
function replaceAll(lines, meta) {
  return transact([STORES.LINES, STORES.META], 'readwrite', tx => {
    const lineStore = tx.objectStore(STORES.LINES);
    const metaStore = tx.objectStore(STORES.META);
    lineStore.clear();
    metaStore.clear();
    lines.forEach(line => lineStore.put(line));
    Object.entries(meta).forEach(([key, value]) => metaStore.put({ key, value }));
  });
}

export {
  getAllLines, putLines, deleteLines,
  getMeta, setMeta,
  exportAll, replaceAll,
};
