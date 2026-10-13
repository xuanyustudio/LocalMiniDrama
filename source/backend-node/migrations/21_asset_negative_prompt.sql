-- 角色 / 场景 / 道具：可选负面提示词（显式指定生图 model 时与图生 API 合并传入）
ALTER TABLE characters ADD COLUMN negative_prompt TEXT;
ALTER TABLE scenes ADD COLUMN negative_prompt TEXT;
ALTER TABLE props ADD COLUMN negative_prompt TEXT;
