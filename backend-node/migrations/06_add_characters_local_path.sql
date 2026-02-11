-- characters 表缺少 local_path 时补上（角色本地图片路径）
ALTER TABLE characters ADD COLUMN local_path TEXT;
