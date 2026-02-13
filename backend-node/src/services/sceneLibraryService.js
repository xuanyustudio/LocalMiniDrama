// 场景库：仿 characterLibraryService
const sceneService = require('./sceneService');

function rowToItem(r) {
  return {
    id: r.id,
    location: r.location,
    time: r.time,
    prompt: r.prompt,
    description: r.description,
    image_url: r.image_url,
    local_path: r.local_path,
    category: r.category,
    tags: r.tags,
    source_type: r.source_type || 'generated',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function listLibraryItems(db, query) {
  let sql = 'FROM scene_libraries WHERE deleted_at IS NULL';
  const params = [];
  if (query.category) {
    sql += ' AND category = ?';
    params.push(query.category);
  }
  if (query.source_type) {
    sql += ' AND source_type = ?';
    params.push(query.source_type);
  }
  if (query.keyword) {
    sql += ' AND (location LIKE ? OR description LIKE ? OR prompt LIKE ?)';
    const k = '%' + query.keyword + '%';
    params.push(k, k, k);
  }
  const countRow = db.prepare('SELECT COUNT(*) as total ' + sql).get(...params);
  const total = countRow.total || 0;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.page_size, 10) || 20));
  const offset = (page - 1) * pageSize;
  const rows = db.prepare('SELECT * ' + sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, pageSize, offset);
  return { items: rows.map(rowToItem), total, page, pageSize };
}

function createLibraryItem(db, log, req) {
  const now = new Date().toISOString();
  const sourceType = req.source_type || 'generated';
  const info = db.prepare(
    `INSERT INTO scene_libraries (location, time, prompt, description, image_url, local_path, category, tags, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.location || '',
    req.time ?? null,
    req.prompt ?? null,
    req.description ?? null,
    req.image_url || '',
    req.local_path ?? null,
    req.category ?? null,
    req.tags ?? null,
    sourceType,
    now,
    now
  );
  log.info('Scene library item created', { item_id: info.lastInsertRowid });
  return getLibraryItem(db, String(info.lastInsertRowid));
}

function getLibraryItem(db, id) {
  const row = db.prepare('SELECT * FROM scene_libraries WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return row ? rowToItem(row) : null;
}

function updateLibraryItem(db, log, id, req) {
  const row = db.prepare('SELECT id FROM scene_libraries WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!row) return null;
  const updates = [];
  const params = [];
  if (req.location != null) { updates.push('location = ?'); params.push(req.location); }
  if (req.time != null) { updates.push('time = ?'); params.push(req.time); }
  if (req.prompt != null) { updates.push('prompt = ?'); params.push(req.prompt); }
  if (req.description != null) { updates.push('description = ?'); params.push(req.description); }
  if (req.image_url != null) { updates.push('image_url = ?'); params.push(req.image_url); }
  if (req.local_path != null) { updates.push('local_path = ?'); params.push(req.local_path); }
  if (req.category != null) { updates.push('category = ?'); params.push(req.category); }
  if (req.tags != null) { updates.push('tags = ?'); params.push(req.tags); }
  if (req.source_type != null) { updates.push('source_type = ?'); params.push(req.source_type); }
  if (updates.length === 0) return getLibraryItem(db, id);
  params.push(new Date().toISOString(), Number(id));
  db.prepare('UPDATE scene_libraries SET ' + updates.join(', ') + ', updated_at = ? WHERE id = ?').run(...params);
  log.info('Scene library item updated', { item_id: id });
  return getLibraryItem(db, id);
}

function deleteLibraryItem(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE scene_libraries SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  if (result.changes === 0) return false;
  log.info('Scene library item deleted', { item_id: id });
  return true;
}

function addSceneToLibrary(db, log, sceneId, category) {
  const scene = sceneService.getSceneById(db, Number(sceneId));
  if (!scene) return { ok: false, error: 'scene not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(scene.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  if (!scene.image_url) return { ok: false, error: '场景还没有形象图片' };
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO scene_libraries (location, time, prompt, description, image_url, local_path, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'scene', ?, ?)`
  ).run(
    scene.location || '',
    scene.time || null,
    scene.prompt || null,
    scene.prompt || null,
    scene.image_url,
    scene.local_path || null,
    now,
    now
  );
  log.info('Scene added to library', { scene_id: sceneId, library_item_id: info.lastInsertRowid });
  return { ok: true, item: getLibraryItem(db, String(info.lastInsertRowid)) };
}

module.exports = {
  listLibraryItems,
  createLibraryItem,
  getLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  addSceneToLibrary,
};
