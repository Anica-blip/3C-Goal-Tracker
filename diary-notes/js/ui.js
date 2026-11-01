// ui.js — small shared helpers (escaping, toast, date formatting)
// DIARY Notes · 3C Thread To Success™

import { getLocale } from './i18n.js';

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Toast ──────────────────────────────────────────────────
let toastTimer = null;
export function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast--${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Dates ('YYYY-MM-DD') and months ('YYYY-MM') ────────────
function dayDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dayLong(iso) {     // "Sunday 1 November 2026"
  return new Intl.DateTimeFormat(getLocale(), {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(dayDate(iso));
}

export function monthLong(key) {   // "November 2026"
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(dayDate(`${key}-01`));
}

export function monthShort(key) {  // "Nov"
  const s = new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', month: 'short' }).format(dayDate(`${key}-01`)).replace('.', '');
  // British English writes "Sept"; the tabs use the three-letter "Sep"
  return getLocale().startsWith('en') && s === 'Sept' ? 'Sep' : s;
}

/** Weekday name for column i of a Monday-first week: 0 → "Mon". */
export function weekdayShort(i) {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 1 + i)));
}
