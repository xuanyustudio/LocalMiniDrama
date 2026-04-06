-- character_libraries 补充外貌字段（分镜生成时引用）
ALTER TABLE character_libraries ADD COLUMN appearance TEXT;
ALTER TABLE character_libraries ADD COLUMN identity_anchors TEXT;
ALTER TABLE character_libraries ADD COLUMN style_tokens TEXT;
ALTER TABLE character_libraries ADD COLUMN color_palette TEXT;
ALTER TABLE character_libraries ADD COLUMN four_view_image_url TEXT;

-- characters 补充锚点字段（AI 角色生成时提炼）
ALTER TABLE characters ADD COLUMN identity_anchors TEXT;
ALTER TABLE characters ADD COLUMN style_tokens TEXT;
ALTER TABLE characters ADD COLUMN color_palette TEXT;
ALTER TABLE characters ADD COLUMN four_view_image_url TEXT;
