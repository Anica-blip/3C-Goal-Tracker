
// ─── SOURCE Notes — Locked folder: PIN, emergency phrase and encryption ──────
// One random master key (MK) encrypts every Locked file. It is kept in two locked copies:
//   daily lock     : 8-digit PIN
//   emergency lock : a short phrase (4+ words), used only after a fresh GitHub sign-in
// Each copy opens only with what Chef knows PLUS a half held by the Worker (made from the
// Worker's LOCK_SECRET). The PIN and the phrase never leave this browser:
//   PIN / phrase + salt → PBKDF2 (250,000 rounds) → "proof"   (the Worker keeps only a keyed hash)
//   lock key = HMAC(Worker's half, proof)                       → opens the locked copy of MK
// The Worker hands over its half and the locked copy only after a correct proof, and counts
// wrong guesses. MK is kept on this device as a non-exportable key, so the PIN is asked once
// per browser. Clearing the browser's site data, or opening another device, asks again.
// If the PIN is forgotten: "Forgot PIN?" → fresh GitHub sign-in + the emergency phrase.

import { api, setLockToken, getLockToken } from './api.js';

const ITER = 250000;
const MAGIC = new Uint8Array([0x53, 0x4e, 0x4c, 0x31]);   // "SNL1"
const te = new TextEncoder();

const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ── key kept on this device (IndexedDB) ──────────────────────────────────────
const DB_NAME = 'source-notes-vault', STORE = 'keys';
let memoryKey = null;

function idb() {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}
async function keyPut(key) {
    memoryKey = key;
    try {
        const db = await idb();
        await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(key, 'main'); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch { /* memory only: asks again next visit */ }
}
async function keyGet() {
    if (memoryKey) return memoryKey;
    try {
        const db = await idb();
        memoryKey = await new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get('main'); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
    } catch { memoryKey = null; }
    return memoryKey;
}
async function keyClear() {
    memoryKey = null;
    try {
        const db = await idb();
        await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete('main'); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch { /* ignore */ }
}

// ── proofs and locked copies ─────────────────────────────────────────────────
// The PIN is digits only. The phrase ignores capital letters and extra spaces.
export const cleanPhrase = t => String(t || '').normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ');
export const phraseWords = t => cleanPhrase(t).split(' ').filter(Boolean).length;

async function stretch(secret, saltB64) {
    const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: unb64(saltB64), iterations: ITER, hash: 'SHA-256' }, base, 256));
    return b64(bits);                                        // the "proof"
}

// lock key = HMAC(Worker's half, "wrap-A:" + proof)  (or "wrap-B:" for the phrase lock)
async function lockKey(halfB64, which, proofB64) {
    const hk = await crypto.subtle.importKey('raw', unb64(halfB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const raw = new Uint8Array(await crypto.subtle.sign('HMAC', hk, te.encode('wrap-' + which + ':' + proofB64)));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function lockCopy(kek, mkRaw) {                        // iv(12) + AES-GCM(MK)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, mkRaw));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return b64(out);
}

async function openCopy(kek, copyB64) {                      // → MK raw bytes
    const buf = unb64(copyB64);
    try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, kek, buf.slice(12))); }
    catch { throw new Error('The Locked folder could not be opened. The Worker’s LOCK_SECRET may have been changed.'); }
}

const asKey = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
const rnd = n => crypto.getRandomValues(new Uint8Array(n));

// ── public ───────────────────────────────────────────────────────────────────
export async function status() {
    return api.get('/locked/status');   // { configured:false, half } | { configured:true, saltA, saltB }
}

export async function isUnlocked() {
    return !!getLockToken() && !!(await keyGet());
}

// First set-up: makes MK, locks one copy with the PIN and one with the phrase.
export async function setup(pin, phrase, st) {
    const saltA = b64(rnd(16)), saltB = b64(rnd(16));
    const proofA = await stretch(pin, saltA);
    const proofB = await stretch(cleanPhrase(phrase), saltB);
    const mk = rnd(32);
    const wrapA = await lockCopy(await lockKey(st.half, 'A', proofA), mk);
    const wrapB = await lockCopy(await lockKey(st.half, 'B', proofB), mk);
    const { token } = await api.post('/locked/setup', { saltA, saltB, proofA, proofB, wrapA, wrapB });
    const key = await asKey(mk); mk.fill(0);
    await keyPut(key); setLockToken(token);
}

// Daily unlock with the PIN.
export async function unlock(pin, st) {
    const proof = await stretch(pin, st.saltA);
    const r = await api.post('/locked/unlock', { proof });
    const mk = await openCopy(await lockKey(r.half, 'A', proof), r.wrapA);
    const key = await asKey(mk); mk.fill(0);
    await keyPut(key); setLockToken(r.token);
}

// Emergency: the phrase opens MK, then a new PIN is set. (Needs a fresh GitHub sign-in.)
export async function recover(phrase, newPin, st) {
    const proofB = await stretch(cleanPhrase(phrase), st.saltB);
    const r = await api.post('/locked/recover', { proof: proofB });
    const mk = await openCopy(await lockKey(r.half, 'B', proofB), r.wrapB);

    const saltA = b64(rnd(16));
    const proofA = await stretch(newPin, saltA);
    const wrapA = await lockCopy(await lockKey(r.half, 'A', proofA), mk);
    setLockToken(r.token);                                   // the new-PIN call needs the unlock token
    let out;
    try { out = await api.post('/locked/pin', { saltA, proofA, wrapA }, { lock: true }); }
    catch (e) { setLockToken(''); mk.fill(0); throw e; }
    const key = await asKey(mk); mk.fill(0);
    await keyPut(key); setLockToken(out.token);
}

export async function lockDevice() {
    await keyClear(); setLockToken('');
}

export async function encryptBlob(blob) {
    const key = await keyGet();
    if (!key) throw new Error('The Locked folder is locked on this device');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await blob.arrayBuffer()));
    return new Blob([MAGIC, iv, ct], { type: 'application/octet-stream' });
}

export async function decryptBlob(blob) {
    const key = await keyGet();
    if (!key) throw new Error('The Locked folder is locked on this device');
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (buf.length < 32 || buf[0] !== MAGIC[0] || buf[1] !== MAGIC[1] || buf[2] !== MAGIC[2] || buf[3] !== MAGIC[3]) {
        throw new Error('This file is not in the Locked format');
    }
    try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(4, 16) }, key, buf.slice(16));
        return new Blob([pt]);
    } catch {
        throw new Error('Could not decrypt this file. Is this the right Locked folder?');
    }
}

// Stored size minus the format overhead (4 magic + 12 iv + 16 tag)
export const plainSize = n => Math.max(0, (Number(n) || 0) - 32);
