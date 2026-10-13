-- storyboards 表新增段落分组字段
ALTER TABLE storyboards ADD COLUMN segment_index INTEGER DEFAULT 0;
ALTER TABLE storyboards ADD COLUMN segment_title TEXT;

-- 模型路由表：按业务场景配置不同 AI 模型
-- key: 业务键（storyboard_gen / character_gen / frame_prompt / image_polish 等）
-- service_type: text / image
-- config_id: 对应 ai_service_configs.id（NULL = 使用默认配置）
-- model_override: 可选，在该配置下使用指定模型名（NULL = 用配置默认模型）
CREATE TABLE IF NOT EXISTS ai_model_map (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  key            TEXT NOT NULL UNIQUE,
  service_type   TEXT NOT NULL DEFAULT 'text',
  config_id      INTEGER,
  model_override TEXT,
  description    TEXT,
  created_at     TEXT NOT NULL DEFAULT '',
  updated_at     TEXT NOT NULL DEFAULT ''
);
