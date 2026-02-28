/**
 * 提示词覆盖：DB CRUD + 内存缓存同步
 */
function listOverrides(db) {
  return db.prepare('SELECT key, content, updated_at FROM prompt_overrides ORDER BY key').all();
}

function getOverride(db, key) {
  const row = db.prepare('SELECT content FROM prompt_overrides WHERE key = ?').get(key);
  return row ? row.content : null;
}

function setOverride(db, key, content) {
  const now = new Date().toISOString();
  db.prepare('INSERT OR REPLACE INTO prompt_overrides (key, content, updated_at) VALUES (?, ?, ?)').run(key, content, now);
}

function deleteOverride(db, key) {
  db.prepare('DELETE FROM prompt_overrides WHERE key = ?').run(key);
}

module.exports = { listOverrides, getOverride, setOverride, deleteOverride };
