// ─── SOURCE Notes — Office shelf (OS) and the Locked folder ──────────────────
// Brand storage files in folders, known by folder path + file name (no ID numbers).
// Same name in the same folder = replace (after a confirm); the version before goes to the Bin.
// The Locked folder is the same screen behind an 8-digit PIN: files are encrypted in this browser.

import { api, enc, recoverPending, clearRecover, signInAgain } from './api.js';
import {
    h, icon, iconBtn, toast, fail, confirmBox, promptBox, openModal,
    fmtSize, fmtDate, extOf, mimeFor, saveBlobAs, validName
} from './ui.js';
import { openViewer } from './viewer.js';
import { openFolderSidebar } from './shelves.js';
import * as vault from './vault.js';

let lastRoot = null, lastParts = [], renderToken = 0;
export const refreshOffice = () => (lastRoot ? renderOffice(lastRoot, lastParts) : Promise.resolve());

// ── one adapter for both spaces: Locked adds the lock token and encrypts / decrypts ──
function space(name) {
    const lock = name === 'locked';
    const o = lock ? { lock: true } : {};
    const base = '/' + name;
    return {
        name, lock,
        folders: async () => (await api.get(base + '/folders', o)).folders,
        files: async id => (await api.get(base + '/files?folder_id=' + enc(id), o)).files,
        createFolder: (n, parent) => api.post(base + '/folders', { name: n, parent_id: parent || null }, o),
        deleteFolder: id => api.del(base + '/folders/' + id, o),
        read: async path => { const b = await api.blob(base + '/file?path=' + enc(path), o); return lock ? vault.decryptBlob(b) : b; },
        write: async (path, blob) => api.put(base + '/file?path=' + enc(path), lock ? await vault.encryptBlob(blob) : blob, o),
        del: path => api.del(base + '/file?path=' + enc(path), o),
        move: (path, toId) => api.post(base + '/move?path=' + enc(path), { to_folder_id: toId }, o),
        dup: path => api.post(base + '/duplicate?path=' + enc(path), undefined, o),
        bin: async () => (await api.get(base + '/bin', o)).files,
        binRead: async id => { const b = await api.blob(base + `/bin/${id}/file`, o); return lock ? vault.decryptBlob(b) : b; },
        binDelete: id => api.del(base + `/bin/${id}`, o),
        size: n => (lock ? vault.plainSize(n) : n)
    };
}

// ── page ─────────────────────────────────────────────────────────────────────
// parts: [] | [folderId] | ['bin'] | ['locked'] | ['locked', folderId] | ['locked','bin']
export async function renderOffice(root, parts = []) {
    lastRoot = root; lastParts = parts;
    const token = ++renderToken;
    const lockedMode = parts[0] === 'locked';
    const rest = lockedMode ? parts.slice(1) : parts;

    if (lockedMode && !(await vault.isUnlocked())) {
        if (token === renderToken) await renderGate(root, token);
        return;
    }

    root.replaceChildren(h('section', { class: 'office-page' }, h('p', { class: 'empty' }, 'Loading…')));
    const sp = space(lockedMode ? 'locked' : 'office');
    let folders;
    try { folders = await sp.folders(); } catch (e) {
        if (e.status === 423) return;           // gate is shown by the app
        root.replaceChildren(h('section', { class: 'office-page' }, h('p', { class: 'empty err' }, e.message))); return;
    }
    if (token !== renderToken) return;

    const inBin = rest[0] === 'bin';
    let folder = !inBin && rest[0] ? folders.find(f => f.id === rest[0]) : null;
    if (!inBin && !folder && folders.length) folder = folders.find(f => !f.parent_id) || folders[0];

    const hashFor = id => '#os/' + (lockedMode ? 'locked/' : '') + (id || '');
    const main = h('div', { class: 'office-main' });
    const page = h('section', { class: 'office-page' + (lockedMode ? ' locked' : '') },
        head(sp, lockedMode, folder, folders),
        h('div', { class: 'office-body' }, side(sp, folders, folder, inBin, lockedMode, hashFor), main));
    root.replaceChildren(page);

    if (inBin) await drawBin(main, sp);
    else await drawFiles(main, sp, folder, folders, lockedMode);
}

function head(sp, lockedMode, folder, folders) {
    return h('div', { class: 'office-head' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { location.hash = lockedMode ? '#os' : ''; } },
            icon('back', 16), h('span', {}, lockedMode ? 'Office' : 'Shelves')),
        h('div', { class: 'office-titles' },
            h('h1', {}, lockedMode ? 'Locked Folder' : 'Office Shelf'),
            h('p', {}, lockedMode ? 'PIN-protected notes. Only Chef can open this; the agent cannot reach it.' : 'Brand storage files. The shared desk for the AI agent.')),
        h('div', { class: 'office-actions' },
            lockedMode
                ? h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
                    await vault.lockDevice(); toast('Locked on this device'); location.hash = '#os';
                } }, icon('lock', 16), h('span', {}, 'Lock this device'))
                : h('button', { class: 'btn ghost', type: 'button', onclick: () => openFolderSidebar({ shelf: 'OS' }) },
                    icon('folder', 16), h('span', {}, 'Add Folder')),
            lockedMode
                ? h('button', { class: 'btn ghost', type: 'button', onclick: () => addLockedFolder(sp, null) }, icon('folder', 16), h('span', {}, 'Add Folder'))
                : null,
            lockedMode && folder
                ? h('button', { class: 'btn ghost', type: 'button', onclick: () => addLockedFolder(sp, folder.id) }, icon('folder', 16), h('span', {}, 'Add Sub-folder'))
                : null));
}

async function addLockedFolder(sp, parentId) {
    const n = await promptBox(parentId ? 'Sub-folder name' : 'Folder name', { ok: 'Create' });
    if (!n) return;
    try { await sp.createFolder(n, parentId); toast('Folder created'); await refreshOffice(); } catch (e) { fail(e); }
}

// ── left list: folders, Bin, (Locked) ────────────────────────────────────────
function side(sp, folders, current, inBin, lockedMode, hashFor) {
    const build = pid => {
        const kids = folders.filter(f => (f.parent_id || '') === pid);
        if (!kids.length) return null;
        return h('ul', { class: 'ftree' }, ...kids.map(f => h('li', {},
            h('div', { class: 'ftree-row' + (current && current.id === f.id && !inBin ? ' active' : '') },
                h('button', { class: 'ftree-name', type: 'button', onclick: () => { location.hash = hashFor(f.id); } },
                    icon('folder', 15), h('span', {}, f.name)),
                iconBtn('trash', 'Delete folder', () => deleteFolder(sp, f))),
            build(f.id))));
    };
    const tree = build('');
    return h('aside', { class: 'office-side' },
        h('div', { class: 'side-label' }, lockedMode ? 'Locked folders' : 'Folders'),
        tree || h('p', { class: 'empty small' }, lockedMode ? 'No locked folders yet.' : 'The shelf starts empty. Use Add Folder to make your first folder.'),
        h('div', { class: 'divider' }),
        h('div', { class: 'ftree-row' + (inBin ? ' active' : '') },
            h('button', { class: 'ftree-name', type: 'button', onclick: () => { location.hash = hashFor('bin'); } }, icon('bin', 15), h('span', {}, 'Bin'))),
        lockedMode ? null : h('div', { class: 'ftree-row special' },
            h('button', { class: 'ftree-name', type: 'button', onclick: () => { location.hash = '#os/locked'; } }, icon('lock', 15), h('span', {}, 'Locked Folder'))),
        lockedMode ? h('div', { class: 'ftree-row' },
            h('button', { class: 'ftree-name', type: 'button', onclick: () => { location.hash = '#os'; } }, icon('back', 15), h('span', {}, 'Office folders'))) : null);
}

async function deleteFolder(sp, f) {
    if (!(await confirmBox('Delete the folder “' + f.name + '”? It must be empty.', { ok: 'Delete', danger: true }))) return;
    try { await sp.deleteFolder(f.id); toast('Folder deleted'); location.hash = lastParts[0] === 'locked' ? '#os/locked' : '#os'; await refreshOffice(); } catch (e) { fail(e); }
}

// ── files in a folder ────────────────────────────────────────────────────────
async function drawFiles(main, sp, folder, folders, lockedMode) {
    if (!folder) {
        main.replaceChildren(h('p', { class: 'empty' }, folders.length ? 'Choose a folder on the left.' : 'No folders yet.'));
        return;
    }
    let files;
    try { files = await sp.files(folder.id); } catch (e) { if (e.status !== 423) main.replaceChildren(h('p', { class: 'empty err' }, e.message)); return; }

    const fi = h('input', { type: 'file', multiple: true, style: 'display:none' });
    fi.addEventListener('change', async () => { const list = [...fi.files]; fi.value = ''; for (const f of list) await uploadOne(sp, folder, files, f); await refreshOffice(); });

    const table = files.length
        ? h('div', { class: 'file-table' },
            h('div', { class: 'file-line head' }, h('span', {}, 'File'), h('span', { class: 'col-size' }, 'Size'), h('span', { class: 'col-when' }, 'Last saved'), h('span', {})),
            ...files.map(f => fileLine(sp, folder, f)))
        : h('p', { class: 'empty' }, 'This folder is empty. Upload a file or start a new .md note.');

    main.replaceChildren(
        h('div', { class: 'main-head' },
            h('div', { class: 'crumb' }, icon('folder', 16), h('span', {}, folder.path.split('/').join(' / '))),
            h('div', { class: 'main-actions' },
                h('button', { class: 'btn ghost', type: 'button', onclick: () => newNote(sp, folder, files) }, icon('plus', 16), h('span', {}, 'New .md note')),
                h('button', { class: 'btn primary', type: 'button', onclick: () => fi.click() }, icon('upload', 16), h('span', {}, 'Upload')),
                fi)),
        table);
}

function fileLine(sp, folder, f) {
    const editable = ['md', 'txt'].includes(extOf(f.name));
    return h('div', { class: 'file-line' },
        h('button', { class: 'file-name', type: 'button', title: 'Open full screen', onclick: () => openFile(sp, f) }, f.name),
        h('span', { class: 'col-size' }, fmtSize(sp.size(f.size))),
        h('span', { class: 'col-when' }, fmtDate(f.saved_at), ' · ', h('span', { class: 'by ' + f.saved_by }, f.saved_by === 'agent' ? 'agent' : 'Chef')),
        h('span', { class: 'file-actions' },
            iconBtn('search', 'Open full screen', () => openFile(sp, f)),
            editable ? iconBtn('edit', 'Edit', () => openFile(sp, f, true)) : null,
            iconBtn('copy', 'Duplicate', async () => { try { await sp.dup(f.path); toast('Duplicated'); await refreshOffice(); } catch (e) { fail(e); } }),
            iconBtn('move', 'Move to folder', async () => { if (await chooseFolder(sp, f)) await refreshOffice(); }),
            iconBtn('download', 'Download', async () => { try { saveBlobAs(await sp.read(f.path), f.name); } catch (e) { fail(e); } }),
            iconBtn('trash', 'Delete', async () => {
                if (!(await confirmBox('Delete "' + f.name + '"? This cannot be undone.', { ok: 'Delete', danger: true }))) return;
                try { await sp.del(f.path); toast('Deleted'); await refreshOffice(); } catch (e) { fail(e); }
            })));
}

function openFile(sp, f, startEditing = false) {
    return openViewer({
        title: f.name, sub: f.path.split('/').slice(0, -1).join(' / ') + ' · saved by ' + (f.saved_by === 'agent' ? 'agent' : 'Chef') + ' · ' + fmtDate(f.saved_at),
        name: f.name, startEditing,
        load: () => sp.read(f.path),
        save: blob => sp.write(f.path, blob),
        duplicate: () => sp.dup(f.path),
        remove: () => sp.del(f.path),
        move: () => chooseFolder(sp, f),
        onChange: () => refreshOffice()
    });
}

// Upload: same name in the same folder replaces that file, after a confirm.
async function uploadOne(sp, folder, files, file) {
    const name = validName(file.name);
    if (!name) { toast('"' + file.name + '" has a file name that is not allowed', 'err'); return; }
    if (files.some(x => x.name === name) && !(await confirmBox('Replace the existing file?', { ok: 'Replace', title: name }))) return;
    try { await sp.write(folder.path + '/' + name, file); toast('Uploaded ' + name); } catch (e) { fail(e); }
}

async function newNote(sp, folder, files) {
    let n = await promptBox('File name', { value: 'untitled.md', ok: 'Create', title: 'New note' });
    if (!n) return;
    if (!extOf(n)) n += '.md';
    const name = validName(n);
    if (!name) { toast('That file name is not allowed', 'err'); return; }
    if (files.some(x => x.name === name) && !(await confirmBox('Replace the existing file?', { ok: 'Replace', title: name }))) return;
    try {
        await sp.write(folder.path + '/' + name, new Blob([''], { type: mimeFor(name) }));
        await refreshOffice();
        const fresh = (await sp.files(folder.id)).find(x => x.name === name);
        if (fresh) openFile(sp, fresh, ['md', 'txt'].includes(extOf(name)));
    } catch (e) { fail(e); }
}

// Move to folder — Chef only
function chooseFolder(sp, f) {
    return new Promise(async resolve => {
        let folders;
        try { folders = (await sp.folders()).filter(x => x.id !== f.folder_id); } catch (e) { fail(e); return resolve(false); }
        if (!folders.length) { toast('There is no other folder to move it to', 'err'); return resolve(false); }
        let done = false;
        const finish = v => { if (!done) { done = true; m.close(); resolve(v); } };
        const sel = h('select', { class: 'field' }, ...folders.map(x => h('option', { value: x.id }, x.path.split('/').join(' / '))));
        const m = openModal({
            title: 'Move to folder', cls: 'small',
            body: h('div', {}, h('p', { class: 'confirm-text' }, '“' + f.name + '”'), sel,
                h('div', { class: 'btn-row' },
                    h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(false) }, 'Cancel'),
                    h('button', { class: 'btn primary', type: 'button', onclick: async () => {
                        try { await sp.move(f.path, sel.value); toast('Moved'); finish(true); } catch (e) { fail(e); }
                    } }, 'Move'))),
            onClose: () => { if (!done) { done = true; resolve(false); } }
        });
    });
}

// ── Bin ──────────────────────────────────────────────────────────────────────
async function drawBin(main, sp) {
    let files;
    try { files = await sp.bin(); } catch (e) { if (e.status !== 423) main.replaceChildren(h('p', { class: 'empty err' }, e.message)); return; }
    main.replaceChildren(
        h('div', { class: 'main-head' },
            h('div', { class: 'crumb' }, icon('bin', 16), h('span', {}, 'Bin'))),
        h('p', { class: 'hint' }, 'The version before each replaced file lands here with the date and time (UTC) in its name. Nothing leaves the Bin on its own — delete each file by hand. The agent cannot open the Bin.'),
        files.length
            ? h('div', { class: 'file-table' },
                h('div', { class: 'file-line head' }, h('span', {}, 'File'), h('span', { class: 'col-size' }, 'Size'), h('span', { class: 'col-when' }, 'Was in'), h('span', {})),
                ...files.map(f => h('div', { class: 'file-line' },
                    h('button', { class: 'file-name', type: 'button', onclick: () => openViewer({ title: f.name, sub: 'In the Bin', name: f.name, load: () => sp.binRead(f.id) }) }, f.name),
                    h('span', { class: 'col-size' }, fmtSize(sp.size(f.size))),
                    h('span', { class: 'col-when' }, (f.bin_original || '').split('/').slice(0, -1).join(' / ')),
                    h('span', { class: 'file-actions' },
                        iconBtn('search', 'Open', () => openViewer({ title: f.name, sub: 'In the Bin', name: f.name, load: () => sp.binRead(f.id) })),
                        iconBtn('download', 'Download', async () => { try { saveBlobAs(await sp.binRead(f.id), f.name); } catch (e) { fail(e); } }),
                        iconBtn('trash', 'Delete from the Bin', async () => {
                            if (!(await confirmBox('Delete "' + f.name + '" from the Bin for good?', { ok: 'Delete', danger: true }))) return;
                            try { await sp.binDelete(f.id); toast('Deleted'); await refreshOffice(); } catch (e) { fail(e); }
                        })))))
            : h('p', { class: 'empty' }, 'The Bin is empty.'));
}

// ── Locked folder gate: set up · PIN · Forgot PIN ────────────────────────────
const pinField = (placeholder, auto) => {
    const f = h('input', { class: 'field', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: auto, placeholder });
    f.addEventListener('input', () => { f.value = f.value.replace(/\D/g, '').slice(0, 8); });
    return f;
};
const phraseField = (placeholder, auto) => h('input', { class: 'field', type: 'password', autocomplete: auto, placeholder, spellcheck: 'false', autocapitalize: 'none' });
const PIN_OK = v => /^\d{8}$/.test(v);

async function renderGate(root, token) {
    root.replaceChildren(h('section', { class: 'office-page locked' }, h('p', { class: 'empty' }, 'Loading…')));
    let st;
    try { st = await vault.status(); } catch (e) { root.replaceChildren(h('section', { class: 'office-page locked' }, h('p', { class: 'empty err' }, e.message))); return; }
    if (token !== renderToken) return;

    const show = card => { root.replaceChildren(h('section', { class: 'office-page locked gate' }, card)); };
    const done = () => renderOffice(root, lastParts);
    const back = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { clearRecover(); location.hash = '#os'; } }, 'Back to Office');

    // one form: fields → check → run → show the Worker's message if it refuses
    const card = ({ title, intro, fields, label, check, run, extra }) => {
        const msg = h('p', { class: 'gate-msg' });
        const go = h('button', { class: 'btn primary', type: 'submit' }, label);
        const form = h('form', { class: 'gate-card' },
            h('div', { class: 'gate-icon' }, icon('lock', 34)),
            h('h2', {}, title), h('p', {}, intro), fields, msg, go, extra || null, back);
        form.addEventListener('submit', async e => {
            e.preventDefault(); msg.textContent = '';
            const bad = check(); if (bad) { msg.textContent = bad; return; }
            go.disabled = true; go.textContent = 'Working…';
            try { await run(); await done(); }
            catch (err) { msg.textContent = err.message || 'Could not unlock'; go.disabled = false; go.textContent = label; }
        });
        setTimeout(() => { const f = form.querySelector('input'); if (f) f.focus(); }, 40);
        return form;
    };

    // 1 · first time: PIN + emergency phrase
    if (!st.configured) {
        const pin = pinField('8-digit PIN', 'new-password'), pin2 = pinField('Repeat the PIN', 'new-password');
        const ph = phraseField('Emergency phrase (4 or more words)', 'off'), ph2 = phraseField('Repeat the phrase', 'off');
        return show(card({
            title: 'Set up the Locked Folder',
            intro: 'Choose an 8-digit PIN for daily use, and an emergency phrase of four or more words that you will remember. The phrase is only for a forgotten PIN. Neither is stored anywhere in readable form; your files are encrypted in this browser.',
            fields: [pin, pin2, ph, ph2], label: 'Create',
            check: () => !PIN_OK(pin.value) ? 'The PIN is exactly 8 digits'
                : pin.value !== pin2.value ? 'The two PINs do not match'
                : vault.phraseWords(ph.value) < 4 ? 'The phrase needs at least four words'
                : vault.cleanPhrase(ph.value) !== vault.cleanPhrase(ph2.value) ? 'The two phrases do not match' : '',
            run: () => vault.setup(pin.value, ph.value, st)
        }));
    }

    // 3 · Forgot PIN, after the fresh GitHub sign-in
    if (recoverPending()) {
        const ph = phraseField('Your emergency phrase', 'off');
        const pin = pinField('New 8-digit PIN', 'new-password'), pin2 = pinField('Repeat the new PIN', 'new-password');
        return show(card({
            title: 'Forgot PIN',
            intro: 'Enter your emergency phrase and choose a new 8-digit PIN. This works for 10 minutes after signing in with GitHub. Your files stay as they are.',
            fields: [ph, pin, pin2], label: 'Reset PIN',
            check: () => !ph.value.trim() ? 'Enter the emergency phrase'
                : !PIN_OK(pin.value) ? 'The new PIN is exactly 8 digits'
                : pin.value !== pin2.value ? 'The two PINs do not match' : '',
            run: async () => { await vault.recover(ph.value, pin.value, st); clearRecover(); toast('New PIN set'); },
            extra: h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { try { await signInAgain(); } catch (e) { fail(e); } } }, 'Sign in with GitHub again')
        }));
    }

    // 2 · every day: PIN
    const pin = pinField('8-digit PIN', 'current-password');
    return show(card({
        title: 'Locked Folder',
        intro: 'Enter your PIN to open the Locked folder on this device. You will be asked again only if this browser’s data is cleared or you open it on another device.',
        fields: [pin], label: 'Unlock',
        check: () => PIN_OK(pin.value) ? '' : 'The PIN is exactly 8 digits',
        run: () => vault.unlock(pin.value, st),
        extra: h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => {
            if (!(await confirmBox('Reset the PIN? You will sign in with GitHub again, then enter your emergency phrase.', { ok: 'Continue' }))) return;
            try { await signInAgain(); } catch (e) { fail(e); }
        } }, 'Forgot PIN?')
    }));
}
