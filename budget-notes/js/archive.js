// archive.js — one button per year; closed years are read-only until unlocked
// BUDGET Notes · 3C Thread To Success™
//
// A year closes automatically once the Lisbon calendar passes 31 December.
// Opening a year shows its LAST three months (Oct · Nov · Dec) with ‹ › to browse all 12.

import * as E from './engine.js';
import * as store from './store.js';
import { t } from './i18n.js';
import { esc } from './ui.js';
import { createMonthView } from './planner.js';

export function initArchive(root) {
  let openYear = null;   // null → list of years
  let view = null;       // month view for the open year

  function statusOf(year) {
    const s = store.getState();
    if (!E.isYearClosed(year, s.today)) return 'live';
    return s.unlockedYears.includes(year) ? 'unlocked' : 'archived';
  }

  const statusLabel = st => t(st === 'live' ? 'archive.inProgress' : st === 'unlocked' ? 'archive.unlocked' : 'archive.archived');

  // ── Year list ──────────────────────────────────────────
  function renderList() {
    const s = store.getState();
    const years = E.yearsWithData(s.lines, s.today).slice().reverse();   // newest first
    if (!years.includes(E.yearOf(s.today))) years.unshift(E.yearOf(s.today));

    root.innerHTML = `
      <div class="section__title">${esc(t('archive.title'))}</div>
      <p class="subtle">${esc(t('archive.subtitle'))}</p>
      <div class="ar-list">
        ${years.length ? years.map(y => {
          const st = statusOf(y);
          return `
            <button type="button" class="ar-year ar-year--${st}" data-year="${y}" aria-label="${esc(t('archive.openAria', { year: y }))}">
              <span class="ar-year__num">${y}</span>
              <span class="ar-year__tag">${esc(statusLabel(st))}</span>
              <span class="ar-year__go">›</span>
            </button>`;
        }).join('') : `<div class="mv-empty">${esc(t('archive.empty'))}</div>`}
      </div>`;
  }

  // ── One year ───────────────────────────────────────────
  function renderLockBar() {
    const bar = root.querySelector('#ar-lock');
    if (!bar || openYear === null) return;
    const st = statusOf(openYear);
    const note = st === 'live' ? t('archive.liveNote') : st === 'unlocked' ? t('archive.unlockedNote') : t('archive.lockedNote');
    bar.className = `card ar-lock ar-lock--${st}`;
    bar.innerHTML = `
      <p>${esc(note)}</p>
      ${st === 'archived' ? `<button type="button" class="btn btn--glass" data-unlock>${esc(t('archive.unlockBtn'))}</button>` : ''}
      ${st === 'unlocked' ? `<button type="button" class="btn btn--ghost" data-lock>${esc(t('archive.lockBtn'))}</button>` : ''}`;
    const tag = root.querySelector('#ar-tag');
    if (tag) { tag.textContent = statusLabel(st); tag.className = `ar-year__tag ar-year__tag--${st}`; }
  }

  function openYearView(year) {
    if (view) { view.destroy(); view = null; }
    openYear = year;
    root.innerHTML = `
      <div class="ar-bar">
        <button type="button" class="btn btn--ghost ar-back" data-back>${esc(t('archive.back'))}</button>
        <span class="ar-title">${year}</span>
        <span id="ar-tag" class="ar-year__tag"></span>
      </div>
      <div id="ar-lock"></div>
      <div id="ar-view"></div>`;
    renderLockBar();

    const bounds = E.yearBounds(year);
    view = createMonthView(root.querySelector('#ar-view'), {
      bounds: () => bounds,
      initial: () => {
        const today = store.getState().today;
        const inLastThree = E.yearOf(today) === year && today >= bounds.maxStart;
        return { viewStart: bounds.maxStart, selected: inLastThree ? today : `${year}-12` };
      },
      readOnly: m => {
        const s = store.getState();
        return E.isMonthLocked(m, s.today, s.unlockedYears);
      },
      // Variable + Bank Commission are mostly one-offs; corrections in a closed year
      // also default to "Once" so later years stay untouched
      defaultOnce: (m, section) =>
        E.ONCE_BY_DEFAULT.includes(section) || E.isYearClosed(E.yearOf(m), store.getState().today),
    });
  }

  function closeYearView() {
    if (view) { view.destroy(); view = null; }
    openYear = null;
    renderList();
  }

  // ── Events ─────────────────────────────────────────────
  root.addEventListener('click', e => {
    const yearBtn = e.target.closest('[data-year]');
    if (yearBtn) { openYearView(Number(yearBtn.dataset.year)); return; }
    if (e.target.closest('[data-back]')) { closeYearView(); return; }
    if (e.target.closest('[data-unlock]')) {
      if (confirm(t('archive.confirmUnlock', { year: openYear }))) store.setYearUnlocked(openYear, true);
      return;
    }
    if (e.target.closest('[data-lock]')) { store.setYearUnlocked(openYear, false); }
  });

  store.subscribe(() => {
    if (openYear === null) renderList(); else renderLockBar();
  });

  renderList();

  return {
    /** Back to the list (used when the Lisbon year/month rolls over). */
    reset() { closeYearView(); },
  };
}
