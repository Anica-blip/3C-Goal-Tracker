-- 3C SOURCE Notes — D1 schema (database: 3c-notes)
-- Run once:  wrangler d1 execute 3c-notes --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS folders (
    id          TEXT PRIMARY KEY,
    side        TEXT NOT NULL,          -- 'shelves' | 'office' | 'locked'
    shelf       TEXT,                   -- WS | RS | AS for shelves; OS / LK for the Office side
    parent_id   TEXT,                   -- empty for a main folder
    name        TEXT NOT NULL,
    ord         INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT ''  -- short label (max 5 capitals) on the box file's spine; shelves 1-3 only
);
CREATE INDEX IF NOT EXISTS idx_folders_side ON folders(side, shelf, ord);

CREATE TABLE IF NOT EXISTS records (
    id          TEXT PRIMARY KEY,       -- hidden permanent id
    shelf       TEXT NOT NULL,          -- WS | RS | AS
    folder_id   TEXT NOT NULL,          -- the box file (folder) it sits in
    ord         INTEGER NOT NULL,       -- filing order on the shelf (File ID number is worked out from this)
    title       TEXT NOT NULL,          -- What is it?
    about       TEXT NOT NULL DEFAULT '',
    why         TEXT NOT NULL DEFAULT '',
    look_again  TEXT NOT NULL DEFAULT '',
    file_name   TEXT NOT NULL,
    file_type   TEXT NOT NULL DEFAULT '',
    storage_key TEXT NOT NULL,
    size        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    bin         INTEGER NOT NULL DEFAULT 0,   -- 1 = in the shelf's Bin (not numbered, not listed in its box file)
    bin_at      TEXT NOT NULL DEFAULT ''      -- when it went into the Bin
);
CREATE INDEX IF NOT EXISTS idx_records_shelf ON records(shelf, ord);
CREATE INDEX IF NOT EXISTS idx_records_folder ON records(folder_id);

CREATE TABLE IF NOT EXISTS office_files (
    id           TEXT PRIMARY KEY,
    space        TEXT NOT NULL,         -- 'office' | 'locked'
    folder_id    TEXT,                  -- empty for files in the Bin
    name         TEXT NOT NULL,
    storage_key  TEXT NOT NULL,
    size         INTEGER NOT NULL DEFAULT 0,
    saved_by     TEXT NOT NULL,         -- 'chef' | 'agent'
    saved_at     TEXT NOT NULL,
    bin          INTEGER NOT NULL DEFAULT 0,
    bin_original TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_office_name ON office_files(space, folder_id, name) WHERE bin = 0;
CREATE INDEX IF NOT EXISTS idx_office_folder ON office_files(space, folder_id);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- UPGRADING THE LIVE DATABASE (15 Nov 2026) — run ONCE, from the notes-worker folder.
-- The CREATE TABLE lines above already contain these columns for a brand-new database,
-- but they do not change a table that exists, so the live one needs these three lines
-- (do not run this whole file for it; a second run of a line only says "duplicate column"):
--
--   npx wrangler d1 execute 3c-notes --remote --command "ALTER TABLE folders ADD COLUMN category TEXT NOT NULL DEFAULT ''"
--   npx wrangler d1 execute 3c-notes --remote --command "ALTER TABLE records ADD COLUMN bin INTEGER NOT NULL DEFAULT 0"
--   npx wrangler d1 execute 3c-notes --remote --command "ALTER TABLE records ADD COLUMN bin_at TEXT NOT NULL DEFAULT ''"
--
-- Every existing folder and note keeps working: folders start with no category, notes start outside the Bin.
