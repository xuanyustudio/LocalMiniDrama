-- 图床上传缓存表：记录本地文件与中转图床 URL 的对应关系，避免重复上传。
-- cache_key: 本地相对路径（如 scenes/ig_xxx.png）或 data URL 内容的 sha256 hash 前缀
CREATE TABLE IF NOT EXISTS image_proxy_cache (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key  TEXT NOT NULL UNIQUE,
  proxy_url  TEXT NOT NULL,
  created_at TEXT NOT NULL
);
