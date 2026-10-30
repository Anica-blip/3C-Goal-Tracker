// store.js — in-memory budget state + persistence + change notifications
// BUDGET Notes · 3C Thread To Success™
//
// Views read from getState() and re-render when subscribe() callbacks fire.
// Every change goes: engine (logic) → storage (save) → notify views.

import * as E from './engine.js';
import * as db from './storage.js';
import { t } from './i18n.js';

const state = {
  lines: [],
  unlockedYears: [],
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

async function reload() {
  state.lines = await db.getAllLines();
  state.unlockedYears = await db.getMeta('unlockedYears', []);
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
  try {
    if (result.changed && result.changed.length) await db.putLines(result.changed);
    if (result.removed && result.removed.length) await db.deleteLines(result.removed);
  } catch (err) {
    await reload();   // memory and disk disagree — trust the disk
    emit();
    throw err;
  }
  emit();
  return result;
}

// ── Changes (all take the month being viewed) ──────────────
export function addLine(section, month, label, amount, once) {
  return persist(E.addLine(state.lines, { section, month, label, amount, once }));
}

export function editLine(id, month, patch, once) {
  return persist(E.editLine(state.lines, id, month, patch, once));
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

// ── Archive: unlock / re-lock a closed year ────────────────
export async function setYearUnlocked(year, unlocked) {
  const set = new Set(state.unlockedYears);
  if (unlocked) set.add(year); else set.delete(year);
  state.unlockedYears = [...set].sort();
  await db.setMeta('unlockedYears', state.unlockedYears);
  emit();
}

// ── Backup / restore ───────────────────────────────────────
export function exportData() {
  return db.exportAll();
}

/** Replaces ALL current data with the backup. Throws 'bad-file' if it is not a Budget Notes backup. */
export async function restoreData(data) {
  if (!data || data.app !== 'budget-notes' || !Array.isArray(data.lines)) throw new Error('bad-file');
  const lines = data.lines.map(E.normaliseLine).filter(Boolean);
  const unlocked = Array.isArray(data.meta?.unlockedYears)
    ? data.meta.unlockedYears.filter(Number.isInteger)
    : [];
  await db.replaceAll(lines, { seeded: true, unlockedYears: unlocked });
  await reload();
  emit();
  return lines.length;
}
