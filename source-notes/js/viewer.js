// ─── SOURCE Notes — full-screen viewer / editor ──────────────────────────────
// Used by shelves 1–3, the Office shelf and the Locked folder.
//   .md  → view rendered, edit and save in the app
//   .txt → view and edit as plain text
//   images, PDF, audio, video → the browser's own viewer
//   anything else → stored and listed; download to open, then upload the new version

import { h, icon, iconBtn, toast, fail, confirmBox, extOf, mimeFor, saveBlobAs, nextZ } from './ui.js';

const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
const AUD = ['mp3', 'wav', 'm4a', 'ogg'];
const VID = ['mp4', 'webm', 'mov'];

/*
 spec = {
   title, sub, name,            what to show and the file name (decides how it opens)
   load(): Promise<Blob>        fetch the file
   save(blob)                   save edited text            (text files)
   upload(file)                 replace the file with a chosen file   (optional)
   duplicate(), remove(), move()   (optional)
   onChange()                   called after anything that changes the list
   startEditing                 open straight in edit mode
 }
*/
export async function openViewer(spec) {
    const ext = extOf(spec.name);
    const isText = ext === 'md' || ext === 'txt';
    let blob = null, url = null, text = '', editing = false, dirty = false;

    const content = h('div', { class: 'viewer-content' });
    const btnEdit = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => toggleEdit() }, icon('edit', 16), h('span', {}, 'Edit'));
    const btnSave = h('button', { class: 'btn primary sm', type: 'button', onclick: () => doSave() }, icon('save', 16), h('span', {}, 'Save'));
    btnSave.style.display = 'none';

    const actions = h('div', { class: 'viewer-actions' });
    if (isText) actions.append(btnEdit, btnSave);
    if (spec.duplicate) actions.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: doDuplicate }, icon('copy', 16), h('span', {}, 'Duplicate')));
    if (spec.upload) {
        const fi = h('input', { type: 'file', style: 'display:none' });
        fi.addEventListener('change', async () => {
            const f = fi.files[0]; fi.value = '';
            if (!f) return;
            try { await spec.upload(f); toast('Uploaded'); if (spec.onChange) spec.onChange(); await close(true); } catch (e) { fail(e); }
        });
        actions.append(fi, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => fi.click() }, icon('upload', 16), h('span', {}, 'Upload new version')));
    }
    if (spec.move) actions.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: doMove }, icon('move', 16), h('span', {}, 'Move to folder')));
    actions.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: doDownload }, icon('download', 16), h('span', {}, 'Download')));
    if (spec.remove) actions.append(h('button', { class: 'btn danger sm', type: 'button', onclick: doDelete }, icon('trash', 16), h('span', {}, 'Delete')));

    const overlay = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'viewer-head' },
            h('div', { class: 'viewer-titles' },
                h('div', { class: 'viewer-title' }, spec.title),
                spec.sub ? h('div', { class: 'viewer-sub' }, spec.sub) : null),
            actions,
            iconBtn('close', 'Close', () => close())),
        content);
    const myZ = nextZ();
    overlay.style.zIndex = myZ;
    document.body.append(overlay);
    document.body.classList.add('no-scroll');

    function onKey(e) {
        if (e.key !== 'Escape') return;
        const above = [...document.querySelectorAll('.modal-back')].some(el => Number(el.style.zIndex) > myZ);
        if (!above) close();
    }
    document.addEventListener('keydown', onKey);

    async function close(force) {
        if (dirty && !force && !(await confirmBox('You have unsaved changes. Close without saving?', { ok: 'Close without saving', danger: true }))) return;
        document.removeEventListener('keydown', onKey);
        if (url) URL.revokeObjectURL(url);
        overlay.remove();
        document.body.classList.remove('no-scroll');
    }

    async function reload() {
        if (url) { URL.revokeObjectURL(url); url = null; }
        content.replaceChildren(h('div', { class: 'viewer-msg' }, 'Loading…'));
        try {
            blob = await spec.load();
        } catch (e) {
            if (isText && e && e.status === 404) blob = new Blob([''], { type: mimeFor(spec.name) });
            else { content.replaceChildren(h('div', { class: 'viewer-msg err' }, e && e.message ? e.message : 'Could not open this file')); return; }
        }
        if (isText) text = await blob.text();
        else url = URL.createObjectURL(new Blob([blob], { type: mimeFor(spec.name) }));
        dirty = false;
        render();
    }

    function render() {
        content.replaceChildren();
        btnSave.style.display = editing ? '' : 'none';
        btnEdit.lastChild.textContent = editing ? 'View' : 'Edit';

        if (isText) {
            if (editing) {
                const ta = h('textarea', { class: 'editor', spellcheck: 'true', 'aria-label': 'Edit ' + spec.name });
                ta.value = text;
                ta.addEventListener('input', () => { text = ta.value; dirty = true; });
                content.append(ta);
                setTimeout(() => ta.focus(), 30);
            } else if (ext === 'md' && window.marked && window.DOMPurify) {
                const div = h('div', { class: 'md' });
                div.innerHTML = window.DOMPurify.sanitize(window.marked.parse(text));
                content.append(div);
            } else {
                content.append(h('pre', { class: 'plain' }, text));
            }
        } else if (IMG.includes(ext)) {
            content.append(h('div', { class: 'media' }, h('img', { src: url, alt: spec.title })));
        } else if (ext === 'pdf') {
            content.append(h('iframe', { class: 'pdf', src: url, title: spec.title }));
        } else if (AUD.includes(ext)) {
            content.append(h('div', { class: 'media' }, h('audio', { src: url, controls: true })));
        } else if (VID.includes(ext)) {
            content.append(h('div', { class: 'media' }, h('video', { src: url, controls: true })));
        } else {
            content.append(h('div', { class: 'viewer-msg' },
                h('p', {}, 'This file type opens in its own program.'),
                h('p', {}, 'Download it, edit it, then upload the new version.')));
        }
    }

    async function toggleEdit() {
        if (editing && dirty && !(await confirmBox('Leave editing without saving your changes?', { ok: 'Leave without saving', danger: true }))) return;
        if (editing && dirty) await reload();      // discard
        editing = !editing;
        dirty = false;
        render();
    }

    async function doSave() {
        try {
            await spec.save(new Blob([text], { type: mimeFor(spec.name) }));
            blob = new Blob([text], { type: mimeFor(spec.name) });
            dirty = false;
            toast('Saved');
            if (spec.onChange) spec.onChange();
        } catch (e) { fail(e); }
    }

    async function doDuplicate() {
        try { await spec.duplicate(); toast('Duplicated'); if (spec.onChange) spec.onChange(); await close(true); } catch (e) { fail(e); }
    }

    async function doMove() {
        try { const moved = await spec.move(); if (moved) { if (spec.onChange) spec.onChange(); await close(true); } } catch (e) { fail(e); }
    }

    function doDownload() {
        if (blob) saveBlobAs(new Blob([blob], { type: mimeFor(spec.name) }), spec.name);
    }

    async function doDelete() {
        if (!(await confirmBox('Delete "' + spec.title + '"? This cannot be undone.', { ok: 'Delete', danger: true }))) return;
        try { await spec.remove(); toast('Deleted'); if (spec.onChange) spec.onChange(); await close(true); } catch (e) { fail(e); }
    }

    if (spec.startEditing && isText) editing = true;
    await reload();
    return { close };
}
