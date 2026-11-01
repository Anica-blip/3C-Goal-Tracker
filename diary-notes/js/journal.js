// journal.js — your own thoughts for the day + 1 to 5 ratings
// DIARY Notes · 3C Thread To Success™
//
// The text saves by itself a moment after you stop typing.
// Ratings: tap a number, that block goes dark; tap it again to clear. The list can be edited.
// (Ratings are stored per day and per habit, ready for a monthly self-regulation page.)

import * as store from './store.js';
import { t } from './i18n.js';
import { esc, showToast } from './ui.js';

const svg = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const X_ICON = svg('<path d="M5 5l14 14M19 5L5 19"/>');

export function initJournal(root) {
  let renderedDay = null;
  let pending = null;       // { day, text } waiting to be saved
  let timer = null;
  let catEdit = null;       // the rating list being edited: [{ id|null, name }]

  // ── saving the text ───────────────────────────────────
  async function flush() {
    clearTimeout(timer);
    const p = pending;
    pending = null;
    if (!p) return;
    setStatus('saving');
    try {
      await store.saveJournal(p.day, p.text);
      if (!pending) setStatus('saved');
    } catch (err) {
      console.error('[diary-notes]', err);
      showToast(t('journal.toastFailed'), 'error');
    }
  }

  function setStatus(kind) {
    const el = root.querySelector('#jr-status');
    if (el) el.textContent = kind === 'saving' ? t('journal.saving') : kind === 'saved' ? t('journal.saved') : '';
  }

  // ── drawing ───────────────────────────────────────────
  function buildPage(day) {
    const rec = store.getState().journal.find(j => j.date === day);
    root.innerHTML = `
      <div class="section__title">${esc(t('journal.title'))}</div>
      <section class="card jr-card">
        <div class="jr-head">
          <div class="section__title">${esc(t('journal.thoughtsTitle'))}</div>
          <span class="jr-status" id="jr-status" aria-live="polite"></span>
        </div>
        <p class="jr-note">${esc(t('journal.note'))}</p>
        <textarea id="jr-text" class="jr-text" maxlength="50000" placeholder="${esc(t('journal.ph'))}"
          aria-label="${esc(t('journal.thoughtsTitle'))}">${esc(rec ? rec.text : '')}</textarea>
      </section>
      <div id="jr-rate"></div>`;
  }

  function renderRatings(day) {
    const s = store.getState();
    const host = root.querySelector('#jr-rate');
    if (!host) return;
    const cats = s.categories.slice().sort((a, b) => a.seq - b.seq);
    const value = id => { const r = s.ratings.find(x => x.id === `${day}|${id}`); return r ? r.value : 0; };

    const body = catEdit
      ? `<div class="rt-edit-list">${catEdit.map((c, i) => `
           <div class="rt-edit">
             <input type="text" data-cat-name="${i}" maxlength="80" value="${esc(c.name)}" placeholder="${esc(t('journal.phName'))}"
               aria-label="${esc(t('journal.phName'))}" />
             <button type="button" class="ic ic--del ic--sm" data-cat-rm="${i}" aria-label="${esc(t('journal.removeCat'))}">${X_ICON}</button>
           </div>`).join('')}</div>
         <div class="rt-edit rt-edit--new">
           <input type="text" data-cat-new maxlength="80" placeholder="${esc(t('journal.phCat'))}" />
           <button type="button" class="btn btn--glass" data-cat-add>${esc(t('journal.addCat'))}</button>
         </div>
         <div class="btn-row rt-buttons">
           <button type="button" class="btn btn--primary" data-cat-save>${esc(t('journal.saveList'))}</button>
           <button type="button" class="btn btn--ghost" data-cat-cancel>${esc(t('journal.cancelList'))}</button>
         </div>`
      : cats.map(c => `
          <div class="rt-row">
            <span class="rt-name">${esc(c.name)}</span>
            <div class="rt-scale" role="group" aria-label="${esc(c.name)}">
              ${[1, 2, 3, 4, 5].map(n => `
                <button type="button" class="rt-b${value(c.id) === n ? ' is-on' : ''}" data-rate="${c.id}|${n}"
                  aria-pressed="${value(c.id) === n}" aria-label="${esc(t('journal.rateAria', { name: c.name, value: n }))}">${n}</button>`).join('')}
            </div>
          </div>`).join('');

    host.innerHTML = `
      <section class="card jr-rate">
        <div class="jr-rate__head">
          <div class="section__title">${esc(t('journal.rateTitle'))}</div>
          ${catEdit ? '' : `<button type="button" class="btn btn--glass" data-cat-edit>${esc(t('journal.editList'))}</button>`}
        </div>
        <p class="subtle">${esc(t('journal.legend'))}</p>
        ${body}
      </section>`;
  }

  function render() {
    const day = store.getState().selected;
    if (renderedDay !== day || !root.querySelector('#jr-text')) {
      flush();                 // save anything typed on the day we are leaving
      buildPage(day);
      renderedDay = day;
    }
    renderRatings(day);
  }

  // ── events ────────────────────────────────────────────
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'jr-text') {
      pending = { day: renderedDay, text: el.value };
      setStatus('saving');
      clearTimeout(timer);
      timer = setTimeout(flush, 600);
    } else if (el.dataset.catName !== undefined && catEdit) {
      catEdit[Number(el.dataset.catName)].name = el.value;
    }
  });

  root.addEventListener('click', async e => {
    const el = e.target.closest('button');
    if (!el || !root.contains(el)) return;
    const d = el.dataset;
    try {
      if (d.rate) {
        const [cat, value] = d.rate.split('|');
        await store.setRating(renderedDay, cat, Number(value));
      } else if ('catEdit' in d) {
        catEdit = store.getState().categories.slice().sort((a, b) => a.seq - b.seq).map(c => ({ id: c.id, name: c.name }));
        renderRatings(renderedDay);
      } else if (d.catRm !== undefined) {
        catEdit.splice(Number(d.catRm), 1);
        renderRatings(renderedDay);
      } else if ('catAdd' in d) {
        addCat();
      } else if ('catCancel' in d) {
        catEdit = null;
        renderRatings(renderedDay);
      } else if ('catSave' in d) {
        const input = root.querySelector('[data-cat-new]');
        if (input && input.value.trim()) catEdit.push({ id: null, name: input.value.trim() });
        const list = catEdit;
        catEdit = null;
        await store.saveCategories(list);
        showToast(t('journal.toastListSaved'));
      }
    } catch (err) {
      console.error('[diary-notes]', err);
      showToast(t('journal.toastFailed'), 'error');
    }
  });

  function addCat() {
    const input = root.querySelector('[data-cat-new]');
    const name = input ? input.value.trim() : '';
    if (name) catEdit.push({ id: null, name });
    renderRatings(renderedDay);
    root.querySelector('[data-cat-new]')?.focus();
  }

  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-cat-new]')) { e.preventDefault(); addCat(); }
  });

  // a new language: save what is typed, then draw the page again in that language
  window.addEventListener('diary-lang-changed', () => { flush(); renderedDay = null; render(); });

  // don't lose the last words when the tab is closed or hidden
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  store.subscribe(render);
  render();
  return { render, flush };
}
