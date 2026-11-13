# SOURCE Notes

Private filing app for Chef's project material — shelves, box files and record cards, plus an Office shelf the AI agent can work on. Part of the 3C notes family (DASH, KEY, BUDGET, DIARY). For Chef's own use; not public.

© 3C Thread To Success™. All rights reserved.

---

## 🎨 Credits

Designed and Built with ❤ by Claude (Anthropic) × Chef Anica · 3C Thread To Success™ Cooking Lab 🧪👨🍳

*Think Smarter, Not Harder — Zero Shortcuts*

---

## 👤 Creator

**Anica-blip** ("Chef")
Founder, 3C Thread To Success™
Independent Creator | Community Builder

---

## 🧠 Philosophy

**"Think it. Do it. Own it."**

Everything you need to file, find and revisit sits in one private place that is yours alone.

---

## Technical notes

- Front end: this `source-notes/` folder (GitHub Pages). It holds no data.
- Pages: `index.html` = cover with the enter button (no toolbar, like Dash Notes) → `app.html` = the four shelves and everything inside (signs in via `login.html` when needed).
- Worker: `../notes-worker/`, served at `notes.threadcommand.center`. Deployed with Wrangler only.
- Storage: R2 bucket `3c-boardroom-hq` → `Notes/source-notes/`; cards and folders in D1 (`3c-notes`).
- Sign-in: GitHub via Supabase, Chef's account only (same account as the Boardroom).
- British English only.
- Locked folder (Office shelf): files are encrypted in the browser with one random master key. That key is kept in two locked copies — an 8-digit PIN for daily use, and an emergency phrase (four or more words) for a forgotten PIN. Each copy also needs a half held only by the Worker (made from its `LOCK_SECRET`). The PIN and phrase never leave the browser. 3 wrong PINs lock the PIN for 15 minutes; 3 wrong phrases lock the phrase for 60 minutes. "Forgot PIN?" needs a fresh GitHub sign-in (within 10 minutes) plus the phrase. The agent cannot reach it.
- **`LOCK_SECRET` must never be lost or changed**, or the Locked files cannot be opened. Keep one offline copy.
