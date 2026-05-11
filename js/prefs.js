// prefs.js — User preferences (localStorage)
// Dash Notes · 3C Thread To Success™

const PREFS_KEY = 'dash-notes-prefs';

const DEFAULTS = {
  shareDestination: null,   // user's preferred share target label
  backupEmail:      '',
  setupComplete:    false,
  theme:            'dark',
};

// ── Load prefs ─────────────────────────────────────────────
function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

// ── Save prefs ─────────────────────────────────────────────
function savePrefs(updates) {
  const current = loadPrefs();
  const merged  = { ...current, ...updates };
  localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  return merged;
}

// ── Specific getters/setters ───────────────────────────────
function getBackupEmail()       { return loadPrefs().backupEmail; }
function setBackupEmail(email)  { savePrefs({ backupEmail: email }); }

function getShareDest()         { return loadPrefs().shareDestination; }
function setShareDest(label)    { savePrefs({ shareDestination: label }); }

function isSetupComplete()      { return loadPrefs().setupComplete; }
function markSetupComplete()    { savePrefs({ setupComplete: true }); }

// ── Init preferences UI (setup.html) ──────────────────────
function initPrefsUI() {
  const prefs    = loadPrefs();
  const emailIn  = document.getElementById('pref-email');
  const options  = document.querySelectorAll('[data-share-dest]');
  const skipBtn  = document.getElementById('skip-setup-btn');
  const saveBtn  = document.getElementById('save-prefs-btn');

  // Pre-fill email
  if (emailIn && prefs.backupEmail) emailIn.value = prefs.backupEmail;

  // Restore selected share destination
  if (prefs.shareDestination) {
    options.forEach(el => {
      el.classList.toggle('selected', el.dataset.shareDest === prefs.shareDestination);
    });
  }

  // Select destination on click
  options.forEach(el => {
    el.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
    });
  });

  // Save and proceed to app
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const selectedDest = document.querySelector('[data-share-dest].selected');
      if (emailIn?.value.trim()) setBackupEmail(emailIn.value.trim());
      if (selectedDest)          setShareDest(selectedDest.dataset.shareDest);
      markSetupComplete();
      window.location.href = 'app.html';
    });
  }

  // Skip
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      markSetupComplete();
      window.location.href = 'app.html';
    });
  }
}

export {
  loadPrefs, savePrefs,
  getBackupEmail, setBackupEmail,
  getShareDest, setShareDest,
  isSetupComplete, markSetupComplete,
  initPrefsUI,
};
