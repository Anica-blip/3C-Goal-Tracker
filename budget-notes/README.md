# BUDGET Notes

A personal budget planner you set once — it carries forward. Part of the 3C Goal Tracker family (DASH Notes · KEY Notes · BUDGET Notes).

© 3C Thread To Success™. All rights reserved. BUDGET Notes is a personal tool built for and by Chef Anica; its design, code and wording are protected as part of the 3C Thread To Success™ brand.

## 🎨 Credits

Designed and Built with ❤ by Claude (Anthropic) × Chef Anica · 3C Thread To Success™ Cooking Lab 🧪👨🍳

*Think Smarter, Not Harder — Zero Shortcuts*

## 👤 Creator

**Anica-blip** ("Chef")
Founder, 3C Thread To Success™
Independent Creator | Community Builder

## 🧠 Philosophy

**"Think it. Do it. Own it."**

Money tools should be calm, clear and yours: enter your budget once, trust it to carry forward, and keep your own data in your own hands.

---

### Folder layout

```
budget-notes/
├── index.html        cover page (enter button)
├── app.html          the app: Planner · Summary · Archive · Save
├── setup.html        Start Here + Q&A
├── manifest.json     home-screen install
├── sw.js             offline cache (bump CACHE when files change)
├── css/budget.css    page-specific styles (theme comes from ../css/style.css)
└── js/
    ├── engine.js     pure budget logic: months, carry-forward, totals, year lock
    ├── storage.js    IndexedDB — the ONLY file that knows where data lives
    ├── store.js      in-memory state, saving, change notifications
    ├── i18n.js       all text in EN · FR · DE · EL · PT
    ├── ui.js         escaping, toast, money + month formatting
    ├── planner.js    month tabs, two-column blocks, summary, line editor
    ├── summary.js    Year at a Glance
    ├── archive.js    year list, open any year, add an earlier year
    └── backup.js     share, download backup, restore
```

Shared with the other apps (unchanged): `../css/style.css`, `../assets/favicon.png`, `../assets/budget-notes-cover.png`.

### How it works

- Every line keeps a **history** (not a copy per month). Change it **Forward** and that month plus every month after follows; tick **Once** and only that month changes. Earlier months are never rewritten.
- Amounts are stored in whole cents. Currency is euro, dates are British English, and "this month" follows Europe/Lisbon time.
- Income, Fixed, Variable and Bank Commission lines can carry a date. A **Start date** makes a line begin in that month (earlier months fill in too) and shows its day on a badge; an **End date** makes that month its last. **Once** changes one month only (e.g. a late payment); Once + Remove skips a single month.
- Months that have not started stay empty — nothing is added ahead of time.
- Money Left = Income − Fixed − Variable − Bank Commission. (`DEDUCT_SAVINGS` in `js/engine.js` also deducts Savings & Investments if you ever want that.)
- Five languages: English, French, German, Greek, Portuguese — all text lives in `js/i18n.js`.
- Nothing is ever locked: any month of any year can be edited at any time. The Planner has a year box, and the Archive lists your years (with “Add an earlier year”) so you can start recording from any point.
- Storage is local to the device (IndexedDB). Swap `js/storage.js` to move to Cloudflare later.
