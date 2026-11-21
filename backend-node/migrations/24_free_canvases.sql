CREATE TABLE IF NOT EXISTS free_canvases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '未命名画布',
  revision INTEGER NOT NULL DEFAULT 1,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  materialized_drama_id INTEGER,
  document TEXT NOT NULL DEFAULT '{"viewport":{"x":0,"y":0,"zoom":1},"nodes":[],"edges":[]}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
