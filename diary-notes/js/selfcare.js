// selfcare.js — six blocks, two in a row, each a list of bullet points for the day
// DIARY Notes · 3C Thread To Success™

import * as E from './engine.js';
import * as store from './store.js';
import { t } from './i18n.js';
import { esc, showToast } from './ui.js';

const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';

export function initSelfcare(root) {
  let focusBlock = null;

  function blockHTML(day, key) {
    const rows = store.getState().selfcare.filter(r => r.date === day && r.block === key).sort((a, b) => a.seq - b.seq);
    return `
      <section class="card sc-block" data-block="${key}">
        <div class="sc-title">${esc(t(`selfcare.blocks.${key}.title`))}</div>
        <p class="sc-prompt">${esc(t(`selfcare.blocks.${key}.prompt`))}</p>
        <ul class="sc-list">${rows.map(r => `
          <li class="sc-li">
            <span class="sc-dot" aria-hidden="true">•</span>
            <input type="text" class="sc-text" data-sc-text="${r.id}" maxlength="500" value="${esc(r.text)}" />
            <button type="button" class="ic ic--del ic--sm" data-sc-del="${r.id}" aria-label="${esc(t('selfcare.removeAria'))}">${X_ICON}</button>
          </li>`).join('')}</ul>
        <div class="sc-add">
          <input type="text" data-sc-new="${key}" maxlength="500" placeholder="${esc(t('selfcare.phAdd'))}" />
          <button type="button" class="ic ic--add" data-sc-add="${key}" aria-label="${esc(t('selfcare.addAria'))}">+</button>
        </div>
      </section>`;
  }

  function render() {
    const day = store.getState().selected;
    root.innerHTML = `
      <div class="section__title">${esc(t('selfcare.title'))}</div>
      <p class="subtle">${esc(t('selfcare.subtitle'))}</p>
      <div class="sc-grid">${E.BLOCKS.map(key => blockHTML(day, key)).join('')}</div>`;
    if (focusBlock) {
      root.querySelector(`[data-sc-new="${focusBlock}"]`)?.focus();
      focusBlock = null;
    }
  }

  const fail = err => { console.error('[diary-notes]', err); showToast(t('planner.toastFailed'), 'error'); };

  async function add(block) {
    const input = root.querySelector(`[data-sc-new="${block}"]`);
    const text = input ? input.value.trim() : '';
    if (!text) { input?.focus(); return; }
    await store.addSelfcare(store.getState().selected, block, text);
    focusBlock = block;
    render();
  }

  root.addEventListener('click', async e => {
    const el = e.target.closest('button');
    if (!el || !root.contains(el)) return;
    try {
      if (el.dataset.scAdd) await add(el.dataset.scAdd);
      else if (el.dataset.scDel) await store.deleteSelfcare(el.dataset.scDel);
    } catch (err) { fail(err); }
  });

  // text typed into an existing bullet is saved quietly (no redraw)
  root.addEventListener('change', async e => {
    const el = e.target;
    if (!el.dataset.scText) return;
    try {
      if (!el.value.trim()) await store.deleteSelfcare(el.dataset.scText);
      else await store.updateSelfcare(el.dataset.scText, el.value, { quiet: true });
    } catch (err) { fail(err); }
  });

  root.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const el = e.target;
    try {
      if (el.dataset.scNew) { e.preventDefault(); await add(el.dataset.scNew); }
      else if (el.dataset.scText) { e.preventDefault(); el.blur(); }
    } catch (err) { fail(err); }
  });

  store.subscribe(render);
  render();
  return { render };
}
