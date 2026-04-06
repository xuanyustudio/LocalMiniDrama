-- 标记已同步到 PHP user_usage_logs，便于登录后补传启动时的版本检测记录
ALTER TABLE desktop_version_check_logs ADD COLUMN cloud_reported INTEGER NOT NULL DEFAULT 0;
