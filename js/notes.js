// notes.js — Written notes, quotes, wish list
// Dash Notes · 3C Thread To Success™

import { saveNote, getNotes, deleteNote, genId } from './storage.js';
import { t, getLocale } from './i18n.js';

// ── Note type label lookup ─────────────────────────────────
function getNoteTypeLabel(type) {
  const map = {
    text:     () => t('notes.tabNote'),
    quote:    () => t('notes.tabQuote'),
    wishlist: () => t('notes.tabWishlist'),
  };
  return (map[type] || map.text)();
}

// ── Note type placeholder lookup ───────────────────────────
function getNoteTypePlaceholder(type) {
  const map = {
    text:     () => t('notes.padPlaceholder'),
    quote:    () => t('notes.phQuote'),
    wishlist: () => t('notes.phWishlist'),
  };
  return (map[type] || map.text)();
}

// ── Save a note ────────────────────────────────────────────
async function saveNewNote(text, subject = '', type = 'text') {
  if (!text.trim()) return null;
  return saveNote({
    id:      genId(),
    text:    text.trim(),
    subject: subject.trim(),
    type,
    created: new Date().toISOString(),
  });
}

// ── Render notes list ──────────────────────────────────────
async function renderNotes(filterType = null) {
  const container = document.getElementById('notes-list');
  if (!container) return;

  const all   = await getNotes();
  const notes = all.filter(n =>
    filterType ? n.type === filterType : ['text', 'quote', 'wishlist'].includes(n.type)
  );

  if (notes.length === 0) {
    container.innerHTML = `
      <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:20px 0;">
        ${t('notes.emptyState')}
      </p>`;
    return;
  }

  container.innerHTML = notes.map(n => {
    const label   = getNoteTypeLabel(n.type);
    const subject = n.subject
      ? `<div style="font-size:0.72rem; font-weight:700; color:var(--cyan); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">${escHtml(n.subject)}</div>`
      : '';
    return `
      <div class="note-item" id="note-${n.id}" style="cursor:default;">
        <div class="item-actions">
          <button class="item-action-btn" data-edit-note="${n.id}" title="Edit">&#x270E;</button>
          <button class="item-action-btn" data-share-note="${n.id}" title="Store">${t('notes.storeBtn')}</button>
          <button class="item-action-btn delete" data-del-note="${n.id}" title="Delete">&#x2715;</button>
        </div>
        <div style="flex:1; min-width:0; padding-right:8px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
            <span style="font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em;
              color:var(--text-muted); border:1px solid var(--border); border-radius:4px; padding:1px 7px;">
              ${label}
            </span>
            <span style="font-size:0.72rem; color:var(--text-muted);">${formatDate(n.created)}</span>
          </div>
          ${subject}
          <div class="note-item__text" id="note-text-${n.id}">${escHtml(n.text)}</div>
        </div>
      </div>`;
  }).join('');

  // Tap to reveal actions on mobile
  container.querySelectorAll('.note-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.item-action-btn')) return;
      item.classList.toggle('reveal');
    });
  });

  // Edit
  container.querySelectorAll('[data-edit-note]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id    = btn.dataset.editNote;
      const all   = await getNotes();
      const note  = all.find(n => n.id === id);
      if (!note) return;

      const pad     = document.getElementById('note-pad');
      const subRef  = document.getElementById('note-subject');
      const saveBtn = document.getElementById('save-note-btn');
      if (!pad || !saveBtn) return;

      pad.value = note.text;
      if (subRef) subRef.value = note.subject || '';

      const tab = document.querySelector(`[data-note-type="${note.type || 'text'}"]`);
      if (tab) tab.click();

      saveBtn.textContent       = t('notes.updateBtn');
      saveBtn.dataset.editingId = id;
      saveBtn.style.background  = 'var(--cyan-dim)';

      pad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pad.focus();

      showToast(t('notes.editLoaded'));
    });
  });

  // Delete
  container.querySelectorAll('[data-del-note]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await deleteNote(btn.dataset.delNote);
      document.getElementById(`note-${btn.dataset.delNote}`)?.remove();
      if (!container.querySelectorAll('.note-item').length) renderNotes();
    });
  });

  // Share
  container.querySelectorAll('[data-share-note]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const all  = await getNotes();
      const note = all.find(n => n.id === btn.dataset.shareNote);
      if (!note) return;
      shareText(note.subject ? `${note.subject}\n\n${note.text}` : note.text);
    });
  });
}

// ── Share ──────────────────────────────────────────────────
function shareText(text) {
  if (navigator.share) {
    navigator.share({ title: 'Dash Notes', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast(t('notes.copied')));
  }
}

// ── Utilities ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(getLocale(), {
    timeZone: 'Europe/London',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast--${type} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Init ───────────────────────────────────────────────────
function initNotes() {
  renderNotes();

  // Tab switching
  document.querySelectorAll('[data-note-type]').forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.dataset.noteType;

      document.querySelectorAll('[data-note-type]').forEach(t => {
        t.style.color        = 'var(--text-muted)';
        t.style.borderBottom = '2px solid transparent';
      });
      tab.style.color        = 'var(--cyan)';
      tab.style.borderBottom = '2px solid var(--cyan)';

      const pad = document.getElementById('note-pad');
      if (pad) pad.placeholder = getNoteTypePlaceholder(type);
      pad?.setAttribute('data-active-type', type);

      renderNotes(type === 'text' ? null : type);
    });
  });

  const pad     = document.getElementById('note-pad');
  const subRef  = document.getElementById('note-subject');
  const saveBtn = document.getElementById('save-note-btn');

  if (!pad || !saveBtn) return;

  const doSave = async () => {
    const text    = pad.value.trim();
    if (!text) return;
    const type    = pad.getAttribute('data-active-type') || 'text';
    const subject = subRef?.value.trim() || '';
    const editId  = saveBtn.dataset.editingId;

    if (editId) {
      const all  = await getNotes();
      const note = all.find(n => n.id === editId);
      if (note) {
        note.text    = text;
        note.subject = subject;
        note.type    = type;
        await saveNote(note);
      }
      delete saveBtn.dataset.editingId;
      saveBtn.textContent      = t('notes.saveBtn');
      saveBtn.style.background = '';
      showToast(t('notes.toastUpdated'));
    } else {
      await saveNewNote(text, subject, type);
      showToast(t('notes.toastSaved'));
    }

    pad.value = '';
    if (subRef) subRef.value = '';
    await renderNotes();
  };

  saveBtn.addEventListener('click', doSave);

  pad.addEventListener('keydown', async e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      await doSave();
    }
  });
}

export { initNotes, renderNotes, saveNewNote, shareText };
