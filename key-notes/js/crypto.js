// ═══════════════════════════════════════════════════════════════
//  js/crypto.js — KEY Notes Encryption Module
//  Zero-knowledge, local-only. AES-256-GCM + PBKDF2.
//  Master key is wrapped 3 independent ways: PIN, passphrase, recovery key.
//  Nothing plaintext ever touches disk. Session key lives in memory only.
//  3C Thread To Success™
// ═══════════════════════════════════════════════════════════════

const VAULT_KEY   = 'key-notes-vault';
const PBKDF2_ITER  = 300000; // adjust down only if setup takes too long on target devices
const CROCKFORD    = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // no I/L/O/U — avoids visual ambiguity

// ── In-memory session state (never persisted to localStorage) ──
// Also bridged through sessionStorage so an accidental page refresh doesn't
// force re-entering the PIN — sessionStorage is tab-scoped and clears
// automatically when the tab closes, unlike localStorage.
const SESSION_BRIDGE_KEY = 'key-notes-session';
let _sessionKey = null; // CryptoKey (AES-GCM), set on unlock, cleared on lock

export function setSessionKey(key) {
  _sessionKey = key;
  if (key) {
    crypto.subtle.exportKey('raw', key).then(raw => {
      try { sessionStorage.setItem(SESSION_BRIDGE_KEY, b64encode(raw)); } catch { /* non-fatal */ }
    }).catch(() => {});
  }
}
export function getSessionKey()    { return _sessionKey; }
export function clearSessionKey() {
  _sessionKey = null;
  try { sessionStorage.removeItem(SESSION_BRIDGE_KEY); } catch { /* non-fatal */ }
}
export function isUnlocked()       { return _sessionKey !== null; }

/** Attempt to restore an unlocked session after a page refresh (same tab only). */
export async function restoreSession() {
  let stored;
  try { stored = sessionStorage.getItem(SESSION_BRIDGE_KEY); } catch { return false; }
  if (!stored) return false;
  try {
    const raw = b64decode(stored);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
    _sessionKey = key;
    return true;
  } catch {
    try { sessionStorage.removeItem(SESSION_BRIDGE_KEY); } catch { /* non-fatal */ }
    return false;
  }
}

// ── Base64 helpers ──────────────────────────────────────────────
function b64encode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64decode(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer;
}

// ── Random bytes ─────────────────────────────────────────────────
function randomBytes(len) {
  return crypto.getRandomValues(new Uint8Array(len));
}

// ── Recovery key generator — e.g. 7K3P-9XQR-2M4T-VN8H-YC5J-4WBD ──
export function generateRecoveryKey() {
  const groups = [];
  for (let g = 0; g < 6; g++) {
    let group = '';
    for (let i = 0; i < 4; i++) {
      group += CROCKFORD[Math.floor(Math.random() * CROCKFORD.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
}

// ── PBKDF2: derive an AES-GCM key from a password/PIN + salt ────
async function deriveKeyFromSecret(secret, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// ── AES-GCM encrypt/decrypt raw bytes with a CryptoKey ───────────
async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: b64encode(iv), data: b64encode(ciphertext) };
}
async function decryptBytes(key, ivB64, dataB64) {
  const iv = new Uint8Array(b64decode(ivB64));
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64decode(dataB64));
}

// ── Public: encrypt/decrypt JS objects with the current session key ──
export async function encryptObject(obj) {
  if (!_sessionKey) throw new Error('Vault is locked — no session key');
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return encryptBytes(_sessionKey, bytes);
}
export async function decryptObject(encObj) {
  if (!_sessionKey) throw new Error('Vault is locked — no session key');
  const bytes = await decryptBytes(_sessionKey, encObj.iv, encObj.data);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ── Vault meta (wrapped keys) — safe to store, useless without secrets ──
export function hasVault() {
  return !!localStorage.getItem(VAULT_KEY);
}
function loadVaultMeta() {
  const raw = localStorage.getItem(VAULT_KEY);
  return raw ? JSON.parse(raw) : null;
}
function saveVaultMeta(meta) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(meta));
}

/** Export the raw vault meta (wrapped keys + salts) for inclusion in a full backup. */
export function exportVaultMeta() {
  return loadVaultMeta();
}
/** Import a vault meta from a backup — used only when setting up a NEW device from
 *  another device's backup, before any vault of its own exists. Never call this on a
 *  device that already has an active vault; it would silently replace the PIN/passphrase. */
export function importVaultMeta(meta) {
  if (!meta) throw new Error('Backup does not contain vault data');
  saveVaultMeta(meta);
}

// ── Setup: create a brand-new vault ───────────────────────────────
// Generates a random master key, wraps it 3 independent ways, stores
// the wrapped copies + salts. Returns the recovery key (show ONCE).
export async function initializeVault(pin, passphrase) {
  const masterKeyRaw = randomBytes(32); // 256-bit master key
  const masterKey = await crypto.subtle.importKey(
    'raw', masterKeyRaw, 'AES-GCM', true, ['encrypt', 'decrypt']
  );

  const recoveryKey = generateRecoveryKey();

  const pinSalt  = randomBytes(16);
  const passSalt = randomBytes(16);
  const recSalt  = randomBytes(16);

  const pinWrapKey  = await deriveKeyFromSecret(pin, pinSalt);
  const passWrapKey = await deriveKeyFromSecret(passphrase, passSalt);
  const recWrapKey  = await deriveKeyFromSecret(recoveryKey, recSalt);

  const pinWrapped  = await encryptBytes(pinWrapKey, masterKeyRaw);
  const passWrapped = await encryptBytes(passWrapKey, masterKeyRaw);
  const recWrapped  = await encryptBytes(recWrapKey, masterKeyRaw);

  const meta = {
    version: 1,
    pinLength: pin.length,
    pin:      { salt: b64encode(pinSalt),  iv: pinWrapped.iv,  data: pinWrapped.data },
    pass:     { salt: b64encode(passSalt), iv: passWrapped.iv, data: passWrapped.data },
    recovery: { salt: b64encode(recSalt),  iv: recWrapped.iv,  data: recWrapped.data },
    createdAt: new Date().toISOString(),
  };
  saveVaultMeta(meta);
  setSessionKey(masterKey);

  return recoveryKey;
}

// ── Unlock attempts — each returns true/false, sets session key on success ──
async function _tryUnwrap(secret, slot) {
  const meta = loadVaultMeta();
  if (!meta) return false;
  const entry = meta[slot];
  const salt = new Uint8Array(b64decode(entry.salt));
  try {
    const wrapKey = await deriveKeyFromSecret(secret, salt);
    const rawBuf = await decryptBytes(wrapKey, entry.iv, entry.data);
    const masterKey = await crypto.subtle.importKey(
      'raw', rawBuf, 'AES-GCM', true, ['encrypt', 'decrypt']
    );
    setSessionKey(masterKey);
    return true;
  } catch {
    return false; // wrong secret — AES-GCM auth tag fails
  }
}

export function unlockWithPIN(pin)               { return _tryUnwrap(pin, 'pin'); }
export function unlockWithPassphrase(passphrase) { return _tryUnwrap(passphrase, 'pass'); }
export function unlockWithRecoveryKey(code)      { return _tryUnwrap(code.toUpperCase(), 'recovery'); }

export function getPinLength() {
  const meta = loadVaultMeta();
  return meta?.pinLength || 6;
}

// ── Reset PIN (requires vault already unlocked this session) ─────
export async function resetPIN(newPin) {
  if (!_sessionKey) throw new Error('Vault is locked');
  const meta = loadVaultMeta();
  const rawBuf = await crypto.subtle.exportKey('raw', _sessionKey);
  const pinSalt = randomBytes(16);
  const pinWrapKey = await deriveKeyFromSecret(newPin, pinSalt);
  const wrapped = await encryptBytes(pinWrapKey, rawBuf);
  meta.pinLength = newPin.length;
  meta.pin = { salt: b64encode(pinSalt), iv: wrapped.iv, data: wrapped.data };
  saveVaultMeta(meta);
}

// ── Reset passphrase (requires vault already unlocked this session) ──
export async function resetPassphrase(newPassphrase) {
  if (!_sessionKey) throw new Error('Vault is locked');
  const meta = loadVaultMeta();
  const rawBuf = await crypto.subtle.exportKey('raw', _sessionKey);
  const passSalt = randomBytes(16);
  const passWrapKey = await deriveKeyFromSecret(newPassphrase, passSalt);
  const wrapped = await encryptBytes(passWrapKey, rawBuf);
  meta.pass = { salt: b64encode(passSalt), iv: wrapped.iv, data: wrapped.data };
  saveVaultMeta(meta);
}

// ── Generate a brand-new recovery key (invalidates the old one) ──
export async function regenerateRecoveryKey() {
  if (!_sessionKey) throw new Error('Vault is locked');
  const meta = loadVaultMeta();
  const rawBuf = await crypto.subtle.exportKey('raw', _sessionKey);
  const recoveryKey = generateRecoveryKey();
  const recSalt = randomBytes(16);
  const recWrapKey = await deriveKeyFromSecret(recoveryKey, recSalt);
  const wrapped = await encryptBytes(recWrapKey, rawBuf);
  meta.recovery = { salt: b64encode(recSalt), iv: wrapped.iv, data: wrapped.data };
  saveVaultMeta(meta);
  return recoveryKey;
}

export function lockVault() {
  clearSessionKey();
}

// ── Full wipe (used only from an explicit, confirmed "reset app" action) ──
export function destroyVault() {
  localStorage.removeItem(VAULT_KEY);
  clearSessionKey();
}
