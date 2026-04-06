-- video_generations 缺少 completed_at / error_msg 时补上（videoService 更新完成状态用）
ALTER TABLE video_generations ADD COLUMN completed_at TEXT;
ALTER TABLE video_generations ADD COLUMN error_msg TEXT;
