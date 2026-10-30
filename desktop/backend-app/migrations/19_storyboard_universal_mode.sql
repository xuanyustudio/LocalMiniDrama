-- 分镜：经典参考图模式 / 全能创建模式（片段描述，独立字段）
ALTER TABLE storyboards ADD COLUMN creation_mode TEXT DEFAULT 'classic';
ALTER TABLE storyboards ADD COLUMN universal_segment_text TEXT;
