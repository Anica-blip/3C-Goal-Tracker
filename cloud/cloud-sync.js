// cloud/cloud-sync.js
// Cloud saving layer for DASH, KEY, BUDGET and DIARY Notes — 3C Thread To Success™
//
// WHAT IT DOES
//   Only when Chef is signed in (Supabase GitHub sign-in found in this browser), it copies the app's
//   whole export to the Notes Worker (notes.threadcommand.center) and brings it back down on another device.
//   With no sign-in found it does nothing at all: no scripts loaded, no calls made.
//
// HOW AN APP USES IT
//   import { connect, changed } from '../cloud/cloud-sync.js';        (path depends on the app's folder)
//   connect({ app, exportFn, replaceFn, isEmpty, afterReplace });      once, when the app's storage loads
//   changed(app);                                                      after every save or delete
//
// RULES IT FOLLOWS
//   • Notes stay in the browser first. The cloud copy is made about 2 seconds after the last change.
//   • Each push says which cloud version it was based on. If the cloud has moved on, the Worker answers 409,
//     the newer copy comes down, and Chef is told in one line. The copy that was replaced is kept in the
//     browser (database "3c-cloud-undo") as a one-step undo.
//   • A device that has never connected and holds notes while the cloud also holds notes is asked once
//     (use the cloud copy / keep this device's notes), and its notes are downloaded as a backup file first.
//   • Offline: notes save in the browser, the cloud icon shows "not saved yet", and the push is made
//     when the connection returns.
//   • A refusal (403) means the signed-in account is not Chef: the layer goes quiet and the app behaves as public.
//   • Messages here are for Chef only, in British English.

const WORKER_URL      = 'https://notes.threadcommand.center';
const SUPABASE_SCRIPT = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const PUSH_DELAY      = 2000;
const RETRY_DELAY     = 30000;

const apps = {};
let sbClient  = null;
let sbLoading = null;

const stateKey = app => '3c-cloud:' + app;

// ── Is Chef signed in on this browser? ───────────────────────────────────────────────────────────
// Supabase keeps the session in localStorage under  sb-<project>-auth-token.
function hasSignIn() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (/^sb-[a-z0-9]+-auth-token$/i.test(k) && localStorage.getItem(k)) return true;
        }
    } catch { /* storage blocked: treat as public */ }
    return false;
}

// ── Small saved state per app: connected before? which cloud version? changes waiting? ──────────
function loadState(app) {
    try {
        const s = JSON.parse(localStorage.getItem(stateKey(app)) || 'null');
        if (s && typeof s === 'object') {
            return { connected: !!s.connected, version: Number(s.version) || 0, dirty: !!s.dirty };
        }
    } catch { /* fall through */ }
    return { connected: false, version: 0, dirty: false };
}
function saveState(a) {
    try {
        localStorage.setItem(stateKey(a.app), JSON.stringify({ connected: a.connected, version: a.version, dirty: a.dirty }));
    } catch { /* ignore */ }
}

// ── Sign-in token (the Supabase script is loaded only now, and only for a signed-in browser) ────
function loadSupabase() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (sbLoading) return sbLoading;
    sbLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SUPABASE_SCRIPT;
        s.onload  = () => resolve();
        s.onerror = () => { sbLoading = null; reject(new Error('Could not load the sign-in script')); };
        document.head.appendChild(s);
    });
    return sbLoading;
}

async function getToken() {
    if (!sbClient) {
        await loadSupabase();
        const cfg = await import('../auth-config.js');
        sbClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
    const { data } = await sbClient.auth.getSession();
    return data && data.session ? data.session.access_token : null;
}

// One call to the Worker. Never throws. → { offline } | { status, json }
async function callApi(app, method, query, body) {
    let token;
    try { token = await getToken(); } catch { return { offline: true }; }
    if (!token) return { status: 401 };
    let res;
    try {
        const headers = { 'Authorization': 'Bearer ' + token };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        res = await fetch(WORKER_URL + '/apps/' + app + '/data' + (query || ''), { method, headers, body });
    } catch { return { offline: true }; }
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, json };
}

// ── The cloud icon (an element with id="cloud-mark" in the app's toolbar; hidden unless signed in) ─
const LABELS = {
    saved:   'Saved to the cloud',
    saving:  'Saving to the cloud…',
    unsaved: 'Not saved to the cloud yet'
};
function setMark(a, state) {
    a.mark = state;
    const el = document.getElementById('cloud-mark');
    if (!el) return;
    if (state === 'hidden') { el.hidden = true; return; }
    el.hidden = false;
    el.dataset.state = state;
    el.title = LABELS[state];
    el.setAttribute('aria-label', LABELS[state]);
}

// One short line for Chef
function say(text) {
    try {
        if (typeof window.showToast === 'function') { window.showToast(text); return; }
        const box = document.createElement('div');
        box.textContent = text;
        box.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:100000;' +
            'background:#1b1f3a;color:#fff;padding:10px 16px;border-radius:10px;font:14px system-ui,sans-serif;' +
            'box-shadow:0 6px 24px rgba(0,0,0,.4);max-width:90vw;text-align:center;';
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 4000);
    } catch { /* ignore */ }
}

// ── First-connection choice ──────────────────────────────────────────────────────────────────────
function askChoice(savedAt) {
    return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(8,11,26,.94);display:flex;' +
            'align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif;';
        const box = document.createElement('div');
        box.style.cssText = 'max-width:420px;width:100%;background:#12162e;color:#f1f1f7;border:1px solid rgba(255,255,255,.18);' +
            'border-radius:14px;padding:22px;line-height:1.5;';
        const h = document.createElement('div');
        h.textContent = 'Notes found on this device and in the cloud';
        h.style.cssText = 'font-weight:700;font-size:1.05rem;margin-bottom:10px;';
        const p = document.createElement('div');
        let when = '';
        try { when = savedAt ? ' The cloud copy was saved ' + new Date(savedAt).toLocaleString('en-GB') + '.' : ''; } catch { /* ignore */ }
        p.textContent = 'Which should this device use?' + when +
            ' Either way, this device’s notes are downloaded first as a backup file.';
        p.style.cssText = 'font-size:.92rem;opacity:.9;margin-bottom:16px;';
        const mk = (label, value, primary) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.style.cssText = 'display:block;width:100%;margin-top:8px;padding:12px;border-radius:10px;font:600 .95rem system-ui,sans-serif;cursor:pointer;' +
                (primary ? 'background:#00e5d4;color:#06101a;border:0;' : 'background:transparent;color:#f1f1f7;border:1px solid rgba(255,255,255,.3);');
            b.addEventListener('click', () => { wrap.remove(); resolve(value); });
            return b;
        };
        box.append(h, p, mk('Use the cloud copy', 'cloud', true), mk('Keep this device’s notes', 'device', false));
        wrap.appendChild(box);
        document.body.appendChild(wrap);
    });
}

function downloadBackup(app, data) {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const when = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        const el   = document.createElement('a');
        el.href = url;
        el.download = app + '-device-backup-' + when + '.json';
        document.body.appendChild(el);
        el.click();
        el.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* the choice still goes ahead; the undo copy is also kept */ }
}

// ── One-step undo: the copy about to be replaced, kept in its own browser database ──────────────
function undoDb() {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open('3c-cloud-undo', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('undo'); };
        r.onsuccess = () => resolve(r.result);
        r.onerror   = () => reject(r.error);
    });
}
async function keepUndo(app, data) {
    try {
        const db = await undoDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('undo', 'readwrite');
            tx.objectStore('undo').put({ saved_at: new Date().toISOString(), data }, app);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror    = () => { db.close(); reject(tx.error); };
            tx.onabort    = () => { db.close(); reject(tx.error); };
        });
        return true;
    } catch { return false; }
}
async function readUndo(app) {
    try {
        const db = await undoDb();
        return await new Promise((resolve, reject) => {
            const req = db.transaction('undo', 'readonly').objectStore('undo').get(app);
            req.onsuccess = () => { db.close(); resolve(req.result || null); };
            req.onerror   = () => { db.close(); reject(req.error); };
        });
    } catch { return null; }
}

// ── Work is done one job at a time per app ───────────────────────────────────────────────────────
function enqueue(a, fn) {
    a.chain = a.chain.then(fn).catch(() => { try { setMark(a, 'unsaved'); } catch { /* ignore */ } });
    return a.chain;
}
function schedule(a) {
    clearTimeout(a.timer);
    a.timer = setTimeout(() => enqueue(a, () => flush(a)), PUSH_DELAY);
}
function retryLater(a) {
    clearTimeout(a.retry);
    a.retry = setTimeout(() => enqueue(a, () => sync(a)), RETRY_DELAY);
}
function sync(a) {
    return (a.connected && a.dirty) ? flush(a) : pull(a);
}

// Judge a reply. true → carry on with it. false → already dealt with.
function usable(a, r) {
    if (r.offline) {
        if (a.dirty) setMark(a, 'unsaved');
        else if (a.connected) setMark(a, 'saved');
        else setMark(a, 'hidden');
        return false;
    }
    if (r.status === 200) return true;
    if (r.status === 403) { a.quiet = true; setMark(a, 'hidden'); return false; }   // not Chef: act as public
    if (r.status === 401) { setMark(a, 'unsaved'); return false; }                 // sign-in not accepted right now
    setMark(a, a.connected ? 'unsaved' : 'hidden');
    retryLater(a);
    return false;
}

// Replace this device's notes with the cloud copy
async function applyCloud(a, doc, message) {
    a.applying = true;
    try {
        let local = null;
        try { local = await a.exportFn(); } catch { /* ignore */ }
        if (local && !a.isEmpty(local)) await keepUndo(a.app, local);
        await a.replaceFn(doc.data);
        a.version = Number(doc.version) || 0;
        a.dirty = false;
        a.connected = true;
        saveState(a);
        try { if (a.afterReplace) a.afterReplace(); } catch { /* ignore */ }
        if (message) setTimeout(() => say(message), 800);
    } finally {
        a.applying = false;
    }
}

// ── Pull: ask the cloud for this app's copy ──────────────────────────────────────────────────────
async function pull(a) {
    if (a.quiet) return;
    const r = await callApi(a.app, 'GET');
    if (!usable(a, r)) return;
    const j = r.json || {};
    const local = await a.exportFn();
    const localEmpty = a.isEmpty(local);

    if (!j.exists) {
        // Nothing in the cloud yet. Notes on this device, if any, become the cloud copy.
        a.version = Number(j.version) || 0;
        a.connected = true;
        saveState(a);
        if (!localEmpty) return flush(a, true);
        setMark(a, 'saved');
        return;
    }

    if (!a.connected) {
        // First time this device meets this cloud copy
        if (localEmpty) {
            await applyCloud(a, j, 'Notes from the cloud were loaded onto this device.');
            setMark(a, 'saved');
            return;
        }
        const pick = await askChoice(j.saved_at);
        downloadBackup(a.app, local);                      // always, whichever is picked
        if (pick === 'cloud') {
            await applyCloud(a, j, 'Cloud notes loaded. This device’s earlier notes were downloaded as a backup.');
            setMark(a, 'saved');
        } else {
            a.version = Number(j.version) || 0;
            a.connected = true;
            saveState(a);
            return flush(a, true);                         // this device's notes become the cloud copy
        }
        return;
    }

    const cloudVersion = Number(j.version) || 0;
    if (cloudVersion > a.version) {
        await applyCloud(a, j, 'Newer notes from another device were loaded.');
        setMark(a, 'saved');
        return;
    }
    if (cloudVersion < a.version) {                         // the cloud copy is behind what this device last saw
        a.version = cloudVersion;
        a.dirty = true;
        saveState(a);
    }
    if (a.dirty) return flush(a, true);
    setMark(a, 'saved');
}

// ── Push: send this device's whole export, based on the cloud version it last saw ───────────────
async function flush(a, force) {
    if (a.quiet || !a.connected) return;
    if (!force && !a.dirty) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        a.dirty = true; saveState(a); setMark(a, 'unsaved'); return;
    }
    setMark(a, 'saving');
    const seq = a.seq;
    let data;
    try { data = await a.exportFn(); } catch { setMark(a, 'unsaved'); return; }

    const r = await callApi(a.app, 'PUT', '?base=' + a.version, JSON.stringify(data));
    if (r.offline) { a.dirty = true; saveState(a); setMark(a, 'unsaved'); return; }

    if (r.status === 200) {
        a.version = Number(r.json && r.json.version) || a.version;
        if (a.seq !== seq) {                                // more changes arrived while this one was going up
            a.dirty = true; saveState(a); setMark(a, 'saving'); schedule(a); return;
        }
        a.dirty = false; saveState(a); setMark(a, 'saved');
        return;
    }

    if (r.status === 409) {                                 // the cloud has newer notes: take them
        const g = await callApi(a.app, 'GET');
        if (!usable(a, g)) return;
        if (g.json && g.json.exists) {
            await applyCloud(a, g.json, 'Newer notes from another device were loaded.');
            setMark(a, 'saved');
        } else {
            a.version = Number(g.json && g.json.version) || 0;
            a.dirty = true; saveState(a); schedule(a);
        }
        return;
    }

    a.dirty = true; saveState(a);
    usable(a, r);                                           // 403 → quiet, 401/5xx → not saved yet
}

// ── Public ───────────────────────────────────────────────────────────────────────────────────────
// connect() is called once by the app's storage file. With no sign-in it returns at once and nothing else happens.
export function connect(opts) {
    if (!opts || !opts.app) return;
    const a = Object.assign({
        enabled: false, quiet: false, applying: false, mark: 'hidden',
        seq: 0, timer: null, retry: null, chain: Promise.resolve(),
        isEmpty: () => false, afterReplace: null
    }, opts, loadState(opts.app));
    apps[a.app] = a;

    if (!hasSignIn()) return;
    a.enabled = true;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') enqueue(a, () => sync(a));
        else if (a.dirty && a.connected) enqueue(a, () => flush(a));      // leaving the page: send what is waiting
    });
    window.addEventListener('online', () => enqueue(a, () => sync(a)));
    window.addEventListener('offline', () => { if (a.dirty) setMark(a, 'unsaved'); });

    enqueue(a, () => pull(a));
}

// Call after every save or delete in the app. Does nothing unless signed in.
export function changed(app) {
    const a = apps[app];
    if (!a || !a.enabled || a.quiet || a.applying) return;
    a.seq++;
    if (!a.dirty) { a.dirty = true; saveState(a); }
    if (a.connected) { setMark(a, 'saving'); schedule(a); }
}

// Put back the notes that the last cloud replace removed from this device (then they go up as a new save).
export async function restoreUndo(app) {
    const a = apps[app];
    if (!a || !a.enabled) return false;
    const rec = await readUndo(app);
    if (!rec || !rec.data) return false;
    a.applying = true;
    try {
        await a.replaceFn(rec.data);
        try { if (a.afterReplace) a.afterReplace(); } catch { /* ignore */ }
    } finally { a.applying = false; }
    a.dirty = true; saveState(a);
    if (a.connected) { setMark(a, 'saving'); schedule(a); }
    return true;
}
