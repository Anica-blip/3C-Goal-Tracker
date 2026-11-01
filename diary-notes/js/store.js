// store.js — in-memory diary state + saving + change notifications
// DIARY Notes · 3C Thread To Success™
//
// Screens read getState() and redraw when subscribe() callbacks fire.
// Every change: memory → storage → notify the screens.
// "quiet" changes (text typed into an existing line) are saved without redrawing,
// so a tap on another button right afterwards is never lost.

import * as E from './engine.js';
import * as db from './storage.js';
import { t } from './i18n.js';

const today0 = E.todayISO();

const state = {
  entries: [],
  reminders: [],
  renewals: [],
  journal: [],
  ratings: [],
  categories: [],
  selfcare: [],
  today: today0,
  selected: today0,
  ready: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach(fn => {
    try { fn(); } catch (err) { console.error('[diary-notes] view error', err); }
  });
}

export function getState() {
  return state;
}

/** Redraw every screen (used when the language changes). */
export function refresh() {
  emit();
}

async function reload() {
  for (const name of db.DATA_STORES) state[name] = await db.getAll(name);
}

// ── Start-up ───────────────────────────────────────────────
export async function init() {
  state.today = E.todayISO();
  state.selected = state.today;
  await reload();

  if (!(await db.getMeta('seeded', false))) {
    if (state.categories.length === 0) {
      state.categories = t('seed.categories').map((name, i) => ({ id: E.newId(), name, seq: (i + 1) * 10 }));
      await db.putMany('categories', state.categories);
    }
    await db.setMeta('seeded', true);
  }

  state.ready = true;
  emit();
}

/** Timer / tab-visible check. Returns true if the Lisbon day changed. */
export function refreshToday() {
  const now = E.todayISO();
  if (now === state.today) return false;
  const followToday = state.selected === state.today;   // anyone looking at "today" moves with it
  state.today = now;
  if (followToday) state.selected = now;
  emit();
  return true;
}

export function selectDay(iso) {
  if (!E.isValidDay(iso)) return;
  const day = E.clampDay(iso, state.today);
  if (day === state.selected) return;
  state.selected = day;
  emit();
}

// ── Saving helpers ─────────────────────────────────────────
async function write(fn, quiet = false) {
  try {
    await fn();
  } catch (err) {
    await reload();      // memory and disk disagree — trust the disk
    emit();
    throw err;
  }
  if (!quiet) emit();
}

const byId = (list, id) => list.find(r => r.id === id);

// ── Day planner entries ────────────────────────────────────
/** fields = { date, time, title, kind, text, items } */
export async function addEntry(fields) {
  const rec = E.makeEntry(fields);
  state.entries.push(rec);
  await write(() => db.put('entries', rec));
  return rec;
}

/** patch = { title, time, kind, text, items } (any of them) */
export async function updateEntry(id, patch) {
  const rec = byId(state.entries, id);
  if (!rec) return null;
  const next = E.makeEntry({ date: rec.date, time: patch.time ?? rec.time, title: patch.title ?? rec.title, kind: patch.kind ?? rec.kind, text: patch.text ?? rec.text, items: patch.items ?? rec.items });
  Object.assign(rec, { time: next.time, title: next.title, kind: next.kind, text: next.text, items: next.items, updated: new Date().toISOString() });
  await write(() => db.put('entries', rec));
  return rec;
}

export async function deleteEntry(id) {
  const i = state.entries.findIndex(r => r.id === id);
  if (i === -1) return;
  state.entries.splice(i, 1);
  await write(() => db.remove('entries', id));
}

export async function duplicateEntry(id) {
  const src = byId(state.entries, id);
  if (!src) return null;
  const copy = E.duplicateEntry(src);
  state.entries.push(copy);
  await write(() => db.put('entries', copy));
  return copy;
}

export async function toggleEntryDone(id) {
  const rec = byId(state.entries, id);
  if (!rec) return;
  rec.done = !rec.done;
  rec.updated = new Date().toISOString();
  await write(() => db.put('entries', rec));
}

export async function toggleEntryItem(id, itemId) {
  const rec = byId(state.entries, id);
  const item = rec && rec.items.find(i => i.id === itemId);
  if (!item) return;
  item.done = !item.done;
  rec.updated = new Date().toISOString();
  await write(() => db.put('entries', rec));
}

// ── Reminders (Work / Personal) ────────────────────────────
export async function addReminder(date, group, text) {
  const mine = state.reminders.filter(r => r.date === date && r.group === group);
  const rec = { id: E.newId(), date, group, text: String(text).trim(), done: false, seq: mine.length ? Math.max(...mine.map(r => r.seq)) + 10 : 10 };
  state.reminders.push(rec);
  await write(() => db.put('reminders', rec));
  return rec;
}

export async function updateReminder(id, patch, { quiet = false } = {}) {
  const rec = byId(state.reminders, id);
  if (!rec) return;
  if ('text' in patch) rec.text = String(patch.text).trim();
  if ('done' in patch) rec.done = !!patch.done;
  await write(() => db.put('reminders', rec), quiet);
}

export async function deleteReminder(id) {
  const i = state.reminders.findIndex(r => r.id === id);
  if (i === -1) return;
  state.reminders.splice(i, 1);
  await write(() => db.remove('reminders', id));
}

// ── Renewals (not tied to a day) ───────────────────────────
/** fields = { name, expiry:'YYYY-MM' } */
export async function addRenewal({ name, expiry }) {
  const seq = state.renewals.length ? Math.max(...state.renewals.map(r => r.seq)) + 10 : 10;
  const rec = E.makeRenewal({ name, expiry, seq });
  state.renewals.push(rec);
  await write(() => db.put('renewals', rec));
  return rec;
}

/** patch = { name } and/or { expiry }. Renewing a card = giving it its new expiry month. */
export async function updateRenewal(id, patch, { quiet = false } = {}) {
  const rec = byId(state.renewals, id);
  if (!rec) return;
  if ('name' in patch) rec.name = String(patch.name).trim();
  if ('expiry' in patch && E.isValidMonth(patch.expiry)) rec.expiry = patch.expiry;
  await write(() => db.put('renewals', rec), quiet);
}

export async function deleteRenewal(id) {
  const i = state.renewals.findIndex(r => r.id === id);
  if (i === -1) return;
  state.renewals.splice(i, 1);
  await write(() => db.remove('renewals', id));
}

// ── Journal text (one per day) ─────────────────────────────
export async function saveJournal(date, text) {
  let rec = state.journal.find(j => j.date === date);
  if (!rec) { rec = { date, text: '', updated: '' }; state.journal.push(rec); }
  rec.text = String(text).slice(0, 50000);
  rec.updated = new Date().toISOString();
  await write(() => db.put('journal', rec));
}

// ── Ratings (1–5, one per category per day) ────────────────
/** Tap the same number again to clear it. */
export async function setRating(date, cat, value) {
  const id = `${date}|${cat}`;
  const i = state.ratings.findIndex(r => r.id === id);
  if (i !== -1 && state.ratings[i].value === value) {
    state.ratings.splice(i, 1);
    await write(() => db.remove('ratings', id));
    return;
  }
  if (i !== -1) {
    state.ratings[i].value = value;
    const rec = state.ratings[i];
    await write(() => db.put('ratings', rec));
  } else {
    const rec = { id, date, cat, value };
    state.ratings.push(rec);
    await write(() => db.put('ratings', rec));
  }
}

/**
 * Replace the rating list. list = [{ id?, name }] in the order wanted.
 * Names that are blank are skipped. Past ratings of a removed item are kept in the backup
 * but no longer shown.
 */
export async function saveCategories(list) {
  const clean = list
    .map(c => ({ id: c.id || E.newId(), name: String(c.name).trim() }))
    .filter(c => c.name)
    .map((c, i) => ({ ...c, seq: (i + 1) * 10 }));
  const keep = new Set(clean.map(c => c.id));
  const gone = state.categories.filter(c => !keep.has(c.id)).map(c => c.id);
  state.categories = clean;
  await write(async () => {
    if (gone.length) await db.removeMany('categories', gone);
    await db.putMany('categories', clean);
  });
}

// ── Self-Care bullet points ────────────────────────────────
export async function addSelfcare(date, block, text) {
  const mine = state.selfcare.filter(s => s.date === date && s.block === block);
  const rec = { id: E.newId(), date, block, text: String(text).trim(), seq: mine.length ? Math.max(...mine.map(s => s.seq)) + 10 : 10 };
  state.selfcare.push(rec);
  await write(() => db.put('selfcare', rec));
  return rec;
}

export async function updateSelfcare(id, text, { quiet = false } = {}) {
  const rec = byId(state.selfcare, id);
  if (!rec) return;
  rec.text = String(text).trim();
  await write(() => db.put('selfcare', rec), quiet);
}

export async function deleteSelfcare(id) {
  const i = state.selfcare.findIndex(r => r.id === id);
  if (i === -1) return;
  state.selfcare.splice(i, 1);
  await write(() => db.remove('selfcare', id));
}

// ── Backup / restore ───────────────────────────────────────
export function exportData() {
  return db.exportAll();
}

/** Replaces ALL current data with the backup. Throws 'bad-file' if it is not a DIARY Notes backup. */
export async function restoreData(raw) {
  const data = E.normaliseData(raw);
  if (!data) throw new Error('bad-file');
  await db.replaceAll(data, { seeded: true });
  await reload();
  emit();
  return data.entries.length + data.journal.length;
}
