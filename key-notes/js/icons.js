// icons.js — Shared icon set matching the Canva Create symbols sheet
// 3C KEY Notes · 3C Thread To Success™
//
// All icons are simple stroke-based line icons, 24x24 viewBox, so they
// scale cleanly inside the circular .icon-btn container used throughout
// the app. Kept in one place so every popup, row, and banner uses the
// exact same glyph for the same action.
// Carried over unchanged from its source repo — no edits made.

const ICONS = {
  close: `<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>`,

  back: `<svg viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M4 12h11a5 5 0 0 0 0-10"/></svg>`,

  next: `<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>`,

  returnMenu: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.64-6.36M3 4v5h5"/></svg>`,

  schedule: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 9v4l3 2"/><path d="M19.4 7.5a9 9 0 1 1-2-3" stroke-dasharray="1 3"/></svg>`,

  exit: `<svg viewBox="0 0 24 24"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 16l5-5-5-5M20 11H9"/></svg>`,

  view: `<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,

  link: `<svg viewBox="0 0 24 24"><path d="M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1"/></svg>`,

  indexList: `<svg viewBox="0 0 24 24"><rect x="4" y="3" width="13" height="18" rx="2"/><circle cx="10.5" cy="9" r="2"/><path d="M7 16h7"/></svg>`,

  download: `<svg viewBox="0 0 24 24"><path d="M12 4v11M8 11l4 4 4-4M5 19h14"/></svg>`,

  upload: `<svg viewBox="0 0 24 24"><path d="M12 19V8M8 12l4-4 4 4M5 19h14" transform="rotate(0 12 12)"/></svg>`,

  edit: `<svg viewBox="0 0 24 24"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z"/><path d="M13 7l3.5 3.5"/></svg>`,

  copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,

  save: `<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4Z"/></svg>`,

  delete: `<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg>`,

  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`,

  github: `<svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
    0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
    1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
    0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04
    2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54
    1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`,
};

/** Returns raw SVG markup for the named icon. Falls back to an empty span if unknown. */
export function icon(name) {
  return ICONS[name] || '<span></span>';
}

/** Builds a ready-to-insert circular icon button. */
export function iconBtn(name, { className = '', title = '', dataAttrs = '' } = {}) {
  return `<button class="icon-btn ${className}" title="${title}" ${dataAttrs}>${icon(name)}</button>`;
}
