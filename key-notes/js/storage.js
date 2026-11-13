// ═══════════════════════════════════════════════════════════════
//  js/storage.js — KEY Notes IndexedDB (encrypted at rest)
//  Every record is stored as an encrypted blob. Decryption happens
//  in memory only, using the session key set by crypto.js on unlock.
//  3C Thread To Success™
// ═══════════════════════════════════════════════════════════════

import { encryptObject, decryptObject, exportVaultMeta, importVaultMeta, isUnlocked, lockVault } from './crypto.js';
import { connect, changed } from '../../cloud/cloud-sync.js';

const DB_NAME    = 'key-notes';
const DB_VERSION = 1;
const CLOUD_APP  = 'key-notes';   // name used by cloud/cloud-sync.js (only active when Chef is signed in)

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
    tx.oncomplete = () => { db.close(); changed(CLOUD_APP); resolve(record); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
    tx.onabort    = () => { db.close(); reject(new Error('Transaction aborted')); };
  });
}

function txDelete(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => { db.close(); changed(CLOUD_APP); resolve(); };
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
// { name, url, email, username, password }
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
// ── Credentials note — a small encrypted reminder of PIN/passphrase/password,
// encrypted with the SAME master key as everything else. This means it
// automatically travels with every backup export, updates whenever the
// credentials change, and is only readable once genuinely unlocked. ──
const CREDS_NOTE_KEY = 'key-notes-creds-note';

export async function saveCredentialsNote(pin, passphrase, password) {
  const enc = await encryptObject({ pin, passphrase, password });
  localStorage.setItem(CREDS_NOTE_KEY, JSON.stringify(enc));
  changed(CLOUD_APP);
}
export async function loadCredentialsNote() {
  const raw = localStorage.getItem(CREDS_NOTE_KEY);
  if (!raw) return null;
  try { return await decryptObject(JSON.parse(raw)); } catch { return null; }
}
export function exportCredentialsNoteRaw() {
  const raw = localStorage.getItem(CREDS_NOTE_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function importCredentialsNoteRaw(blob) {
  if (blob) localStorage.setItem(CREDS_NOTE_KEY, JSON.stringify(blob));
  changed(CLOUD_APP);
}

export async function exportEncrypted() {
  const dump = {};
  for (const name of Object.values(STORES)) {
    const db = await openDB();
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
  for (const name of Object.values(STORES)) {
    const rows = backup.stores?.[name] || [];
    for (const row of rows) {
      const db = await openDB();
      await txWrite(db, name, row);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  Cloud saving (only when Chef is signed in — see cloud/cloud-sync.js)
//  The cloud copy is the same package as the full backup file: the vault's
//  wrapped keys + the encrypted records + the encrypted credentials note.
//  Every record in it is already encrypted here, in the browser, with the
//  vault's own key. The Worker only stores it and never opens it. The
//  GitHub sign-in never replaces the vault lock (PIN + passphrase + password,
//  or the recovery key).
// ═══════════════════════════════════════════════════════════════

/** Call after anything that changes the vault's keys without saving a record
 *  (e.g. a new recovery key), so the cloud copy follows. */
export function vaultChanged() { changed(CLOUD_APP); }

async function cloudExport() {
  return {
    app: 'key-notes',
    format: 'full-backup-v2',
    exportedAt: new Date().toISOString(),
    vault: exportVaultMeta(),
    data: await exportEncrypted(),
    credentials: exportCredentialsNoteRaw(),
  };
}

// "Empty" = no vault yet on this device and no records. A device that already has
// a vault (even with no records) is never overwritten without asking first.
function cloudIsEmpty(copy) {
  if (!copy || copy.vault) return false;
  const stores = (copy.data && copy.data.stores) || {};
  return Object.values(STORES).every(name => !(stores[name] && stores[name].length));
}

let _replaceLockedVault = false;

async function cloudReplace(doc) {
  if (!doc || typeof doc !== 'object' || !doc.vault || !doc.data || !doc.data.stores) {
    throw new Error('Not a usable KEY Notes cloud copy');
  }
  const incoming = {};
  for (const name of Object.values(STORES)) {
    const rows = doc.data.stores[name] || [];
    if (!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object' || r.id === undefined || r.id === null)) {
      throw new Error('Not a usable KEY Notes cloud copy');
    }
    incoming[name] = rows;
  }

  const before = exportVaultMeta();
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const names = Object.values(STORES);
    const tx = db.transaction(names, 'readwrite');
    for (const name of names) {
      const os = tx.objectStore(name);
      os.clear();
      for (const row of incoming[name]) os.put(row);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
    tx.onabort    = () => { db.close(); reject(tx.error || new Error('Transaction aborted')); };
  });

  importVaultMeta(doc.vault);
  if (doc.credentials) localStorage.setItem(CREDS_NOTE_KEY, JSON.stringify(doc.credentials));
  else localStorage.removeItem(CREDS_NOTE_KEY);

  // Same vault (same master key) → an open session stays valid. A different vault → the
  // open session key no longer fits, so lock and ask for the unlock details again.
  _replaceLockedVault = false;
  if (isUnlocked() && (!before || before.createdAt !== doc.vault.createdAt)) {
    lockVault();
    _replaceLockedVault = true;
  }
}

connect({
  app: CLOUD_APP,
  exportFn: cloudExport,
  replaceFn: cloudReplace,
  isEmpty: cloudIsEmpty,
  afterReplace: () => {
    window.dispatchEvent(new CustomEvent('key-cloud-replaced', { detail: { locked: _replaceLockedVault } }));
  },
});
