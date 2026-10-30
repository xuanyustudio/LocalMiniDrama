-- image_generations 缺少 completed_at / error_msg 时补上（imageClient 更新完成状态与错误信息用）
ALTER TABLE image_generations ADD COLUMN completed_at TEXT;
ALTER TABLE image_generations ADD COLUMN error_msg TEXT;
