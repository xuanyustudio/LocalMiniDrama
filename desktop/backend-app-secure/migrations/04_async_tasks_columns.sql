-- async_tasks 缺少 completed_at、error、result 时补上（与 taskService 一致）
ALTER TABLE async_tasks ADD COLUMN completed_at TEXT;
ALTER TABLE async_tasks ADD COLUMN error TEXT;
ALTER TABLE async_tasks ADD COLUMN result TEXT;
