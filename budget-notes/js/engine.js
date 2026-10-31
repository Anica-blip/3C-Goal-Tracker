// engine.js — pure budget logic (no DOM, no storage)
// BUDGET Notes · 3C Thread To Success™
//
// How carry-forward works
// -----------------------
// Every budget line stores a HISTORY of changes, not a copy per month:
//   versions  [{ from:'2026-10', patch:{ label?, amount?, day? } }]  → "Forward" changes
//   overrides { '2026-11': { label?, amount?, day?, hidden? } }      → "Once" changes
//   checks    { '2026-10': true }                                    → savings tick-offs (per month, never carried)
//   endMonth  first month the line no longer applies (or null)
//   endDay    the day typed in the End date (display only)
// A month's value = base versions up to that month, then that month's override on top.
// Editing never rewrites earlier months.
//
// Start date  → the month the line begins (earlier months fill in too) + its day of month.
//               A LATER start date never removes or rewrites existing months.
// End date    → the last month the line appears in; it is gone from the next month.
// Months that have not started yet are NOT shown or filled ahead of time (see isFutureMonth).
//
// Amounts are stored as integer CENTS to avoid floating-point drift.
// Months are 'YYYY-MM' strings.
//
// Engine mutators change the `lines` array you pass in (in place) and return
// { changed:[lines to save], removed:[ids to delete] } so the caller can persist them.
// On a refused change they return { changed:[], removed:[], error:'code' }.

export const SECTIONS = ['income', 'savings', 'fixed', 'variable', 'commission'];

/** Sections whose lines can carry a date (start / end / day badge). */
export const DATED_SECTIONS = ['fixed', 'variable', 'commission'];

/** Sections where "Once" is pre-ticked (they are mostly one-offs). */
export const ONCE_BY_DEFAULT = ['variable', 'commission'];

export const TIMEZONE = 'Europe/Lisbon';

// Money Left = Income − Fixed − Variable − Bank Commission.
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

export function daysInMonth(key) {
  const { year, month } = parseMonth(key);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function clampDay(day, key) {
  return Math.min(day, daysInMonth(key));
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

/** A month that has not started yet — nothing is shown or added ahead of time. */
export function isFutureMonth(month, todayKey) {
  return month > todayKey;
}

/** Planner: Jan of the current year → the first tab never goes past the current month. */
export function plannerBounds(todayKey) {
  const y = yearOf(todayKey);
  return { min: `${y}-01`, maxStart: todayKey };
}

/** Archive viewer for one year: Jan → Dec of that year (window never leaves the year). */
export function yearBounds(year) {
  return { min: `${year}-01`, maxStart: `${year}-10` };
}

// ── Dates (day-level, typed as dd/mm/yy) ───────────────────
/**
 * Parse what a person types: "05/11/26", "5.11.2026", "05-11", "5".
 * Missing month/year come from `contextMonth` ('YYYY-MM').
 * Returns { day, month:'YYYY-MM' } or null when it is not a real date.
 */
export function parseDate(input, contextMonth) {
  const m = String(input ?? '').trim().match(/^(\d{1,2})(?:[\/.\-\s](\d{1,2})(?:[\/.\-\s](\d{2}|\d{4}))?)?$/);
  if (!m) return null;
  const ctx = contextMonth ? parseMonth(contextMonth) : null;
  const day = Number(m[1]);
  const month = m[2] !== undefined ? Number(m[2]) : ctx && ctx.month;
  let year = ctx && ctx.year;
  if (m[3] !== undefined) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (!month || !year || month < 1 || month > 12 || year < 2000 || year > 2099) return null;
  const key = monthKey(year, month);
  if (day < 1 || day > daysInMonth(key)) return null;
  return { day, month: key };
}

/** { day, month } → "05/11/26" */
export function formatDate({ day, month }) {
  const { year, month: mm } = parseMonth(month);
  return `${String(day).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${String(year).slice(2)}`;
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
/** patch = { label, amount, day? } — the first version of a new line. */
export function newLine(section, from, patch, seq, endMonth = null) {
  return {
    id: newId(),
    section,
    seq,
    versions: [{ from, patch: { ...patch } }],
    overrides: {},
    checks: {},
    endMonth,
  };
}

/** Validate/repair a line coming from a backup file. Returns null if unusable. */
export function normaliseLine(raw) {
  if (!raw || typeof raw.id !== 'string' || !SECTIONS.includes(raw.section)) return null;
  if (!Array.isArray(raw.versions) || !raw.versions.length) return null;
  const monthOk = m => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  const dayOk = d => Number.isInteger(d) && d >= 1 && d <= 31;
  const cleanPatch = p => {
    const out = {};
    if (p && typeof p.label === 'string') out.label = p.label;
    if (p && Number.isInteger(p.amount)) out.amount = p.amount;
    if (p && dayOk(p.day)) out.day = p.day;
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
  const line = {
    id: raw.id,
    section: raw.section,
    seq: Number.isFinite(raw.seq) ? raw.seq : 0,
    versions, overrides, checks,
    endMonth: monthOk(raw.endMonth) ? raw.endMonth : null,
  };
  if (dayOk(raw.endDay)) line.endDay = raw.endDay;
  return line;
}

/** Base values of a line in a month (versions only — no "Once" overrides). */
function fold(line, month) {
  let label = '';
  let amount = 0;
  let day = null;
  for (const v of line.versions) {
    if (v.from > month) break;
    if ('label' in v.patch) label = v.patch.label;
    if ('amount' in v.patch) amount = v.patch.amount;
    if ('day' in v.patch) day = v.patch.day;
  }
  return { label, amount, day };
}

/** What a line looks like in a given month (or null if it does not apply). */
export function resolveLine(line, month) {
  if (!line.versions.length || month < line.versions[0].from) return null;
  if (line.endMonth && month >= line.endMonth) return null;
  const ov = line.overrides?.[month];
  if (ov && ov.hidden) return null;

  let { label, amount, day } = fold(line, month);
  let once = false;
  if (ov) {
    if ('label' in ov) { label = ov.label; once = true; }
    if ('amount' in ov) { amount = ov.amount; once = true; }
    if ('day' in ov) { day = ov.day; once = true; }
  }
  const first = line.versions[0].from;
  if (line.endMonth === addMonths(first, 1)) once = true; // one-month line

  return {
    id: line.id, section: line.section, seq: line.seq,
    label, amount, once, done: !!line.checks?.[month],
    day,                                            // raw day of month (or null)
    dayShown: day ? clampDay(day, month) : null,    // fits short months (31 → 28)
    start: { month: first, day: fold(line, first).day },
    end: line.endMonth ? { month: addMonths(line.endMonth, -1), day: line.endDay || null } : null,
  };
}

export function monthLines(lines, section, month) {
  return lines
    .filter(l => l.section === section)
    .map(l => resolveLine(l, month))
    .filter(Boolean)
    .sort((a, b) => a.seq - b.seq);
}

export function monthTotals(lines, month) {
  const totals = { income: 0, savings: 0, fixed: 0, variable: 0, commission: 0, count: 0, hasFigures: false };
  for (const line of lines) {
    const r = resolveLine(line, month);
    if (!r || !(r.section in totals)) continue;
    totals[r.section] += r.amount;
    totals.count += 1;
    if (r.amount !== 0) totals.hasFigures = true;
  }
  totals.moneyLeft = totals.income - totals.fixed - totals.variable - totals.commission
    - (DEDUCT_SAVINGS ? totals.savings : 0);
  return totals;
}

/**
 * All 12 months of a year plus year totals.
 * upTo (optional 'YYYY-MM'): months after it are left blank — nothing is added ahead of time.
 */
export function yearTotals(lines, year, upTo = null) {
  const months = [];
  const sum = { income: 0, savings: 0, fixed: 0, variable: 0, commission: 0, moneyLeft: 0, hasFigures: false };
  for (let m = 1; m <= 12; m++) {
    const key = monthKey(year, m);
    const blank = upTo && key > upTo;
    const t = blank
      ? { income: 0, savings: 0, fixed: 0, variable: 0, commission: 0, count: 0, hasFigures: false, moneyLeft: 0 }
      : monthTotals(lines, key);
    months.push({ key, ...t });
    if (t.hasFigures) {
      sum.income += t.income; sum.savings += t.savings; sum.fixed += t.fixed;
      sum.variable += t.variable; sum.commission += t.commission;
      sum.moneyLeft += t.moneyLeft; sum.hasFigures = true;
    }
  }
  return { months, total: sum };
}

// ── Mutators ───────────────────────────────────────────────
const EMPTY = () => ({ changed: [], removed: [] });
const fail = error => ({ changed: [], removed: [], error });

function nextSeq(lines, section) {
  const seqs = lines.filter(l => l.section === section).map(l => l.seq);
  return seqs.length ? Math.max(...seqs) + 10 : 10;
}

/**
 * Add a line.
 *   once=true  → exists in `month` only (a date, if given, must fall in that month).
 *   otherwise  → begins in the START date's month (or `month`) and runs on;
 *                an END date makes its month the last one.
 * start / end = { day, month } as returned by parseDate().
 */
export function addLine(lines, { section, month, label, amount = 0, once = false, start = null, end = null }) {
  if (!SECTIONS.includes(section)) return fail('bad-section');
  const dated = DATED_SECTIONS.includes(section);
  let from = month;
  const patch = { label, amount };
  let endMonth = null;
  let endDay = null;

  if (dated && start) {
    if (once && start.month !== month) return fail('date-month');
    from = once ? month : start.month;
    patch.day = start.day;
  }
  if (once) {
    endMonth = addMonths(month, 1);
  } else if (dated && end) {
    if (end.month < from) return fail('end-before-start');
    endMonth = addMonths(end.month, 1);
    endDay = end.day;
  }

  const line = newLine(section, from, patch, nextSeq(lines, section), endMonth);
  if (endDay) line.endDay = endDay;
  lines.push(line);
  return { changed: [line], removed: [], newId: line.id };
}

/**
 * Edit label / amount / day as seen in `month`.
 * once=true → only that month. Otherwise → that month and every month after
 * (earlier months are never touched; a LATER explicit change to the same field still wins).
 * Fields that did not actually change are ignored.
 */
export function editLine(lines, id, month, patch, once = false) {
  const line = lines.find(l => l.id === id);
  if (!line) return fail('not-found');
  const cur = resolveLine(line, month);
  if (!cur) return fail('not-active');

  const clean = {};
  if ('label' in patch && patch.label !== cur.label) clean.label = patch.label;
  if ('amount' in patch && patch.amount !== cur.amount) clean.amount = patch.amount;
  if ('day' in patch && patch.day && patch.day !== cur.day) clean.day = patch.day;
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
 * Set the line's START (a month + the day it falls due).
 *   earlier month → the line now also appears in those earlier months (its first values carried back)
 *   later month   → NOTHING before it is touched; the new day simply applies from that month on
 * Records that already exist are never removed or rewritten by a start date.
 * (To change a contract: END the old line, then add a new one with its own start date.)
 */
export function setStart(lines, id, start) {
  const line = lines.find(l => l.id === id);
  if (!line) return fail('not-found');
  const first = line.versions[0].from;
  if (line.endMonth && start.month >= line.endMonth) return fail('start-after-end');

  if (start.month <= first) {
    line.versions[0].from = start.month;
    line.versions[0].patch = { ...line.versions[0].patch, day: start.day };
    return { changed: [line], removed: [] };
  }

  const ov = line.overrides[start.month];
  if (ov && 'day' in ov) {                      // a one-off day in that month would hide the new one
    delete ov.day;
    if (!Object.keys(ov).length) delete line.overrides[start.month];
  }
  const v = line.versions.find(x => x.from === start.month);
  if (v) {
    v.patch = { ...v.patch, day: start.day };
  } else {
    line.versions.push({ from: start.month, patch: { day: start.day } });
    line.versions.sort((a, b) => (a.from < b.from ? -1 : 1));
  }
  return { changed: [line], removed: [] };
}

/**
 * Set or clear the END: the month of `end` is the LAST month the line appears in.
 * end = null → the line runs on again.
 */
export function setEnd(lines, id, end) {
  const line = lines.find(l => l.id === id);
  if (!line) return fail('not-found');
  if (!end) {
    line.endMonth = null;
    delete line.endDay;
    return { changed: [line], removed: [] };
  }
  const endMonth = addMonths(end.month, 1);
  if (endMonth <= line.versions[0].from) return fail('end-before-start');
  line.endMonth = endMonth;
  line.endDay = end.day;
  line.versions = line.versions.filter(v => v.from < endMonth);
  for (const k of Object.keys(line.overrides)) if (k >= endMonth) delete line.overrides[k];
  for (const k of Object.keys(line.checks)) if (k >= endMonth) delete line.checks[k];
  return { changed: [line], removed: [] };
}

/**
 * One save from the editor: label/amount/day first, then (Forward only) start and end.
 * Either everything is applied or nothing is.
 *   dates = { start: {day,month}|null, end: {day,month}|null, endChanged: boolean }
 */
export function updateLine(lines, id, month, patch, once = false, dates = null) {
  const line = lines.find(l => l.id === id);
  if (!line) return fail('not-found');
  const snapshot = structuredClone(line);
  const changed = new Set();
  const run = r => {
    if (r.error) throw Object.assign(new Error(r.error), { code: r.error });
    r.changed.forEach(l => changed.add(l));
  };
  try {
    run(editLine(lines, id, month, patch, once));
    if (!once && dates) {
      if (dates.start) run(setStart(lines, id, dates.start));
      if (dates.endChanged) run(setEnd(lines, id, dates.end || null));
    }
  } catch (err) {
    for (const k of Object.keys(line)) delete line[k];
    Object.assign(line, snapshot);
    return fail(err.code || 'failed');
  }
  return { changed: [...changed], removed: [] };
}

/**
 * Remove a line. once=true → hidden in `month` only (it comes back next month).
 * Otherwise it stops applying from `month` onwards (earlier months keep it).
 * If `month` is the first month the line ever existed, the line is deleted entirely.
 */
export function deleteLine(lines, id, month, once = false) {
  const idx = lines.findIndex(l => l.id === id);
  if (idx === -1) return fail('not-found');
  const line = lines[idx];
  if (!resolveLine(line, month)) return fail('not-active');

  if (once) {
    line.overrides[month] = { ...(line.overrides[month] || {}), hidden: true };
    return { changed: [line], removed: [] };
  }
  if (month <= line.versions[0].from) {
    lines.splice(idx, 1);
    return { changed: [], removed: [id] };
  }
  line.endMonth = month;
  delete line.endDay;
  line.versions = line.versions.filter(v => v.from < month);
  for (const k of Object.keys(line.overrides)) if (k >= month) delete line.overrides[k];
  for (const k of Object.keys(line.checks)) if (k >= month) delete line.checks[k];
  return { changed: [line], removed: [] };
}

/** Copy a line (as it looks in `month`) directly underneath the original. */
export function duplicateLine(lines, id, month, once = false) {
  const src = lines.find(l => l.id === id);
  if (!src) return fail('not-found');
  const cur = resolveLine(src, month);
  if (!cur) return fail('not-active');

  const higher = lines
    .filter(l => l.section === src.section && l.seq > src.seq)
    .map(l => l.seq)
    .sort((a, b) => a - b);
  const next = higher.length ? higher[0] : src.seq + 10;
  const patch = { label: cur.label, amount: cur.amount };
  if (cur.day) patch.day = cur.day;
  const copy = newLine(src.section, month, patch, (src.seq + next) / 2, once ? addMonths(month, 1) : null);
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
  if (!line) return fail('not-found');
  if (done) line.checks[month] = true; else delete line.checks[month];
  return { changed: [line], removed: [] };
}

/** First-run lines: shared by every month from `startMonth` onwards (amounts at 0). */
export function seedDefaults(startMonth, labels) {
  const out = [];
  for (const section of ['income', 'savings']) {
    (labels[section] || []).forEach((label, i) => {
      out.push(newLine(section, startMonth, { label, amount: 0 }, (i + 1) * 10));
    });
  }
  return out;
}
