# DIARY Notes

A day planner, journal and self-care diary. Part of the 3C Goal Tracker family (DASH Notes · KEY Notes · BUDGET Notes · DIARY Notes).

© 3C Thread To Success™. All rights reserved. DIARY Notes is a personal tool built for and by Chef Anica; its design, code and wording are protected as part of the 3C Thread To Success™ brand.

## 🎨 Credits

Designed and Built with ❤ by Claude (Anthropic) × Chef Anica · 3C Thread To Success™ Cooking Lab 🧪👨🍳

*Think Smarter, Not Harder — Zero Shortcuts*

## 👤 Creator

**Anica-blip** ("Chef")
Founder, 3C Thread To Success™
Independent Creator | Community Builder

## 🧠 Philosophy

**"Think it. Do it. Own it."**

A calm place for your day: plan it, reflect on it, look after yourself, and keep it all in your own hands.

---

### Folder layout

```
diary-notes/
├── index.html        cover page (enter button)
├── app.html          the app: Day Planner · Journal · Self-Care · Save
├── setup.html        Start Here + Q&A
├── manifest.json     home screen install
├── sw.js             offline copy (network first: updates show after one reload)
├── css/diary.css     page styles only (theme comes from ../css/style.css)
└── js/
    ├── engine.js     pure logic: Lisbon dates, calendar grid, time order, data repair
    ├── storage.js    IndexedDB — the ONLY file that knows where data lives
    ├── store.js      in-memory state, the chosen day, saving, change notifications
    ├── i18n.js       all text: English, French, German, Greek, Portuguese (language dropdown in the top bar)
    ├── ui.js         escaping, toast, date formatting
    ├── datebar.js    the calendar bar shared by the first three tabs
    ├── planner.js    Day Planner entries + Renewals + Reminder (Work / Personal)
    ├── journal.js    your thoughts + 1 to 5 ratings (editable list)
    ├── selfcare.js   six blocks of bullet points
    └── backup.js     share a day, download backup, restore
```

Shared with the other apps (unchanged): `../css/style.css`, `../assets/favicon.png`, `../assets/diary-notes-cover.png`.

### How it works

- One calendar bar (three month tabs, a Monday-first month grid) picks the day for Day Planner, Journal and Self-Care. The diary runs from January 2026; future days are open for planning.
- **Day Planner:** entries in time order, each with a done box, a time badge, a title and a note or a to-do list. Edit, duplicate, save and delete on every title. **Renewals** (cards, subscriptions, insurance: a nickname and an expiry month, never card numbers) sit above the reminders and show from 30 days before the end of the expiry month until marked Renewed; Work and Personal reminders sit underneath.
- **Journal:** your own thoughts (saved automatically), then a 1 to 5 rating for each habit on an editable list. Ratings are stored per day and per habit, ready for a monthly self-regulation page.
- **Self-Care:** Affirmation, Reward, Gratitude, Fun, Health and Sleep, each a bullet list for the day.
- Times and "today" follow Europe/Lisbon. Everything is stored on the device (IndexedDB). Swap `js/storage.js` to move to Cloudflare later.
