-- storyboards 表新增结构化视角字段（三元组）
-- angle_h: 水平方向（front / front_left / left / back_left / back / back_right / right / front_right）
-- angle_v: 俯仰角度（worm / low / eye_level / high）
-- angle_s: 景别   （close_up / medium / wide）
-- 保留原 angle 字段（旧文本）以兼容存量数据，新数据优先使用三元组字段
ALTER TABLE storyboards ADD COLUMN angle_h TEXT;
ALTER TABLE storyboards ADD COLUMN angle_v TEXT;
ALTER TABLE storyboards ADD COLUMN angle_s TEXT;
