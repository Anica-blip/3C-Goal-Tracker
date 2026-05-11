// notes.js — Written notes / brain dump
// Dash Notes · 3C Thread To Success™

import { saveNote, getNotes, deleteNote, genId } from './storage.js';

// ── Render notes list ──────────────────────────────────────
async function renderNotes() {
  const container = document.getElementById('notes-list');
  if (!container) return;

  const all   = await getNotes();
  const notes = all.filter(n => n.type === 'text');

  if (notes.length === 0) {
    container.innerHTML = `
      <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:20px 0;">
        No notes yet. Capture your first thought above.
      </p>`;
    return;
  }

  container.innerHTML = notes.map(n => `
    <div class="note-item" id="note-${n.id}">
      <div class="note-item__text">${escHtml(n.text)}</div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
        <span class="note-item__date">${formatDate(n.created)}</span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn--glass" style="padding:4px 10px; font-size:0.72rem;"
            data-share="${n.id}">Share</button>
          <button class="btn btn--danger" style="padding:4px 10px; font-size:0.72rem;"
            data-del-note="${n.id}">✕</button>
        </div>
      </div>
    </div>`).join('');

  // Delete
  container.querySelectorAll('[data-del-note]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteNote(btn.dataset.delNote);
      document.getElementById(`note-${btn.dataset.delNote}`)?.remove();
      const remaining = container.querySelectorAll('.note-item');
      if (remaining.length === 0) renderNotes();
    });
  });

  // Share via Web Share API (British-friendly: falls back to clipboard)
  container.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const all   = await getNotes();
      const note  = all.find(n => n.id === btn.dataset.share);
      if (!note) return;
      shareText(note.text);
    });
  });
}

// ── Save a new note ────────────────────────────────────────
async function saveNewNote(text) {
  if (!text.trim()) return null;
  return saveNote({
    id:      genId(),
    text:    text.trim(),
    type:    'text',
    created: new Date().toISOString(),
  });
}

// ── Share via Web Share API ────────────────────────────────
function shareText(text) {
  if (navigator.share) {
    navigator.share({ title: 'Dash Notes — 3C', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard ✅');
    });
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
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
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

  const pad     = document.getElementById('note-pad');
  const saveBtn = document.getElementById('save-note-btn');

  if (!pad || !saveBtn) return;

  // Save on button click
  saveBtn.addEventListener('click', async () => {
    const text = pad.value.trim();
    if (!text) return;
    await saveNewNote(text);
    pad.value = '';
    await renderNotes();
    showToast('Note saved ✅');
  });

  // Save on Ctrl+Enter / Cmd+Enter
  pad.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const text = pad.value.trim();
      if (!text) return;
      await saveNewNote(text);
      pad.value = '';
      await renderNotes();
      showToast('Note saved ✅');
    }
  });
}

export { initNotes, renderNotes, saveNewNote, shareText };
