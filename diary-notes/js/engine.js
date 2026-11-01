// engine.js — pure diary logic (no DOM, no storage)
// DIARY Notes · 3C Thread To Success™
//
// Days are 'YYYY-MM-DD' strings, months are 'YYYY-MM', times are 'HH:MM' (24 hour).
// "Today" and "now" always follow Europe/Lisbon time.

export const TIMEZONE = 'Europe/Lisbon';

/** The diary starts in January 2026 — earlier years are not needed. */
export const MIN_MONTH = '2026-01';

export const BLOCKS = ['affirmation', 'reward', 'gratitude', 'fun', 'health', 'sleep'];
export const GROUPS = ['work', 'personal'];
export const KINDS  = ['note', 'todo'];

const pad2 = n => String(n).padStart(2, '0');

// ── Months ─────────────────────────────────────────────────
export function monthKey(year, month) {
  return `${year}-${pad2(month)}`;
}

export function parseMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

export function yearOf(key) {
  return Number(key.slice(0, 4));
}

export function addMonths(key, n) {
  const { year, month } = parseMonth(key);
  const idx = year * 12 + (month - 1) + n;
  return monthKey(Math.floor(idx / 12), (idx % 12) + 1);
}

export function daysInMonth(key) {
  const { year, month } = parseMonth(key);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function windowFor(viewStart) {
  return [viewStart, addMonths(viewStart, 1), addMonths(viewStart, 2)];
}

export function clampMonth(key, min, max) {
  if (key < min) return min;
  if (key > max) return max;
  return key;
}

// ── Days ───────────────────────────────────────────────────
export function dayISO(month, day) {
  return `${month}-${pad2(day)}`;
}

export function parseDay(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

export function monthOfDay(iso) {
  return iso.slice(0, 7);
}

export function isValidDay(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { year, month, day } = parseDay(iso);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(monthKey(year, month));
}

/** Same day-of-month in another month (31 → 30 or 28 where the month is shorter). */
export function shiftToMonth(iso, month) {
  const { day } = parseDay(iso);
  return dayISO(month, Math.min(day, daysInMonth(month)));
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(iso) {
  const { year, month, day } = parseDay(iso);
  const w = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (w + 6) % 7;
}

/** Weeks of a month, Monday first. Cells outside the month are null. */
export function monthGrid(month) {
  const total = daysInMonth(month);
  const cells = [];
  for (let i = 0; i < weekdayIndex(`${month}-01`); i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push({ iso: dayISO(month, d), day: d });
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Today in Lisbon, e.g. '2026-11-01'. */
export function todayISO(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The time now in Lisbon, e.g. '09:18'. */
export function nowTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('hour')}:${get('minute')}`;
}

/** First selectable month, and the last month the calendar window may start in. */
export function diaryBounds(todayDay) {
  const year = yearOf(todayDay);
  return { min: MIN_MONTH, maxStart: `${year + 1}-10` };
}

/** Keep a day inside the diary: from 1 Jan 2026 to the end of December next year. */
export function clampDay(iso, todayDay) {
  const b = diaryBounds(todayDay);
  const first = `${b.min}-01`;
  const lastMonth = addMonths(b.maxStart, 2);
  const last = dayISO(lastMonth, daysInMonth(lastMonth));
  if (iso < first) return first;
  if (iso > last) return last;
  return iso;
}

// ── Times ──────────────────────────────────────────────────
export function isValidTime(str) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}

/** Entries in time order; entries with no time come last, then by when they were made. */
export function sortEntries(list) {
  return list.slice().sort((a, b) => {
    const ta = a.time || '99:99';
    const tb = b.time || '99:99';
    if (ta !== tb) return ta < tb ? -1 : 1;
    if (a.created !== b.created) return a.created < b.created ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

// ── Records ────────────────────────────────────────────────
export function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const nowISO = () => new Date().toISOString();

export function makeEntry({ date, time = '', title, kind = 'note', text = '', items = [] }) {
  const stamp = nowISO();
  return {
    id: newId(),
    date,
    time: isValidTime(time) ? time : '',
    title: String(title).trim(),
    kind: KINDS.includes(kind) ? kind : 'note',
    text: String(text),
    items: items
      .filter(i => String(i.text ?? '').trim())
      .map(i => ({ id: i.id || newId(), text: String(i.text).trim(), done: !!i.done })),
    done: false,
    created: stamp,
    updated: stamp,
  };
}

/** A copy for the same day: same title, time and contents, nothing ticked. */
export function duplicateEntry(entry) {
  const stamp = nowISO();
  return {
    ...entry,
    id: newId(),
    done: false,
    items: entry.items.map(i => ({ id: newId(), text: i.text, done: false })),
    created: stamp,
    updated: stamp,
  };
}

/** Which days have anything written on them (for the dots on the calendar). */
export function daysWithContent(data) {
  const days = new Set();
  data.entries.forEach(e => days.add(e.date));
  data.reminders.forEach(r => days.add(r.date));
  data.selfcare.forEach(s => days.add(s.date));
  data.ratings.forEach(r => days.add(r.date));
  data.journal.forEach(j => { if (j.text && j.text.trim()) days.add(j.date); });
  return days;
}

// ── Backup repair ──────────────────────────────────────────
const MAX_TEXT = 50000;
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

function normaliseEntry(r) {
  if (!r || typeof r.id !== 'string' || !isValidDay(r.date) || !str(r.title, 200).trim()) return null;
  return {
    id: r.id,
    date: r.date,
    time: isValidTime(r.time) ? r.time : '',
    title: str(r.title, 200).trim(),
    kind: KINDS.includes(r.kind) ? r.kind : 'note',
    text: str(r.text, MAX_TEXT),
    items: (Array.isArray(r.items) ? r.items : [])
      .filter(i => i && typeof i.id === 'string' && str(i.text, 500).trim())
      .map(i => ({ id: i.id, text: str(i.text, 500).trim(), done: !!i.done })),
    done: !!r.done,
    created: str(r.created, 40) || nowISO(),
    updated: str(r.updated, 40) || nowISO(),
  };
}

function normaliseReminder(r) {
  if (!r || typeof r.id !== 'string' || !isValidDay(r.date) || !GROUPS.includes(r.group)) return null;
  return { id: r.id, date: r.date, group: r.group, text: str(r.text, 500), done: !!r.done, seq: Number.isFinite(r.seq) ? r.seq : 0 };
}

function normaliseJournal(r) {
  if (!r || !isValidDay(r.date)) return null;
  return { date: r.date, text: str(r.text, MAX_TEXT), updated: str(r.updated, 40) || nowISO() };
}

function normaliseRating(r) {
  if (!r || !isValidDay(r.date) || typeof r.cat !== 'string' || !Number.isInteger(r.value) || r.value < 1 || r.value > 5) return null;
  return { id: `${r.date}|${r.cat}`, date: r.date, cat: r.cat, value: r.value };
}

function normaliseCategory(r) {
  if (!r || typeof r.id !== 'string' || !str(r.name, 80).trim()) return null;
  return { id: r.id, name: str(r.name, 80).trim(), seq: Number.isFinite(r.seq) ? r.seq : 0 };
}

function normaliseSelfcare(r) {
  if (!r || typeof r.id !== 'string' || !isValidDay(r.date) || !BLOCKS.includes(r.block)) return null;
  return { id: r.id, date: r.date, block: r.block, text: str(r.text, 500), seq: Number.isFinite(r.seq) ? r.seq : 0 };
}

/** Validate a backup file; returns clean arrays, or null when it is not a DIARY Notes backup. */
export function normaliseData(data) {
  if (!data || data.app !== 'diary-notes') return null;
  const list = (v, fn) => (Array.isArray(v) ? v.map(fn).filter(Boolean) : []);
  return {
    entries:    list(data.entries, normaliseEntry),
    reminders:  list(data.reminders, normaliseReminder),
    journal:    list(data.journal, normaliseJournal),
    ratings:    list(data.ratings, normaliseRating),
    categories: list(data.categories, normaliseCategory),
    selfcare:   list(data.selfcare, normaliseSelfcare),
  };
}
