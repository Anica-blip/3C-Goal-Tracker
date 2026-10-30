// engine.js — pure budget logic (no DOM, no storage)
// BUDGET Notes · 3C Thread To Success™
//
// How carry-forward works
// -----------------------
// Every budget line stores a HISTORY of changes, not a copy per month:
//   versions  [{ from:'2026-10', patch:{ label?, amount? } }]  → "Forward" changes
//   overrides { '2026-11': { label?, amount?, hidden? } }      → "Once" changes
//   checks    { '2026-10': true }                              → savings tick-offs (per month, never carried)
//   endMonth  first month the line no longer applies (or null)
// A month's value = base versions up to that month, then that month's override on top.
// Editing never rewrites earlier months.
//
// Amounts are stored as integer CENTS to avoid floating-point drift.
// Months are 'YYYY-MM' strings.
//
// Engine mutators change the `lines` array you pass in (in place) and return
// { changed:[lines to save], removed:[ids to delete] } so the caller can persist them.

export const SECTIONS = ['income', 'savings', 'fixed', 'variable'];
export const TIMEZONE = 'Europe/Lisbon';

// Money Left = Income − Fixed − Variable.
// Set to true to ALSO deduct the Savings & Investments total.
export const DEDUCT_SAVINGS = false;

// ── Months ─────────────────────────────────────────────────
export function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
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

/** Current month in Lisbon time, e.g. '2026-10'. */
export function currentMonthKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  return `${y}-${m}`;
}

export function windowFor(viewStart) {
  return [viewStart, addMonths(viewStart, 1), addMonths(viewStart, 2)];
}

export function clampMonth(key, min, max) {
  if (key < min) return min;
  if (key > max) return max;
  return key;
}

/** Planner: Jan of the current year → last 3-month window ends Dec of next year. */
export function plannerBounds(todayKey) {
  const y = yearOf(todayKey);
  return { min: `${y}-01`, maxStart: `${y + 1}-10` };
}

/** Archive viewer for one year: Jan → Dec of that year (window never leaves the year). */
export function yearBounds(year) {
  return { min: `${year}-01`, maxStart: `${year}-10` };
}

// ── Year lock / archive ────────────────────────────────────
/** A year is closed once the Lisbon calendar has moved past 31 December. */
export function isYearClosed(year, todayKey) {
  return year < yearOf(todayKey);
}

export function isMonthLocked(month, todayKey, unlockedYears = []) {
  const y = yearOf(month);
  return isYearClosed(y, todayKey) && !unlockedYears.includes(y);
}

/** Years (up to and including the current one) in which at least one line was active. */
export function yearsWithData(lines, todayKey) {
  const nowYear = yearOf(todayKey);
  const years = new Set();
  for (const line of lines) {
    if (!line.versions.length) continue;
    const start = yearOf(line.versions[0].from);
    const end = Math.min(line.endMonth ? yearOf(addMonths(line.endMonth, -1)) : nowYear, nowYear);
    for (let y = start; y <= end; y++) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}

// ── Money ──────────────────────────────────────────────────
/**
 * Parse what a person types into integer cents.
 * Accepts "1,234.50", "1.234,50", "12,5", "12.5", "1.234", "€ 99", "-5".
 * Returns 0 for empty input and null when it is not a valid amount.
 */
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
  let s = String(input ?? '').trim().replace(/[€\s]/g, '');
  if (!s) return 0;
  let neg = false;
  if (s[0] === '-') { neg = true; s = s.slice(1); } else if (s[0] === '+') { s = s.slice(1); }
  if (!s || !/^[\d.,]+$/.test(s)) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let intPart = s;
  let decPart = '';

  if (hasComma && hasDot) {
    // the last separator is the decimal point; the other one groups thousands
    const sepPos = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    intPart = s.slice(0, sepPos);
    decPart = s.slice(sepPos + 1);
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const count = s.split(sep).length - 1;
    if (count === 1) {
      const sepPos = s.indexOf(sep);
      const after = s.slice(sepPos + 1);
      if (after.length === 3) {
        intPart = s.replace(sep, '');          // "1.234" → 1234 (thousands)
      } else if (after.length <= 2) {
        intPart = s.slice(0, sepPos);          // decimals
        decPart = after;
      } else {
        return null;
      }
    } else {
      intPart = s.split(sep).join('');         // "1.234.567" → thousands only
    }
  }

  intPart = intPart.replace(/[.,]/g, '');
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null;
  if (intPart.length > 10 || decPart.length > 2) return null;
  const cents = Number(intPart || '0') * 100 + Number((decPart + '00').slice(0, 2));
  return neg ? -cents : cents;
}

export function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Lines ──────────────────────────────────────────────────
export function newLine(section, month, label, amount, seq, once = false) {
  return {
    id: newId(),
    section,
    seq,
    versions: [{ from: month, patch: { label, amount } }],
    overrides: {},
    checks: {},
    endMonth: once ? addMonths(month, 1) : null,
  };
}

/** Validate/repair a line coming from a backup file. Returns null if unusable. */
export function normaliseLine(raw) {
  if (!raw || typeof raw.id !== 'string' || !SECTIONS.includes(raw.section)) return null;
  if (!Array.isArray(raw.versions) || !raw.versions.length) return null;
  const monthOk = m => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  const cleanPatch = p => {
    const out = {};
    if (p && typeof p.label === 'string') out.label = p.label;
    if (p && Number.isInteger(p.amount)) out.amount = p.amount;
    if (p && p.hidden === true) out.hidden = true;
    return out;
  };
  const versions = raw.versions
    .filter(v => v && monthOk(v.from))
    .map(v => ({ from: v.from, patch: cleanPatch(v.patch) }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  if (!versions.length) return null;
  const overrides = {};
  for (const [m, p] of Object.entries(raw.overrides || {})) if (monthOk(m)) overrides[m] = cleanPatch(p);
  const checks = {};
  for (const [m, v] of Object.entries(raw.checks || {})) if (monthOk(m) && v) checks[m] = true;
  return {
    id: raw.id,
    section: raw.section,
    seq: Number.isFinite(raw.seq) ? raw.seq : 0,
    versions, overrides, checks,
    endMonth: monthOk(raw.endMonth) ? raw.endMonth : null,
  };
}

/** What a line looks like in a given month (or null if it does not apply). */
export function resolveLine(line, month) {
  if (!line.versions.length || month < line.versions[0].from) return null;
  if (line.endMonth && month >= line.endMonth) return null;
  const ov = line.overrides?.[month];
  if (ov && ov.hidden) return null;

  let label = '';
  let amount = 0;
  for (const v of line.versions) {
    if (v.from > month) break;
    if ('label' in v.patch) label = v.patch.label;
    if ('amount' in v.patch) amount = v.patch.amount;
  }
  let once = false;
  if (ov) {
    if ('label' in ov) { label = ov.label; once = true; }
    if ('amount' in ov) { amount = ov.amount; once = true; }
  }
  if (line.endMonth === addMonths(line.versions[0].from, 1)) once = true; // one-month line
  return { id: line.id, section: line.section, seq: line.seq, label, amount, once, done: !!line.checks?.[month] };
}

export function monthLines(lines, section, month) {
  return lines
    .filter(l => l.section === section)
    .map(l => resolveLine(l, month))
    .filter(Boolean)
    .sort((a, b) => a.seq - b.seq);
}

export function monthTotals(lines, month) {
  const totals = { income: 0, savings: 0, fixed: 0, variable: 0, count: 0, hasFigures: false };
  for (const line of lines) {
    const r = resolveLine(line, month);
    if (!r || !(r.section in totals)) continue;
    totals[r.section] += r.amount;
    totals.count += 1;
    if (r.amount !== 0) totals.hasFigures = true;
  }
  totals.moneyLeft = totals.income - totals.fixed - totals.variable - (DEDUCT_SAVINGS ? totals.savings : 0);
  return totals;
}

/** All 12 months of a year plus year totals. */
export function yearTotals(lines, year) {
  const months = [];
  const sum = { income: 0, savings: 0, fixed: 0, variable: 0, moneyLeft: 0, hasFigures: false };
  for (let m = 1; m <= 12; m++) {
    const key = monthKey(year, m);
    const t = monthTotals(lines, key);
    months.push({ key, ...t });
    if (t.hasFigures) {
      sum.income += t.income; sum.savings += t.savings; sum.fixed += t.fixed;
      sum.variable += t.variable; sum.moneyLeft += t.moneyLeft; sum.hasFigures = true;
    }
  }
  return { months, total: sum };
}

// ── Mutators ───────────────────────────────────────────────
const EMPTY = () => ({ changed: [], removed: [] });

function nextSeq(lines, section) {
  const seqs = lines.filter(l => l.section === section).map(l => l.seq);
  return seqs.length ? Math.max(...seqs) + 10 : 10;
}

/** Add a line. once=true → exists in `month` only; otherwise from `month` onwards. */
export function addLine(lines, { section, month, label, amount = 0, once = false }) {
  if (!SECTIONS.includes(section)) return { ...EMPTY(), error: 'bad-section' };
  const line = newLine(section, month, label, amount, nextSeq(lines, section), once);
  lines.push(line);
  return { changed: [line], removed: [], newId: line.id };
}

/**
 * Edit label and/or amount as seen in `month`.
 * once=true → only that month. Otherwise → that month and every month after
 * (earlier months are never touched; a LATER explicit change to the same field still wins).
 * Fields that did not actually change are ignored.
 */
export function editLine(lines, id, month, patch, once = false) {
  const line = lines.find(l => l.id === id);
  if (!line) return { ...EMPTY(), error: 'not-found' };
  const cur = resolveLine(line, month);
  if (!cur) return { ...EMPTY(), error: 'not-active' };

  const clean = {};
  if ('label' in patch && patch.label !== cur.label) clean.label = patch.label;
  if ('amount' in patch && patch.amount !== cur.amount) clean.amount = patch.amount;
  if (!Object.keys(clean).length) return EMPTY();

  if (once) {
    line.overrides[month] = { ...(line.overrides[month] || {}), ...clean };
  } else {
    const ov = line.overrides[month];
    if (ov) {
      for (const k of Object.keys(clean)) delete ov[k];
      if (!Object.keys(ov).length) delete line.overrides[month];
    }
    const v = line.versions.find(x => x.from === month);
    if (v) {
      v.patch = { ...v.patch, ...clean };
    } else {
      line.versions.push({ from: month, patch: clean });
      line.versions.sort((a, b) => (a.from < b.from ? -1 : 1));
    }
  }
  return { changed: [line], removed: [] };
}

/**
 * Remove a line. once=true → hidden in `month` only.
 * Otherwise it stops applying from `month` onwards (earlier months keep it).
 * If `month` is the first month the line ever existed, the line is deleted entirely.
 */
export function deleteLine(lines, id, month, once = false) {
  const idx = lines.findIndex(l => l.id === id);
  if (idx === -1) return { ...EMPTY(), error: 'not-found' };
  const line = lines[idx];
  if (!resolveLine(line, month)) return { ...EMPTY(), error: 'not-active' };

  if (once) {
    line.overrides[month] = { ...(line.overrides[month] || {}), hidden: true };
    return { changed: [line], removed: [] };
  }
  if (month <= line.versions[0].from) {
    lines.splice(idx, 1);
    return { changed: [], removed: [id] };
  }
  line.endMonth = month;
  line.versions = line.versions.filter(v => v.from < month);
  for (const k of Object.keys(line.overrides)) if (k >= month) delete line.overrides[k];
  for (const k of Object.keys(line.checks)) if (k >= month) delete line.checks[k];
  return { changed: [line], removed: [] };
}

/** Copy a line (as it looks in `month`) directly underneath the original. */
export function duplicateLine(lines, id, month, once = false) {
  const src = lines.find(l => l.id === id);
  if (!src) return { ...EMPTY(), error: 'not-found' };
  const cur = resolveLine(src, month);
  if (!cur) return { ...EMPTY(), error: 'not-active' };

  const higher = lines
    .filter(l => l.section === src.section && l.seq > src.seq)
    .map(l => l.seq)
    .sort((a, b) => a - b);
  const next = higher.length ? higher[0] : src.seq + 10;
  const copy = newLine(src.section, month, cur.label, cur.amount, (src.seq + next) / 2, once);
  lines.push(copy);

  let changed = [copy];
  if (next - src.seq < 0.01) {
    // gaps got tiny — renumber this section tidily
    const sec = lines.filter(l => l.section === src.section).sort((a, b) => a.seq - b.seq);
    sec.forEach((l, i) => { l.seq = (i + 1) * 10; });
    changed = sec;
  }
  return { changed, removed: [], newId: copy.id };
}

export function setChecked(lines, id, month, done) {
  const line = lines.find(l => l.id === id);
  if (!line) return { ...EMPTY(), error: 'not-found' };
  if (done) line.checks[month] = true; else delete line.checks[month];
  return { changed: [line], removed: [] };
}

/** First-run lines: shared by every month from `startMonth` onwards (amounts at 0). */
export function seedDefaults(startMonth, labels) {
  const out = [];
  for (const section of ['income', 'savings']) {
    (labels[section] || []).forEach((label, i) => {
      out.push(newLine(section, startMonth, label, 0, (i + 1) * 10));
    });
  }
  return out;
}
