-- characters 表新增预生成的四视图图片提示词字段
-- polished_prompt: 经文字AI润色后的完整图片生成提示词，可由用户编辑，生成图片时直接使用
ALTER TABLE characters ADD COLUMN polished_prompt TEXT;
