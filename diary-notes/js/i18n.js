// ═══════════════════════════════════════════════════════════════
//  js/i18n.js — DIARY Notes Internationalisation Module
//  Live language: English (British).  Built so FR / DE / EL / PT can be
//  added later WITHOUT touching any other file:
//    1. add the language to LANG_META
//    2. copy the whole `en` block below into a new block with that key
//    3. translate the values (keep the keys and the {placeholders})
//    4. add the flag dropdown to app.html / setup.html (same markup as BUDGET Notes)
//  Usage:
//    initI18n();                          // apply saved/default language on load
//    t('planner.addBtn')                  // JS lookup (dot path)
//    t('planner.confirmDelete', { title })// {placeholders} are filled in
//    getLocale()                          // → 'en-GB' (for dates)
// ═══════════════════════════════════════════════════════════════

export const LANG_META = {
  en: { flag: '🇬🇧', code: 'EN', locale: 'en-GB' },
};

// ── Internal state ─────────────────────────────────────────────
let _lang = localStorage.getItem('diary-notes-lang') || 'en';
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
  localStorage.setItem('diary-notes-lang', lang);
  _applyTranslations(lang);
  window.dispatchEvent(new CustomEvent('diary-lang-changed', { detail: lang }));
}

export function getCurrentLang() { return _lang; }
export function getLocale()      { return LANG_META[_lang]?.locale || 'en-GB'; }
export function getLangMeta()    { return LANG_META[_lang] || LANG_META.en; }

/** Dot-path key lookup, with optional {placeholder} values: t('x.y', { title: 'Dentist' }) */
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
    tabs: { planner: 'Day Planner', journal: 'Journal', selfcare: 'Self-Care', backup: 'Save' },
    seed: {
      categories: ['Eating', 'Water', 'Exercising', 'Mobility', 'Emotion', 'Spiritual', 'Learning', 'Reading'],
    },
    cal: {
      prev:      'Earlier months',
      next:      'Later months',
      todayTag:  'Today',
      jumpToday: 'Go to today',
      dayAria:   '{date}',
    },
    planner: {
      title:        'Day Planner',
      subtitle:     'Your day in time order. Give each entry a title, then a note or a to-do list.',
      addBtn:       '+ Add entry',
      empty:        'Nothing planned for this day yet.',
      newTitle:     'New entry',
      labelTitle:   'Title',
      phTitle:      'e.g. Dentist',
      labelTime:    'Time',
      kindNote:     'Note',
      kindTodo:     'To-do list',
      phNote:       'Write a note…',
      phItem:       'Add an item…',
      addItem:      '+ Add item',
      saveBtn:      'Save',
      cancelBtn:    'Cancel',
      editAria:     'Edit',
      duplicateAria:'Duplicate',
      saveAria:     'Save changes',
      deleteAria:   'Delete',
      doneAria:     'Mark as done',
      itemDoneAria: 'Mark item as done',
      removeItemAria:'Remove item',
      progress:     '{done} of {total} done',
      toastSaved:   'Saved ✅',
      toastAdded:   'Entry added ✅',
      toastDuplicated:'Duplicated — now edit the copy',
      toastDeleted: 'Entry deleted',
      toastNoTitle: 'Please add a title',
      toastFailed:  'Could not save — please try again.',
      confirmDelete:'Delete “{title}”?',
    },
    reminders: {
      title:          'Reminder',
      work:           'Work',
      personal:       'Personal',
      phAdd:          'Add a reminder…',
      addBtn:         '+ Add',
      suggestLabel:   'Tap to add:',
      suggestWork:    ['Meeting with …', 'Call …', 'Urgent email reply …'],
      suggestPersonal:['Birthday of …', 'Wedding anniversary …', 'Event …'],
      doneAria:       'Mark as done',
      deleteAria:     'Delete reminder',
    },
    journal: {
      title:       'Journal',
      thoughtsTitle:'Your thoughts',
      note:        'Self-awareness, self-discovery, pattern recognition and habits. A corner for reflection, not for self-judgement, criticism or complaining. Just self-mentoring, as a best friend would.',
      ph:          'Write freely…',
      saving:      'Saving…',
      saved:       'Saved ✓',
      rateTitle:   'How satisfied are you with these today:',
      legend:      '1 is the lowest, 5 is the highest.',
      editList:    'Edit list',
      saveList:    'Save',
      cancelList:  'Cancel',
      addCat:      'Add',
      phCat:       'Add an item…',
      phName:      'Name',
      removeCat:   'Remove',
      rateAria:    '{name}: {value} out of 5',
      toastListSaved:'List saved ✅',
      toastFailed: 'Could not save — please try again.',
    },
    selfcare: {
      title:    'Self-Care',
      subtitle: 'One bullet point at a time, for the day you are on.',
      phAdd:    'Add a bullet…',
      addAria:  'Add',
      removeAria:'Remove',
      blocks: {
        affirmation: { title: 'Affirmation', prompt: 'What is your favourite today?' },
        reward:      { title: 'Reward',      prompt: 'What did you treat yourself to today?' },
        gratitude:   { title: 'Gratitude',   prompt: 'What are you grateful for today?' },
        fun:         { title: 'Fun',         prompt: 'What joy did you do for yourself today?' },
        health:      { title: 'Health',      prompt: 'What precautions did you take today?' },
        sleep:       { title: 'Sleep',       prompt: 'How much time did you rest today?' },
      },
    },
    backup: {
      title:              'Save & Restore',
      subtitle:           'Keep your diary safe. Share a day to your favourite app or save a backup file.',
      storeTitle:         'Share This Day',
      storeDesc:          "Send the day you are viewing — your planner, reminders, journal and self-care — to any app on your device. One tap opens your device's own share menu.",
      storeBtn:           'Share This Day',
      downloadTitle:      '💾 Download Backup File',
      downloadDesc:       'Downloads a complete copy of your whole diary to your device. Store it anywhere — your phone, computer, or cloud storage.',
      downloadBtn:        'Download Backup',
      restoreTitle:       '🔁 Restore from Backup',
      restoreDesc:        'Previously downloaded a backup file? Tap below to restore it. This replaces the diary currently on this device.',
      restoreBtn:         'Choose Backup File',
      restoreConfirm:     'Restore this backup? It will REPLACE the diary currently on this device.',
      bestPracticeTitle:  'Best Practice',
      bestPracticeText:   'Download a backup at the end of every month and keep the newest file. Use Share for a quick readable copy of a day. Both work together.',
      privacyNote:        '🔒 <strong style="color:var(--text-secondary);">Important:</strong> Clearing your browser\'s site data will permanently delete your DIARY Notes data. Always share or download a backup first. <strong style="color:var(--cyan);">Your data. Your responsibility. Your freedom.</strong>',
      shareTitle:         'DIARY Notes',
      shareNoTime:        'Any time',
      shareReminders:     'Reminder',
      shareJournal:       'Journal',
      shareRatings:       'How satisfied are you with these today',
      shareSelfcare:      'Self-Care',
      toastCopied:        'Copied — paste into your notes app ✅',
      toastShareFailed:   'Could not share — try downloading instead.',
      toastDownloaded:    'Backup downloaded ✅',
      toastDownloadFailed:'Download failed — try again.',
      toastBadFile:       'File not recognised — use a DIARY Notes backup.',
      toastRestored:      'Diary restored ✅',
      toastRestoreFailed: 'Restore failed — file may be damaged.',
    },
    setup: {
      title:        'Start Here',
      subtitle:     'A calm place for your day: plan it, reflect on it and look after yourself.',
      plannerTitle: 'Day Planner',
      plannerText:  'Pick a day on the calendar. Add an entry with a time and a title, then a note or a to-do list. Entries line up in time order. Use the pencil to edit, the double square to duplicate, the disk to save and the box on the left to cross a finished entry out. Reminders for Work and Personal sit underneath.',
      journalTitle: 'Journal',
      journalText:  'Write your own thoughts for the day, then rate how satisfied you are with each habit from 1 to 5. The block you tap goes dark. You can rename, add or remove anything on the list.',
      selfcareTitle:'Self-Care',
      selfcareText: 'Six small blocks for the day: Affirmation, Reward, Gratitude, Fun, Health and Sleep. Add a bullet point to each.',
      safeTitle:    'Keeping Your Data Safe',
      safeText:     'Your diary lives on this device only. If you clear your browser storage, it\'s gone. Use <strong style="color:var(--text-primary);">Save → Share</strong> or <strong style="color:var(--text-primary);">Save → Download Backup</strong> regularly.',
      qaBtn:        'Q & A',
      qaTitle:      'Questions & Answers',
      closeBtn:     'Close',
      leaveBtn:     'Leave',
      qa: [
        { q: 'Can I plan days that have not happened yet?',
          a: 'Yes. Every day from January 2026 to the end of next year is open, so you can add birthdays, appointments and reminders ahead of time.' },
        { q: 'How are my entries ordered?',
          a: 'By time, earliest first. An entry with no time goes to the end of the day.' },
        { q: 'How do I edit, duplicate or delete an entry?',
          a: 'Use the symbols beside its title. The pencil opens the entry so you can change the title, time and note or list, and the disk saves your changes. The double square makes a copy and opens it for you to edit. The bin deletes it after asking.' },
        { q: 'What is the box on the left of an entry?',
          a: 'It crosses the entry out when it is done. A to-do list also has a box for each item.' },
        { q: 'Do reminders carry over to the next day?',
          a: 'No. Reminders belong to the day you add them on. Add one on every day it matters.' },
        { q: 'How does the rating work?',
          a: 'Tap a number from 1 to 5 beside a habit. The block you tap goes dark. Tap it again to clear it. 1 is the lowest and 5 is the highest.' },
        { q: 'Can I change the list of habits?',
          a: 'Yes. Tap Edit list to rename, remove or add habits, then Save. Your past ratings are kept in your backups.' },
        { q: 'What is the Journal for?',
          a: 'Self-awareness, self-discovery, pattern recognition and habits. It is a corner for reflection, not for self-judgement, criticism or complaining. Just self-mentoring, as a best friend would.' },
        { q: 'Where is my data stored?',
          a: 'Everything stays on your device in your browser\'s storage. Nothing is sent to any server.' },
        { q: 'Does it work without internet?',
          a: 'Yes. Once you have opened the app once, it works fully offline.' },
        { q: 'How do I restore from a backup?',
          a: 'Go to Save, tap Choose Backup File and pick the file you downloaded. The restore replaces the diary currently on this device, so download a fresh backup first if you are unsure.' },
        { q: 'Best Practice: Keeping Your Diary Safe',
          a: 'Download a backup at the end of every month and keep the newest file. If your browser storage is ever cleared, that one file brings everything back.' },
      ],
    },
  },

};
