// notes.js — Written notes, quotes, wish list
// Dash Notes · 3C Thread To Success™

import { saveNote, getNotes, deleteNote, genId } from './storage.js';

// ── Type config ────────────────────────────────────────────
const NOTE_TYPES = {
  text:     { label: 'Note',      placeholder: 'What\'s on your mind? Just start typing…' },
  quote:    { label: 'Quote',     placeholder: 'A thought, a quote, something worth keeping…' },
  wishlist: { label: 'Wish List', placeholder: 'Something you want, need, or are working towards…' },
};

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
        Nothing saved yet in this section.
      </p>`;
    return;
  }

  container.innerHTML = notes.map(n => {
    const cfg     = NOTE_TYPES[n.type] || NOTE_TYPES.text;
    const subject = n.subject ? `<div style="font-size:0.72rem; font-weight:700; color:var(--cyan); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">${escHtml(n.subject)}</div>` : '';
    return `
      <div class="note-item" id="note-${n.id}">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
            <span style="font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em;
              color:var(--text-muted); border:1px solid var(--border); border-radius:4px; padding:1px 7px;">
              ${cfg.label}
            </span>
            <span style="font-size:0.72rem; color:var(--text-muted);">${formatDate(n.created)}</span>
          </div>
          ${subject}
          <div class="note-item__text">${escHtml(n.text)}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0; margin-left:10px;">
          <button class="btn btn--glass" style="padding:4px 10px; font-size:0.72rem;"
            data-share-note="${n.id}">Share</button>
          <button class="btn btn--danger" style="padding:4px 10px; font-size:0.72rem;"
            data-del-note="${n.id}">&#x2715;</button>
        </div>
      </div>`;
  }).join('');

  // Delete
  container.querySelectorAll('[data-del-note]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteNote(btn.dataset.delNote);
      document.getElementById(`note-${btn.dataset.delNote}`)?.remove();
      const remaining = container.querySelectorAll('.note-item');
      if (remaining.length === 0) renderNotes();
    });
  });

  // Share
  container.querySelectorAll('[data-share-note]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const all  = await getNotes();
      const note = all.find(n => n.id === btn.dataset.shareNote);
      if (!note) return;
      const text = note.subject ? `${note.subject}\n\n${note.text}` : note.text;
      shareText(text);
    });
  });
}

// ── Share ──────────────────────────────────────────────────
function shareText(text) {
  if (navigator.share) {
    navigator.share({ title: 'Dash Notes', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard ✅'));
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
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast--${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Init ───────────────────────────────────────────────────
function initNotes() {
  renderNotes();

  // Tab switching
  document.querySelectorAll('[data-note-type]').forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.dataset.noteType;

      // Update active tab
      document.querySelectorAll('[data-note-type]').forEach(t => {
        t.style.color        = 'var(--text-muted)';
        t.style.borderBottom = '2px solid transparent';
      });
      tab.style.color        = 'var(--cyan)';
      tab.style.borderBottom = '2px solid var(--cyan)';

      // Update placeholder
      const pad = document.getElementById('note-pad');
      if (pad) pad.placeholder = NOTE_TYPES[type]?.placeholder || '';
      pad?.setAttribute('data-active-type', type);

      // Re-render filtered list
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
    await saveNewNote(text, subject, type);
    pad.value = '';
    if (subRef) subRef.value = '';
    await renderNotes();
    showToast('Saved ✅');
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
