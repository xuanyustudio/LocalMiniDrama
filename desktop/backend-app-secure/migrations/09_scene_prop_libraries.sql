-- 公共场景库、公共道具库（仿 character_libraries）
CREATE TABLE IF NOT EXISTS scene_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location TEXT NOT NULL DEFAULT '',
  time TEXT,
  prompt TEXT,
  description TEXT,
  image_url TEXT,
  local_path TEXT,
  category TEXT,
  tags TEXT,
  source_type TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS prop_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  prompt TEXT,
  image_url TEXT,
  local_path TEXT,
  category TEXT,
  tags TEXT,
  source_type TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
