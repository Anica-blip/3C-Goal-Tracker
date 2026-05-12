// storage.js — IndexedDB foundation
// Dash Notes · 3C Thread To Success™

const DB_NAME    = 'dash-notes';
const DB_VERSION = 1;

const STORES = {
  GOALS:  'goals',
  TASKS:  'tasks',
  NOTES:  'notes',
};

// ── Open DB ────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.GOALS))
        db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.TASKS))
        db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.NOTES))
        db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Write helper — waits for tx.oncomplete before resolving ──
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

// ── Delete helper ──────────────────────────────────────────
function txDelete(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

// ── Read helper ────────────────────────────────────────────
function txRead(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req   = store.getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

// ── ID generator ───────────────────────────────────────────
function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Goals ──────────────────────────────────────────────────
async function saveGoal(goal) {
  const db = await openDB();
  return txWrite(db, STORES.GOALS, {
    id:         goal.id         || genId(),
    title:      goal.title      || '',
    why:        goal.why        || '',
    milestones: goal.milestones || [],
    reflection: goal.reflection || '',
    progress:   goal.progress   || 0,
    created:    goal.created    || new Date().toISOString(),
    updated:    new Date().toISOString(),
  });
}

async function getGoals() {
  const db   = await openDB();
  const data = await txRead(db, STORES.GOALS);
  return data.sort((a, b) => new Date(b.created) - new Date(a.created));
}

async function deleteGoal(id) {
  const db = await openDB();
  return txDelete(db, STORES.GOALS, id);
}

// ── Tasks ──────────────────────────────────────────────────
async function saveTask(task) {
  const db = await openDB();
  return txWrite(db, STORES.TASKS, {
    id:       task.id       || genId(),
    text:     task.text     || '',
    quadrant: task.quadrant || 'q1',
    created:  task.created  || new Date().toISOString(),
    updated:  new Date().toISOString(),
  });
}

async function getTasks() {
  const db = await openDB();
  return txRead(db, STORES.TASKS);
}

async function deleteTask(id) {
  const db = await openDB();
  return txDelete(db, STORES.TASKS, id);
}

// ── Notes ──────────────────────────────────────────────────
async function saveNote(note) {
  const db = await openDB();
  return txWrite(db, STORES.NOTES, {
    id:      note.id      || genId(),
    text:    note.text    || '',
    subject: note.subject || '',
    type:    note.type    || 'text',
    created: note.created || new Date().toISOString(),
  });
}

async function getNotes() {
  const db   = await openDB();
  const data = await txRead(db, STORES.NOTES);
  return data.sort((a, b) => new Date(b.created) - new Date(a.created));
}

async function deleteNote(id) {
  const db = await openDB();
  return txDelete(db, STORES.NOTES, id);
}

// ── Export all ─────────────────────────────────────────────
async function exportAll() {
  const [goals, tasks, notes] = await Promise.all([
    getGoals(), getTasks(), getNotes()
  ]);
  return { goals, tasks, notes, exportedAt: new Date().toISOString() };
}

// ── Import from backup ─────────────────────────────────────
async function importAll(data) {
  if (data.goals) for (const g of data.goals) await saveGoal(g);
  if (data.tasks) for (const t of data.tasks) await saveTask(t);
  if (data.notes) for (const n of data.notes) await saveNote(n);
}

export {
  saveGoal, getGoals, deleteGoal,
  saveTask, getTasks, deleteTask,
  saveNote, getNotes, deleteNote,
  exportAll, importAll,
  genId,
};
