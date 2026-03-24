-- 分镜解说/旁白文案（TTS、成片旁轨），与角色对白 dialogue 分离
ALTER TABLE storyboards ADD COLUMN narration TEXT;
