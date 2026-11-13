// ─── SOURCE Notes — entry page, toolbar and router ───────────────────────────
// One page, one entry point. Hash routes: (none) entry · #ws · #rs · #as · #os · #os/<folder> · #os/locked · #os/bin

import { getSession, signOut, recoverPending } from './api.js';
import { h, icon, openModal, fail } from './ui.js';
import { SHELF, loadShelfData, renderShelf, setRefreshHook, openIndex, redrawOpenBox } from './shelves.js';
import { renderOffice } from './office.js';
import * as vault from './vault.js';

const root = document.getElementById('view');

function renderEntry() {
    const squares = ['WS', 'RS', 'AS', 'OS'].map(k => {
        const meta = SHELF[k];
        const btn = h('button', { class: 'square', type: 'button', style: `--sq:${meta.colour}`, 'aria-label': `${meta.title} (${k})` },
            h('span', { class: 'sq-title' }, `${meta.title} (${k})`),
            h('span', { class: 'sq-line' }, meta.line));
        btn.addEventListener('click', () => {
            btn.classList.add('pressed');                       // button motion + highlight, then open
            document.querySelectorAll('.square').forEach(s => { if (s !== btn) s.classList.add('dim'); });
            setTimeout(() => { location.hash = '#' + k.toLowerCase(); }, 360);
        });
        return btn;
    });
    root.replaceChildren(h('section', { class: 'entry' }, h('div', { class: 'squares' }, squares)));
}

function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const first = (parts[0] || '').toLowerCase();
    const key = first.toUpperCase();
    document.body.dataset.view = ['ws', 'rs', 'as', 'os'].includes(first) ? first : 'entry';
    window.scrollTo(0, 0);
    if (['WS', 'RS', 'AS'].includes(key)) renderShelf(root, key);
    else if (key === 'OS') renderOffice(root, parts.slice(1));
    else renderEntry();
}

function about() {
    openModal({
        title: 'About SOURCE Notes', cls: 'small',
        body: h('div', { class: 'about' },
            h('p', { class: 'about-lead' }, 'Chef’s private filing app for project material.'),
            h('p', {}, 'Shelves 1–3 — Working, Reference and Archive — hold your own filing in box files, with a record card for every note. The Office shelf holds brand storage files and is the only part the AI agent can reach.'),
            h('p', {}, 'Private use only. You sign in with GitHub, and everything is stored in your own Cloudflare storage behind the Notes Worker. The Locked folder is encrypted in this browser with its own PIN.'),
            h('p', { class: 'about-tag' }, 'Think it. Do it. Own it.'))
    });
}

function denied(message) {
    root.replaceChildren(h('section', { class: 'entry' },
        h('div', { class: 'gate-card' },
            h('h2', {}, 'No access'),
            h('p', {}, message),
            h('button', { class: 'btn primary', type: 'button', onclick: signOut }, 'Sign out'))));
}

async function boot() {
    const session = await getSession();
    if (!session) { location.replace('login.html'); return; }

    const meta = (session.user && session.user.user_metadata) || {};
    document.getElementById('userBadge').textContent = meta.user_name ? '@' + meta.user_name : (session.user.email || '');
    document.getElementById('btnIndex').addEventListener('click', openIndex);
    document.getElementById('btnAbout').addEventListener('click', about);
    document.getElementById('btnExit').addEventListener('click', signOut);
    document.getElementById('brand').addEventListener('click', e => { e.preventDefault(); location.hash = ''; route(); });

    try {
        await loadShelfData();
    } catch (e) {
        if (e.status === 403) { denied('This account does not have access to SOURCE Notes.'); return; }
        fail(e);
    }

    setRefreshHook(async () => {
        try { await loadShelfData(); } catch (e) { fail(e); }
        route();
        redrawOpenBox();
    });
    window.addEventListener('hashchange', route);
    // Came back from the fresh GitHub sign-in of "Forgot PIN?" → straight to the Locked folder's reset step
    if (recoverPending() && !location.hash.toLowerCase().startsWith('#os/locked')) location.hash = '#os/locked';
    // The Worker said the Locked folder is locked (token no longer valid) → ask for the PIN again
    window.addEventListener('source-locked', async () => {
        await vault.lockDevice();
        if (location.hash.toLowerCase().startsWith('#os/locked')) route();
    });
    route();
}

boot();
