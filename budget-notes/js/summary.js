// summary.js — "Year at a Glance": every month side by side, with year totals
// BUDGET Notes · 3C Thread To Success™

import * as E from './engine.js';
import * as store from './store.js';
import { t } from './i18n.js';
import { esc, money, monthShort } from './ui.js';

export function initSummary(root) {
  let year = null;   // null → follow the current year

  function availableYears() {
    const s = store.getState();
    const years = new Set(E.yearsWithData(s.lines, s.today));
    years.add(E.yearOf(s.today));
    return [...years].sort((a, b) => a - b);
  }

  function render() {
    const s = store.getState();
    const years = availableYears();
    if (year === null || !years.includes(year)) year = E.yearOf(s.today);
    const idx = years.indexOf(year);

    // months that have not started stay blank — nothing is added ahead of time
    const cur = E.yearTotals(s.lines, year, year === E.yearOf(s.today) ? s.today : null);
    const prev = E.yearTotals(s.lines, year - 1);
    const dash = `<span class="mv-dash">${esc(t('year.none'))}</span>`;
    const cell = (tt, key) => (tt.hasFigures ? money(tt[key]) : dash);
    const left = tt => (tt.hasFigures
      ? `<span class="${tt.moneyLeft < 0 ? 'is-neg' : 'is-pos'}">${money(tt.moneyLeft)}</span>`
      : dash);

    const body = cur.months.map(m => `
      <tr${m.key === s.today ? ' class="ys-now"' : ''}>
        <th scope="row">${esc(monthShort(m.key))}</th>
        <td>${cell(m, 'income')}</td>
        <td>${cell(m, 'fixed')}</td>
        <td>${cell(m, 'variable')}</td>
        <td>${cell(m, 'commission')}</td>
        <td>${cell(m, 'savings')}</td>
        <td>${left(m)}</td>
      </tr>`).join('');

    const totalRow = (label, tt, cls) => `
      <tr class="${cls}">
        <th scope="row">${esc(label)}</th>
        <td>${cell(tt, 'income')}</td>
        <td>${cell(tt, 'fixed')}</td>
        <td>${cell(tt, 'variable')}</td>
        <td>${cell(tt, 'commission')}</td>
        <td>${cell(tt, 'savings')}</td>
        <td>${left(tt)}</td>
      </tr>`;

    root.innerHTML = `
      <div class="ys-head">
        <button type="button" class="mv-arrow" data-yr="-1" aria-label="${esc(t('year.prev'))}" ${idx <= 0 ? 'disabled' : ''}>‹</button>
        <div class="ys-year">${year}</div>
        <button type="button" class="mv-arrow" data-yr="1" aria-label="${esc(t('year.next'))}" ${idx >= years.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      <div class="card ys-card">
        <div class="ys-scroll">
          <table class="ys-table">
            <thead>
              <tr>
                <th scope="col">${esc(t('year.month'))}</th>
                <th scope="col">${esc(t('year.income'))}</th>
                <th scope="col">${esc(t('year.fixed'))}</th>
                <th scope="col">${esc(t('year.variable'))}</th>
                <th scope="col">${esc(t('year.commission'))}</th>
                <th scope="col">${esc(t('year.savings'))}</th>
                <th scope="col">${esc(t('year.left'))}</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
            <tfoot>
              ${totalRow(t('year.total'), cur.total, 'ys-total')}
              ${totalRow(t('year.totalOf', { year: year - 1 }), prev.total, 'ys-prev')}
            </tfoot>
          </table>
        </div>
      </div>
      <p class="mv-sum__formula">${esc(t('sum.left'))} = ${esc(t('sum.formula'))}</p>`;
  }

  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-yr]');
    if (!btn) return;
    const years = availableYears();
    const next = years[years.indexOf(year) + Number(btn.dataset.yr)];
    if (next !== undefined) { year = next; render(); }
  });

  store.subscribe(render);
  render();
  return { render };
}
