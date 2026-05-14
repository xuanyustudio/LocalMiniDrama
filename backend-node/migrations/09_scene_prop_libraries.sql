-- 公共场景库、公共道具库（仿 character_libraries）
CREATE TABLE IF NOT EXISTS scene_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER,
  location TEXT NOT NULL DEFAULT '',
  time TEXT,
  prompt TEXT,
  description TEXT,
  image_url TEXT,
  local_path TEXT,
  category TEXT,
  tags TEXT,
  source_type TEXT,
  source_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS prop_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  prompt TEXT,
  image_url TEXT,
  local_path TEXT,
  category TEXT,
  tags TEXT,
  source_type TEXT,
  source_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
