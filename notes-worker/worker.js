// ─── 3C SOURCE Notes — Notes Worker ──────────────────────────────────────────
// One Worker for the notes apps. This build serves SOURCE Notes only.
// Served at: notes.threadcommand.center
// Bindings : BUCKET (R2 → 3c-boardroom-hq), DB (D1 → 3c-notes)
// Secrets  : SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_USER_ID, AGENT_KEY, LOCK_SECRET
// Vars     : ALLOWED_ORIGINS (comma separated, set in wrangler.toml)
// Deploy   : wrangler deploy (from notes-worker/ — never the dashboard editor)
//
// WHO MAY CALL WHAT
//   Chef (Supabase GitHub login, Bearer token) → every route.
//   Agent (X-Agent-Key header)                 → ONLY the Office routes marked [agent]:
//                                                list folders, list files, read file, write .md file.
//                                                No delete, no move, no Bin, no Locked folder,
//                                                nothing on shelves 1–3.
//
// R2 LAYOUT (inside the bucket)
//   Notes/source-notes/shelves/<record id>/<file name>
//   Notes/source-notes/office/<folder path>/<file name>
//   Notes/source-notes/office/Bin/<name_date_time.ext>
//   Notes/source-notes/locked/<folder path>/<file name>   (contents encrypted in the browser)
//   Notes/source-notes/locked/Bin/...

const BASE = 'Notes/source-notes/';
const MAX_BYTES = 25 * 1024 * 1024;
const SHELVES = ['WS', 'RS', 'AS'];

// ── small helpers ────────────────────────────────────────────────────────────
const enc = new TextEncoder();

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status, headers: { 'Content-Type': 'application/json' }
    });
}
const refuse = (msg, status) => json({ error: msg }, status);

function parseAllowed(env) {
    return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
}

function corsHeaders(origin, env) {
    const allowed = parseAllowed(env);
    const h = {
        'Access-Control-Allow-Methods':  'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':  'Content-Type, Authorization, X-Lock-Token, X-File-Name',
        'Access-Control-Expose-Headers': 'Content-Disposition, X-File-Name',
        'Access-Control-Max-Age':        '600',
        'Vary':                          'Origin'
    };
    if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
    return h;
}

function safeEqual(a, b) {
    a = String(a); b = String(b);
    let diff = a.length ^ b.length;
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
}

async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacB64(secret, text) {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const nowIso = () => new Date().toISOString();

// Names: no slashes, no control characters, no dot-dot, sensible length.
function cleanName(raw, max = 120) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s || s.length > max) return null;
    if (/[\/\\\u0000-\u001f]/.test(s)) return null;
    if (s === '.' || s === '..' || s.startsWith('.')) return null;
    return s;
}

function extOf(name) {
    const i = String(name).lastIndexOf('.');
    return i > 0 ? String(name).slice(i + 1).toLowerCase() : '';
}

const TYPES = {
    md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
};
const typeFor = name => TYPES[extOf(name)] || 'application/octet-stream';

function fileResponse(obj, name, download, forceType) {
    const h = new Headers();
    h.set('Content-Type', forceType || typeFor(name));
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('Cache-Control', 'no-store');
    h.set('Content-Disposition',
        (download ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(name));
    h.set('X-File-Name', encodeURIComponent(name));
    return new Response(obj.body, { status: 200, headers: h });
}

async function readBody(request) {
    const len = Number(request.headers.get('Content-Length') || 0);
    if (len > MAX_BYTES) return { error: refuse('File is too large (25 MB limit)', 413) };
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return { error: refuse('File is too large (25 MB limit)', 413) };
    return { buf };
}

async function bodyJson(request) {
    try { return await request.json(); } catch { return null; }
}

// ── ACCESS CHECK ─────────────────────────────────────────────────────────────
// Returns { role: 'chef', token } | { role: 'agent' } | { error: Response }
async function authenticate(request, env) {
    const agentHeader = request.headers.get('X-Agent-Key');
    if (agentHeader) {
        if (!env.AGENT_KEY) return { error: refuse('Agent access is not configured', 500) };
        if (!safeEqual(agentHeader, env.AGENT_KEY)) return { error: refuse('Key refused', 401) };
        return { role: 'agent' };
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.ALLOWED_USER_ID) {
        return { error: refuse('Access check is not configured', 500) };
    }
    const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/i);
    if (!m) return { error: refuse('Sign in required', 401) };

    let user;
    try {
        const res = await fetch(env.SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', {
            headers: { 'Authorization': 'Bearer ' + m[1], 'apikey': env.SUPABASE_ANON_KEY }
        });
        if (res.status === 401 || res.status === 403) return { error: refuse('Sign in required', 401) };
        if (!res.ok) throw new Error('Supabase auth ' + res.status);
        user = await res.json();
    } catch {
        return { error: refuse('Could not verify sign-in. Try again.', 503) };
    }
    const allowed = String(env.ALLOWED_USER_ID).trim().toLowerCase();
    if (!user || String(user.id || '').toLowerCase() !== allowed) {
        return { error: refuse('This account does not have access', 403) };
    }
    return { role: 'chef', token: m[1] };
}

// ── ENTRY ────────────────────────────────────────────────────────────────────
export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const cors = corsHeaders(origin, env);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        let res;
        try {
            // Browser calls must come from the app's own address.
            // (Calls without an Origin header — the agent, a manual test — are judged by their key/login.)
            if (origin && !parseAllowed(env).includes(origin)) {
                res = refuse('This address is not allowed', 403);
            } else {
                const auth = await authenticate(request, env);
                res = auth.error || await route(request, env, auth);
            }
        } catch (err) {
            res = refuse(err && err.message ? err.message : 'Server error', 500);
        }

        const out = new Response(res.body, res);
        for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
        return out;
    }
};

// ── ROUTER ───────────────────────────────────────────────────────────────────
async function route(request, env, auth) {
    const url = new URL(request.url);
    const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const method = request.method;
    const ctx = { request, env, url, q: url.searchParams, auth, method };

    if (!seg.length) return new Response('SOURCE Notes Worker — online.', { status: 200 });

    // Agent wall: the agent never reaches anything except the marked Office routes.
    if (auth.role === 'agent') {
        if (seg[0] !== 'office') return refuse('Key refused on this route', 403);
        const ok =
            (method === 'GET' && seg[1] === 'folders' && seg.length === 2) ||
            (method === 'GET' && seg[1] === 'files'   && seg.length === 2) ||
            (method === 'GET' && seg[1] === 'file'    && seg.length === 2) ||
            (method === 'PUT' && seg[1] === 'file'    && seg.length === 2);
        if (!ok) return refuse('Key refused on this route', 403);
    }

    if (seg[0] === 'source') {
        if (seg[1] === 'folders') return shelfFolders(ctx, seg);
        if (seg[1] === 'records') return shelfRecords(ctx, seg);
        return refuse('Not found', 404);
    }

    if (seg[0] === 'office' || seg[0] === 'locked') {
        ctx.space = seg[0];
        if (seg[0] === 'locked') {
            if (!env.LOCK_SECRET) return refuse('The Locked folder is not configured', 500);
            if (seg[1] === 'status'  && method === 'GET')  return lockStatus(ctx);
            if (seg[1] === 'setup'   && method === 'POST') return lockSetup(ctx);
            if (seg[1] === 'unlock'  && method === 'POST') return lockUnlock(ctx);
            if (seg[1] === 'recover' && method === 'POST') return lockRecover(ctx);
            const denied = await requireLockToken(ctx);
            if (denied) return denied;
        }
        switch (seg[1]) {
            case 'folders':   return spaceFolders(ctx, seg);
            case 'files':     return method === 'GET' ? spaceFileList(ctx) : refuse('Not found', 404);
            case 'file':      return spaceFile(ctx);
            case 'move':      return method === 'POST' ? spaceMove(ctx) : refuse('Not found', 404);
            case 'duplicate': return method === 'POST' ? spaceDuplicate(ctx) : refuse('Not found', 404);
            case 'bin':       return spaceBin(ctx, seg);
            case 'pin':       return ctx.space === 'locked' && method === 'POST' ? lockChangePin(ctx) : refuse('Not found', 404);
            default:          return refuse('Not found', 404);
        }
    }
    return refuse('Not found', 404);
}

// ═════════════════════════════════════════════════════════════════════════════
// SHELVES 1–3  (WS / RS / AS)
// ═════════════════════════════════════════════════════════════════════════════

async function shelfFolders(ctx, seg) {
    const { env, method, q } = ctx;
    const id = seg[2];

    if (method === 'GET' && !id) {
        const shelf = q.get('shelf');
        const { results } = shelf
            ? await env.DB.prepare("SELECT id, shelf, parent_id, name, ord FROM folders WHERE side='shelves' AND shelf=? ORDER BY ord, created_at").bind(shelf).all()
            : await env.DB.prepare("SELECT id, shelf, parent_id, name, ord FROM folders WHERE side='shelves' ORDER BY shelf, ord, created_at").all();
        return json({ folders: results });
    }

    if (method === 'POST' && !id) {
        const b = await bodyJson(ctx.request);
        if (!b) return refuse('Invalid request', 400);
        const name = cleanName(b.name, 60);
        if (!name) return refuse('Folder name is not valid', 400);
        if (!SHELVES.includes(b.shelf)) return refuse('Choose a shelf: WS, RS or AS', 400);
        let parentId = b.parent_id || null;
        if (parentId) {
            const p = await env.DB.prepare("SELECT id, shelf FROM folders WHERE id=? AND side='shelves'").bind(parentId).first();
            if (!p) return refuse('Parent folder not found', 404);
            if (p.shelf !== b.shelf) return refuse('A sub-folder must be on the same shelf as its parent', 400);
        }
        const dup = await env.DB.prepare(
            "SELECT id FROM folders WHERE side='shelves' AND shelf=? AND IFNULL(parent_id,'')=? AND lower(name)=lower(?)"
        ).bind(b.shelf, parentId || '', name).first();
        if (dup) return refuse('A folder with that name already exists here', 409);
        const max = await env.DB.prepare("SELECT IFNULL(MAX(ord),0) AS m FROM folders WHERE side='shelves' AND shelf=?").bind(b.shelf).first();
        const row = { id: crypto.randomUUID(), side: 'shelves', shelf: b.shelf, parent_id: parentId, name, ord: (max.m || 0) + 1 };
        await env.DB.prepare('INSERT INTO folders (id, side, shelf, parent_id, name, ord, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(row.id, row.side, row.shelf, row.parent_id, row.name, row.ord, nowIso()).run();
        return json({ folder: row }, 201);
    }

    if (method === 'PATCH' && id) {
        const b = await bodyJson(ctx.request);
        const name = b && cleanName(b.name, 60);
        if (!name) return refuse('Folder name is not valid', 400);
        const f = await env.DB.prepare("SELECT * FROM folders WHERE id=? AND side='shelves'").bind(id).first();
        if (!f) return refuse('Folder not found', 404);
        const dup = await env.DB.prepare(
            "SELECT id FROM folders WHERE side='shelves' AND shelf=? AND IFNULL(parent_id,'')=? AND lower(name)=lower(?) AND id<>?"
        ).bind(f.shelf, f.parent_id || '', name, id).first();
        if (dup) return refuse('A folder with that name already exists here', 409);
        await env.DB.prepare('UPDATE folders SET name=? WHERE id=?').bind(name, id).run();
        return json({ ok: true });
    }

    if (method === 'DELETE' && id) {
        const f = await env.DB.prepare("SELECT id FROM folders WHERE id=? AND side='shelves'").bind(id).first();
        if (!f) return refuse('Folder not found', 404);
        const kids = await env.DB.prepare('SELECT COUNT(*) AS n FROM folders WHERE parent_id=?').bind(id).first();
        const recs = await env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE folder_id=?').bind(id).first();
        if (kids.n || recs.n) return refuse('This folder is not empty', 409);
        await env.DB.prepare('DELETE FROM folders WHERE id=?').bind(id).run();
        return json({ ok: true });
    }
    return refuse('Not found', 404);
}

// The File ID is worked out from the note's position on its shelf — never stored.
function withFileIds(rows) {
    const counters = {};
    return rows.map(r => {
        counters[r.shelf] = (counters[r.shelf] || 0) + 1;
        return {
            id: r.id, shelf: r.shelf,
            file_id: r.shelf + String(counters[r.shelf]).padStart(4, '0'),
            folder_id: r.folder_id, title: r.title, about: r.about, why: r.why,
            look_again: r.look_again, file_name: r.file_name, file_type: r.file_type,
            size: r.size, created_at: r.created_at, updated_at: r.updated_at
        };
    });
}

async function allRecords(env, shelf) {
    const { results } = shelf
        ? await env.DB.prepare('SELECT * FROM records WHERE shelf=? ORDER BY ord, created_at, id').bind(shelf).all()
        : await env.DB.prepare('SELECT * FROM records ORDER BY shelf, ord, created_at, id').all();
    return withFileIds(results);
}

const recKey = (id, name) => BASE + 'shelves/' + id + '/' + name;

async function shelfRecords(ctx, seg) {
    const { env, method, q } = ctx;
    const id = seg[2];
    const sub = seg[3];

    if (method === 'GET' && !id) {
        const shelf = q.get('shelf');
        if (shelf && !SHELVES.includes(shelf)) return refuse('Unknown shelf', 400);
        return json({ records: await allRecords(env, shelf) });
    }

    if (method === 'POST' && !id) {
        const b = await bodyJson(ctx.request);
        if (!b) return refuse('Invalid request', 400);
        if (!SHELVES.includes(b.shelf)) return refuse('Choose a shelf: WS, RS or AS', 400);
        const title = String(b.title || '').trim().slice(0, 140);
        if (!title) return refuse('"What is it?" is required', 400);
        const folder = await env.DB.prepare("SELECT id, shelf FROM folders WHERE id=? AND side='shelves'").bind(b.folder_id || '').first();
        if (!folder) return refuse('Choose where it sits', 400);
        if (folder.shelf !== b.shelf) return refuse('That folder is on a different shelf', 400);

        const format = b.format === 'txt' ? 'txt' : 'md';
        const fileName = cleanName(b.file_name) || (slugify(title) + '.' + format);
        const id2 = crypto.randomUUID();
        let size = 0;
        if (typeof b.content === 'string') {
            const bytes = enc.encode(b.content);
            if (bytes.byteLength > MAX_BYTES) return refuse('File is too large (25 MB limit)', 413);
            size = bytes.byteLength;
            await env.BUCKET.put(recKey(id2, fileName), bytes, { httpMetadata: { contentType: typeFor(fileName) } });
        }
        const max = await env.DB.prepare('SELECT IFNULL(MAX(ord),0) AS m FROM records WHERE shelf=?').bind(b.shelf).first();
        const t = nowIso();
        await env.DB.prepare(
            'INSERT INTO records (id, shelf, folder_id, ord, title, about, why, look_again, file_name, file_type, storage_key, size, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(id2, b.shelf, b.folder_id, (max.m || 0) + 1, title, str(b.about), str(b.why), str(b.look_again),
            fileName, extOf(fileName), recKey(id2, fileName), size, t, t).run();
        const list = await allRecords(env, b.shelf);
        return json({ record: list.find(r => r.id === id2) }, 201);
    }

    const rec = id ? await env.DB.prepare('SELECT * FROM records WHERE id=?').bind(id).first() : null;
    if (!rec) return refuse('Note not found', 404);

    if (method === 'GET' && !sub) {
        const list = await allRecords(env, rec.shelf);
        return json({ record: list.find(r => r.id === id) });
    }

    if (method === 'PATCH' && !sub) {
        const b = await bodyJson(ctx.request);
        if (!b) return refuse('Invalid request', 400);
        const title = b.title !== undefined ? String(b.title).trim().slice(0, 140) : rec.title;
        if (!title) return refuse('"What is it?" is required', 400);
        const newShelf = b.shelf || rec.shelf;
        if (!SHELVES.includes(newShelf)) return refuse('Unknown shelf', 400);
        const newFolder = b.folder_id || rec.folder_id;
        const folder = await env.DB.prepare("SELECT id, shelf FROM folders WHERE id=? AND side='shelves'").bind(newFolder).first();
        if (!folder) return refuse('Choose where it sits', 400);
        if (folder.shelf !== newShelf) return refuse('That folder is on a different shelf', 400);
        let ord = rec.ord;
        if (newShelf !== rec.shelf) {
            // Moving shelf: next number on the new shelf. The stored file stays where it is.
            const max = await env.DB.prepare('SELECT IFNULL(MAX(ord),0) AS m FROM records WHERE shelf=?').bind(newShelf).first();
            ord = (max.m || 0) + 1;
        }
        await env.DB.prepare(
            'UPDATE records SET shelf=?, folder_id=?, ord=?, title=?, about=?, why=?, look_again=?, updated_at=? WHERE id=?'
        ).bind(newShelf, newFolder, ord, title,
            b.about !== undefined ? str(b.about) : rec.about,
            b.why !== undefined ? str(b.why) : rec.why,
            b.look_again !== undefined ? str(b.look_again) : rec.look_again,
            nowIso(), id).run();
        const list = await allRecords(env, newShelf);
        return json({ record: list.find(r => r.id === id) });
    }

    if (method === 'DELETE' && !sub) {
        await env.BUCKET.delete(rec.storage_key);
        await env.DB.prepare('DELETE FROM records WHERE id=?').bind(id).run();
        return json({ ok: true });
    }

    if (method === 'POST' && sub === 'duplicate') {
        const newId = crypto.randomUUID();
        const key = recKey(newId, rec.file_name);
        const obj = await env.BUCKET.get(rec.storage_key);
        if (obj) await env.BUCKET.put(key, await obj.arrayBuffer(), { httpMetadata: { contentType: typeFor(rec.file_name) } });
        const max = await env.DB.prepare('SELECT IFNULL(MAX(ord),0) AS m FROM records WHERE shelf=?').bind(rec.shelf).first();
        const t = nowIso();
        await env.DB.prepare(
            'INSERT INTO records (id, shelf, folder_id, ord, title, about, why, look_again, file_name, file_type, storage_key, size, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(newId, rec.shelf, rec.folder_id, (max.m || 0) + 1, (rec.title + ' (copy)').slice(0, 140),
            rec.about, rec.why, rec.look_again, rec.file_name, rec.file_type, key, rec.size, t, t).run();
        const list = await allRecords(env, rec.shelf);
        return json({ record: list.find(r => r.id === newId) }, 201);
    }

    if (sub === 'file') {
        if (method === 'GET') {
            const obj = await env.BUCKET.get(rec.storage_key);
            if (!obj) return refuse('File not found in storage', 404);
            return fileResponse(obj, rec.file_name, ctx.q.get('download') === '1');
        }
        if (method === 'PUT') {
            const r = await readBody(ctx.request);
            if (r.error) return r.error;
            const hdrName = ctx.request.headers.get('X-File-Name');
            let name = rec.file_name;
            if (hdrName) {
                const n = cleanName(decodeURIComponent(hdrName));
                if (!n) return refuse('File name is not valid', 400);
                name = n;
            }
            const key = recKey(rec.id, name);
            await env.BUCKET.put(key, r.buf, { httpMetadata: { contentType: typeFor(name) } });
            if (key !== rec.storage_key) await env.BUCKET.delete(rec.storage_key);
            await env.DB.prepare('UPDATE records SET file_name=?, file_type=?, storage_key=?, size=?, updated_at=? WHERE id=?')
                .bind(name, extOf(name), key, r.buf.byteLength, nowIso(), id).run();
            return json({ ok: true, size: r.buf.byteLength, file_name: name });
        }
    }
    return refuse('Not found', 404);
}

function str(v) { return v == null ? '' : String(v).slice(0, 2000); }

function slugify(t) {
    const s = String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return s || 'note';
}

// ═════════════════════════════════════════════════════════════════════════════
// OFFICE SHELF (space = 'office')  and  LOCKED FOLDER (space = 'locked')
// Same handlers; Locked needs the unlock token, and is never reachable by the agent.
// ═════════════════════════════════════════════════════════════════════════════

const spaceKey = (space, path) => BASE + space + '/' + path;

async function loadFolders(env, space) {
    const { results } = await env.DB.prepare('SELECT id, parent_id, name, ord FROM folders WHERE side=? ORDER BY ord, created_at').bind(space).all();
    const byId = new Map(results.map(r => [r.id, r]));
    const pathOf = id => {
        const parts = []; let cur = byId.get(id); let guard = 0;
        while (cur && guard++ < 50) { parts.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : null; }
        return parts.join('/');
    };
    const byPath = new Map(); const byLower = new Map();
    for (const r of results) { const p = pathOf(r.id); byPath.set(p, r); byLower.set(p.toLowerCase(), r); }
    return { rows: results, byId, pathOf, byPath, byLower };
}

const splitSegs = p => String(p || '').split('/').map(s => s.trim()).filter(Boolean);

// "Brand Kit / logo-rules.md" → { folderPath: 'Brand Kit', name: 'logo-rules.md' }
function splitFilePath(p) {
    const parts = splitSegs(p);
    if (parts.length < 2) return null;
    return { folderPath: parts.slice(0, -1).join('/'), name: parts[parts.length - 1] };
}

async function spaceFolders(ctx, seg) {
    const { env, method, space } = ctx;
    const id = seg[2];

    if (method === 'GET' && !id) {
        const idx = await loadFolders(env, space);
        return json({ folders: idx.rows.map(r => ({ id: r.id, parent_id: r.parent_id, name: r.name, path: idx.pathOf(r.id) })) });
    }
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);

    if (method === 'POST' && !id) {
        const b = await bodyJson(ctx.request);
        const name = b && cleanName(b.name, 60);
        if (!name) return refuse('Folder name is not valid', 400);
        const parentId = b.parent_id || null;
        if (!parentId && name.toLowerCase() === 'bin') return refuse('"Bin" is reserved', 400);
        if (parentId) {
            const p = await env.DB.prepare('SELECT id FROM folders WHERE id=? AND side=?').bind(parentId, space).first();
            if (!p) return refuse('Parent folder not found', 404);
        }
        const dup = await env.DB.prepare(
            "SELECT id FROM folders WHERE side=? AND IFNULL(parent_id,'')=? AND lower(name)=lower(?)"
        ).bind(space, parentId || '', name).first();
        if (dup) return refuse('A folder with that name already exists here', 409);
        const max = await env.DB.prepare('SELECT IFNULL(MAX(ord),0) AS m FROM folders WHERE side=?').bind(space).first();
        const fid = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO folders (id, side, shelf, parent_id, name, ord, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(fid, space, space === 'office' ? 'OS' : 'LK', parentId, name, (max.m || 0) + 1, nowIso()).run();
        const idx = await loadFolders(env, space);
        return json({ folder: { id: fid, parent_id: parentId, name, path: idx.pathOf(fid) } }, 201);
    }

    if (method === 'DELETE' && id) {
        const f = await env.DB.prepare('SELECT id FROM folders WHERE id=? AND side=?').bind(id, space).first();
        if (!f) return refuse('Folder not found', 404);
        const kids = await env.DB.prepare('SELECT COUNT(*) AS n FROM folders WHERE parent_id=?').bind(id).first();
        const files = await env.DB.prepare('SELECT COUNT(*) AS n FROM office_files WHERE folder_id=? AND bin=0').bind(id).first();
        if (kids.n || files.n) return refuse('This folder is not empty', 409);
        await env.DB.prepare('DELETE FROM folders WHERE id=?').bind(id).run();
        return json({ ok: true });
    }
    return refuse('Not found', 404);
}

async function spaceFileList(ctx) {
    const { env, space, q } = ctx;
    const idx = await loadFolders(env, space);
    let folderId = q.get('folder_id');
    if (!folderId && q.get('folder_path')) {
        const p = splitSegs(q.get('folder_path')).join('/');
        const f = idx.byPath.get(p) || idx.byLower.get(p.toLowerCase());
        if (!f) return refuse('Folder not found', 404);
        folderId = f.id;
    }
    const { results } = folderId
        ? await env.DB.prepare('SELECT id, folder_id, name, size, saved_by, saved_at FROM office_files WHERE space=? AND bin=0 AND folder_id=? ORDER BY lower(name)').bind(space, folderId).all()
        : await env.DB.prepare('SELECT id, folder_id, name, size, saved_by, saved_at FROM office_files WHERE space=? AND bin=0 ORDER BY folder_id, lower(name)').bind(space).all();
    return json({
        files: results.map(r => ({ ...r, path: idx.pathOf(r.folder_id) + '/' + r.name }))
    });
}

// Resolve ?path=Folder/Sub/file.md to { folder, name, row }
async function resolveFile(ctx) {
    const sp = splitFilePath(ctx.q.get('path'));
    if (!sp) return { error: refuse('Give the file as folder path and file name', 400) };
    const idx = await loadFolders(ctx.env, ctx.space);
    const folder = idx.byPath.get(sp.folderPath) || idx.byLower.get(sp.folderPath.toLowerCase());
    if (!folder) return { error: refuse('Folder not found', 404), sp };
    const row = await ctx.env.DB.prepare('SELECT * FROM office_files WHERE space=? AND bin=0 AND folder_id=? AND name=?')
        .bind(ctx.space, folder.id, sp.name).first();
    return { idx, folder, name: sp.name, row, folderPath: idx.pathOf(folder.id) };
}

function binName(name) {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const stamp = d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
        '_' + p(d.getUTCHours()) + '-' + p(d.getUTCMinutes()) + '-' + p(d.getUTCSeconds());
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(0, i) + '_' + stamp + name.slice(i) : name + '_' + stamp;
}

async function sendToBin(ctx, row, originalPath) {
    const { env, space } = ctx;
    const obj = await env.BUCKET.get(row.storage_key);
    if (!obj) return;
    let name = binName(row.name), n = 1;
    while (await env.BUCKET.head(spaceKey(space, 'Bin/' + name))) {
        n++; name = binName(row.name).replace(/(\.[^.]*)?$/, '-' + n + '$1');
    }
    const key = spaceKey(space, 'Bin/' + name);
    await env.BUCKET.put(key, await obj.arrayBuffer(), { httpMetadata: { contentType: obj.httpMetadata && obj.httpMetadata.contentType } });
    await env.DB.prepare(
        'INSERT INTO office_files (id, space, folder_id, name, storage_key, size, saved_by, saved_at, bin, bin_original) VALUES (?,?,?,?,?,?,?,?,1,?)'
    ).bind(crypto.randomUUID(), space, null, name, key, row.size, row.saved_by, row.saved_at, originalPath).run();
}

async function spaceFile(ctx) {
    const { env, method, space, auth, q } = ctx;
    const r = await resolveFile(ctx);
    if (r.error) return r.error;

    if (method === 'GET') {
        if (!r.row) return refuse('File not found', 404);
        const obj = await env.BUCKET.get(r.row.storage_key);
        if (!obj) return refuse('File not found in storage', 404);
        return fileResponse(obj, r.row.name, q.get('download') === '1',
            space === 'locked' ? 'application/octet-stream' : undefined);
    }

    if (method === 'PUT') {
        const name = cleanName(r.name);
        if (!name) return refuse('File name is not valid', 400);
        if (auth.role === 'agent' && extOf(name) !== 'md') return refuse('The agent writes .md files only', 400);
        const body = await readBody(ctx.request);
        if (body.error) return body.error;
        const key = spaceKey(space, r.folderPath + '/' + name);
        const t = nowIso();
        const by = auth.role === 'agent' ? 'agent' : 'chef';
        if (r.row) await sendToBin(ctx, r.row, r.folderPath + '/' + name);   // previous version → Bin
        await env.BUCKET.put(key, body.buf, {
            httpMetadata: { contentType: space === 'locked' ? 'application/octet-stream' : typeFor(name) }
        });
        if (r.row) {
            await env.DB.prepare('UPDATE office_files SET size=?, saved_by=?, saved_at=? WHERE id=?')
                .bind(body.buf.byteLength, by, t, r.row.id).run();
        } else {
            await env.DB.prepare('INSERT INTO office_files (id, space, folder_id, name, storage_key, size, saved_by, saved_at, bin) VALUES (?,?,?,?,?,?,?,?,0)')
                .bind(crypto.randomUUID(), space, r.folder.id, name, key, body.buf.byteLength, by, t).run();
        }
        return json({ ok: true, replaced: !!r.row, path: r.folderPath + '/' + name, saved_by: by, saved_at: t });
    }

    if (auth.role !== 'chef') return refuse('Key refused on this route', 403);

    if (method === 'DELETE') {
        if (!r.row) return refuse('File not found', 404);
        await env.BUCKET.delete(r.row.storage_key);
        await env.DB.prepare('DELETE FROM office_files WHERE id=?').bind(r.row.id).run();
        return json({ ok: true });
    }
    return refuse('Not found', 404);
}

async function spaceMove(ctx) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const { env, space } = ctx;
    const r = await resolveFile(ctx);
    if (r.error) return r.error;
    if (!r.row) return refuse('File not found', 404);
    const b = await bodyJson(ctx.request);
    const dest = b && await env.DB.prepare('SELECT id FROM folders WHERE id=? AND side=?').bind(b.to_folder_id || '', space).first();
    if (!dest) return refuse('Destination folder not found', 404);
    if (dest.id === r.folder.id) return json({ ok: true });
    const clash = await env.DB.prepare('SELECT id FROM office_files WHERE space=? AND bin=0 AND folder_id=? AND name=?').bind(space, dest.id, r.row.name).first();
    if (clash) return refuse('A file with that name is already in that folder', 409);
    const idx = await loadFolders(env, space);
    const newKey = spaceKey(space, idx.pathOf(dest.id) + '/' + r.row.name);
    const obj = await env.BUCKET.get(r.row.storage_key);
    if (!obj) return refuse('File not found in storage', 404);
    await env.BUCKET.put(newKey, await obj.arrayBuffer(), { httpMetadata: obj.httpMetadata });
    await env.BUCKET.delete(r.row.storage_key);
    await env.DB.prepare('UPDATE office_files SET folder_id=?, storage_key=? WHERE id=?').bind(dest.id, newKey, r.row.id).run();
    return json({ ok: true });
}

async function spaceDuplicate(ctx) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const { env, space } = ctx;
    const r = await resolveFile(ctx);
    if (r.error) return r.error;
    if (!r.row) return refuse('File not found', 404);
    const i = r.row.name.lastIndexOf('.');
    const stem = i > 0 ? r.row.name.slice(0, i) : r.row.name;
    const ext = i > 0 ? r.row.name.slice(i) : '';
    let name = stem + ' (copy)' + ext, n = 1;
    while (await env.DB.prepare('SELECT id FROM office_files WHERE space=? AND bin=0 AND folder_id=? AND name=?').bind(space, r.folder.id, name).first()) {
        n++; name = stem + ' (copy ' + n + ')' + ext;
    }
    const obj = await env.BUCKET.get(r.row.storage_key);
    if (!obj) return refuse('File not found in storage', 404);
    const key = spaceKey(space, r.folderPath + '/' + name);
    await env.BUCKET.put(key, await obj.arrayBuffer(), { httpMetadata: obj.httpMetadata });
    await env.DB.prepare('INSERT INTO office_files (id, space, folder_id, name, storage_key, size, saved_by, saved_at, bin) VALUES (?,?,?,?,?,?,?,?,0)')
        .bind(crypto.randomUUID(), space, r.folder.id, name, key, r.row.size, 'chef', nowIso()).run();
    return json({ ok: true, name });
}

async function spaceBin(ctx, seg) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const { env, method, space } = ctx;
    const id = seg[2];

    if (method === 'GET' && !id) {
        const { results } = await env.DB.prepare('SELECT id, name, size, saved_by, saved_at, bin_original FROM office_files WHERE space=? AND bin=1 ORDER BY name DESC').bind(space).all();
        return json({ files: results });
    }
    const row = id ? await env.DB.prepare('SELECT * FROM office_files WHERE id=? AND space=? AND bin=1').bind(id, space).first() : null;
    if (!row) return refuse('Not found in the Bin', 404);

    if (method === 'GET' && seg[3] === 'file') {
        const obj = await env.BUCKET.get(row.storage_key);
        if (!obj) return refuse('File not found in storage', 404);
        return fileResponse(obj, row.name, true, space === 'locked' ? 'application/octet-stream' : undefined);
    }
    if (method === 'DELETE' && !seg[3]) {
        await env.BUCKET.delete(row.storage_key);
        await env.DB.prepare('DELETE FROM office_files WHERE id=?').bind(id).run();
        return json({ ok: true });
    }
    return refuse('Not found', 404);
}

// ═════════════════════════════════════════════════════════════════════════════
// LOCKED FOLDER — one master key, two locks
//
// The browser makes a random master key (MK) that encrypts every Locked file. MK is kept
// here in two locked copies, and each copy opens only with BOTH of these together:
//   • something Chef knows  → daily lock: 8-digit PIN · emergency lock: a short phrase
//   • a half only this Worker holds (made from the LOCK_SECRET secret, never stored in D1)
//
// The PIN and the phrase never reach this Worker. The browser stretches each one (PBKDF2)
// into a "proof"; this Worker keeps only a keyed hash of each proof. The half and the
// locked copy are handed out only AFTER a correct proof, so a stolen sign-in cannot take
// them away to guess offline; guesses go through here and are counted:
//   PIN     3 wrong → 15 minutes locked
//   phrase  3 wrong → 60 minutes locked  (and only within 10 minutes of a fresh GitHub sign-in)
// Stolen D1/R2 data alone is useless: it needs the LOCK_SECRET half as well.
// Do NOT lose or change LOCK_SECRET — without it nothing in the Locked folder can be opened.
// ═════════════════════════════════════════════════════════════════════════════

const PIN_TRIES = 3,    PIN_WAIT = 15 * 60 * 1000;
const PHRASE_TRIES = 3, PHRASE_WAIT = 60 * 60 * 1000;
const FRESH_MS = 10 * 60 * 1000;

async function getSetting(env, key) {
    const r = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
    return r ? r.value : null;
}
async function setSetting(env, key, value) {
    await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key, String(value)).run();
}

async function issueToken(env) {
    const version = (await getSetting(env, 'lock_version')) || '1';
    return hmacB64(env.LOCK_SECRET, 'locked:' + version);
}

// The Worker's half of the keys: 32 bytes, standard base64. Same value every time.
async function serverHalf(env) {
    const key = await crypto.subtle.importKey('raw', enc.encode(env.LOCK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('half:v1')));
    return btoa(String.fromCharCode(...sig));
}

// What is kept for a proof: a keyed hash, so D1 alone cannot be used to guess a PIN offline.
const proofMac = (env, which, proof) => hmacB64(env.LOCK_SECRET, 'proof-' + which + ':' + proof);

async function requireLockToken(ctx) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const given = ctx.request.headers.get('X-Lock-Token') || '';
    if (!given) return refuse('Locked', 423);
    const good = await issueToken(ctx.env);
    if (!safeEqual(given, good)) return refuse('Locked', 423);
    return null;
}

const validB64 = s => typeof s === 'string' && /^[A-Za-z0-9+/=_-]{16,200}$/.test(s);

// Was this sign-in made in the last 10 minutes? (Supabase stamps the time of the GitHub sign-in
// inside the token; Supabase has already vouched for the token in authenticate().)
function freshSignIn(token) {
    try {
        const part = String(token || '').split('.')[1];
        if (!part) return false;
        const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        const stamps = (Array.isArray(payload.amr) ? payload.amr : [])
            .map(a => Number(a && a.timestamp)).filter(n => Number.isFinite(n) && n > 0);
        if (!stamps.length) return false;
        return Date.now() - Math.max(...stamps) * 1000 <= FRESH_MS;
    } catch { return false; }
}

// One counted guess at the PIN ('A') or the phrase ('B'). Returns { ok: true } or { resp }.
async function countedGuess(env, which, proof) {
    const isPin = which === 'A';
    const label = isPin ? 'PIN' : 'phrase';
    const tries = isPin ? PIN_TRIES : PHRASE_TRIES;
    const wait  = isPin ? PIN_WAIT : PHRASE_WAIT;

    const stored = await getSetting(env, 'lock_v' + which);
    if (!stored) return { resp: refuse('The Locked folder has not been set up yet', 409) };

    const until = Number(await getSetting(env, 'lock_until' + which) || 0);
    if (until > Date.now()) {
        const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
        return { resp: refuse('Too many wrong tries. Try again in ' + mins + (mins === 1 ? ' minute.' : ' minutes.'), 429) };
    }

    if (safeEqual(await proofMac(env, which, proof), stored)) {
        await setSetting(env, 'lock_fails' + which, 0);
        return { ok: true };
    }
    const fails = Number(await getSetting(env, 'lock_fails' + which) || 0) + 1;
    await new Promise(r => setTimeout(r, 700));
    if (fails >= tries) {
        await setSetting(env, 'lock_until' + which, Date.now() + wait);
        await setSetting(env, 'lock_fails' + which, 0);
        return { resp: refuse('Wrong ' + label + '. Too many wrong tries: locked for ' + (wait / 60000) + ' minutes.' + (isPin ? ' Use “Forgot PIN?” if you need to.' : ''), 403) };
    }
    await setSetting(env, 'lock_fails' + which, fails);
    const left = tries - fails;
    return { resp: refuse('Wrong ' + label + '. ' + left + (left === 1 ? ' try left.' : ' tries left.'), 403) };   // 403, not 401: 401 means "sign in again"
}

// Is the folder set up? The Worker's half is shown only before set-up (the browser needs it to
// build the first locked copies); after that it is released only with a correct proof.
async function lockStatus(ctx) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const { env } = ctx;
    const saltA = await getSetting(env, 'lock_saltA');
    if (!saltA) return json({ configured: false, half: await serverHalf(env) });
    return json({ configured: true, saltA, saltB: await getSetting(env, 'lock_saltB') });
}

async function lockSetup(ctx) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const { env } = ctx;
    if (await getSetting(env, 'lock_saltA')) return refuse('The Locked folder is already set up', 409);
    const b = await bodyJson(ctx.request);
    if (!b || !['saltA', 'saltB', 'proofA', 'proofB', 'wrapA', 'wrapB'].every(k => validB64(b[k]))) {
        return refuse('Invalid request', 400);
    }
    await setSetting(env, 'lock_saltB', b.saltB);
    await setSetting(env, 'lock_vA', await proofMac(env, 'A', b.proofA));
    await setSetting(env, 'lock_vB', await proofMac(env, 'B', b.proofB));
    await setSetting(env, 'lock_wrapA', b.wrapA);
    await setSetting(env, 'lock_wrapB', b.wrapB);
    await setSetting(env, 'lock_version', '1');
    for (const k of ['lock_failsA', 'lock_failsB', 'lock_untilA', 'lock_untilB']) await setSetting(env, k, 0);
    await setSetting(env, 'lock_saltA', b.saltA);          // written last: this marks "set up"
    return json({ token: await issueToken(env) });
}

// Daily unlock: correct PIN proof → token + the Worker's half + the PIN-locked copy of MK.
async function lockUnlock(ctx) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const { env } = ctx;
    const b = await bodyJson(ctx.request);
    if (!b || !validB64(b.proof)) return refuse('Invalid request', 400);
    const g = await countedGuess(env, 'A', b.proof);
    if (!g.ok) return g.resp;
    return json({ token: await issueToken(env), half: await serverHalf(env), wrapA: await getSetting(env, 'lock_wrapA') });
}

// Emergency unlock: needs a fresh GitHub sign-in AND the phrase proof.
async function lockRecover(ctx) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const { env } = ctx;
    if (!freshSignIn(ctx.auth.token)) {
        return json({ error: 'Sign in with GitHub again first, then try within 10 minutes.', fresh: true }, 403);
    }
    const b = await bodyJson(ctx.request);
    if (!b || !validB64(b.proof)) return refuse('Invalid request', 400);
    const g = await countedGuess(env, 'B', b.proof);
    if (!g.ok) return g.resp;
    return json({ token: await issueToken(env), half: await serverHalf(env), wrapB: await getSetting(env, 'lock_wrapB'), saltA: await getSetting(env, 'lock_saltA') });
}

// New PIN (used after recovery). Needs the unlock token. Replaces the PIN lock only, bumps the
// version so every other device must enter the new PIN, and clears the PIN lock-out.
async function lockChangePin(ctx) {
    if (ctx.auth.role !== 'chef') return refuse('Key refused on this route', 403);
    const { env } = ctx;
    const b = await bodyJson(ctx.request);
    if (!b || !['saltA', 'proofA', 'wrapA'].every(k => validB64(b[k]))) return refuse('Invalid request', 400);
    await setSetting(env, 'lock_saltA', b.saltA);
    await setSetting(env, 'lock_vA', await proofMac(env, 'A', b.proofA));
    await setSetting(env, 'lock_wrapA', b.wrapA);
    await setSetting(env, 'lock_version', String(Number((await getSetting(env, 'lock_version')) || 1) + 1));
    await setSetting(env, 'lock_failsA', 0);
    await setSetting(env, 'lock_untilA', 0);
    return json({ token: await issueToken(env) });
}
