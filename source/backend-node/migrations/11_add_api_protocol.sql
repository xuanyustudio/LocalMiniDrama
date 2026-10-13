-- 新增 api_protocol 字段：显式指定接口规范，独立于 provider（厂商名）。
-- 优先级高于 provider 推断，便于中转站/自定义厂商明确接口格式。
-- 可选值：openai / volcengine / dashscope / gemini / nano_banana
ALTER TABLE ai_service_configs ADD COLUMN api_protocol TEXT DEFAULT '' NOT NULL;
