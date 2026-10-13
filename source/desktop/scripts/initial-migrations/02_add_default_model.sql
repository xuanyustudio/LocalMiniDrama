-- 为已有库增加 default_model 列（新建库 01 已包含则跳过）
ALTER TABLE ai_service_configs ADD COLUMN default_model TEXT;
