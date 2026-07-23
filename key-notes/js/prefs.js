// prefs.js — User preferences (localStorage)
// KEY Notes · 3C Thread To Success™
//
// Simplified from the Dash Notes version: onboarding here happens on
// index.html (PIN/passphrase/recovery-key setup, driven by crypto.js),
// so the share-destination picker isn't needed. Kept: backup email
// (used once, optionally, to email the recovery key at setup) and a
// generic prefs store for anything added later.

const PREFS_KEY = 'key-notes-prefs';

const DEFAULTS = {
  backupEmail: '',
  theme:       'dark',
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function savePrefs(updates) {
  const current = loadPrefs();
  const merged  = { ...current, ...updates };
  localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  return merged;
}

function getBackupEmail()      { return loadPrefs().backupEmail; }
function setBackupEmail(email) { savePrefs({ backupEmail: email }); }

export {
  loadPrefs, savePrefs,
  getBackupEmail, setBackupEmail,
};
