// ═══════════════════════════════════════════════════════════════
//  js/storage.js — KEY Notes IndexedDB (encrypted at rest)
//  Every record is stored as an encrypted blob. Decryption happens
//  in memory only, using the session key set by crypto.js on unlock.
//  3C Thread To Success™
// ═══════════════════════════════════════════════════════════════

import { encryptObject, decryptObject } from './crypto.js';

const DB_NAME    = 'key-notes';
const DB_VERSION = 1;

const STORES = {
  CONTACTS: 'contacts',
  LINKS:    'links',
  ARCHIVE:  'archive',
  KEYS:     'keys',
};

// ── Open DB ────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      Object.values(STORES).forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function txWrite(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(record);
    tx.oncomplete = () => { db.close(); resolve(record); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
    tx.onabort    = () => { db.close(); reject(new Error('Transaction aborted')); };
  });
}

function txDelete(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

function txRead(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req   = store.getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Generic encrypted save/read/delete for a given store ────────
async function saveRecord(storeName, plainObj) {
  const id      = plainObj.id || genId();
  const created = plainObj.created || new Date().toISOString();
  const payload = { ...plainObj, id, created, updated: new Date().toISOString() };
  delete payload.id; // id stays outside the encrypted blob (used as IndexedDB keyPath)

  const enc = await encryptObject(payload);
  const db  = await openDB();
  await txWrite(db, storeName, { id, iv: enc.iv, data: enc.data });
  return { ...payload, id };
}

async function getAllRecords(storeName) {
  const db   = await openDB();
  const rows = await txRead(db, storeName);
  const out  = [];
  for (const row of rows) {
    try {
      const decrypted = await decryptObject({ iv: row.iv, data: row.data });
      out.push({ ...decrypted, id: row.id });
    } catch {
      // Skip a record that fails to decrypt (wrong session key / corrupted row)
      // rather than crash the whole list.
    }
  }
  return out;
}

async function deleteRecord(storeName, id) {
  const db = await openDB();
  return txDelete(db, storeName, id);
}

// ── Sort helpers ──────────────────────────────────────────────
function sortByName(a, b, key = 'firstName') {
  return (a[key] || '').localeCompare(b[key] || '', undefined, { sensitivity: 'base' });
}

// ── Contacts ───────────────────────────────────────────────────
// { firstName, lastName, business, phones: [{label, number}], email, address }
export async function saveContact(obj)      { return saveRecord(STORES.CONTACTS, obj); }
export async function deleteContact(id)     { return deleteRecord(STORES.CONTACTS, id); }
export async function getContacts() {
  const rows = await getAllRecords(STORES.CONTACTS);
  return rows.sort((a, b) =>
    sortByName(a, b, 'firstName') || sortByName(a, b, 'lastName')
  );
}

// ── Links ──────────────────────────────────────────────────────
// { name, username, url, password }
export async function saveLink(obj)      { return saveRecord(STORES.LINKS, obj); }
export async function deleteLink(id)     { return deleteRecord(STORES.LINKS, id); }
export async function getLinks() {
  const rows = await getAllRecords(STORES.LINKS);
  return rows.sort((a, b) => sortByName(a, b, 'name'));
}

// ── Archive notes ──────────────────────────────────────────────
// { category, title, note }
export async function saveArchiveNote(obj)      { return saveRecord(STORES.ARCHIVE, obj); }
export async function deleteArchiveNote(id)     { return deleteRecord(STORES.ARCHIVE, id); }
export async function getArchiveNotes() {
  const rows = await getAllRecords(STORES.ARCHIVE);
  return rows.sort((a, b) =>
    sortByName(a, b, 'category') || sortByName(a, b, 'title')
  );
}

// ── Keys ───────────────────────────────────────────────────────
// { title, note }
export async function saveKeyRecord(obj)      { return saveRecord(STORES.KEYS, obj); }
export async function deleteKeyRecord(id)     { return deleteRecord(STORES.KEYS, id); }
export async function getKeyRecords() {
  const rows = await getAllRecords(STORES.KEYS);
  return rows.sort((a, b) => sortByName(a, b, 'title'));
}

// ── Encrypted export — raw blobs copied as-is, only openable via KEY Notes ──
export async function exportEncrypted() {
  const db = await openDB();
  const dump = {};
  for (const name of Object.values(STORES)) {
    dump[name] = await txRead(db, name);
  }
  return {
    app: 'key-notes',
    format: 'encrypted',
    exportedAt: new Date().toISOString(),
    stores: dump,
  };
}

export async function importEncrypted(backup) {
  if (!backup || backup.app !== 'key-notes' || backup.format !== 'encrypted') {
    throw new Error('Not a valid KEY Notes encrypted backup file');
  }
  const db = await openDB();
  for (const name of Object.values(STORES)) {
    const rows = backup.stores?.[name] || [];
    for (const row of rows) await txWrite(db, name, row);
  }
}
