// ─── SOURCE Notes — Shelves 1–3 (WS, RS, AS) ─────────────────────────────────
// One system: same folders, cards and screens. A folder is a box file; every note
// inside has its own Record Card and carries its number on the shelf (WS0001…).
// Also holds the shared Add Folder sidebar and the Index sidebar.

import { api, enc } from './api.js';
import {
    h, icon, iconBtn, toast, fail, confirmBox, promptBox, openModal, openSidebar,
    boxFile, boxColour, fmtDay, fmtSize, todayStr, mimeFor, extOf, validName
} from './ui.js';
import { openViewer } from './viewer.js';

export const SHELF = {
    WS: { key: 'WS', title: 'Working Shelf',   line: 'What am I using this for now?',                      colour: '#9fd0ff' },
    RS: { key: 'RS', title: 'Reference Shelf', line: 'What might I need soon or again?',                    colour: '#a9e8b0' },
    AS: { key: 'AS', title: 'Archive Shelf',   line: 'Is this finished, but worth keeping or discarding?',  colour: '#fff1a0' },
    OS: { key: 'OS', title: 'Office Shelf',    line: 'Brand storage files',                                 colour: '#cdb4ff' }
};

// ── data ─────────────────────────────────────────────────────────────────────
export const data = { folders: [], records: [] };
let refreshHook = async () => {};
export const setRefreshHook = fn => { refreshHook = fn; };

export async function loadShelfData() {
    const [f, r] = await Promise.all([api.get('/source/folders'), api.get('/source/records')]);
    data.folders = f.folders; data.records = r.records;
}

const pad = n => String(n).padStart(4, '0');
const foldersOf = shelf => data.folders.filter(f => f.shelf === shelf);
const recordsIn = id => data.records.filter(r => r.folder_id === id);

export function folderPath(id) {
    const parts = []; let cur = data.folders.find(f => f.id === id); let guard = 0;
    while (cur && guard++ < 50) { parts.unshift(cur.name); cur = cur.parent_id ? data.folders.find(f => f.id === cur.parent_id) : null; }
    return parts.join(' / ');
}

function folderOptions(shelf) {
    const list = foldersOf(shelf), out = [];
    const walk = (pid, prefix) => list.filter(f => (f.parent_id || '') === pid).forEach(f => {
        const label = prefix ? prefix + ' / ' + f.name : f.name;
        out.push({ id: f.id, label }); walk(f.id, label);
    });
    walk('', '');
    return out;
}

// ── shelf page ───────────────────────────────────────────────────────────────
export function renderShelf(root, key) {
    const meta = SHELF[key];
    const folders = foldersOf(key);
    const recs = data.records.filter(r => r.shelf === key);

    const grid = h('div', { class: 'bf-grid' });
    folders.forEach((f, i) => grid.append(
        boxFile({ abbr: key, colour: boxColour(i), name: f.name, count: recordsIn(f.id).length || '', onclick: () => openBox(f) })));
    if (!folders.length) grid.append(h('p', { class: 'empty' }, 'No box files yet. Use Add Folder to make the first one.'));

    root.replaceChildren(h('section', { class: 'shelf-page', style: `--accent:${meta.colour}` },
        h('div', { class: 'shelf-head' },
            h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { location.hash = ''; } }, icon('back', 16), h('span', {}, 'Shelves')),
            h('div', { class: 'shelf-badge' }, key),
            h('div', { class: 'shelf-titles' },
                h('h1', {}, meta.title),
                h('p', {}, meta.line),
                h('p', { class: 'shelf-count' }, `${folders.length} ${folders.length === 1 ? 'folder' : 'folders'} · ${recs.length} ${recs.length === 1 ? 'note' : 'notes'}`)),
            h('div', { class: 'shelf-actions' },
                h('button', { class: 'btn ghost', type: 'button', onclick: () => openFolderSidebar({ shelf: key }) }, icon('folder', 16), h('span', {}, 'Add Folder')),
                h('button', { class: 'btn primary', type: 'button', onclick: () => openCard({ mode: 'create', shelf: key }) }, icon('plus', 16), h('span', {}, 'Add Card')))),
        grid));
}

// ── box file opened: its notes in File ID order ──────────────────────────────
let boxRedraw = null;
export const redrawOpenBox = () => { if (boxRedraw) boxRedraw(); };

export function openBox(folder) {
    const m = openModal({ title: folderPath(folder.id), wide: true, body: h('div'), onClose: () => { boxRedraw = null; } });
    const draw = () => {
        const recs = recordsIn(folder.id);
        m.setBody(h('div', { class: 'box-open', style: `--accent:${SHELF[folder.shelf].colour}` },
            recs.length ? h('ul', { class: 'note-list' }, ...recs.map(noteRow)) : h('p', { class: 'empty' }, 'Nothing filed in this box file yet.'),
            h('div', { class: 'btn-row' },
                h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); openCard({ mode: 'create', shelf: folder.shelf, folderId: folder.id }); } },
                    icon('plus', 16), h('span', {}, 'Add Card here')))));
    };
    draw();
    boxRedraw = draw;
    return m;
}

export function noteRow(r) {
    const due = r.look_again && r.look_again <= todayStr();
    return h('li', { class: 'note-row' },
        h('span', { class: 'note-id' }, r.file_id),
        h('span', { class: 'note-title' }, r.title, due ? h('span', { class: 'due', title: 'Look again by ' + fmtDay(r.look_again) }, 'look again') : null),
        iconBtn('eye', 'Record card', () => openCard({ mode: 'view', record: r })),
        iconBtn('search', 'Open full screen', () => openRecord(r)));
}

export function openRecord(r, startEditing = false) {
    return openViewer({
        title: r.title, sub: r.file_id + ' · ' + r.file_name, name: r.file_name, startEditing,
        load: () => api.blob(`/source/records/${r.id}/file`),
        save: blob => api.put(`/source/records/${r.id}/file`, blob, { headers: { 'Content-Type': mimeFor(r.file_name) } }),
        upload: file => api.put(`/source/records/${r.id}/file`, file, { headers: { 'X-File-Name': enc(file.name), 'Content-Type': file.type || 'application/octet-stream' } }),
        duplicate: () => api.post(`/source/records/${r.id}/duplicate`),
        remove: () => api.del(`/source/records/${r.id}`),
        onChange: () => refreshHook()
    });
}

// ── Record Card (popup): view / create / edit ────────────────────────────────
export function openCard({ mode, record, shelf, folderId }) {
    const m = openModal({ title: 'Record Card', body: h('div') });
    if (mode === 'view') drawView(m, record);
    else drawForm(m, { mode, record, shelf, folderId });
    return m;
}

function row(label, value) {
    return h('div', { class: 'card-row' }, h('div', { class: 'card-label' }, label), h('div', { class: 'card-value' }, value || '—'));
}

function drawView(m, r) {
    m.setTitle('Record Card · ' + r.file_id);
    m.setBody(h('div', { class: 'index-card', style: `--accent:${SHELF[r.shelf].colour}` },
        h('div', { class: 'card-id' }, h('span', { class: 'shelf-badge sm' }, r.shelf), h('span', {}, r.file_id)),
        row('What is it?', r.title),
        row('What is it about?', r.about),
        row('Where it sits?', folderPath(r.folder_id)),
        row('Why I kept it', r.why),
        row('Look again by', fmtDay(r.look_again)),
        row('File', r.file_name + ' · ' + fmtSize(r.size)),
        h('div', { class: 'btn-row' },
            h('button', { class: 'btn ghost', type: 'button', onclick: () => drawForm(m, { mode: 'edit', record: r }) }, icon('edit', 16), h('span', {}, 'Edit card')),
            h('button', { class: 'btn primary', type: 'button', onclick: () => m.close() }, 'Close'))));
}

const KEYS = ['WS', 'RS', 'AS', 'OS'];
const cleanFileName = t => String(t).trim().replace(/[\/\\\u0000-\u001f]+/g, '-').replace(/^\.+/, '').slice(0, 110);

function drawForm(m, { mode, record, shelf, folderId }) {
    const editing = mode === 'edit';
    m.setTitle(editing ? 'Edit Record Card · ' + record.file_id : 'New Record Card');

    let sel = editing ? record.shelf : (shelf || 'WS');
    let officeFolders = null;        // loaded when OS is ticked
    let chosenFile = null;

    const idShow = h('div', { class: 'id-show' });
    const ticks = KEYS.map(k => {
        const cb = h('input', { type: 'checkbox' });
        cb.checked = k === sel;
        if (editing && k === 'OS') cb.disabled = true;
        cb.addEventListener('change', async () => {
            cb.checked = true;
            if (sel === k) return;
            sel = k;
            if (k === 'OS' && !officeFolders) {
                try { officeFolders = (await api.get('/office/folders')).folders; } catch (e) { fail(e); officeFolders = []; }
            }
            sync();
        });
        return h('label', { class: 'tick' + (editing && k === 'OS' ? ' off' : '') }, cb, h('span', {}, k));
    });

    const title   = h('input', { class: 'field', type: 'text', maxlength: '140', value: editing ? record.title : '', placeholder: 'A short name for this note' });
    const about   = h('textarea', { class: 'field', rows: '2', maxlength: '500' }); about.value = editing ? record.about : '';
    const why     = h('textarea', { class: 'field', rows: '2', maxlength: '500' }); why.value = editing ? record.why : '';
    const look    = h('input', { class: 'field', type: 'date', value: editing ? record.look_again : '' });
    const folder  = h('select', { class: 'field' });
    const format  = h('select', { class: 'field narrow' }, h('option', { value: 'md' }, '.md'), h('option', { value: 'txt' }, '.txt'));
    const body    = h('textarea', { class: 'field editor-small', rows: '8', placeholder: 'Write your note here, or upload a file below…' });
    const fileIn  = h('input', { type: 'file', style: 'display:none' });
    const fileLbl = h('span', { class: 'file-chosen' }, 'No file chosen');
    const clearBtn = h('button', { class: 'btn ghost sm', type: 'button', style: 'display:none', onclick: () => setFile(null) }, 'Clear');
    const osName  = h('div', { class: 'os-name' });
    const folderLbl = h('label', { class: 'lbl' }, 'Where it sits?');

    fileIn.addEventListener('change', () => setFile(fileIn.files[0] || null));
    function setFile(f) {
        chosenFile = f; fileIn.value = '';
        fileLbl.textContent = f ? f.name + ' · ' + fmtSize(f.size) : 'No file chosen';
        clearBtn.style.display = f ? '' : 'none';
        body.disabled = !!f; body.style.opacity = f ? '.4' : '';
    }

    function fillFolders() {
        const keep = folder.value || folderId || (editing && sel === record.shelf ? record.folder_id : '');
        folder.replaceChildren(h('option', { value: '' }, 'Choose a folder…'));
        const opts = sel === 'OS'
            ? (officeFolders || []).map(f => ({ id: f.id, label: f.path.split('/').join(' / ') })).sort((a, b) => a.label.localeCompare(b.label))
            : folderOptions(sel);
        opts.forEach(o => folder.append(h('option', { value: o.id }, o.label)));
        folder.value = opts.some(o => o.id === keep) ? keep : '';
    }

    const osBox   = h('div', { class: 'os-note' });
    const submitBtn = h('button', { class: 'btn primary', type: 'submit' });
    const shelfOnly = [];            // elements hidden when OS is ticked
    function sync() {
        ticks.forEach((t, i) => { t.firstChild.checked = KEYS[i] === sel; });
        const os = sel === 'OS';
        const next = sel + pad(data.records.filter(r => r.shelf === sel).length + 1);
        idShow.textContent = os ? 'No ID number — Office files are known by folder and file name'
            : editing && sel === record.shelf ? record.file_id : next + (editing ? ' (next number on this shelf)' : '');
        folderLbl.textContent = os ? 'Send to which Office folder?' : 'Where it sits?';
        shelfOnly.forEach(el => { el.style.display = os ? 'none' : ''; });
        osBox.style.display = os ? '' : 'none';
        fillFolders();
        updateOsName();
        fileRow.style.display = os ? 'none' : '';
        submitBtn.textContent = editing ? 'Save card' : (os ? 'Send to Office' : 'Save');
    }
    function updateOsName() {
        if (sel !== 'OS') return;
        const n = cleanFileName(title.value) || '(title)';
        osName.textContent = 'Saved in the Office folder as: ' + n + '.' + format.value;
    }
    title.addEventListener('input', updateOsName);
    format.addEventListener('change', updateOsName);

    const aboutBlock = h('div', {}, h('label', { class: 'lbl' }, 'What is it about?'), about);
    const whyBlock   = h('div', {}, h('label', { class: 'lbl' }, 'Why I kept it'), why);
    const lookBlock  = h('div', {}, h('label', { class: 'lbl' }, 'Look again by'), look);
    shelfOnly.push(aboutBlock, whyBlock, lookBlock);
    osBox.append(osName);

    const fileRow = h('div', { class: 'file-row' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => fileIn.click() }, icon('upload', 16), h('span', {}, 'Upload a file instead')),
        fileLbl, clearBtn, fileIn);

    const form = h('form', { class: 'card-form', novalidate: true },
        h('div', {}, h('label', { class: 'lbl' }, 'Shelf'), h('div', { class: 'ticks' }, ticks)),
        h('div', {}, h('label', { class: 'lbl' }, 'File ID'), idShow),
        h('div', {}, h('label', { class: 'lbl' }, 'What is it?'), title),
        aboutBlock,
        h('div', {}, folderLbl, folder),
        whyBlock, lookBlock,
        editing ? h('p', { class: 'hint' }, 'The note itself is edited from the magnifying glass. Changing the shelf moves this note to the next number on the new shelf; the stored file stays where it is.') :
            h('div', {},
                h('label', { class: 'lbl' }, 'Content'),
                h('div', { class: 'format-row' }, h('span', { class: 'lbl inline' }, 'Written as'), format),
                body, osBox, fileRow),
        h('div', { class: 'btn-row' },
            h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Cancel'),
            submitBtn));

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!title.value.trim()) { toast('"What is it?" is required', 'err'); title.focus(); return; }
        if (!folder.value) { toast(sel === 'OS' ? 'Choose an Office folder' : 'Choose where it sits', 'err'); return; }
        submitBtn.disabled = true;
        try {
            if (editing) {
                await api.patch(`/source/records/${record.id}`, {
                    shelf: sel, folder_id: folder.value, title: title.value.trim(),
                    about: about.value, why: why.value, look_again: look.value
                });
                toast('Card saved');
            } else if (sel === 'OS') {
                await sendToOffice();
            } else {
                await createRecord();
                toast('Filed');
            }
            m.close();
            await refreshHook();
        } catch (err) { if (err.message !== 'Not sent') fail(err); } finally { submitBtn.disabled = false; }
    });

    async function createRecord() {
        const base = { shelf: sel, folder_id: folder.value, title: title.value.trim(), about: about.value, why: why.value, look_again: look.value };
        if (chosenFile) {
            const name = validName(chosenFile.name);
            if (!name) throw new Error('That file name is not allowed');
            const { record: rec } = await api.post('/source/records', { ...base, file_name: name });
            try {
                await api.put(`/source/records/${rec.id}/file`, chosenFile, { headers: { 'Content-Type': chosenFile.type || 'application/octet-stream' } });
            } catch (e) { await api.del(`/source/records/${rec.id}`).catch(() => {}); throw e; }
        } else {
            await api.post('/source/records', { ...base, format: format.value, content: body.value });
        }
    }

    async function sendToOffice() {
        const fname = cleanFileName(title.value) + '.' + format.value;
        if (!validName(fname)) throw new Error('The title cannot be used as a file name');
        const of = officeFolders.find(f => f.id === folder.value);
        const { files } = await api.get('/office/files?folder_id=' + enc(of.id));
        if (files.some(f => f.name === fname) && !(await confirmBox('Replace the existing file?', { ok: 'Replace', title: fname }))) throw new Error('Not sent');
        await api.put('/office/file?path=' + enc(of.path + '/' + fname), new Blob([body.value], { type: mimeFor(fname) }));
        toast('Sent to Office: ' + of.path + ' / ' + fname);
    }

    m.setBody(form);
    (async () => {
        if (sel === 'OS') { try { officeFolders = (await api.get('/office/folders')).folders; } catch { officeFolders = []; } }
        sync();
    })();
    sync();
    setTimeout(() => title.focus(), 40);
}

// ── Index sidebar: File IDs and titles ───────────────────────────────────────
export async function openIndex() {
    const list = h('div', { class: 'index-list' }, h('p', { class: 'empty' }, 'Loading…'));
    const search = h('input', { class: 'field', type: 'search', placeholder: 'Filter by ID or title…' });
    const s = openSidebar({ title: 'Index', body: h('div', {}, search, list) });
    let recs = [];
    const draw = () => {
        const q = search.value.trim().toLowerCase();
        const shown = recs.filter(r => !q || r.file_id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q));
        list.replaceChildren();
        ['WS', 'RS', 'AS'].forEach(k => {
            const items = shown.filter(r => r.shelf === k);
            if (!items.length) return;
            list.append(h('div', { class: 'index-shelf', style: `--accent:${SHELF[k].colour}` }, k + ' · ' + SHELF[k].title),
                h('ul', { class: 'note-list' }, ...items.map(r => noteRow(r))));
        });
        if (!shown.length) list.append(h('p', { class: 'empty' }, recs.length ? 'Nothing matches.' : 'Nothing filed yet.'));
    };
    search.addEventListener('input', draw);
    try {
        const [f, r] = await Promise.all([api.get('/source/folders'), api.get('/source/records')]);
        data.folders = f.folders; data.records = r.records; recs = r.records; draw();
    } catch (e) { s.close(); fail(e); }
}

// ── Add Folder sidebar (shelves 1–3 and the Office shelf) ────────────────────
export function openFolderSidebar({ shelf = 'WS' } = {}) {
    let sel = shelf;
    let office = [];
    const ticks = ['WS', 'RS', 'AS', 'OS'].map(k => {
        const r = h('input', { type: 'radio', name: 'fs-shelf' }); r.checked = k === sel;
        r.addEventListener('change', async () => { sel = k; await draw(); });
        return h('label', { class: 'tick' }, r, h('span', {}, k));
    });
    const parent = h('select', { class: 'field' });
    const name = h('input', { class: 'field', type: 'text', maxlength: '60', placeholder: 'Folder name' });
    const treeBox = h('div', { class: 'ftree-box' });

    const body = h('div', {},
        h('label', { class: 'lbl' }, 'Shelf'), h('div', { class: 'ticks' }, ticks),
        h('label', { class: 'lbl' }, 'Make it inside'), parent,
        h('label', { class: 'lbl' }, 'Folder name'), name,
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', onclick: create }, icon('plus', 16), h('span', {}, 'Create folder'))),
        h('div', { class: 'divider' }),
        h('div', { class: 'lbl' }, 'Folders'), treeBox);
    name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); create(); } });

    const s = openSidebar({ title: 'Add Folder', body });

    const current = () => sel === 'OS'
        ? office.map(f => ({ id: f.id, parent_id: f.parent_id, name: f.name }))
        : foldersOf(sel).map(f => ({ id: f.id, parent_id: f.parent_id, name: f.name }));

    function pathOf(list, id) {
        const parts = []; let cur = list.find(f => f.id === id); let g = 0;
        while (cur && g++ < 50) { parts.unshift(cur.name); cur = cur.parent_id ? list.find(f => f.id === cur.parent_id) : null; }
        return parts.join(' / ');
    }

    async function draw() {
        if (sel === 'OS') { try { office = (await api.get('/office/folders')).folders; } catch (e) { fail(e); office = []; } }
        const list = current();
        parent.replaceChildren(h('option', { value: '' }, 'Nothing — a main folder'),
            ...list.map(f => ({ id: f.id, label: pathOf(list, f.id) })).sort((a, b) => a.label.localeCompare(b.label))
                .map(o => h('option', { value: o.id }, o.label)));
        treeBox.replaceChildren(list.length ? tree(list, '') : h('p', { class: 'empty' }, 'No folders on this shelf yet.'));
    }

    function tree(list, pid) {
        const kids = list.filter(f => (f.parent_id || '') === pid);
        return h('ul', { class: 'ftree' }, ...kids.map(f => {
            const subs = list.filter(x => x.parent_id === f.id);
            const sub = subs.length ? tree(list, f.id) : null;
            if (sub) { sub.hidden = true; sub.prepend(h('li', {}, h('button', { class: 'ftree-name open', type: 'button', onclick: () => openFolder(f) }, 'Open “' + f.name + '”'))); }
            const toggle = () => { if (sub) sub.hidden = !sub.hidden; else openFolder(f); };
            const rowEl = h('div', { class: 'ftree-row' },
                h('button', { class: 'ftree-name', type: 'button', onclick: toggle },
                    icon('folder', 15), h('span', {}, f.name), sub ? h('span', { class: 'chev' }, '▾') : null),
                sel !== 'OS' ? iconBtn('edit', 'Rename', () => rename(f)) : null,
                iconBtn('trash', 'Delete folder', () => remove(f)));
            return h('li', {}, rowEl, sub);
        }));
    }

    function openFolder(f) {
        s.close();
        if (sel === 'OS') { location.hash = '#os/' + f.id; return; }
        if (location.hash.toLowerCase() !== '#' + sel.toLowerCase()) location.hash = '#' + sel.toLowerCase();
        const full = data.folders.find(x => x.id === f.id);
        if (full) setTimeout(() => openBox(full), 60);
    }

    async function create() {
        const n = name.value.trim();
        if (!n) { toast('Give the folder a name', 'err'); name.focus(); return; }
        try {
            if (sel === 'OS') await api.post('/office/folders', { name: n, parent_id: parent.value || null });
            else await api.post('/source/folders', { shelf: sel, name: n, parent_id: parent.value || null });
            name.value = '';
            toast('Folder created');
            if (sel !== 'OS') await loadShelfData();
            await draw();
            await refreshHook();
        } catch (e) { fail(e); }
    }

    async function rename(f) {
        const n = await promptBox('New folder name', { value: f.name, ok: 'Rename' });
        if (!n) return;
        try { await api.patch('/source/folders/' + f.id, { name: n }); await loadShelfData(); await draw(); await refreshHook(); toast('Renamed'); } catch (e) { fail(e); }
    }

    async function remove(f) {
        if (!(await confirmBox('Delete the folder “' + f.name + '”? It must be empty.', { ok: 'Delete', danger: true }))) return;
        try {
            if (sel === 'OS') await api.del('/office/folders/' + f.id); else await api.del('/source/folders/' + f.id);
            if (sel !== 'OS') await loadShelfData();
            await draw(); await refreshHook(); toast('Folder deleted');
        } catch (e) { fail(e); }
    }

    draw();
    return s;
}
