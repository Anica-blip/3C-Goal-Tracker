// backup.js — Share, download and restore
// BUDGET Notes · 3C Thread To Success™

import * as E from './engine.js';
import * as store from './store.js';
import { t, getLocale } from './i18n.js';
import { money, monthLong, monthShort, showToast } from './ui.js';

// ── Readable text version (for the share menu) ─────────────
function formatAsText() {
  const s = store.getState();
  const month = s.today;
  const lines = [];

  lines.push(`${t('backup.shareTitle')} — ${monthLong(month)}`);
  lines.push('='.repeat(40));

  const sections = [
    ['income',   'block.income',   'total.income'],
    ['savings',  'block.savings',  'total.savings'],
    ['fixed',    'block.fixed',    'total.fixed'],
    ['variable', 'block.variable', 'total.variable'],
  ];
  const totals = E.monthTotals(s.lines, month);

  sections.forEach(([sec, titleKey, totalKey]) => {
    lines.push('');
    lines.push(t(titleKey).toUpperCase());
    lines.push('-'.repeat(20));
    const rows = E.monthLines(s.lines, sec, month);
    rows.forEach(r => {
      const tick = sec === 'savings' ? (r.done ? '☑ ' : '☐ ') : '• ';
      lines.push(`${tick}${r.label}${r.amount ? ` — ${money(r.amount)}` : ''}`);
    });
    lines.push(`${t(totalKey)}: ${money(totals[sec])}`);
  });

  lines.push('');
  lines.push(`${t('backup.shareLeft').toUpperCase()}: ${money(totals.moneyLeft)}`);

  const year = E.yearOf(month);
  const yt = E.yearTotals(s.lines, year);
  if (yt.total.hasFigures) {
    lines.push('');
    lines.push(t('backup.shareYear', { year }));
    lines.push('-'.repeat(20));
    yt.months.filter(m => m.hasFigures).forEach(m => {
      lines.push(`${monthShort(m.key)}: ${t('year.income')} ${money(m.income)} · ${t('year.fixed')} ${money(m.fixed)} · ${t('year.variable')} ${money(m.variable)} · ${t('year.left')} ${money(m.moneyLeft)}`);
    });
    lines.push(`${t('year.total')}: ${t('year.left')} ${money(yt.total.moneyLeft)}`);
  }

  lines.push('');
  lines.push('='.repeat(40));
  lines.push('BUDGET Notes · 3C Thread To Success™');
  return lines.join('\n');
}

// ── Share via Web Share API ────────────────────────────────
async function shareAll() {
  try {
    const content = formatAsText();
    if (navigator.share) {
      await navigator.share({ title: `${t('backup.shareTitle')} — ${monthLong(store.getState().today)}`, text: content });
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
    a.download = `budget-notes-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('backup.toastDownloaded'));
  } catch {
    showToast(t('backup.toastDownloadFailed'), 'error');
  }
}

// ── Restore from JSON (replaces the current budget) ────────
async function importJSON(file) {
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    showToast(t('backup.toastRestoreFailed'), 'error');
    return;
  }
  if (!data || data.app !== 'budget-notes' || !Array.isArray(data.lines)) {
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

export { shareAll, downloadJSON, importJSON, formatAsText };
