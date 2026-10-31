// planner.js — month view (3-month tab strip, two-column blocks, summary) + line editor
// BUDGET Notes · 3C Thread To Success™
//
// createMonthView() is shared: the Planner tab uses it for the rolling months,
// the Archive tab uses it for one past year. Both read the same data from store.js.
// Months that have not started yet stay empty — nothing is shown or added ahead of time.
// Nothing is ever locked: every month of every year can be edited.

import * as E from './engine.js';
import * as store from './store.js';
import { t } from './i18n.js';
import { esc, money, plainAmount, showToast, monthLong, monthShort, dateLong, dayText } from './ui.js';

const CLOSE_SVG = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24"><polyline points="5 12 10 17 19 7"/></svg>';

// ═══════════════════════════════════════════════════════════════
//  HTML builders
// ═══════════════════════════════════════════════════════════════
function rowHTML(r) {
  const check = r.section === 'savings'
    ? `<button type="button" class="mv-check${r.done ? ' is-done' : ''}" data-check="${r.id}"
         aria-pressed="${r.done}" aria-label="${esc(t('line.doneAria'))}">${CHECK_SVG}</button>`
    : '';
  const amount = r.amount === 0
    ? `<span class="mv-row__amt mv-row__amt--zero">${esc(t('sum.none'))}</span>`
    : `<span class="mv-row__amt">${money(r.amount)}</span>`;
  const day = r.dayShown ? `<span class="mv-day">${dayText(r.dayShown)}</span>` : '';
  const badge = r.once ? ` <span class="mv-pill">${esc(t('line.onceBadge'))}</span>` : '';
  const main = `<span class="mv-row__label">${day}${esc(r.label)}${badge}</span>${amount}`;
  const body = `<button type="button" class="mv-row__main" data-edit="${r.id}">${main}</button>`;
  return `<div class="mv-row${r.done ? ' mv-row--done' : ''}${check ? ' mv-row--check' : ''}">${check}${body}</div>`;
}

function blockHTML(section, rows, total) {
  const rowsHTML = rows.length
    ? rows.map(r => rowHTML(r)).join('')
    : `<div class="mv-empty">${esc(t('block.empty'))}</div>`;
  return `
    <section class="card mv-block" data-section="${section}">
      <div class="mv-block__head">
        <div class="section__title">${esc(t('block.' + section))}</div>
        <button type="button" class="btn btn--glass mv-add" data-add="${section}">${esc(t('block.add'))}</button>
      </div>
      <div class="mv-rows">${rowsHTML}</div>
      <div class="mv-total"><span>${esc(t('total.' + section))}</span><strong>${money(total)}</strong></div>
    </section>`;
}

function summaryHTML(month, totals, prevMonth, prev) {
  const dash = `<span class="mv-dash">${esc(t('sum.none'))}</span>`;
  const rows = [
    ['income',     'sum.income'],
    ['fixed',      'sum.fixed'],
    ['variable',   'sum.variable'],
    ['commission', 'sum.commission'],
    ['savings',    'sum.savings'],
  ].map(([key, label]) => `
      <tr>
        <th scope="row">${esc(t(label))}</th>
        <td>${money(totals[key])}</td>
        <td>${prev.hasFigures ? money(prev[key]) : dash}</td>
      </tr>`).join('');

  const leftClass = totals.moneyLeft < 0 ? 'is-neg' : 'is-pos';
  const prevLeftClass = prev.moneyLeft < 0 ? 'is-neg' : 'is-pos';
  return `
    <section class="card mv-sum">
      <div class="section__title">${esc(t('sum.title'))}</div>
      <table class="mv-sum__table">
        <thead>
          <tr>
            <th></th>
            <th scope="col">${esc(t('sum.thisMonth'))}<small>${esc(monthLong(month))}</small></th>
            <th scope="col">${esc(t('sum.lastYear'))}<small>${esc(monthLong(prevMonth))}</small></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="mv-sum__left">
            <th scope="row">${esc(t('sum.left'))}</th>
            <td class="${leftClass}">${money(totals.moneyLeft)}</td>
            <td class="${prev.hasFigures ? prevLeftClass : ''}">${prev.hasFigures ? money(prev.moneyLeft) : dash}</td>
          </tr>
        </tbody>
      </table>
      <p class="mv-sum__formula">${esc(t('sum.left'))} = ${esc(t('sum.formula'))}</p>
    </section>`;
}

// ═══════════════════════════════════════════════════════════════
//  Line editor (add / edit / duplicate / remove) — one shared modal
// ═══════════════════════════════════════════════════════════════
let modalEl = null;
let busy = false;

function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'modal-overlay';
  modalEl.id = 'line-modal';
  modalEl.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true"></div>';
  modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalEl.classList.contains('open')) closeModal();
  });
  document.body.appendChild(modalEl);
  return modalEl;
}

function closeModal() {
  if (modalEl) modalEl.classList.remove('open');
}

async function guarded(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
  } catch (err) {
    console.error('[budget-notes]', err);
    showToast(t('line.toastFailed'), 'error');
  } finally {
    busy = false;
  }
}

/** Turn an engine refusal into a plain message. Returns true if it was an error. */
function reportError(res) {
  if (!res || !res.error) return false;
  const map = {
    'end-before-start': 'line.toastEndBeforeStart',
    'start-after-end':  'line.toastStartAfterEnd',
    'date-month':       'line.toastBadDate',
  };
  showToast(t(map[res.error] || 'line.toastFailed'), 'error');
  return true;
}

/**
 * ctx = { mode:'add'|'edit', section, month, lineId, defaultOnce }
 * The "Once" box decides whether Save / Duplicate / Remove touch this month only
 * or this month and every month after. Dates (Fixed, Variable, Bank Commission):
 *   Forward → Start date + End date;   Once → one date inside this month.
 */
function openLineEditor(ctx) {
  const modal = ensureModal();
  const card = modal.querySelector('.modal-card');
  const isEdit = ctx.mode === 'edit';
  const line = isEdit ? store.getState().lines.find(l => l.id === ctx.lineId) : null;
  const cur = line ? E.resolveLine(line, ctx.month) : null;
  if (isEdit && !cur) return;

  const monthText = monthLong(ctx.month);
  const section = isEdit ? cur.section : ctx.section;
  const dated = E.DATED_SECTIONS.includes(section);

  // what the date boxes start with
  const initStart = cur && cur.start.day ? E.formatDate({ month: cur.start.month, day: cur.start.day }) : '';
  const initEnd = cur && cur.end
    ? E.formatDate({ month: cur.end.month, day: cur.end.day || E.daysInMonth(cur.end.month) })
    : '';
  const initDate = cur && cur.dayShown ? E.formatDate({ month: ctx.month, day: cur.dayShown }) : '';
  const runsInfo = cur
    ? t('line.runsFrom', {
        from: monthLong(cur.start.month),
        until: cur.end ? t('line.untilEnd', { end: monthLong(cur.end.month) }) : t('line.untilFurther'),
      })
    : '';

  const dateFields = !dated ? '' : `
    <div id="lf-forward-dates" class="${ctx.defaultOnce ? 'hidden' : ''}">
      <div class="form-row">
        <div class="form-group">
          <label for="lf-start">${esc(t('line.labelStart'))}</label>
          <input type="text" id="lf-start" inputmode="numeric" autocomplete="off"
            placeholder="${esc(t('line.phDate'))}" value="${esc(initStart)}" />
        </div>
        <div class="form-group">
          <label for="lf-end">${esc(t('line.labelEnd'))}</label>
          <input type="text" id="lf-end" inputmode="numeric" autocomplete="off"
            placeholder="${esc(t('line.phDate'))}" value="${esc(initEnd)}" />
        </div>
      </div>
      <p class="mv-help">${esc(t('line.datesHelp'))}</p>
      ${isEdit ? `<p class="mv-help mv-help--info">${esc(runsInfo)}</p>` : ''}
    </div>
    <div id="lf-once-date" class="${ctx.defaultOnce ? '' : 'hidden'}">
      <div class="form-group">
        <label for="lf-date">${esc(t('line.labelDate'))}</label>
        <input type="text" id="lf-date" inputmode="numeric" autocomplete="off"
          placeholder="${esc(t('line.phDate'))}" value="${esc(initDate)}" />
      </div>
    </div>`;

  card.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">${esc(isEdit ? t('line.editTitle') : t('line.addTitle'))} · ${esc(t('block.' + section))}</span>
      <button type="button" class="icon-btn" data-close aria-label="${esc(t('line.closeAria'))}">${CLOSE_SVG}</button>
    </div>

    <div class="form-group">
      <label for="lf-label">${esc(t('line.labelDesc'))}</label>
      <input type="text" id="lf-label" maxlength="80" autocomplete="off"
        placeholder="${esc(t('line.phLabel'))}" value="${esc(cur ? cur.label : '')}" />
    </div>

    <div class="form-group">
      <label for="lf-amount">${esc(t('line.labelAmount'))}</label>
      <input type="text" id="lf-amount" inputmode="decimal" autocomplete="off"
        placeholder="0.00" value="${cur && cur.amount ? esc(plainAmount(cur.amount)) : ''}" />
    </div>

    <label class="check-row">
      <input type="checkbox" id="lf-once" ${ctx.defaultOnce ? 'checked' : ''} />
      <span>${t('line.onceText')}</span>
    </label>
    <p class="mv-hint" id="lf-hint"></p>

    ${dateFields}

    <div class="modal-buttons">
      <button type="button" class="btn btn--primary btn--full" id="lf-save">
        ${esc(isEdit ? t('line.updateBtn') : t('line.addBtn'))}
      </button>
      ${isEdit ? `
        <div class="btn-row">
          <button type="button" class="btn btn--glass" id="lf-duplicate">${esc(t('line.duplicateBtn'))}</button>
          <button type="button" class="btn btn--danger" id="lf-remove">${esc(t('line.removeBtn'))}</button>
        </div>` : `
        <button type="button" class="btn btn--glass btn--full" id="lf-save-next">${esc(t('line.addNextBtn'))}</button>`}
    </div>`;

  const $ = sel => card.querySelector(sel);
  const labelInput = $('#lf-label');
  const amountInput = $('#lf-amount');
  const onceBox = $('#lf-once');
  const hint = $('#lf-hint');

  const syncMode = () => {
    hint.textContent = onceBox.checked
      ? t('line.hintOnce', { month: monthText })
      : t('line.hintForward', { month: monthText });
    if (dated) {
      $('#lf-forward-dates').classList.toggle('hidden', onceBox.checked);
      $('#lf-once-date').classList.toggle('hidden', !onceBox.checked);
    }
  };
  onceBox.addEventListener('change', syncMode);
  syncMode();

  // Read + validate every box. Returns null (and shows a toast) when something is wrong.
  const readFields = () => {
    const label = labelInput.value.trim();
    if (!label) { showToast(t('line.toastNoLabel'), 'error'); labelInput.focus(); return null; }
    const amount = E.parseAmount(amountInput.value);
    if (amount === null) { showToast(t('line.toastBadAmount'), 'error'); amountInput.focus(); return null; }

    const out = { label, amount, date: null, start: null, end: null, startChanged: false, endChanged: false };
    if (!dated) return out;

    if (onceBox.checked) {
      const text = $('#lf-date').value.trim();
      if (text) {
        const d = E.parseDate(text, ctx.month);
        if (!d) { showToast(t('line.toastBadDate'), 'error'); $('#lf-date').focus(); return null; }
        if (d.month !== ctx.month) { showToast(t('line.toastDateMonth', { month: monthText }), 'error'); $('#lf-date').focus(); return null; }
        out.date = d;
      }
    } else {
      const startText = $('#lf-start').value.trim();
      const endText = $('#lf-end').value.trim();
      if (startText) {
        out.start = E.parseDate(startText, ctx.month);
        if (!out.start) { showToast(t('line.toastBadDate'), 'error'); $('#lf-start').focus(); return null; }
        out.startChanged = startText !== initStart;
      }
      if (endText) {
        out.end = E.parseDate(endText, ctx.month);
        if (!out.end) { showToast(t('line.toastBadDate'), 'error'); $('#lf-end').focus(); return null; }
      }
      out.endChanged = endText !== initEnd;
      if (out.start && out.end && out.end.month < out.start.month) {
        showToast(t('line.toastEndBeforeStart'), 'error');
        return null;
      }
    }
    return out;
  };

  const save = (addAnother) => guarded(async () => {
    const f = readFields();
    if (!f) return;
    const once = onceBox.checked;

    if (isEdit) {
      const patch = { label: f.label, amount: f.amount };
      if (once && f.date) patch.day = f.date.day;
      const dates = once ? null : { start: f.startChanged ? f.start : null, end: f.end, endChanged: f.endChanged };
      const res = await store.updateLine(ctx.lineId, ctx.month, patch, once, dates);
      if (reportError(res)) return;
      closeModal();
      showToast(res.changed.length ? t('line.toastUpdated') : t('line.toastNoChange'));
      return;
    }

    // add
    const dates = once ? { start: f.date } : { start: f.start, end: f.end };
    if (addAnother) {
      // clear the boxes straight away so the next line can be typed while this one saves
      labelInput.value = '';
      amountInput.value = '';
      if (dated) { $('#lf-start').value = ''; $('#lf-end').value = ''; $('#lf-date').value = ''; }
      labelInput.focus();
    }
    let res;
    try {
      res = await store.addLine(section, ctx.month, f.label, f.amount, once, dates);
    } catch (err) {
      if (addAnother) {                       // saving failed — put the text back
        labelInput.value = f.label;
        amountInput.value = f.amount ? plainAmount(f.amount) : '';
      }
      throw err;
    }
    if (reportError(res)) return;
    if (!addAnother) closeModal();
    const later = !once && f.start && f.start.month > ctx.month;
    showToast(later ? t('line.toastAddedLater', { month: monthLong(f.start.month) }) : t('line.toastAdded'));
  });

  $('#lf-save').addEventListener('click', () => save(false));
  if (!isEdit) $('#lf-save-next').addEventListener('click', () => save(true));
  card.querySelector('[data-close]').addEventListener('click', closeModal);
  card.querySelectorAll('input[type="text"]').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(false); } });
  });

  if (isEdit) {
    $('#lf-duplicate').addEventListener('click', () => guarded(async () => {
      const res = await store.duplicateLine(ctx.lineId, ctx.month, onceBox.checked);
      if (reportError(res)) return;
      closeModal();
      showToast(t('line.toastDuplicated'));
      if (res.newId) openLineEditor({ ...ctx, mode: 'edit', lineId: res.newId });
    }));

    $('#lf-remove').addEventListener('click', () => guarded(async () => {
      const once = onceBox.checked;
      const msg = t(once ? 'line.confirmRemoveOnce' : 'line.confirmRemoveForward', { label: cur.label, month: monthText });
      if (!confirm(msg)) return;
      const res = await store.deleteLine(ctx.lineId, ctx.month, once);
      if (reportError(res)) return;
      closeModal();
      showToast(t('line.toastRemoved'));
    }));
  }

  modal.classList.add('open');
  // focus the description — unless the person has already tapped into another box
  setTimeout(() => { if (!card.contains(document.activeElement)) labelInput.focus(); }, 50);
}

// ═══════════════════════════════════════════════════════════════
//  Month view
// ═══════════════════════════════════════════════════════════════
/** Year dropdown: from 20 years back (never before 2000) up to the current year. */
function yearBox(selected, todayKey) {
  const nowYear = E.yearOf(todayKey);
  const first = Math.max(2000, nowYear - 20);
  const chosen = E.yearOf(selected);
  let opts = '';
  for (let y = nowYear; y >= first; y--) opts += `<option value="${y}"${y === chosen ? ' selected' : ''}>${y}</option>`;
  return `<label class="mv-year"><span class="sr-only">${esc(t('month.year'))}</span>
    <select data-year-jump aria-label="${esc(t('month.year'))}">${opts}</select></label>`;
}

/**
 * cfg = {
 *   bounds():            { min, maxStart }   first month / last allowed first-tab month
 *   initial():           { viewStart, selected }
 *   yearJump:            boolean            show the year box (Planner only)
 *   defaultOnce(m, sec): boolean             pre-tick "Once" in the editor
 * }
 */
export function createMonthView(root, cfg) {
  let viewStart = null;
  let selected = null;

  function normalise() {
    const b = cfg.bounds();
    viewStart = E.clampMonth(viewStart, b.min, b.maxStart);
    const win = E.windowFor(viewStart);
    if (selected < win[0]) selected = win[0];
    if (selected > win[2]) selected = win[2];
  }

  function render() {
    if (viewStart === null) return;
    normalise();
    const s = store.getState();
    const b = cfg.bounds();
    const win = E.windowFor(viewStart);

    const tabs = win.map(m => `
      <button type="button" class="mv-tab${m === selected ? ' mv-tab--active' : ''}${m === s.today ? ' mv-tab--current' : ''}"
        data-month="${m}" aria-pressed="${m === selected}" ${m === s.today ? 'aria-current="date"' : ''}>
        <span class="mv-tab__m">${esc(monthShort(m))}</span>
        <span class="mv-tab__y">${E.yearOf(m)}</span>
      </button>`).join('');

    const head = `
      <div class="mv-strip">
        <button type="button" class="mv-arrow" data-dir="-1" aria-label="${esc(t('month.prev'))}" ${viewStart <= b.min ? 'disabled' : ''}>‹</button>
        <div class="mv-tabs">${tabs}</div>
        <button type="button" class="mv-arrow" data-dir="1" aria-label="${esc(t('month.next'))}" ${viewStart >= b.maxStart ? 'disabled' : ''}>›</button>
      </div>

      <div class="mv-title">
        <span>${esc(monthLong(selected))}</span>
        ${selected === s.today ? `<span class="mv-now">${esc(t('month.thisMonthTag'))}</span>` : ''}
        ${cfg.yearJump ? yearBox(selected, s.today) : ''}
      </div>`;

    // A month that has not started stays empty — nothing is added ahead of time.
    if (E.isFutureMonth(selected, s.today)) {
      root.innerHTML = `
        <div class="mv">
          ${head}
          <div class="card mv-notice">
            <div class="mv-notice__icon" aria-hidden="true">🗓️</div>
            <div class="mv-notice__title">${esc(t('month.notStarted'))}</div>
            <p>${esc(t('month.notStartedText', { date: dateLong(selected, 1) }))}</p>
          </div>
        </div>`;
      return;
    }

    const totals = E.monthTotals(s.lines, selected);
    const prevMonth = E.addMonths(selected, -12);
    const prev = E.monthTotals(s.lines, prevMonth);
    const rows = section => E.monthLines(s.lines, section, selected);

    root.innerHTML = `
      <div class="mv">
        ${head}

        <div class="mv-grid">
          <div class="mv-col">
            ${blockHTML('income', rows('income'), totals.income)}
            ${blockHTML('savings', rows('savings'), totals.savings)}
          </div>
          <div class="mv-col">
            ${blockHTML('fixed', rows('fixed'), totals.fixed)}
            ${blockHTML('variable', rows('variable'), totals.variable)}
            ${blockHTML('commission', rows('commission'), totals.commission)}
          </div>
        </div>

        ${summaryHTML(selected, totals, prevMonth, prev)}
      </div>`;
  }

  function onClick(e) {
    const el = e.target.closest('[data-dir],[data-month],[data-add],[data-edit],[data-check]');
    if (!el || !root.contains(el)) return;

    if (el.dataset.dir) {
      const b = cfg.bounds();
      viewStart = E.clampMonth(E.addMonths(viewStart, Number(el.dataset.dir)), b.min, b.maxStart);
      render();
      return;
    }
    if (el.dataset.month) {
      selected = el.dataset.month;
      render();
      return;
    }
    if (E.isFutureMonth(selected, store.getState().today)) return;

    if (el.dataset.add) {
      openLineEditor({
        mode: 'add', section: el.dataset.add, month: selected,
        defaultOnce: cfg.defaultOnce(selected, el.dataset.add),
      });
    } else if (el.dataset.edit) {
      const line = store.getState().lines.find(l => l.id === el.dataset.edit);
      if (!line) return;
      openLineEditor({
        mode: 'edit', lineId: line.id, month: selected,
        defaultOnce: cfg.defaultOnce(selected, line.section),
      });
    } else if (el.dataset.check) {
      const done = el.getAttribute('aria-pressed') !== 'true';
      store.setChecked(el.dataset.check, selected, done).catch(() => showToast(t('line.toastFailed'), 'error'));
    }
  }

  function onChange(e) {
    const sel = e.target.closest('[data-year-jump]');
    if (!sel || !root.contains(sel)) return;
    const b = cfg.bounds();
    const mm = E.parseMonth(selected).month;
    const target = E.clampMonth(E.monthKey(Number(sel.value), mm), b.min, b.maxStart);
    viewStart = target;
    selected = target;
    render();
  }

  function reset() {
    const init = cfg.initial();
    viewStart = init.viewStart;
    selected = init.selected;
    render();
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  const unsubscribe = store.subscribe(render);
  reset();

  return {
    reset,
    destroy() {
      unsubscribe();
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.innerHTML = '';
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  Planner tab: rolling months, current month first
// ═══════════════════════════════════════════════════════════════
export function initPlanner(root) {
  return createMonthView(root, {
    yearJump: true,
    bounds: () => E.plannerBounds(store.getState().today),
    initial: () => {
      const today = store.getState().today;
      return { viewStart: today, selected: today };
    },
    // Variable + Bank Commission lines are mostly one-offs → "Once" pre-ticked.
    defaultOnce: (m, section) => E.ONCE_BY_DEFAULT.includes(section),
  });
}
