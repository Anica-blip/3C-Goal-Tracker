// planner.js — Day Planner (entries in time order) + Renewals + Reminder (Work / Personal)
// DIARY Notes · 3C Thread To Success™
//
// Each entry: a done box, a time badge, a title, and a note or a to-do list.
// Symbols on every title: edit · duplicate · save · delete.

import * as E from './engine.js';
import * as store from './store.js';
import { t } from './i18n.js';
import { esc, showToast, monthName } from './ui.js';

const svg = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const ICON = {
  edit:  svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  copy:  svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  save:  svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
  trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
  x:     svg('<path d="M5 5l14 14M19 5L5 19"/>'),
  check: svg('<polyline points="5 12 10 17 19 7"/>'),
};

export function initPlanner(root) {
  let draft = null;          // the entry being written or edited: { id:'new'|entryId, date, title, time, kind, text, items }
  let rnOpen = false;        // the "Manage renewals" panel is open
  let rnRenewing = null;     // id of the renewal whose new expiry month is being chosen
  let focus = null;          // what to focus after the next draw: 'title' | 'item' | 'text' | { reminder:id } | { group }

  const blankDraft = day => {
    const s = store.getState();
    return { id: 'new', date: day, title: '', time: day === s.today ? E.nowTime() : '09:00', kind: 'note', text: '', items: [] };
  };
  const draftFrom = e => ({ id: e.id, date: e.date, title: e.title, time: e.time, kind: e.kind, text: e.text, items: e.items.map(i => ({ ...i })) });

  // ═════════════════════ HTML ═════════════════════
  function viewCard(e) {
    const body = e.kind === 'todo'
      ? `${e.items.length ? `<p class="en-progress">${esc(t('planner.progress', { done: e.items.filter(i => i.done).length, total: e.items.length }))}</p>` : ''}
         <ul class="en-items">${e.items.map(i => `
           <li class="en-item${i.done ? ' is-done' : ''}">
             <button type="button" class="box box--sm${i.done ? ' is-done' : ''}" data-item="${e.id}|${i.id}"
               aria-pressed="${i.done}" aria-label="${esc(t('planner.itemDoneAria'))}">${ICON.check}</button>
             <span>${esc(i.text)}</span>
           </li>`).join('')}</ul>`
      : (e.text.trim() ? `<p class="en-text">${esc(e.text)}</p>` : '');

    return `
      <article class="en${e.done ? ' is-done' : ''}" data-entry="${e.id}">
        <div class="en__head">
          <button type="button" class="box${e.done ? ' is-done' : ''}" data-done="${e.id}"
            aria-pressed="${e.done}" aria-label="${esc(t('planner.doneAria'))}">${ICON.check}</button>
          ${e.time ? `<span class="en-time">${esc(e.time)}</span>` : ''}
          <h3 class="en__title">${esc(e.title)}</h3>
          <div class="en__actions">
            <button type="button" class="ic" data-edit="${e.id}" aria-label="${esc(t('planner.editAria'))}" title="${esc(t('planner.editAria'))}">${ICON.edit}</button>
            <button type="button" class="ic" data-dup="${e.id}" aria-label="${esc(t('planner.duplicateAria'))}" title="${esc(t('planner.duplicateAria'))}">${ICON.copy}</button>
            <button type="button" class="ic ic--idle" disabled aria-label="${esc(t('planner.saveAria'))}" title="${esc(t('planner.saveAria'))}">${ICON.save}</button>
            <button type="button" class="ic ic--del" data-del="${e.id}" aria-label="${esc(t('planner.deleteAria'))}" title="${esc(t('planner.deleteAria'))}">${ICON.trash}</button>
          </div>
        </div>
        ${body ? `<div class="en__body">${body}</div>` : ''}
      </article>`;
  }

  function editorCard(d) {
    const isNew = d.id === 'new';
    const body = d.kind === 'todo'
      ? `<div class="ei-list">${d.items.map((i, n) => `
           <div class="ei">
             <button type="button" class="box box--sm${i.done ? ' is-done' : ''}" data-ei-done="${n}" aria-pressed="${i.done}"
               aria-label="${esc(t('planner.itemDoneAria'))}">${ICON.check}</button>
             <input type="text" class="ei-text" data-ei="${n}" maxlength="500" value="${esc(i.text)}" />
             <button type="button" class="ic ic--del ic--sm" data-ei-rm="${n}" aria-label="${esc(t('planner.removeItemAria'))}">${ICON.x}</button>
           </div>`).join('')}</div>
         <div class="ei ei--new">
           <input type="text" class="ei-text" data-new-item maxlength="500" placeholder="${esc(t('planner.phItem'))}" />
           <button type="button" class="btn btn--glass ei-add" data-add-item>${esc(t('planner.addItem'))}</button>
         </div>`
      : `<textarea class="en-note" data-f="text" rows="4" maxlength="20000" placeholder="${esc(t('planner.phNote'))}">${esc(d.text)}</textarea>`;

    return `
      <article class="en en--edit" data-editor>
        <div class="en-form__title">${esc(isNew ? t('planner.newTitle') : t('planner.editAria'))}</div>
        <div class="form-group">
          <label for="pl-title">${esc(t('planner.labelTitle'))}</label>
          <input type="text" id="pl-title" data-f="title" maxlength="200" autocomplete="off"
            placeholder="${esc(t('planner.phTitle'))}" value="${esc(d.title)}" />
        </div>
        <div class="en-form__row">
          <div class="form-group">
            <label for="pl-time">${esc(t('planner.labelTime'))}</label>
            <input type="time" id="pl-time" data-f="time" value="${esc(d.time)}" />
          </div>
          <div class="en-kind" role="group">
            <button type="button" data-kind="note" class="${d.kind === 'note' ? 'is-on' : ''}" aria-pressed="${d.kind === 'note'}">${esc(t('planner.kindNote'))}</button>
            <button type="button" data-kind="todo" class="${d.kind === 'todo' ? 'is-on' : ''}" aria-pressed="${d.kind === 'todo'}">${esc(t('planner.kindTodo'))}</button>
          </div>
        </div>
        ${body}
        <div class="btn-row en-form__buttons">
          <button type="button" class="btn btn--primary" data-save>${esc(t('planner.saveBtn'))}</button>
          <button type="button" class="btn btn--ghost" data-cancel>${esc(t('planner.cancelBtn'))}</button>
        </div>
      </article>`;
  }

  function reminderBlock(day, group) {
    const s = store.getState();
    const rows = s.reminders.filter(r => r.date === day && r.group === group).sort((a, b) => a.seq - b.seq);
    const suggestions = t(group === 'work' ? 'reminders.suggestWork' : 'reminders.suggestPersonal');
    return `
      <section class="card rm-block" data-group="${group}">
        <div class="section__title">${esc(t('reminders.' + group))}</div>
        <div class="rm-rows">${rows.map(r => `
          <div class="rm-row${r.done ? ' is-done' : ''}">
            <button type="button" class="box${r.done ? ' is-done' : ''}" data-rm-done="${r.id}" aria-pressed="${r.done}"
              aria-label="${esc(t('reminders.doneAria'))}">${ICON.check}</button>
            <input type="text" class="rm-text" data-rm-text="${r.id}" maxlength="500" value="${esc(r.text)}" />
            <button type="button" class="ic ic--del ic--sm" data-rm-del="${r.id}" aria-label="${esc(t('reminders.deleteAria'))}">${ICON.x}</button>
          </div>`).join('')}</div>
        ${rows.length ? '' : `
          <div class="rm-chips">
            <span class="rm-chips__label">${esc(t('reminders.suggestLabel'))}</span>
            ${suggestions.map((txt, i) => `<button type="button" class="chip" data-rm-suggest="${group}|${i}">${esc(txt)}</button>`).join('')}
          </div>`}
        <div class="rm-add">
          <input type="text" data-rm-new="${group}" maxlength="500" placeholder="${esc(t('reminders.phAdd'))}" />
          <button type="button" class="btn btn--glass" data-rm-add="${group}">${esc(t('reminders.addBtn'))}</button>
        </div>
      </section>`;
  }

  // ═════════════════════ renewals ═════════════════════
  const monthOptions = sel => Array.from({ length: 12 }, (_, i) =>
    `<option value="${String(i + 1).padStart(2, '0')}"${i + 1 === sel ? ' selected' : ''}>${esc(monthName(i + 1))}</option>`).join('');

  function yearOptions(sel) {
    const first = Math.min(E.yearOf(E.MIN_MONTH), sel);
    const last = Math.max(E.yearOf(store.getState().today) + 15, sel);
    let out = '';
    for (let y = first; y <= last; y++) out += `<option value="${y}"${y === sel ? ' selected' : ''}>${y}</option>`;
    return out;
  }

  function daysLeftText(left) {
    if (left < 0) return t('renewals.expired');
    if (left === 0) return t('renewals.lastDay');
    if (left === 1) return t('renewals.dayLeft');
    return t('renewals.daysLeft', { n: left });
  }

  function renewalRow(r, due) {
    const s = store.getState();
    const { year, month } = E.parseMonth(r.expiry);
    const left = E.renewalDaysLeft(r, s.today);
    const state = !due ? '' : left < 0 ? ' is-late' : ' is-soon';
    const renewing = rnRenewing === r.id;
    let nextYear = year + 1, nextMonth = month;
    return `
      <div class="rn-row${state}" data-rn-row="${r.id}">
        <div class="rn-top">
          <input type="text" class="rn-name" data-rn-name="${r.id}" maxlength="200" value="${esc(r.name)}"
            aria-label="${esc(t('renewals.nameAria'))}" />
          <button type="button" class="ic ic--del ic--sm" data-rn-del="${r.id}" aria-label="${esc(t('renewals.deleteAria'))}">${ICON.x}</button>
        </div>
        <div class="rn-meta">
          <span class="rn-meta__label">${esc(t('renewals.expires'))}</span>
          <select data-rn-month="${r.id}" aria-label="${esc(t('renewals.monthAria'))}">${monthOptions(month)}</select>
          <select data-rn-year="${r.id}" aria-label="${esc(t('renewals.yearAria'))}">${yearOptions(year)}</select>
          ${due ? `<span class="rn-badge">${esc(daysLeftText(left))}</span>` : ''}
        </div>
        ${due && !renewing ? `<button type="button" class="btn btn--glass rn-renewed" data-rn-renewed="${r.id}">${ICON.check} ${esc(t('renewals.renewedBtn'))}</button>` : ''}
        ${renewing ? `
          <div class="rn-renew">
            <span class="rn-meta__label">${esc(t('renewals.newExpiry'))}</span>
            <select data-rn-nm aria-label="${esc(t('renewals.monthAria'))}">${monthOptions(nextMonth)}</select>
            <select data-rn-ny aria-label="${esc(t('renewals.yearAria'))}">${yearOptions(nextYear)}</select>
            <div class="rn-renew__buttons">
              <button type="button" class="btn btn--primary" data-rn-confirm="${r.id}">${esc(t('renewals.confirmBtn'))}</button>
              <button type="button" class="btn btn--ghost" data-rn-cancel>${esc(t('renewals.cancelBtn'))}</button>
            </div>
          </div>` : ''}
      </div>`;
  }

  function renewalsBlock(day) {
    const s = store.getState();
    const due = E.dueRenewals(s.renewals, day);
    const later = E.laterRenewals(s.renewals, day);
    const total = s.renewals.length;
    const open = rnOpen || total === 0;
    const { year: ty, month: tm } = E.parseMonth(E.monthOfDay(s.today));
    return `
      <section class="card rn-block">
        <div class="rn-head">
          <div class="section__title">${esc(t('renewals.title'))}</div>
          ${total ? `<button type="button" class="btn btn--glass rn-manage" data-rn-manage aria-expanded="${open}">${esc(t('renewals.manageBtn', { n: total }))}</button>` : ''}
        </div>
        <p class="subtle rn-sub">${esc(t('renewals.subtitle', { days: E.RENEWAL_WINDOW_DAYS }))}</p>
        ${due.length
          ? `<div class="rn-rows">${due.map(r => renewalRow(r, true)).join('')}</div>`
          : `<p class="rn-none">${esc(t(total ? 'renewals.nothingSoon' : 'renewals.none', { days: E.RENEWAL_WINDOW_DAYS }))}</p>`}
        ${open ? `
          <div class="rn-manage-panel">
            ${later.length ? `<div class="rn-later-title">${esc(t('renewals.laterTitle'))}</div>
              <div class="rn-rows">${later.map(r => renewalRow(r, false)).join('')}</div>` : ''}
            <div class="rn-add">
              <div class="rn-later-title">${esc(t('renewals.addTitle'))}</div>
              <input type="text" data-rn-new-name maxlength="200" autocomplete="off" placeholder="${esc(t('renewals.phName'))}" />
              <div class="rn-add__row">
                <select data-rn-add-month aria-label="${esc(t('renewals.monthAria'))}">${monthOptions(tm)}</select>
                <select data-rn-add-year aria-label="${esc(t('renewals.yearAria'))}">${yearOptions(ty)}</select>
                <button type="button" class="btn btn--glass" data-rn-add>${esc(t('renewals.addBtn'))}</button>
              </div>
              <p class="rn-privacy">${esc(t('renewals.privacy'))}</p>
            </div>
          </div>` : ''}
      </section>`;
  }

  // ═════════════════════ draw ═════════════════════
  function render() {
    const s = store.getState();
    const day = s.selected;
    if (draft && draft.date !== day) draft = null;      // moved to another day: the unsaved draft is dropped

    const entries = E.sortEntries(s.entries.filter(e => e.date === day));
    const cards = [];
    if (draft && draft.id === 'new') cards.push(editorCard(draft));
    entries.forEach(e => cards.push(draft && draft.id === e.id ? editorCard(draft) : viewCard(e)));

    root.innerHTML = `
      <div class="pl-head">
        <div class="section__title">${esc(t('planner.title'))}</div>
        <button type="button" class="btn btn--primary pl-add" data-add>${esc(t('planner.addBtn'))}</button>
      </div>
      <p class="subtle">${esc(t('planner.subtitle'))}</p>
      <div class="en-list">${cards.length ? cards.join('') : `<div class="empty">${esc(t('planner.empty'))}</div>`}</div>

      <div class="rn">${renewalsBlock(day)}</div>

      <div class="rm">
        <div class="section__title rm-title">${esc(t('reminders.title'))}</div>
        <div class="rm-grid">${reminderBlock(day, 'work')}${reminderBlock(day, 'personal')}</div>
      </div>`;

    if (focus) {
      let el = null;
      if (focus === 'title') el = root.querySelector('[data-f="title"]');
      else if (focus === 'text') el = root.querySelector('[data-f="text"]');
      else if (focus === 'item') el = root.querySelector('[data-new-item]');
      else if (focus === 'rn-name') el = root.querySelector('[data-rn-new-name]');
      else if (focus.reminder) el = root.querySelector(`[data-rm-text="${focus.reminder}"]`);
      else if (focus.group) el = root.querySelector(`[data-rm-new="${focus.group}"]`);
      if (el) {
        el.focus();
        if (focus.reminder && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
      }
      focus = null;
    }
  }

  const fail = err => { console.error('[diary-notes]', err); showToast(t('planner.toastFailed'), 'error'); };

  // ═════════════════════ events ═════════════════════
  root.addEventListener('click', async e => {
    const el = e.target.closest('button');
    if (!el || !root.contains(el) || el.disabled) return;
    const d = el.dataset;
    const s = store.getState();

    try {
      // — entries —
      if ('add' in d) { draft = blankDraft(s.selected); focus = 'title'; render(); }
      else if (d.edit) {
        const entry = s.entries.find(x => x.id === d.edit);
        if (entry) { draft = draftFrom(entry); focus = 'title'; render(); }
      }
      else if (d.dup) {
        const copy = await store.duplicateEntry(d.dup);
        if (copy) { draft = draftFrom(copy); focus = 'title'; showToast(t('planner.toastDuplicated')); render(); }
      }
      else if (d.del) {
        const entry = s.entries.find(x => x.id === d.del);
        if (entry && confirm(t('planner.confirmDelete', { title: entry.title }))) {
          if (draft && draft.id === d.del) draft = null;
          await store.deleteEntry(d.del);
          showToast(t('planner.toastDeleted'));
        }
      }
      else if (d.done) await store.toggleEntryDone(d.done);
      else if (d.item) { const [entryId, itemId] = d.item.split('|'); await store.toggleEntryItem(entryId, itemId); }

      // — the editor —
      else if (d.kind) { draft.kind = d.kind; focus = d.kind === 'todo' ? 'item' : 'text'; render(); }
      else if ('addItem' in d) addDraftItem();
      else if (d.eiDone !== undefined) { draft.items[Number(d.eiDone)].done = !draft.items[Number(d.eiDone)].done; render(); }
      else if (d.eiRm !== undefined) { draft.items.splice(Number(d.eiRm), 1); render(); }
      else if ('cancel' in d) { draft = null; render(); }
      else if ('save' in d) await saveDraft();

      // — reminders —
      else if (d.rmDone) {
        const r = s.reminders.find(x => x.id === d.rmDone);
        if (r) await store.updateReminder(r.id, { done: !r.done });
      }
      else if (d.rmDel) await store.deleteReminder(d.rmDel);
      else if (d.rmAdd) await addReminder(d.rmAdd);
      else if (d.rmSuggest) {
        const [group, i] = d.rmSuggest.split('|');
        const list = t(group === 'work' ? 'reminders.suggestWork' : 'reminders.suggestPersonal');
        const rec = await store.addReminder(s.selected, group, list[Number(i)]);
        focus = { reminder: rec.id };
        render();
      }

      // — renewals —
      else if ('rnManage' in d) { rnOpen = !rnOpen; render(); }
      else if (d.rnRenewed) { rnRenewing = d.rnRenewed; render(); }
      else if ('rnCancel' in d) { rnRenewing = null; render(); }
      else if (d.rnConfirm) {
        const row = el.closest('.rn-renew');
        const month = row.querySelector('[data-rn-nm]').value;
        const year = row.querySelector('[data-rn-ny]').value;
        rnRenewing = null;
        await store.updateRenewal(d.rnConfirm, { expiry: `${year}-${month}` });
        showToast(t('renewals.toastRenewed'));
      }
      else if (d.rnDel) {
        const r = s.renewals.find(x => x.id === d.rnDel);
        if (r && confirm(t('renewals.confirmDelete', { name: r.name }))) {
          if (rnRenewing === r.id) rnRenewing = null;
          await store.deleteRenewal(r.id);
          showToast(t('renewals.toastDeleted'));
        }
      }
      else if ('rnAdd' in d) await addRenewal();
    } catch (err) { fail(err); }
  });

  async function addRenewal() {
    const input = root.querySelector('[data-rn-new-name]');
    const name = input ? input.value.trim() : '';
    if (!name) { showToast(t('renewals.toastNoName'), 'error'); input?.focus(); return; }
    const month = root.querySelector('[data-rn-add-month]').value;
    const year = root.querySelector('[data-rn-add-year]').value;
    await store.addRenewal({ name, expiry: `${year}-${month}` });
    rnOpen = true;
    focus = 'rn-name';
    showToast(t('renewals.toastAdded'));
    render();
  }

  function addDraftItem() {
    const input = root.querySelector('[data-new-item]');
    const text = input ? input.value.trim() : '';
    if (text) draft.items.push({ id: E.newId(), text, done: false });
    focus = 'item';
    render();
  }

  async function saveDraft() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) { showToast(t('planner.toastNoTitle'), 'error'); root.querySelector('[data-f="title"]')?.focus(); return; }
    // an item still typed in the "add an item" box is kept
    const pending = root.querySelector('[data-new-item]');
    if (draft.kind === 'todo' && pending && pending.value.trim()) draft.items.push({ id: E.newId(), text: pending.value.trim(), done: false });

    const fields = { title, time: draft.time, kind: draft.kind, text: draft.text, items: draft.items };
    const isNew = draft.id === 'new';
    if (isNew) await store.addEntry({ date: draft.date, ...fields });
    else await store.updateEntry(draft.id, fields);
    draft = null;
    showToast(t(isNew ? 'planner.toastAdded' : 'planner.toastSaved'));
    render();
  }

  async function addReminder(group) {
    const input = root.querySelector(`[data-rm-new="${group}"]`);
    const text = input ? input.value.trim() : '';
    if (!text) { input?.focus(); return; }
    await store.addReminder(store.getState().selected, group, text);
    focus = { group };
    render();
  }

  // typing updates the draft without redrawing
  root.addEventListener('input', e => {
    const el = e.target;
    if (!draft) return;
    if (el.dataset.f) draft[el.dataset.f] = el.value;
    else if (el.dataset.ei !== undefined) draft.items[Number(el.dataset.ei)].text = el.value;
  });

  // text typed into an existing reminder is saved quietly (no redraw)
  root.addEventListener('change', async e => {
    const el = e.target;
    try {
      if (el.dataset.rnName) {                       // renewal name: saved quietly; blank puts the old name back
        const r = store.getState().renewals.find(x => x.id === el.dataset.rnName);
        if (!r) return;
        if (!el.value.trim()) el.value = r.name;
        else await store.updateRenewal(r.id, { name: el.value }, { quiet: true });
        return;
      }
      const rid = el.dataset.rnMonth || el.dataset.rnYear;   // renewal expiry month or year changed
      if (rid) {
        const row = el.closest('[data-rn-row]');
        const month = row.querySelector('[data-rn-month]').value;
        const year = row.querySelector('[data-rn-year]').value;
        await store.updateRenewal(rid, { expiry: `${year}-${month}` });
        return;
      }
      if (!el.dataset.rmText) return;
      if (!el.value.trim()) await store.deleteReminder(el.dataset.rmText);
      else await store.updateReminder(el.dataset.rmText, { text: el.value }, { quiet: true });
    } catch (err) { fail(err); }
  });

  root.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const el = e.target;
    try {
      if (el.matches('[data-new-item]')) { e.preventDefault(); addDraftItem(); }
      else if (el.dataset.rmNew) { e.preventDefault(); await addReminder(el.dataset.rmNew); }
      else if (el.matches('[data-rn-new-name]')) { e.preventDefault(); await addRenewal(); }
      else if (el.dataset.rnName) { e.preventDefault(); el.blur(); }
      else if (el.dataset.f === 'title') { e.preventDefault(); await saveDraft(); }
      else if (el.dataset.rmText || el.dataset.ei !== undefined) { e.preventDefault(); el.blur(); }
    } catch (err) { fail(err); }
  });

  store.subscribe(render);
  render();
  return { render };
}
