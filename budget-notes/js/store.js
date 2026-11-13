// store.js — in-memory budget state + persistence + change notifications
// BUDGET Notes · 3C Thread To Success™
//
// Views read from getState() and re-render when subscribe() callbacks fire.
// Every change goes: engine (logic) → storage (save) → notify views.

import * as E from './engine.js';
import * as db from './storage.js';
import { t } from './i18n.js';
// Cloud saving (Chef only): does nothing unless she is signed in on this browser.
import { connect, changed } from '../../cloud/cloud-sync.js';

const state = {
  lines: [],
  today: E.currentMonthKey(),
  ready: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach(fn => {
    try { fn(); } catch (err) { console.error('[budget-notes] view error', err); }
  });
}

export function getState() {
  return state;
}

/** Re-draw every view (used when the language changes). */
export function refresh() {
  emit();
}

async function reload() {
  state.lines = await db.getAllLines();
}

// ── Cloud saving connection ────────────────────────────────
// A line still in its first-run shape (income/savings row, amount 0, never edited) is not "notes",
// so a new device holding only those is treated as empty and takes the cloud copy without asking.
const isPristine = l => !!l && (l.section === 'income' || l.section === 'savings') &&
  Array.isArray(l.versions) && l.versions.length === 1 && !l.versions[0].patch.amount &&
  !Object.keys(l.overrides || {}).length && !Object.keys(l.checks || {}).length && !l.endMonth;

/** Replace this device's budget with the cloud copy (same checks as a backup restore). */
async function cloudReplace(data) {
  if (!data || !Array.isArray(data.lines)) throw new Error('bad-copy');
  const lines = data.lines.map(E.normaliseLine).filter(Boolean);
  await db.replaceAll(lines, Object.assign({}, data.meta, { seeded: true }));
  await reload();
}

function startCloud() {
  connect({
    app:          'budget-notes',
    exportFn:     db.exportAll,
    replaceFn:    cloudReplace,
    isEmpty:      d => !(d.lines || []).some(l => !isPristine(l)),
    afterReplace: () => { state.today = E.currentMonthKey(); emit(); },
  });
}

// ── Start-up ───────────────────────────────────────────────
export async function init() {
  state.today = E.currentMonthKey();
  await reload();

  const seeded = await db.getMeta('seeded', false);
  if (!seeded) {
    if (state.lines.length === 0) {
      // First run: income + savings rows apply to every month of this year (amounts at 0)
      const year = E.yearOf(state.today);
      const lines = E.seedDefaults(`${year}-01`, {
        income:  t('seed.income'),
        savings: t('seed.savings'),
      });
      await db.putLines(lines);
      state.lines = lines;
    }
    await db.setMeta('seeded', true);
  }

  state.ready = true;
  startCloud();   // only after the first-run set-up above, so it can never clash with it
  emit();
}

/** Called on a timer / when the tab becomes visible again. Returns true if the Lisbon month changed. */
export function refreshToday() {
  const key = E.currentMonthKey();
  if (key === state.today) return false;
  state.today = key;
  emit();
  return true;
}

// ── Persist an engine result, then tell the views ──────────
async function persist(result) {
  if (result.error) return result;   // refused by the engine — nothing to save
  try {
    if (result.changed && result.changed.length) await db.putLines(result.changed);
    if (result.removed && result.removed.length) await db.deleteLines(result.removed);
  } catch (err) {
    await reload();   // memory and disk disagree — trust the disk
    emit();
    throw err;
  }
  if ((result.changed && result.changed.length) || (result.removed && result.removed.length)) changed('budget-notes');
  emit();
  return result;
}

// ── Changes (all take the month being viewed) ──────────────
/** dates = { start:{day,month}|null, end:{day,month}|null } */
export function addLine(section, month, label, amount, once, dates = {}) {
  return persist(E.addLine(state.lines, {
    section, month, label, amount, once,
    start: dates.start || null, end: dates.end || null,
  }));
}

/** patch = { label, amount, day? }, dates = { start, end, endChanged } (Forward edits only) */
export function updateLine(id, month, patch, once, dates = null) {
  return persist(E.updateLine(state.lines, id, month, patch, once, dates));
}

export function deleteLine(id, month, once) {
  return persist(E.deleteLine(state.lines, id, month, once));
}

export function duplicateLine(id, month, once) {
  return persist(E.duplicateLine(state.lines, id, month, once));
}

export function setChecked(id, month, done) {
  return persist(E.setChecked(state.lines, id, month, done));
}

// ── Backup / restore ───────────────────────────────────────
export function exportData() {
  return db.exportAll();
}

/** Replaces ALL current data with the backup. Throws 'bad-file' if it is not a Budget Notes backup. */
export async function restoreData(data) {
  if (!data || data.app !== 'budget-notes' || !Array.isArray(data.lines)) throw new Error('bad-file');
  const lines = data.lines.map(E.normaliseLine).filter(Boolean);
  await db.replaceAll(lines, { seeded: true });
  await reload();
  changed('budget-notes');
  emit();
  return lines.length;
}
