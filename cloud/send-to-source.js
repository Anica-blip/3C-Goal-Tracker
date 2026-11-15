// cloud/send-to-source.js
// Send a DASH Notes note to the Working shelf (WS) of SOURCE Notes — 3C Thread To Success™
//
// WHAT IT DOES
//   Chef taps the send button on a note → a small popup asks "What is it?" and "Where it sits?"
//   (a list of the Working shelf's box files) → the note is filed on the next WS number as a .md file.
//   A copy is sent; the note stays in DASH Notes.
//
// RULES IT FOLLOWS
//   • Only when Chef is signed in (Supabase GitHub sign-in found in this browser). With no sign-in,
//     canSendToSource() is false, nothing is loaded and no calls are made — public users see no change.
//   • Same Notes Worker and same sign-in as cloud-sync.js (notes.threadcommand.center). No PIN is used:
//     this can only add a note and read the box-file names, it cannot open anything on the shelf.
//   • About / Why I kept it / Look again by stay empty; Chef fills them with Edit card in SOURCE Notes.
//   • Messages here are for Chef only, in British English (no translations needed).
//
// HOW AN APP USES IT
//   import { canSendToSource, sendNoteToSource } from '../cloud/send-to-source.js';   (path depends on the app's folder)
//   if (canSendToSource()) sendNoteToSource({ subject, text });

const WORKER_URL      = 'https://notes.threadcommand.center';
const SUPABASE_SCRIPT = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const LAST_KEY        = '3c-send-ws-folder';      // the box file used last time, offered first next time

let sbClient  = null;
let sbLoading = null;

// ── Is Chef signed in on this browser? ───────────────────────────────────────────────────────────
// Supabase keeps the session in localStorage under  sb-<project>-auth-token.
export function canSendToSource() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (/^sb-[a-z0-9]+-auth-token$/i.test(k) && localStorage.getItem(k)) return true;
        }
    } catch { /* storage blocked: treat as public */ }
    return false;
}

// ── Sign-in token (the Supabase script is loaded only now, and only for a signed-in browser) ────
function loadSupabase() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (sbLoading) return sbLoading;
    sbLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SUPABASE_SCRIPT;
        s.onload  = () => resolve();
        s.onerror = () => { sbLoading = null; reject(new Error('Could not load the sign-in script. Check your connection and try again.')); };
        document.head.appendChild(s);
    });
    return sbLoading;
}

async function getToken() {
    if (!sbClient) {
        await loadSupabase();
        const cfg = await import('../auth-config.js');
        // No background refresh timer: this client only reads the session already kept by the browser.
        sbClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false } });
    }
    const { data } = await sbClient.auth.getSession();
    return data && data.session ? data.session.access_token : null;
}

// One call to the Worker. Throws an Error whose message can be shown to Chef as it is.
async function call(method, path, body) {
    const token = await getToken();
    if (!token) throw new Error('You are not signed in. Open SOURCE Notes once to sign in with GitHub.');
    let res;
    try {
        const headers = { 'Authorization': 'Bearer ' + token };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        res = await fetch(WORKER_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch { throw new Error('Cannot reach the cloud right now. Try again when you are online.'); }
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
        if (res.status === 401) throw new Error('Your sign-in has run out. Open SOURCE Notes to sign in again.');
        if (res.status === 403) throw new Error('This account does not have access to SOURCE Notes.');
        throw new Error((data && data.error) || 'Could not send the note (' + res.status + ').');
    }
    return data || {};
}

// ── small helpers ────────────────────────────────────────────────────────────────────────────────
function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'style') e.style.cssText = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids) { if (kid !== null && kid !== undefined) e.append(kid); }
    return e;
}

function toast(message, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.className = 'toast toast--' + type + ' show';
    setTimeout(() => t.classList.remove('show'), 3500);
}

const firstLine = text => String(text || '').split('\n').map(s => s.trim()).find(Boolean) || '';
const pathOf = (list, id) => {
    const parts = []; let cur = list.find(f => f.id === id), guard = 0;
    while (cur && guard++ < 50) { parts.unshift(cur.name); cur = cur.parent_id ? list.find(f => f.id === cur.parent_id) : null; }
    return parts.join(' / ');
};

// ── the popup ────────────────────────────────────────────────────────────────────────────────────
// sendNoteToSource({ subject, text }) → opens the popup; resolves true when the note was sent, false otherwise.
export function sendNoteToSource(note) {
    return new Promise(resolve => {
        const text  = String((note && note.text) || '');
        const first = (note && String(note.subject || '').trim()) || firstLine(text);
        let sent = false, busy = false;

        const title = el('input', { type: 'text', maxlength: '140', value: first, placeholder: 'A short name for this note' });
        const folder = el('select', { disabled: true }, el('option', { value: '' }, 'Loading folders…'));
        const msg = el('p', { style: 'min-height:1.2em; margin:10px 0 0; font-size:0.8rem; color:var(--danger);' });
        const cancel = el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => close() }, 'Cancel');
        const go = el('button', { class: 'btn btn--primary', type: 'submit', disabled: true }, 'Send to Working shelf');

        const form = el('form', { novalidate: true },
            el('p', { style: 'margin:0 0 14px; font-size:0.8rem; color:var(--text-secondary); white-space:pre-wrap; overflow-wrap:anywhere; max-height:4.6em; overflow:hidden;' },
                text.length > 140 ? text.slice(0, 140) + '…' : text),
            el('div', { class: 'form-group' },
                el('label', { style: 'display:block; margin-bottom:6px; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-muted);' }, 'What is it?'), title),
            el('div', { class: 'form-group', style: 'margin-bottom:6px;' },
                el('label', { style: 'display:block; margin-bottom:6px; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-muted);' }, 'Where it sits?'), folder),
            msg,
            el('div', { style: 'display:flex; justify-content:flex-end; gap:10px; margin-top:16px;' }, cancel, go));

        const card = el('div', {
            role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send to Working shelf',
            style: 'width:100%; max-width:420px; max-height:90vh; overflow-y:auto; padding:22px 22px 20px; border-radius:16px; ' +
                   'background:rgba(13,27,94,0.97); border:1px solid var(--border-strong); box-shadow:0 30px 80px rgba(0,0,0,0.6);'
        },
            el('div', { style: 'font-weight:700; font-size:1rem; color:var(--cyan); margin-bottom:14px;' }, 'Send to the Working shelf'),
            form);
        const back = el('div', { style: 'position:fixed; inset:0; z-index:9000; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(4,2,14,0.78);' }, card);

        function onKey(e) { if (e.key === 'Escape') close(); }
        function close() {
            if (busy) return;
            document.removeEventListener('keydown', onKey);
            back.remove();
            resolve(sent);
        }
        back.addEventListener('click', e => { if (e.target === back) close(); });
        document.addEventListener('keydown', onKey);
        document.body.append(back);
        setTimeout(() => { title.focus(); title.select(); }, 40);

        // the Working shelf's box files
        (async () => {
            try {
                const { folders } = await call('GET', '/source/folders?shelf=WS');
                const opts = (folders || []).map(f => ({ id: f.id, label: pathOf(folders, f.id) })).sort((a, b) => a.label.localeCompare(b.label));
                if (!opts.length) {
                    folder.replaceChildren(el('option', { value: '' }, 'No box files yet'));
                    msg.textContent = 'The Working shelf has no box file yet. Open SOURCE Notes, make one with Add Folder, then send again.';
                    return;
                }
                let last = ''; try { last = localStorage.getItem(LAST_KEY) || ''; } catch { /* ignore */ }
                folder.replaceChildren(el('option', { value: '' }, 'Choose a folder…'), ...opts.map(o => el('option', { value: o.id }, o.label)));
                if (opts.some(o => o.id === last)) folder.value = last;
                folder.disabled = false; go.disabled = false;
            } catch (e) {
                folder.replaceChildren(el('option', { value: '' }, 'Could not load folders'));
                msg.textContent = e.message;
            }
        })();

        form.addEventListener('submit', async e => {
            e.preventDefault();
            if (busy) return;
            msg.textContent = '';
            const name = title.value.trim();
            if (!name) { msg.textContent = '“What is it?” is required.'; title.focus(); return; }
            if (!folder.value) { msg.textContent = 'Choose where it sits.'; return; }
            busy = true; go.disabled = true; cancel.disabled = true; go.textContent = 'Sending…';
            try {
                const { record } = await call('POST', '/source/records', {
                    shelf: 'WS', folder_id: folder.value, title: name,
                    about: '', why: '', look_again: '', format: 'md', content: text
                });
                try { localStorage.setItem(LAST_KEY, folder.value); } catch { /* ignore */ }
                sent = true; busy = false;
                close();
                toast('Sent to the Working shelf' + (record && record.file_id ? ' · ' + record.file_id : ''));
            } catch (err) {
                busy = false; go.disabled = false; cancel.disabled = false; go.textContent = 'Send to Working shelf';
                msg.textContent = err.message;
            }
        });
    });
}
