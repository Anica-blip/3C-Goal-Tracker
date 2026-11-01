// backup.js — Share a day, download and restore
// DIARY Notes · 3C Thread To Success™

import * as E from './engine.js';
import * as store from './store.js';
import { t, getLocale } from './i18n.js';
import { dayLong, showToast } from './ui.js';

// ── Readable text version of the day being viewed ──────────
function formatAsText() {
  const s = store.getState();
  const day = s.selected;
  const lines = [];

  lines.push(`${t('backup.shareTitle')} — ${dayLong(day)}`);
  lines.push('='.repeat(40));

  // Day planner
  const entries = E.sortEntries(s.entries.filter(e => e.date === day));
  if (entries.length) {
    lines.push('');
    lines.push(t('planner.title').toUpperCase());
    lines.push('-'.repeat(20));
    entries.forEach(e => {
      lines.push(`${e.done ? '☑' : '☐'} ${e.time || t('backup.shareNoTime')}  ${e.title}`);
      if (e.kind === 'todo') e.items.forEach(i => lines.push(`     ${i.done ? '☑' : '☐'} ${i.text}`));
      else if (e.text.trim()) e.text.trim().split('\n').forEach(l => lines.push(`     ${l}`));
    });
  }

  // Reminders
  const rem = s.reminders.filter(r => r.date === day).sort((a, b) => a.seq - b.seq);
  if (rem.length) {
    lines.push('');
    lines.push(t('backup.shareReminders').toUpperCase());
    lines.push('-'.repeat(20));
    E.GROUPS.forEach(g => {
      const rows = rem.filter(r => r.group === g);
      if (!rows.length) return;
      lines.push(t('reminders.' + g));
      rows.forEach(r => lines.push(`  ${r.done ? '☑' : '☐'} ${r.text}`));
    });
  }

  // Journal
  const j = s.journal.find(x => x.date === day);
  if (j && j.text.trim()) {
    lines.push('');
    lines.push(t('backup.shareJournal').toUpperCase());
    lines.push('-'.repeat(20));
    lines.push(j.text.trim());
  }

  // Ratings
  const rated = s.categories
    .slice().sort((a, b) => a.seq - b.seq)
    .map(c => ({ name: c.name, r: s.ratings.find(x => x.id === `${day}|${c.id}`) }))
    .filter(x => x.r);
  if (rated.length) {
    lines.push('');
    lines.push(t('backup.shareRatings').toUpperCase());
    lines.push('-'.repeat(20));
    rated.forEach(x => lines.push(`${x.name}: ${x.r.value}/5`));
  }

  // Self-care
  const care = s.selfcare.filter(c => c.date === day);
  if (care.length) {
    lines.push('');
    lines.push(t('backup.shareSelfcare').toUpperCase());
    lines.push('-'.repeat(20));
    E.BLOCKS.forEach(b => {
      const rows = care.filter(c => c.block === b).sort((x, y) => x.seq - y.seq);
      if (!rows.length) return;
      lines.push(t(`selfcare.blocks.${b}.title`));
      rows.forEach(r => lines.push(`  • ${r.text}`));
    });
  }

  lines.push('');
  lines.push('='.repeat(40));
  lines.push('DIARY Notes · 3C Thread To Success™');
  return lines.join('\n');
}

// ── Share via Web Share API ────────────────────────────────
async function shareDay() {
  try {
    const content = formatAsText();
    if (navigator.share) {
      await navigator.share({ title: `${t('backup.shareTitle')} — ${dayLong(store.getState().selected)}`, text: content });
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
    const data = await store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toLocaleDateString(getLocale(), {
      timeZone: E.TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric',
    }).replace(/\//g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `diary-notes-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('backup.toastDownloaded'));
  } catch {
    showToast(t('backup.toastDownloadFailed'), 'error');
  }
}

// ── Restore from JSON (replaces the current diary) ─────────
async function importJSON(file) {
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    showToast(t('backup.toastRestoreFailed'), 'error');
    return;
  }
  if (!data || data.app !== 'diary-notes') {
    showToast(t('backup.toastBadFile'), 'error');
    return;
  }
  if (!confirm(t('backup.restoreConfirm'))) return;
  try {
    await store.restoreData(data);
    showToast(t('backup.toastRestored'));
  } catch {
    showToast(t('backup.toastRestoreFailed'), 'error');
  }
}

// ── Init ───────────────────────────────────────────────────
export function initBackup() {
  const shareBtn     = document.getElementById('share-all-btn');
  const jsonBtn      = document.getElementById('json-download-btn');
  const restoreBtn   = document.getElementById('restore-btn');
  const restoreInput = document.getElementById('restore-input');

  if (shareBtn) shareBtn.addEventListener('click', shareDay);
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

export { shareDay, downloadJSON, importJSON, formatAsText };
