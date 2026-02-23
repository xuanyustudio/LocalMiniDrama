function listByDramaId(db, dramaId) {
  const rows = db.prepare(
    'SELECT * FROM props WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id ASC'
  ).all(Number(dramaId));
  return rows.map((r) => ({
    id: r.id,
    drama_id: r.drama_id,
    name: r.name,
    type: r.type,
    description: r.description,
    prompt: r.prompt,
    image_url: r.image_url,
    local_path: r.local_path,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

function create(db, log, req) {
  const now = new Date().toISOString();
  const episodeId = req.episode_id != null ? Number(req.episode_id) : null;
  const info = db.prepare(
    `INSERT INTO props (drama_id, episode_id, name, type, description, prompt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.drama_id,
    episodeId,
    req.name || '',
    req.type ?? null,
    req.description ?? null,
    req.prompt ?? null,
    now,
    now
  );
  log.info('Prop created', { prop_id: info.lastInsertRowid });
  return getById(db, info.lastInsertRowid);
}

function getById(db, id) {
  const r = db.prepare('SELECT * FROM props WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!r) return null;
  return {
    id: r.id,
    drama_id: r.drama_id,
    name: r.name,
    type: r.type,
    description: r.description,
    prompt: r.prompt,
    image_url: r.image_url,
    local_path: r.local_path,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function update(db, log, id, updates) {
  const existing = getById(db, id);
  if (!existing) return null;
  const set = [];
  const params = [];
  if (updates.name != null) { set.push('name = ?'); params.push(updates.name); }
  if (updates.type != null) { set.push('type = ?'); params.push(updates.type); }
  if (updates.description != null) { set.push('description = ?'); params.push(updates.description); }
  if (updates.prompt != null) { set.push('prompt = ?'); params.push(updates.prompt); }
  if (updates.image_url != null) { set.push('image_url = ?'); params.push(updates.image_url); }
  if (updates.local_path !== undefined) { set.push('local_path = ?'); params.push(updates.local_path ?? null); }
  if (set.length === 0) return existing;
  params.push(new Date().toISOString(), id);
  db.prepare('UPDATE props SET ' + set.join(', ') + ', updated_at = ? WHERE id = ?').run(...params);
  log.info('Prop updated', { prop_id: id });
  return getById(db, id);
}

function deleteById(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE props SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, id);
  if (result.changes === 0) return false;
  log.info('Prop deleted', { prop_id: id });
  return true;
}

function associateWithStoryboard(db, log, storyboardId, propIds) {
  db.prepare('DELETE FROM storyboard_props WHERE storyboard_id = ?').run(storyboardId);
  const ins = db.prepare('INSERT OR IGNORE INTO storyboard_props (storyboard_id, prop_id) VALUES (?, ?)');
  for (const pid of propIds || []) ins.run(storyboardId, pid);
  log.info('Props associated with storyboard', { storyboard_id: storyboardId });
  return true;
}

module.exports = {
  listByDramaId,
  create,
  getById,
  update,
  deleteById,
  associateWithStoryboard,
};
