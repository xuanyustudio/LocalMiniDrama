-- scenes 表新增单图完整图片提示词
-- polished_prompt_single: 经文字AI润色后的单图提示词，可由用户编辑，单图生图时直接使用
ALTER TABLE scenes ADD COLUMN polished_prompt_single TEXT;
