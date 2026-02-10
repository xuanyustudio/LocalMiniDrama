// 场景：与 Go scene_handler + storyboard_composition 对齐
function updateScene(db, log, sceneId, req) {
  const row = db.prepare('SELECT id FROM scenes WHERE id = ? AND deleted_at IS NULL').get(Number(sceneId));
  if (!row) return { ok: false, error: 'scene not found' };
  const updates = [];
  const params = [];
  if (req.location != null) { updates.push('location = ?'); params.push(req.location); }
  if (req.time != null) { updates.push('time = ?'); params.push(req.time); }
  if (req.prompt != null) { updates.push('prompt = ?'); params.push(req.prompt); }
  if (req.image_url != null) { updates.push('image_url = ?'); params.push(req.image_url); }
  if (req.local_path !== undefined) { updates.push('local_path = ?'); params.push(req.local_path); }
  if (updates.length === 0) return { ok: true };
  params.push(new Date().toISOString(), sceneId);
  db.prepare('UPDATE scenes SET ' + updates.join(', ') + ', updated_at = ? WHERE id = ?').run(...params);
  log.info('Scene updated', { scene_id: sceneId });
  return { ok: true };
}

function updateScenePrompt(db, log, sceneId, req) {
  const row = db.prepare('SELECT id FROM scenes WHERE id = ? AND deleted_at IS NULL').get(Number(sceneId));
  if (!row) return { ok: false, error: 'scene not found' };
  const prompt = req.prompt != null ? req.prompt : '';
  db.prepare('UPDATE scenes SET prompt = ?, updated_at = ? WHERE id = ?').run(prompt, new Date().toISOString(), Number(sceneId));
  log.info('Scene prompt updated', { scene_id: sceneId });
  return { ok: true };
}

function deleteScene(db, log, sceneId) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE scenes SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(sceneId));
  if (result.changes === 0) return { ok: false, error: 'scene not found' };
  log.info('Scene deleted', { scene_id: sceneId });
  return { ok: true };
}

function createScene(db, log, dramaId, req) {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO scenes (drama_id, location, time, prompt, storyboard_count, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 'pending', ?, ?)`
  ).run(
    Number(dramaId),
    req.location || '',
    req.time || '',
    req.prompt || '',
    now,
    now
  );
  log.info('Scene created', { scene_id: info.lastInsertRowid, drama_id: dramaId });
  return getSceneById(db, info.lastInsertRowid);
}

function createSceneForEpisode(db, log, dramaId, episodeId, req) {
  const now = new Date().toISOString();
  try {
    const info = db.prepare(
      `INSERT INTO scenes (drama_id, episode_id, location, time, prompt, storyboard_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 'pending', ?, ?)`
    ).run(
      Number(dramaId),
      Number(episodeId),
      req.location || '',
      req.time || '',
      req.prompt || '',
      now,
      now
    );
    log.info('Scene created for episode', { scene_id: info.lastInsertRowid, episode_id: episodeId });
    return getSceneById(db, info.lastInsertRowid);
  } catch (e) {
    if ((e.message || '').includes('episode_id')) {
      const info = db.prepare(
        `INSERT INTO scenes (drama_id, location, time, prompt, storyboard_count, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 'pending', ?, ?)`
      ).run(Number(dramaId), req.location || '', req.time || '', req.prompt || '', now, now);
      return getSceneById(db, info.lastInsertRowid);
    }
    throw e;
  }
}

function deleteScenesByEpisodeId(db, log, episodeId) {
  const now = new Date().toISOString();
  try {
    const result = db.prepare('UPDATE scenes SET deleted_at = ? WHERE episode_id = ? AND deleted_at IS NULL').run(now, Number(episodeId));
    log.info('Scenes deleted by episode', { episode_id: episodeId, count: result.changes });
    return result.changes;
  } catch (e) {
    if ((e.message || '').includes('episode_id')) return 0;
    throw e;
  }
}

function getSceneById(db, id) {
  const row = db.prepare('SELECT * FROM scenes WHERE id = ? AND deleted_at IS NULL').get(id);
  return row ? { id: row.id, drama_id: row.drama_id, location: row.location, time: row.time, prompt: row.prompt, image_url: row.image_url, local_path: row.local_path, status: row.status, created_at: row.created_at, updated_at: row.updated_at } : null;
}

module.exports = {
  updateScene,
  updateScenePrompt,
  deleteScene,
  createScene,
  createSceneForEpisode,
  deleteScenesByEpisodeId,
  getSceneById,
};
