-- 道具归属集：从某集剧本提取的道具记入该集，本集资源列表会展示
ALTER TABLE props ADD COLUMN episode_id INTEGER;
