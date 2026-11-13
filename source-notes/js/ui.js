// ─── SOURCE Notes — shared interface helpers ─────────────────────────────────
// Everything the other scripts draw with: elements, icons, the toast, popups, the left
// sidebar, the box-file graphic and small format helpers.
// No data and no Worker calls live here. Used by app.js, shelves.js, office.js and viewer.js.

// ── elements ─────────────────────────────────────────────────────────────────
// h('button', { class: 'btn', type: 'button', onclick: fn }, child, 'text', [more], null)
//   · on…  + a function  → event listener
//   · true               → bare attribute (controls, multiple, novalidate)
//   · null / undefined / false → left out
//   · children: elements, text, numbers, arrays of those; empty values are skipped
export function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === null || v === undefined || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'class') el.className = String(v);
        else if (k === 'value') { el.setAttribute('value', String(v)); if ('value' in el) el.value = String(v); }
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
    }
    addKids(el, kids);
    return el;
}

function addKids(el, kids) {
    for (const k of kids) {
        if (k === null || k === undefined || k === false || k === true || k === '') continue;
        if (Array.isArray(k)) addKids(el, k);
        else if (k instanceof Node) el.append(k);
        else el.append(document.createTextNode(String(k)));
    }
}

// ── icons (line icons, drawn with the text colour) ───────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
    back:     [['line', { x1: 19, y1: 12, x2: 5, y2: 12 }], ['polyline', { points: '12 19 5 12 12 5' }]],
    plus:     [['line', { x1: 12, y1: 5, x2: 12, y2: 19 }], ['line', { x1: 5, y1: 12, x2: 19, y2: 12 }]],
    close:    [['line', { x1: 18, y1: 6, x2: 6, y2: 18 }], ['line', { x1: 6, y1: 6, x2: 18, y2: 18 }]],
    folder:   [['path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' }]],
    edit:     [['path', { d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' }]],
    eye:      [['path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    search:   [['circle', { cx: 11, cy: 11, r: 8 }], ['line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }]],
    upload:   [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }], ['polyline', { points: '17 8 12 3 7 8' }], ['line', { x1: 12, y1: 3, x2: 12, y2: 15 }]],
    download: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }], ['polyline', { points: '7 10 12 15 17 10' }], ['line', { x1: 12, y1: 15, x2: 12, y2: 3 }]],
    trash:    [['polyline', { points: '3 6 5 6 21 6' }], ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
               ['line', { x1: 10, y1: 11, x2: 10, y2: 17 }], ['line', { x1: 14, y1: 11, x2: 14, y2: 17 }]],
    bin:      [['polyline', { points: '21 8 21 21 3 21 3 8' }], ['rect', { x: 1, y: 3, width: 22, height: 5 }], ['line', { x1: 10, y1: 12, x2: 14, y2: 12 }]],
    lock:     [['rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }], ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]],
    copy:     [['rect', { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }], ['path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }]],
    move:     [['polyline', { points: '15 14 20 9 15 4' }], ['path', { d: 'M4 20v-7a4 4 0 0 1 4-4h12' }]],
    save:     [['path', { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' }], ['polyline', { points: '17 21 17 13 7 13 7 21' }], ['polyline', { points: '7 3 7 8 15 8' }]]
};

export function icon(name, size = 18) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    const base = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
    for (const [k, v] of Object.entries(base)) svg.setAttribute(k, String(v));
    for (const [tag, attrs] of (ICONS[name] || [['circle', { cx: 12, cy: 12, r: 2 }]])) {
        const part = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) part.setAttribute(k, String(v));
        svg.append(part);
    }
    const wrap = document.createElement('span');
    wrap.className = 'ico';
    wrap.append(svg);
    return wrap;
}

// A small square button that is only an icon; the label shows on hover and is read by screen readers.
export function iconBtn(name, label, onclick) {
    return h('button', { class: 'icon-btn', type: 'button', title: label, 'aria-label': label, onclick }, icon(name, 16));
}

// ── toast ────────────────────────────────────────────────────────────────────
let toastEl = null, toastTimer = 0;
export function toast(message, kind) {
    if (!toastEl) {
        toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
        document.body.append(toastEl);
    }
    const err = kind === 'err';
    toastEl.textContent = String(message || '');
    toastEl.className = 'toast' + (err ? ' err' : '');
    void toastEl.offsetWidth;                       // restart the slide-in when one toast follows another
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), err ? 5000 : 2600);
}

// Show what went wrong. A 401 is not shown: api.js is already sending the browser to the sign-in page.
export function fail(e) {
    if (e && e.status === 401) return;
    console.error(e);
    toast(e && e.message ? e.message : 'Something went wrong', 'err');
}

// ── layers: popups, sidebars and the full-screen viewer stack in the order they open ──
let zTop = 1000;
export const nextZ = () => ++zTop;

const zOf = el => Number(el.style.zIndex) || 0;
const isTopLayer = el => ![...document.querySelectorAll('.modal-back, .viewer, .side-panel')]
    .some(other => other !== el && zOf(other) > zOf(el));

// ── popup ────────────────────────────────────────────────────────────────────
// openModal({ title, body, wide, cls, onClose }) → { close, setBody, setTitle }
// Closes with the ✕ button, or Escape when it is the top layer. A popup that holds a
// writing box (the Record Card) ignores Escape, so a half-written note is not lost by a slip.
export function openModal({ title = '', body = null, wide = false, cls = '', onClose } = {}) {
    const titleEl = h('div', { class: 'modal-title' }, title);
    const bodyEl  = h('div', { class: 'modal-body' }, body);
    const box = h('div', { class: 'modal' + (wide ? ' wide' : '') + (cls ? ' ' + cls : ''), role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal-head' }, titleEl, iconBtn('close', 'Close', () => close())),
        bodyEl);
    const back = h('div', { class: 'modal-back' }, box);
    back.style.zIndex = nextZ();

    let open = true;
    function onKey(e) {
        if (e.key !== 'Escape' || !isTopLayer(back)) return;
        if (bodyEl.querySelector('textarea')) return;
        close();
    }
    function close() {
        if (!open) return;
        open = false;
        document.removeEventListener('keydown', onKey);
        back.remove();
        if (onClose) onClose();
    }

    document.addEventListener('keydown', onKey);
    document.body.append(back);
    return {
        close,
        setBody(node) { if (node) bodyEl.replaceChildren(node); else bodyEl.replaceChildren(); },
        setTitle(text) { titleEl.textContent = String(text || ''); }
    };
}

// confirmBox('Delete this?', { ok: 'Delete', danger: true, title: '…' }) → true / false
export function confirmBox(text, { ok = 'OK', danger = false, title = 'Please confirm' } = {}) {
    return new Promise(resolve => {
        let answered = false;
        const answer = value => { if (answered) return; answered = true; resolve(value); m.close(); };
        const no  = h('button', { class: 'btn ghost', type: 'button', onclick: () => answer(false) }, 'Cancel');
        const yes = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => answer(true) }, ok);
        const m = openModal({
            title, cls: 'small',
            body: h('div', {}, h('p', { class: 'confirm-text' }, text), h('div', { class: 'btn-row' }, no, yes)),
            onClose: () => { if (!answered) { answered = true; resolve(false); } }
        });
        setTimeout(() => (danger ? no : yes).focus(), 30);     // a delete is never one stray Enter away
    });
}

// promptBox('New folder name', { value: 'old', ok: 'Rename', title: '…' }) → the text typed, or null if cancelled
export function promptBox(label, { value = '', ok = 'OK', title } = {}) {
    return new Promise(resolve => {
        let answered = false;
        const answer = v => { if (answered) return; answered = true; resolve(v); m.close(); };
        const input = h('input', { class: 'field', type: 'text', maxlength: '120', value });
        const form = h('form', { novalidate: true },
            h('label', { class: 'lbl' }, label), input,
            h('div', { class: 'btn-row' },
                h('button', { class: 'btn ghost', type: 'button', onclick: () => answer(null) }, 'Cancel'),
                h('button', { class: 'btn primary', type: 'submit' }, ok)));
        form.addEventListener('submit', e => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) { input.focus(); return; }
            answer(text);
        });
        const m = openModal({ title: title || label, cls: 'small', body: form,
            onClose: () => { if (!answered) { answered = true; resolve(null); } } });
        setTimeout(() => { input.focus(); input.select(); }, 30);
    });
}

// ── left sidebar (Add Folder, Index) ─────────────────────────────────────────
// openSidebar({ title, body }) → { close }.  Closes with ✕, a click outside it, or Escape.
export function openSidebar({ title = '', body = null } = {}) {
    const back = h('div', { class: 'side-back' });
    const panel = h('aside', { class: 'side-panel', role: 'dialog', 'aria-label': title },
        h('div', { class: 'side-head' }, h('div', { class: 'side-title' }, title), iconBtn('close', 'Close', () => close())),
        h('div', { class: 'side-body' }, body));
    back.style.zIndex = nextZ();
    panel.style.zIndex = nextZ();

    let open = true;
    function onKey(e) { if (e.key === 'Escape' && isTopLayer(panel)) close(); }
    function close() {
        if (!open) return;
        open = false;
        document.removeEventListener('keydown', onKey);
        back.classList.remove('on'); panel.classList.remove('on');
        setTimeout(() => { back.remove(); panel.remove(); }, 240);
    }

    back.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.append(back, panel);
    void panel.offsetWidth;                         // so the slide-in runs
    back.classList.add('on'); panel.classList.add('on');
    return { close };
}

// ── box file graphic ─────────────────────────────────────────────────────────
// A folder drawn as a small box file: shelf abbreviation up the spine (first letter at the
// bottom, each letter upright), the folder name on mouse hover, and how many notes are inside.
const BOX_COLOURS = ['#9fd0ff', '#a9e8b0', '#fff1a0', '#cdb4ff', '#ffc9a8', '#ffb3c7', '#9be7e1', '#d6e3a4'];
export const boxColour = i => BOX_COLOURS[((Number(i) || 0) % BOX_COLOURS.length + BOX_COLOURS.length) % BOX_COLOURS.length];

export function boxFile({ abbr = '', colour = BOX_COLOURS[0], name = '', count = '', onclick } = {}) {
    return h('button', { class: 'boxfile', type: 'button', title: name, 'aria-label': name + ' (' + abbr + ' box file)', style: '--bf:' + colour, onclick },
        h('span', { class: 'bf-back' }),
        h('span', { class: 'bf-spine' }, [...String(abbr)].map(ch => h('span', {}, ch))),
        h('span', { class: 'bf-front' }, h('span', { class: 'bf-hole' }), h('span', { class: 'bf-label' })),
        count ? h('span', { class: 'bf-count' }, count) : null);
}

// ── format helpers ───────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-11-13' → '13 Nov 2026'  (a plain calendar day, so no time-zone shift)
export function fmtDay(day) {
    if (!day) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day));
    return m && MONTHS[m[2] - 1] ? Number(m[3]) + ' ' + MONTHS[m[2] - 1] + ' ' + m[1] : String(day);
}

// Worker timestamp (UTC) → '13 Nov 2026, 17:30' in this computer's time
export function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Today as 'YYYY-MM-DD' in this computer's time (compared with "Look again by")
export function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function fmtSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
}

// ── file names and types (the same rules the Notes Worker applies) ───────────
export function extOf(name) {
    const s = String(name == null ? '' : name);
    const i = s.lastIndexOf('.');
    return i > 0 ? s.slice(i + 1).toLowerCase() : '';
}

const TYPES = {
    md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
};
export const mimeFor = name => TYPES[extOf(name)] || 'application/octet-stream';

// Returns the tidied name, or '' when the Worker would refuse it:
// empty, over 120 characters, a slash or control character, or starting with a dot.
export function validName(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s || s.length > 120) return '';
    if (/[\/\\\u0000-\u001f]/.test(s)) return '';
    if (s.startsWith('.')) return '';
    return s;
}

// Download a file to the computer
export function saveBlobAs(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name || 'download', style: 'display:none' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
