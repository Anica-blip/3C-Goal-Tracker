// storage.js — IndexedDB foundation
// 3C Goal Tracker · 3C Thread To Success™

const DB_NAME    = '3c-goal-tracker';
const DB_VERSION = 1;

const STORES = {
  GOALS:  'goals',
  TASKS:  'tasks',
  NOTES:  'notes',
  VOICES: 'voices',
};

// ── Open DB ────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORES.GOALS)) {
        const goals = db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
        goals.createIndex('created', 'created', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        const tasks = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
        tasks.createIndex('quadrant', 'quadrant', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const notes = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
        notes.createIndex('created', 'created', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.VOICES)) {
        const voices = db.createObjectStore(STORES.VOICES, { keyPath: 'id' });
        voices.createIndex('created', 'created', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Generic helpers ────────────────────────────────────────
function txStore(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── ID generator ───────────────────────────────────────────
function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Goals ──────────────────────────────────────────────────
async function saveGoal(goal) {
  const db   = await openDB();
  const store = txStore(db, STORES.GOALS, 'readwrite');
  const record = {
    id:         goal.id || genId(),
    title:      goal.title      || '',
    why:        goal.why        || '',
    milestones: goal.milestones || [],
    reflection: goal.reflection || '',
    progress:   goal.progress   || 0,
    created:    goal.created    || new Date().toISOString(),
    updated:    new Date().toISOString(),
  };
  await promisify(store.put(record));
  db.close();
  return record;
}

async function getGoals() {
  const db     = await openDB();
  const store  = txStore(db, STORES.GOALS, 'readonly');
  const result = await promisify(store.getAll());
  db.close();
  return result.sort((a, b) => new Date(b.created) - new Date(a.created));
}

async function deleteGoal(id) {
  const db   = await openDB();
  const store = txStore(db, STORES.GOALS, 'readwrite');
  await promisify(store.delete(id));
  db.close();
}

// ── Tasks (Eisenhower) ─────────────────────────────────────
async function saveTask(task) {
  const db   = await openDB();
  const store = txStore(db, STORES.TASKS, 'readwrite');
  const record = {
    id:       task.id       || genId(),
    text:     task.text     || '',
    quadrant: task.quadrant || 'q1',
    created:  task.created  || new Date().toISOString(),
    updated:  new Date().toISOString(),
  };
  await promisify(store.put(record));
  db.close();
  return record;
}

async function getTasks() {
  const db     = await openDB();
  const store  = txStore(db, STORES.TASKS, 'readonly');
  const result = await promisify(store.getAll());
  db.close();
  return result;
}

async function deleteTask(id) {
  const db   = await openDB();
  const store = txStore(db, STORES.TASKS, 'readwrite');
  await promisify(store.delete(id));
  db.close();
}

// ── Notes ──────────────────────────────────────────────────
async function saveNote(note) {
  const db   = await openDB();
  const store = txStore(db, STORES.NOTES, 'readwrite');
  const record = {
    id:      note.id      || genId(),
    text:    note.text    || '',
    type:    note.type    || 'text',   // 'text' | 'voice'
    created: note.created || new Date().toISOString(),
  };
  await promisify(store.put(record));
  db.close();
  return record;
}

async function getNotes() {
  const db     = await openDB();
  const store  = txStore(db, STORES.NOTES, 'readonly');
  const result = await promisify(store.getAll());
  db.close();
  return result.sort((a, b) => new Date(b.created) - new Date(a.created));
}

async function deleteNote(id) {
  const db   = await openDB();
  const store = txStore(db, STORES.NOTES, 'readwrite');
  await promisify(store.delete(id));
  db.close();
}

// ── Full export (for backup) ───────────────────────────────
async function exportAll() {
  const [goals, tasks, notes] = await Promise.all([
    getGoals(), getTasks(), getNotes()
  ]);
  return { goals, tasks, notes, exportedAt: new Date().toISOString() };
}

// ── Import from JSON backup ────────────────────────────────
async function importAll(data) {
  if (data.goals)  for (const g of data.goals)  await saveGoal(g);
  if (data.tasks)  for (const t of data.tasks)  await saveTask(t);
  if (data.notes)  for (const n of data.notes)  await saveNote(n);
}

export {
  saveGoal, getGoals, deleteGoal,
  saveTask, getTasks, deleteTask,
  saveNote, getNotes, deleteNote,
  exportAll, importAll,
  genId,
};
