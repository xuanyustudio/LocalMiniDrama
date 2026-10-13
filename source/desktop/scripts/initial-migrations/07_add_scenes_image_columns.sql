-- scenes 表缺少 image_url / local_path 时补上
ALTER TABLE scenes ADD COLUMN image_url TEXT;
ALTER TABLE scenes ADD COLUMN local_path TEXT;
