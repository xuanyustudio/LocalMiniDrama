-- 最小初始表结构，与 backend-node 业务代码对齐（若无 backend-node/migrations 则使用本文件）

CREATE TABLE IF NOT EXISTS dramas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  genre TEXT,
  style TEXT DEFAULT 'realistic',
  status TEXT DEFAULT 'draft',
  metadata TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER NOT NULL,
  episode_number INTEGER DEFAULT 0,
  title TEXT DEFAULT '',
  script_content TEXT,
  description TEXT,
  duration INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS storyboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  scene_id INTEGER,
  storyboard_number INTEGER DEFAULT 0,
  title TEXT,
  description TEXT,
  location TEXT,
  time TEXT,
  duration REAL,
  dialogue TEXT,
  action TEXT,
  atmosphere TEXT,
  image_prompt TEXT,
  video_prompt TEXT,
  characters TEXT,
  shot_type TEXT,
  angle TEXT,
  movement TEXT,
  video_url TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT,
  description TEXT,
  personality TEXT,
  appearance TEXT,
  image_url TEXT,
  local_path TEXT,
  voice_style TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS episode_characters (
  episode_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  PRIMARY KEY (episode_id, character_id)
);

CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER NOT NULL,
  episode_id INTEGER,
  location TEXT,
  time TEXT,
  prompt TEXT,
  image_url TEXT,
  local_path TEXT,
  storyboard_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS props (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  type TEXT,
  description TEXT,
  prompt TEXT,
  image_url TEXT,
  local_path TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS storyboard_props (
  storyboard_id INTEGER NOT NULL,
  prop_id INTEGER NOT NULL,
  PRIMARY KEY (storyboard_id, prop_id)
);

CREATE TABLE IF NOT EXISTS frame_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storyboard_id INTEGER NOT NULL,
  frame_type TEXT,
  prompt TEXT,
  description TEXT,
  layout TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_service_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_type TEXT NOT NULL,
  provider TEXT DEFAULT '',
  name TEXT DEFAULT '',
  base_url TEXT DEFAULT '',
  api_key TEXT,
  model TEXT,
  default_model TEXT,
  endpoint TEXT,
  query_endpoint TEXT,
  priority INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  settings TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS async_tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  message TEXT,
  resource_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  completed_at TEXT,
  error TEXT,
  result TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS image_generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storyboard_id INTEGER,
  drama_id INTEGER,
  scene_id INTEGER,
  character_id INTEGER,
  provider TEXT,
  prompt TEXT,
  negative_prompt TEXT,
  model TEXT,
  frame_type TEXT,
  reference_images TEXT,
  size TEXT,
  quality TEXT,
  image_url TEXT,
  local_path TEXT,
  status TEXT,
  task_id TEXT,
  completed_at TEXT,
  error_msg TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS video_generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER,
  storyboard_id INTEGER,
  provider TEXT,
  prompt TEXT,
  model TEXT,
  duration REAL,
  aspect_ratio TEXT,
  image_url TEXT,
  first_frame_url TEXT,
  last_frame_url TEXT,
  reference_image_urls TEXT,
  video_url TEXT,
  local_path TEXT,
  status TEXT,
  task_id TEXT,
  scene_id INTEGER,
  completed_at TEXT,
  error_msg TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS video_merges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER,
  drama_id INTEGER,
  title TEXT,
  provider TEXT,
  model TEXT,
  status TEXT,
  scenes TEXT,
  task_id TEXT,
  created_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS character_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  category TEXT,
  image_url TEXT,
  local_path TEXT,
  description TEXT,
  tags TEXT,
  source_type TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id INTEGER,
  name TEXT,
  type TEXT,
  category TEXT,
  url TEXT,
  local_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration REAL,
  image_gen_id INTEGER,
  video_gen_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
