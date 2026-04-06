-- 桌面端版本检测上报（本地留档，并可同步到云端 user_usage_logs）
CREATE TABLE IF NOT EXISTS desktop_version_check_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  app_version TEXT,
  channel INTEGER,
  platform TEXT,
  arch TEXT,
  os_release TEXT,
  exec_basename TEXT,
  exe_prefix_remote TEXT,
  local_semver TEXT,
  remote_semver TEXT,
  remote_filename TEXT,
  download_url TEXT,
  update_available INTEGER NOT NULL DEFAULT 0,
  outcome TEXT,
  detail_json TEXT
);
