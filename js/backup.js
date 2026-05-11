// backup.js — Email backup via EmailJS + JSON export
// Dash Notes · 3C Thread To Success™

import { exportAll, importAll } from './storage.js';
import { EMAILJS_CONFIG } from '../config.js';

// ── Load EmailJS SDK ───────────────────────────────────────
function loadEmailJS() {
  return new Promise((resolve, reject) => {
    if (window.emailjs) { resolve(); return; }
    const s    = document.createElement('script');
    s.src      = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload   = () => { window.emailjs.init(EMAILJS_CONFIG.publicKey); resolve(); };
    s.onerror  = () => reject(new Error('Failed to load EmailJS'));
    document.head.appendChild(s);
  });
}

// ── Format data as readable text for email ─────────────────
function formatForEmail(data) {
  const lines = [];
  const ts    = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  lines.push(`Dash Notes Backup — ${ts} (London)`);
  lines.push('='.repeat(48));

  // Goals
  if (data.goals?.length) {
    lines.push('');
    lines.push('GOALS');
    lines.push('-'.repeat(24));
    data.goals.forEach((g, i) => {
      lines.push(`${i + 1}. ${g.title}`);
      if (g.why)        lines.push(`   Why: ${g.why}`);
      if (g.milestones?.length)
        g.milestones.forEach(m => lines.push(`   • ${m}`));
      if (g.reflection) lines.push(`   Reflection: ${g.reflection}`);
      lines.push(`   Progress: ${g.progress || 0}%`);
      lines.push('');
    });
  }

  // Tasks (Eisenhower)
  if (data.tasks?.length) {
    const quadLabels = {
      q1: 'Do First (Urgent + Important)',
      q2: 'Schedule (Important, Not Urgent)',
      q3: 'Delegate (Urgent, Not Important)',
      q4: 'Drop (Not Urgent, Not Important)',
    };
    lines.push('EISENHOWER MATRIX — TASKS');
    lines.push('-'.repeat(24));
    Object.entries(quadLabels).forEach(([q, label]) => {
      const qTasks = data.tasks.filter(t => t.quadrant === q);
      if (qTasks.length) {
        lines.push(`\n${label}:`);
        qTasks.forEach(t => lines.push(`  • ${t.text}`));
      }
    });
    lines.push('');
  }

  // Notes
  if (data.notes?.length) {
    lines.push('NOTES');
    lines.push('-'.repeat(24));
    data.notes.forEach(n => {
      const prefix = n.type === 'voice' ? '🎙️ Voice' : '📝 Note';
      const date   = new Date(n.created).toLocaleString('en-GB', {
        timeZone: 'Europe/London', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit'
      });
      lines.push(`[${prefix} — ${date}]`);
      lines.push(n.text);
      lines.push('');
    });
  }

  lines.push('='.repeat(48));
  lines.push('Sent from Dash Notes — 3C Thread To Success™');
  lines.push('www.3c-innergrowth.com');

  return lines.join('\n');
}

// ── Send email backup ──────────────────────────────────────
async function sendEmailBackup(userEmail) {
  if (!userEmail?.trim()) {
    showToast('Please enter your email address.', 'error');
    return false;
  }

  if (!EMAILJS_CONFIG.serviceId || EMAILJS_CONFIG.serviceId.startsWith('YOUR_')) {
    showToast('EmailJS not configured — see SETUP.md to connect your email.', 'error');
    return false;
  }

  showToast('Preparing your backup…');

  try {
    await loadEmailJS();
    const data    = await exportAll();
    const content = formatForEmail(data);
    const date    = new Date().toLocaleDateString('en-GB', {
      timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric'
    });

    await window.emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      {
        to_email: userEmail.trim(),
        subject:  `Dash Notes Backup — ${date}`,
        content,
        date,
      }
    );

    showToast('Backup sent to your inbox ✅');
    return true;
  } catch (err) {
    console.error('Email backup failed:', err);
    showToast('Email failed — check your config or try again.', 'error');
    return false;
  }
}

// ── JSON download ──────────────────────────────────────────
async function downloadJSON() {
  try {
    const data     = await exportAll();
    const json     = JSON.stringify(data, null, 2);
    const blob     = new Blob([json], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const date     = new Date().toLocaleDateString('en-GB', {
      timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '-');
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `dash-notes-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON backup downloaded ✅');
  } catch {
    showToast('Download failed — try again.', 'error');
  }
}

// ── JSON import / restore ──────────────────────────────────
async function importJSON(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.goals && !data.tasks && !data.notes) {
      showToast('Invalid backup file — please use a Dash Notes backup.', 'error');
      return;
    }
    await importAll(data);
    showToast('Backup restored successfully ✅');
    // Refresh all sections
    window.dispatchEvent(new CustomEvent('dash-data-restored'));
  } catch {
    showToast('Restore failed — file may be corrupted.', 'error');
  }
}

// ── Utility ────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast--${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Init ───────────────────────────────────────────────────
function initBackup() {
  // Email backup
  const emailBtn = document.getElementById('email-backup-btn');
  const emailIn  = document.getElementById('backup-email');
  if (emailBtn) {
    emailBtn.addEventListener('click', () => {
      const addr = emailIn?.value || localStorage.getItem('dash-backup-email') || '';
      sendEmailBackup(addr);
      if (addr && emailIn) localStorage.setItem('dash-backup-email', addr);
    });
  }

  // Pre-fill saved email
  if (emailIn) {
    const saved = localStorage.getItem('dash-backup-email');
    if (saved) emailIn.value = saved;
  }

  // JSON download
  const jsonBtn = document.getElementById('json-download-btn');
  if (jsonBtn) jsonBtn.addEventListener('click', downloadJSON);

  // JSON restore
  const restoreInput = document.getElementById('restore-input');
  const restoreBtn   = document.getElementById('restore-btn');
  if (restoreBtn && restoreInput) {
    restoreBtn.addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) importJSON(file);
      restoreInput.value = '';
    });
  }
}

export { initBackup, sendEmailBackup, downloadJSON, importJSON };
