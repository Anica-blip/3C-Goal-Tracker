// ─── SOURCE Notes — sign-in + Worker calls ───────────────────────────────────
// Every call carries the signed-in user's Supabase token as a bearer token.
// The Locked folder calls also carry the unlock token kept on this device.

import { SUPABASE_URL, SUPABASE_ANON_KEY, WORKER_URL } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LOCK_KEY = 'source-notes-lock-token';
export const getLockToken = () => { try { return localStorage.getItem(LOCK_KEY) || ''; } catch { return ''; } };
export const setLockToken = t => { try { t ? localStorage.setItem(LOCK_KEY, t) : localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ } };

export async function getSession() {
    const { data } = await sb.auth.getSession();
    return data && data.session ? data.session : null;
}

// "Forgot PIN?" — a fresh GitHub sign-in is part of the emergency unlock.
const RECOVER_KEY = 'source-notes-recover';
export const recoverPending = () => { try { return Date.now() - Number(sessionStorage.getItem(RECOVER_KEY) || 0) < 10 * 60 * 1000; } catch { return false; } };
export const clearRecover = () => { try { sessionStorage.removeItem(RECOVER_KEY); } catch { /* ignore */ } };
export async function signInAgain() {
    try { sessionStorage.setItem(RECOVER_KEY, String(Date.now())); } catch { /* ignore */ }
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: new URL('index.html', location.href).href }
    });
    if (error) throw new ApiError(0, error.message);
}

export async function signOut() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
}

export class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

async function send(method, path, { json, body, headers, lock } = {}) {
    const session = await getSession();
    if (!session) { window.location.href = 'login.html'; throw new ApiError(401, 'Sign in required'); }

    const h = Object.assign({ 'Authorization': 'Bearer ' + session.access_token }, headers || {});
    if (lock) h['X-Lock-Token'] = getLockToken();
    const init = { method, headers: h };
    if (json !== undefined) { init.body = JSON.stringify(json); h['Content-Type'] = 'application/json'; }
    else if (body !== undefined) { init.body = body; }

    let res;
    try { res = await fetch(WORKER_URL + path, init); }
    catch { throw new ApiError(0, 'Could not reach the Notes Worker. Check your connection.'); }

    if (!res.ok) {
        let msg = 'Something went wrong';
        try { msg = (await res.json()).error || msg; } catch { /* not json */ }
        if (res.status === 401) { window.location.href = 'login.html'; }
        if (res.status === 423) window.dispatchEvent(new CustomEvent('source-locked'));
        throw new ApiError(res.status, msg);
    }
    return res;
}

export const api = {
    async get(path, o)    { return (await send('GET', path, o)).json(); },
    async post(path, json, o) { return (await send('POST', path, { ...o, json })).json(); },
    async patch(path, json, o) { return (await send('PATCH', path, { ...o, json })).json(); },
    async del(path, o)    { return (await send('DELETE', path, o)).json(); },
    async blob(path, o)   { return (await send('GET', path, o)).blob(); },
    async put(path, blob, o = {}) {
        return (await send('PUT', path, { ...o, body: blob, headers: { 'Content-Type': 'application/octet-stream', ...(o.headers || {}) } })).json();
    }
};

export const enc = encodeURIComponent;
