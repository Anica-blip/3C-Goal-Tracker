// backup.js — Share, download and restore
// Dash Notes · 3C Thread To Success™

import { exportAll, importAll } from './storage.js';
import { t, getLocale } from './i18n.js';

// ── Format data as readable text ───────────────────────────
function formatAsText(data) {
  const lines = [];
  const ts = new Date().toLocaleString(getLocale(), {
    timeZone: 'Europe/London',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  lines.push(`Dash Notes — ${ts}`);
  lines.push('='.repeat(40));

  if (data.goals?.length) {
    lines.push('');
    lines.push('MY GOALS');
    lines.push('-'.repeat(20));
    data.goals.forEach((g, i) => {
      lines.push(`${i + 1}. ${g.title}`);
      if (g.why)             lines.push(`   Why: ${g.why}`);
      if (g.milestones?.length)
        g.milestones.forEach(m => lines.push(`   • ${m}`));
      if (g.reflection)      lines.push(`   Reflection: ${g.reflection}`);
      lines.push(`   Progress: ${g.progress || 0}%`);
      lines.push('');
    });
  }

  if (data.tasks?.length) {
    const labels = { q1: 'Do First', q2: 'Schedule', q3: 'Delegate', q4: 'Drop' };
    lines.push('PRIORITY MATRIX');
    lines.push('-'.repeat(20));
    Object.entries(labels).forEach(([q, label]) => {
      const qt = data.tasks.filter(t => t.quadrant === q);
      if (qt.length) {
        lines.push(`\n${label}:`);
        qt.forEach(t => lines.push(`  • ${t.text}`));
      }
    });
    lines.push('');
  }

  if (data.notes?.length) {
    lines.push('NOTES');
    lines.push('-'.repeat(20));
    data.notes.forEach(n => {
      const prefix = n.type === 'voice' ? '🎙️' : '📝';
      const date = new Date(n.created).toLocaleString(getLocale(), {
        timeZone: 'Europe/London',
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit'
      });
      lines.push(`${prefix} ${date}`);
      lines.push(n.text);
      lines.push('');
    });
  }

  lines.push('='.repeat(40));
  lines.push('Dash Notes · 3C Thread To Success™');
  return lines.join('\n');
}

// ── Share via Web Share API ────────────────────────────────
async function shareAll() {
  try {
    const data    = await exportAll();
    const content = formatAsText(data);
    if (navigator.share) {
      await navigator.share({ title: 'Dash Notes — My Backup', text: content });
    } else {
      await navigator.clipboard.writeText(content);
      showToast(t('backup.toastCopied'));
    }
  } catch (err) {
    if (err.name !== 'AbortError') showToast(t('backup.toastShareFailed'), 'error');
  }
}

// ── JSON download ──────────────────────────────────────────
async function downloadJSON() {
  try {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const date = new Date().toLocaleDateString(getLocale(), {
      timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '-');
    const a    = document.createElement('a');
    a.href = url; a.download = `dash-notes-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('backup.toastDownloaded'));
  } catch {
    showToast(t('backup.toastDownloadFailed'), 'error');
  }
}

// ── Restore from JSON ──────────────────────────────────────
async function importJSON(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.goals && !data.tasks && !data.notes) {
      showToast(t('backup.toastBadFile'), 'error');
      return;
    }
    await importAll(data);
    showToast(t('backup.toastRestored'));
    window.dispatchEvent(new CustomEvent('dash-data-restored'));
  } catch {
    showToast(t('backup.toastRestoreFailed'), 'error');
  }
}

// ── Utility ────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast--${type} show`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Init ───────────────────────────────────────────────────
function initBackup() {
  const shareBtn     = document.getElementById('share-all-btn');
  const jsonBtn      = document.getElementById('json-download-btn');
  const restoreBtn   = document.getElementById('restore-btn');
  const restoreInput = document.getElementById('restore-input');

  if (shareBtn) shareBtn.addEventListener('click', shareAll);
  if (jsonBtn)  jsonBtn.addEventListener('click', downloadJSON);
  if (restoreBtn && restoreInput) {
    restoreBtn.addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) importJSON(file);
      restoreInput.value = '';
    });
  }
}

export { initBackup, shareAll, downloadJSON, importJSON };
