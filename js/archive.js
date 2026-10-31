// archive.js — your years, newest first. Nothing is ever locked.
// BUDGET Notes · 3C Thread To Success™
//
// Open any year to see its LAST three months (Oct · Nov · Dec) with ‹ › to browse all 12.
// Past years stay fully editable. "Add an earlier year" starts a year before your first one.

import * as E from './engine.js';
import * as store from './store.js';
import { t } from './i18n.js';
import { esc } from './ui.js';
import { createMonthView } from './planner.js';

export function initArchive(root) {
  let openYear = null;   // null → list of years
  let view = null;       // month view for the open year

  const isLive = year => year === E.yearOf(store.getState().today);
  const statusLabel = year => t(isLive(year) ? 'archive.inProgress' : 'archive.pastYear');

  function listedYears() {
    const s = store.getState();
    const years = E.yearsWithData(s.lines, s.today).slice().reverse();   // newest first
    const nowYear = E.yearOf(s.today);
    if (!years.includes(nowYear)) years.unshift(nowYear);
    return years;
  }

  // ── Year list ──────────────────────────────────────────
  function renderList() {
    const years = listedYears();
    const earliest = Math.min(...years);

    root.innerHTML = `
      <div class="section__title">${esc(t('archive.title'))}</div>
      <p class="subtle">${esc(t('archive.subtitle'))}</p>
      <div class="ar-list">
        ${years.map(y => `
          <button type="button" class="ar-year ar-year--${isLive(y) ? 'live' : 'past'}" data-year="${y}" aria-label="${esc(t('archive.openAria', { year: y }))}">
            <span class="ar-year__num">${y}</span>
            <span class="ar-year__tag">${esc(statusLabel(y))}</span>
            <span class="ar-year__go">›</span>
          </button>`).join('')}
        ${earliest > 2000
          ? `<button type="button" class="btn btn--glass ar-add" data-addyear="${earliest - 1}">${esc(t('archive.addYear'))}</button>`
          : ''}
      </div>`;
  }

  // ── One year ───────────────────────────────────────────
  function openYearView(year) {
    if (view) { view.destroy(); view = null; }
    openYear = year;
    root.innerHTML = `
      <div class="ar-bar">
        <button type="button" class="btn btn--ghost ar-back" data-back>${esc(t('archive.back'))}</button>
        <span class="ar-title">${year}</span>
        <span class="ar-year__tag ar-year__tag--${isLive(year) ? 'live' : 'past'}">${esc(statusLabel(year))}</span>
      </div>
      ${isLive(year) ? '' : `<p class="ar-note">${esc(t('archive.openNote'))}</p>`}
      <div id="ar-view"></div>`;

    const bounds = E.yearBounds(year);
    view = createMonthView(root.querySelector('#ar-view'), {
      bounds: () => bounds,
      initial: () => {
        const today = store.getState().today;
        const inLastThree = E.yearOf(today) === year && today >= bounds.maxStart;
        return { viewStart: bounds.maxStart, selected: inLastThree ? today : `${year}-12` };
      },
      defaultOnce: (m, section) => E.ONCE_BY_DEFAULT.includes(section),
    });
  }

  function closeYearView() {
    if (view) { view.destroy(); view = null; }
    openYear = null;
    renderList();
  }

  // ── Events ─────────────────────────────────────────────
  root.addEventListener('click', e => {
    const yearBtn = e.target.closest('[data-year],[data-addyear]');
    if (yearBtn) { openYearView(Number(yearBtn.dataset.year || yearBtn.dataset.addyear)); return; }
    if (e.target.closest('[data-back]')) closeYearView();
  });

  store.subscribe(() => { if (openYear === null) renderList(); });

  renderList();

  return {
    /** Back to the list (used when the Lisbon year/month rolls over). */
    reset() { closeYearView(); },
  };
}
