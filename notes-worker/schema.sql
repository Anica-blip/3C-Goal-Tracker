-- 3C SOURCE Notes — D1 schema (database: 3c-notes)
-- Run once:  wrangler d1 execute 3c-notes --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS folders (
    id          TEXT PRIMARY KEY,
    side        TEXT NOT NULL,          -- 'shelves' | 'office' | 'locked'
    shelf       TEXT,                   -- WS | RS | AS for shelves; OS / LK for the Office side
    parent_id   TEXT,                   -- empty for a main folder
    name        TEXT NOT NULL,
    ord         INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
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
    updated_at  TEXT NOT NULL
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
