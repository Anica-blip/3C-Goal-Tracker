// ═══════════════════════════════════════════════════════════════
//  js/i18n.js — BUDGET Notes Internationalisation Module
//  Live language: English (British).  Built so FR / DE / EL / PT can be
//  added later WITHOUT touching any other file:
//    1. add the language to LANG_META
//    2. copy the whole `en` block below into a new block with that key
//    3. translate the values (keep the keys and the {placeholders})
//    4. add the flag dropdown to app.html / setup.html (same markup as Dash Notes)
//  Usage:
//    initI18n();                          // apply saved/default language on load
//    t('line.addTitle')                   // JS lookup (dot path)
//    t('line.hintForward', { month })     // {placeholders} are filled in
//    getLocale()                          // → 'en-GB' (for dates + currency)
// ═══════════════════════════════════════════════════════════════

export const LANG_META = {
  en: { flag: '🇬🇧', code: 'EN', locale: 'en-GB' },
};

// ── Internal state ─────────────────────────────────────────────
let _lang = localStorage.getItem('budget-notes-lang') || 'en';
if (!LANG_META[_lang]) _lang = 'en';

// ── Public API ─────────────────────────────────────────────────

/** Apply saved/default language on page load */
export function initI18n() {
  _applyTranslations(_lang);
}

/** Set a new language, persist it, re-apply, and dispatch event */
export function setLanguage(lang) {
  if (!translations[lang]) return;
  _lang = lang;
  localStorage.setItem('budget-notes-lang', lang);
  _applyTranslations(lang);
  window.dispatchEvent(new CustomEvent('budget-lang-changed', { detail: lang }));
}

export function getCurrentLang() { return _lang; }
export function getLocale()      { return LANG_META[_lang]?.locale || 'en-GB'; }
export function getLangMeta()    { return LANG_META[_lang] || LANG_META.en; }

/** Dot-path key lookup, with optional {placeholder} values: t('x.y', { month: 'October 2026' }) */
export function t(key, vars) {
  const data = translations[_lang] || translations.en;
  let val = _getKey(data, key);
  if (val === undefined) val = _getKey(translations.en, key);
  if (val === undefined) return key;
  if (vars && typeof val === 'string') {
    return val.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
  }
  return val;
}

/**
 * Renders the Q&A list for setup.html.
 * @param {string} containerId - id of the <div> to populate
 */
export function renderSetupQA(containerId = 'qa-list') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const qa = t('setup.qa');
  if (!Array.isArray(qa)) return;

  container.innerHTML = qa.map((item, i) => {
    const isBestPractice = i === qa.length - 1;
    if (isBestPractice) {
      return `
        <div style="background:rgba(0,229,212,0.06); border:1px solid rgba(0,229,212,0.2);
          border-radius:var(--radius-sm); padding:14px;">
          <p style="font-size:0.85rem; font-weight:700; color:var(--cyan); margin-bottom:6px;">
            ${_esc(item.q)}
          </p>
          <p style="font-size:0.84rem; color:var(--text-secondary); line-height:1.65; margin:0;">
            ${_esc(item.a)}
          </p>
        </div>`;
    }
    return `
      <div>
        <p style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
          ${_esc(item.q)}
        </p>
        <p style="font-size:0.84rem; color:var(--text-secondary); line-height:1.65; margin:0;">
          ${_esc(item.a)}
        </p>
      </div>`;
  }).join('');
}

// ── Internal helpers ───────────────────────────────────────────

function _getKey(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _applyTranslations(lang) {
  const data = translations[lang] || translations.en;

  // Plain text
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = _getKey(data, el.getAttribute('data-i18n'));
    if (val !== undefined) el.textContent = val;
  });

  // HTML content
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const val = _getKey(data, el.getAttribute('data-i18n-html'));
    if (val !== undefined) el.innerHTML = val;
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const val = _getKey(data, el.getAttribute('data-i18n-placeholder'));
    if (val !== undefined) el.placeholder = val;
  });

  document.documentElement.lang = LANG_META[lang]?.locale || 'en-GB';

  // Re-render Q&A if on setup page
  renderSetupQA('qa-list');
}


// ═══════════════════════════════════════════════════════════════
//  TRANSLATIONS
// ═══════════════════════════════════════════════════════════════
const translations = {

  // ── ENGLISH (British) ─────────────────────────────────────────
  en: {
    nav: {
      startHere: '<span style="display:block;">Start</span><span style="display:block;">Here</span>',
    },
    tabs: {
      planner: 'Planner',
      summary: 'Summary',
      archive: 'Archive',
      backup:  'Save',
    },
    seed: {
      income:  ['Salary', 'Side Income / Gift', 'Business Income', 'Other Income'],
      savings: ['Track bill expenses', 'Save at least …', 'Invest …'],
    },
    planner: {
      title:    'Monthly Planner',
      subtitle: 'Enter your budget once — it carries forward. Edit any month without touching the ones before it.',
    },
    month: {
      prev:        'Earlier months',
      next:        'Later months',
      current:     'This month',
      thisMonthTag:'Current month',
    },
    block: {
      income:   'Income',
      savings:  'Savings & Goals',
      fixed:    'Fixed Expenses',
      variable: 'Variable Expenses',
      add:      '+ Add line',
      empty:    'Nothing here yet — tap “+ Add line”.',
    },
    total: {
      income:   'Total Income',
      savings:  'Total Savings & Investments',
      fixed:    'Total Fixed Expenses',
      variable: 'Total Variable Expenses',
    },
    sum: {
      title:    'Monthly Summary',
      thisMonth:'This month',
      lastYear: 'Last year',
      income:   'Total Income',
      fixed:    'Total Fixed Expenditure',
      variable: 'Total Variable Expenses',
      savings:  'Total Savings & Investments',
      left:     'Money Left',
      formula:  'Income − Fixed − Variable',
      none:     '—',
    },
    line: {
      addTitle:     'Add line',
      editTitle:    'Edit line',
      labelDesc:    'Description',
      labelAmount:  'Amount (€)',
      phLabel:      'e.g. Rent',
      onceText:     '<strong>Once</strong> — this month only. Also applies to Duplicate and Remove.',
      hintForward:  'Applies to {month} and every month after. Earlier months stay as they are.',
      hintOnce:     'Applies to {month} only. Other months are not changed.',
      addBtn:       'Add line',
      addNextBtn:   'Add & add another',
      updateBtn:    'Save changes',
      duplicateBtn: 'Duplicate',
      removeBtn:    'Remove',
      closeAria:    'Close',
      doneAria:     'Mark as done',
      onceBadge:    'once',
      toastAdded:   'Line added ✅',
      toastUpdated: 'Saved ✅',
      toastNoChange:'No changes to save',
      toastDuplicated:'Duplicated — now edit the copy',
      toastRemoved: 'Line removed',
      toastNoLabel: 'Please add a description',
      toastBadAmount:'Enter an amount like 120.50',
      toastFailed:  'Could not save — please try again.',
      confirmRemoveForward: 'Remove “{label}” from {month} onwards? Earlier months are not changed.',
      confirmRemoveOnce:    'Remove “{label}” from {month} only?',
    },
    year: {
      title:     'Year at a Glance',
      subtitle:  'Every month side by side.',
      prev:      'Earlier year',
      next:      'Later year',
      month:     'Month',
      income:    'Income',
      fixed:     'Fixed',
      variable:  'Variable',
      savings:   'Savings',
      left:      'Money Left',
      total:     'Year total',
      totalOf:   '{year} total',
      none:      '—',
    },
    archive: {
      title:       'Archive',
      subtitle:    'Each year closes after 31 December (Lisbon time) and is kept here as a read-only record.',
      inProgress:  'In progress',
      archived:    'Archived',
      unlocked:    'Unlocked',
      back:        '‹ Years',
      lockedNote:  'Read-only. Unlock only to correct a mistake — edits here default to “Once”, so other years stay untouched.',
      unlockedNote:'Unlocked for corrections. Lock it again when you are done.',
      liveNote:    'This year is still running — you can edit it here or in the Planner.',
      unlockBtn:   'Unlock to edit',
      lockBtn:     'Lock again',
      confirmUnlock:'Unlock {year} for editing?',
      empty:       'No years yet.',
      openAria:    'Open {year}',
    },
    backup: {
      title:              'Save & Restore',
      subtitle:           'Keep your budget safe. Share it to your favourite app or save a backup file.',
      storeTitle:         'Share Your Budget',
      storeDesc:          "Send this month's budget and your year overview to any app on your device — your notes app, a message to yourself, or anywhere you keep things safe. One tap opens your device's own share menu.",
      storeBtn:           'Share My Budget',
      downloadTitle:      '💾 Download Backup File',
      downloadDesc:       'Downloads a complete copy of your budget to your device. Store it anywhere — your phone, computer, or cloud storage.',
      downloadBtn:        'Download Backup',
      restoreTitle:       '🔁 Restore from Backup',
      restoreDesc:        'Previously downloaded a backup file? Tap below to restore it. This replaces the budget currently on this device.',
      restoreBtn:         'Choose Backup File',
      restoreConfirm:     'Restore this backup? It will REPLACE the budget currently on this device.',
      bestPracticeTitle:  'Best Practice',
      bestPracticeText:   'Download a backup at the end of every month and keep the newest file. Use Share for a quick readable copy. Both work together.',
      privacyNote:        '🔒 <strong style="color:var(--text-secondary);">Important:</strong> Clearing your browser\'s site data will permanently delete your Budget Notes data. Always share or download a backup first. <strong style="color:var(--cyan);">Your data. Your responsibility. Your freedom.</strong>',
      shareTitle:         'BUDGET Notes',
      shareYear:          'Year overview {year}',
      shareLeft:          'Money Left',
      toastCopied:        'Copied — paste into your notes app ✅',
      toastShareFailed:   'Could not share — try downloading instead.',
      toastDownloaded:    'Backup downloaded ✅',
      toastDownloadFailed:'Download failed — try again.',
      toastBadFile:       'File not recognised — use a Budget Notes backup.',
      toastRestored:      'Budget restored ✅',
      toastRestoreFailed: 'Restore failed — file may be damaged.',
    },
    setup: {
      title:      'Start Here',
      subtitle:   "There's not much to set up — enter your budget once and it looks after the months ahead.",
      carryTitle: 'Forward or Once',
      carryText:  'Whatever you enter carries <strong style="color:var(--text-primary);">forward</strong> to every month after it. Change something in October and November onwards follow — September stays exactly as it was. Tick <strong style="color:var(--text-primary);">Once</strong> when a change is a one-off, and no other month is touched.',
      monthsTitle:'Months and Years',
      monthsText: 'The Planner shows three months at a time. Use ‹ › to move along, and the current month is always highlighted. When 31 December passes, the year moves into the Archive as a read-only record and the new year starts.',
      safeTitle:  'Keeping Your Data Safe',
      safeText:   'Your budget lives on this device only. If you clear your browser storage, it\'s gone. Use <strong style="color:var(--text-primary);">Save → Share</strong> or <strong style="color:var(--text-primary);">Save → Download Backup</strong> regularly.',
      qaBtn:      'Q & A',
      qaTitle:    'Questions & Answers',
      closeBtn:   'Close',
      leaveBtn:   'Leave',
      qa: [
        { q: 'How does the budget carry forward?',
          a: 'Each line remembers its history. When you add or change a line it applies from that month onwards. Earlier months are never rewritten, and a later change you made on purpose is kept.' },
        { q: 'What does “Once” do?',
          a: 'Tick Once when a change is a one-off — a bonus, a repair, a gift. It changes that month only; every other month stays as it is. Once also applies when you Duplicate or Remove a line.' },
        { q: 'Can I edit any month at any time?',
          a: 'Yes. Tap any line to change its description or amount. Months of the current year stay editable. Closed years are read-only until you unlock them in the Archive.' },
        { q: 'How do I delete or duplicate a line?',
          a: 'Tap the line, then choose Remove or Duplicate. Duplicate places a copy directly underneath and opens it so you can change the text. Remove without Once ticked removes the line from that month onwards; earlier months keep it.' },
        { q: 'How many lines can I add?',
          a: 'As many as you like. Each block simply grows as you add lines.' },
        { q: 'What is Money Left?',
          a: 'Total Income minus Total Fixed Expenditure minus Total Variable Expenses. Savings & Investments are shown in the summary for reference and are not taken off.' },
        { q: 'How does the Archive work?',
          a: 'After 31 December (Lisbon time) the year closes and appears in the Archive, opening on its last three months. It is read-only so the record stays true. If you spot a mistake, unlock the year, fix it, and lock it again.' },
        { q: 'Where is my data stored?',
          a: 'Everything stays on your device in your browser\'s storage. Nothing is sent to any server.' },
        { q: 'Does it work without internet?',
          a: 'Yes — once you have opened the app once, it works fully offline.' },
        { q: 'How do I restore from a backup?',
          a: 'Go to Save, tap Choose Backup File and pick the file you downloaded. The restore replaces the budget currently on this device, so download a fresh backup first if you are unsure.' },
        { q: 'Best Practice — Keeping Your Budget Safe',
          a: 'Download a backup at the end of every month and keep the newest file. If your browser storage is ever cleared, that one file brings everything back.' },
      ],
    },
  },

};
