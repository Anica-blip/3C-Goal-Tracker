// datebar.js — the calendar bar: 3 month tabs, a month grid and the chosen day
// DIARY Notes · 3C Thread To Success™
//
// Shared by Day Planner, Journal and Self-Care: they all show the day chosen here.
// Same look as the BUDGET Notes month tabs. Weeks start on Monday.

import * as E from './engine.js';
import * as store from './store.js';
import { t } from './i18n.js';
import { esc, dayLong, monthShort, weekdayShort } from './ui.js';

const OPEN_KEY = 'diary-notes-calendar-open';

export function initDateBar(root) {
  let viewStart = null;
  let open = true;
  try { open = localStorage.getItem(OPEN_KEY) !== '0'; } catch { /* private mode: stay open */ }

  function fitWindow(selMonth, b) {
    if (viewStart === null) viewStart = E.monthOfDay(store.getState().today);
    const win = E.windowFor(viewStart);
    if (selMonth < win[0]) viewStart = selMonth;
    else if (selMonth > win[2]) viewStart = E.addMonths(selMonth, -2);
    viewStart = E.clampMonth(viewStart, b.min, b.maxStart);
  }

  function render() {
    const s = store.getState();
    const b = E.diaryBounds(s.today);
    const selMonth = E.monthOfDay(s.selected);
    const todayMonth = E.monthOfDay(s.today);
    fitWindow(selMonth, b);
    const win = E.windowFor(viewStart);
    const dots = E.daysWithContent(s);

    const tabs = win.map(m => `
      <button type="button" class="ds-tab${m === selMonth ? ' is-active' : ''}${m === todayMonth ? ' is-current' : ''}"
        data-month="${m}" aria-pressed="${m === selMonth}" ${m === todayMonth ? 'aria-current="date"' : ''}>
        <span class="ds-tab__m">${esc(monthShort(m))}</span>
        <span class="ds-tab__y">${E.yearOf(m)}</span>
      </button>`).join('');

    const header = [0, 1, 2, 3, 4, 5, 6].map(i => `<span class="cal-wd">${esc(weekdayShort(i))}</span>`).join('');
    const weeks = E.monthGrid(selMonth).map(week => week.map(cell => {
      if (!cell) return '<span class="cal-blank"></span>';
      const cls = ['cal-day'];
      if (cell.iso === s.selected) cls.push('is-sel');
      if (cell.iso === s.today) cls.push('is-today');
      if (dots.has(cell.iso)) cls.push('has-dot');
      return `<button type="button" class="${cls.join(' ')}" data-day="${cell.iso}"
        aria-label="${esc(dayLong(cell.iso))}" aria-pressed="${cell.iso === s.selected}">${cell.day}</button>`;
    }).join('')).join('');

    root.innerHTML = `
      <div class="ds-strip">
        <button type="button" class="ds-arrow" data-dir="-1" aria-label="${esc(t('cal.prev'))}" ${viewStart <= b.min ? 'disabled' : ''}>‹</button>
        <div class="ds-tabs">${tabs}</div>
        <button type="button" class="ds-arrow" data-dir="1" aria-label="${esc(t('cal.next'))}" ${viewStart >= b.maxStart ? 'disabled' : ''}>›</button>
      </div>

      <div class="cal-title">
        <span class="cal-title__day">${esc(dayLong(s.selected))}</span>
        ${s.selected === s.today
          ? `<span class="cal-now">${esc(t('cal.todayTag'))}</span>`
          : `<button type="button" class="cal-jump" data-today>${esc(t('cal.jumpToday'))}</button>`}
        <button type="button" class="cal-toggle${open ? ' is-open' : ''}" data-toggle aria-expanded="${open}" aria-label="Calendar">▾</button>
      </div>

      ${open ? `<div class="cal-grid" role="group">${header}${weeks}</div>` : ''}`;
  }

  root.addEventListener('click', e => {
    const el = e.target.closest('[data-dir],[data-month],[data-day],[data-today],[data-toggle]');
    if (!el || !root.contains(el)) return;
    const s = store.getState();

    if (el.dataset.dir) {
      const b = E.diaryBounds(s.today);
      viewStart = E.clampMonth(E.addMonths(viewStart, Number(el.dataset.dir)), b.min, b.maxStart);
      // keep the chosen day inside the three months now showing
      const win = E.windowFor(viewStart);
      const selMonth = E.monthOfDay(s.selected);
      if (selMonth < win[0]) store.selectDay(E.shiftToMonth(s.selected, win[0]));
      else if (selMonth > win[2]) store.selectDay(E.shiftToMonth(s.selected, win[2]));
      else render();
    } else if (el.dataset.month) {
      store.selectDay(E.shiftToMonth(s.selected, el.dataset.month));
    } else if (el.dataset.day) {
      store.selectDay(el.dataset.day);
    } else if ('today' in el.dataset) {
      viewStart = E.monthOfDay(s.today);
      store.selectDay(s.today);
    } else if ('toggle' in el.dataset) {
      open = !open;
      try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
      render();
    }
  });

  store.subscribe(render);
  render();
  return { render };
}
