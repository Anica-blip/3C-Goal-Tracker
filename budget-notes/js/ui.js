// ui.js — small shared helpers (escaping, toast, money + month formatting)
// BUDGET Notes · 3C Thread To Success™

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

// ── Money (amounts are integer cents; display is euro) ─────
const moneyFormats = {};
export function money(cents) {
  const locale = getLocale();
  moneyFormats[locale] ||= new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
  return moneyFormats[locale].format((cents || 0) / 100);
}

/** Plain "1234.50" for putting back into an input box. */
export function plainAmount(cents) {
  return ((cents || 0) / 100).toFixed(2);
}

// ── Months ('YYYY-MM') ─────────────────────────────────────
function monthDate(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function monthLong(key) {   // "October 2026"
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(monthDate(key));
}

export function monthShort(key) {  // "Oct"
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', month: 'short' }).format(monthDate(key)).replace('.', '');
}

export function monthName(key) {   // "October"
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', month: 'long' }).format(monthDate(key));
}

export function dateLong(key, day = 1) {   // "1 November 2026"
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(y, m - 1, day)));
}

/** "05" — the day badge text */
export function dayText(day) {
  return String(day).padStart(2, '0');
}
