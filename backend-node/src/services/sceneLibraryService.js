const sceneService = require('./sceneService');
const {
  appendSourceIdFilters,
  findExistingLibraryItem,
  insertLibraryItem,
  normalizeSourceId,
  updateLibraryItem: updateExistingLibraryItem,
} = require('./libraryDedup');

function rowToItem(r) {
  return {
    id: r.id,
    drama_id: r.drama_id ?? null,
    location: r.location,
    time: r.time,
    prompt: r.prompt,
    description: r.description,
    image_url: r.image_url,
    local_path: r.local_path,
    category: r.category,
    tags: r.tags,
    source_type: r.source_type || 'generated',
    source_id: r.source_id || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function listLibraryItems(db, query) {
  let sql = 'FROM scene_libraries WHERE deleted_at IS NULL';
  const params = [];
  if (query.global === '1' || query.global === 1) {
    sql += ' AND drama_id IS NULL';
  } else if (query.drama_id != null && query.drama_id !== '') {
    sql += ' AND drama_id = ?';
    params.push(Number(query.drama_id));
  }
  if (query.category) {
    sql += ' AND category = ?';
    params.push(query.category);
  }
  if (query.source_type) {
    sql += ' AND source_type = ?';
    params.push(query.source_type);
  }
  sql = appendSourceIdFilters(query, sql, params);
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
  const info = insertLibraryItem(db, 'scene_libraries', {
    drama_id: req.drama_id ?? null,
    location: req.location || '',
    time: req.time ?? null,
    prompt: req.prompt ?? null,
    description: req.description ?? null,
    image_url: req.image_url || '',
    local_path: req.local_path ?? null,
    category: req.category ?? null,
    tags: req.tags ?? null,
    source_type: sourceType,
    source_id: normalizeSourceId(req.source_id) || null,
    created_at: now,
    updated_at: now,
  });
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
  if (req.source_id != null) { updates.push('source_id = ?'); params.push(normalizeSourceId(req.source_id)); }
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

function resolveImageUrl(image_url, local_path) {
  if (image_url && !image_url.startsWith('data:')) return image_url;
  if (local_path) return `/static/${local_path}`;
  return image_url || null;
}

function sceneLibraryFields(scene, dramaId, imageUrl, now) {
  return {
    drama_id: dramaId,
    location: scene.location || '',
    time: scene.time || null,
    prompt: scene.prompt || null,
    description: scene.prompt || null,
    image_url: imageUrl,
    local_path: scene.local_path || null,
    source_type: 'scene',
    source_id: normalizeSourceId(scene.id),
    updated_at: now,
  };
}

function addSceneToLibrary(db, log, sceneId) {
  const scene = sceneService.getSceneById(db, Number(sceneId));
  if (!scene) return { ok: false, error: 'scene not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(scene.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  if (!scene.image_url && !scene.local_path) return { ok: false, error: '场景还没有形象图片' };
  const now = new Date().toISOString();
  const imageUrl = resolveImageUrl(scene.image_url, scene.local_path);
  const fields = sceneLibraryFields(scene, scene.drama_id, imageUrl, now);
  const existing = findExistingLibraryItem(db, 'scene_libraries', {
    dramaId: scene.drama_id,
    sourceType: 'scene',
    sourceId: scene.id,
    imageUrl,
    localPath: scene.local_path,
  });
  if (existing) {
    updateExistingLibraryItem(db, 'scene_libraries', existing.id, fields);
    log.info('Scene library item reused', { scene_id: sceneId, drama_id: scene.drama_id, library_item_id: existing.id });
    return { ok: true, item: getLibraryItem(db, String(existing.id)), duplicated: true };
  }
  const info = insertLibraryItem(db, 'scene_libraries', { ...fields, created_at: now });
  log.info('Scene added to drama library', { scene_id: sceneId, drama_id: scene.drama_id, library_item_id: info.lastInsertRowid });
  return { ok: true, item: getLibraryItem(db, String(info.lastInsertRowid)), duplicated: false };
}

function addSceneToMaterialLibrary(db, log, sceneId) {
  const scene = sceneService.getSceneById(db, Number(sceneId));
  if (!scene) return { ok: false, error: 'scene not found' };
  if (!scene.image_url && !scene.local_path) return { ok: false, error: '场景还没有形象图片' };
  const now = new Date().toISOString();
  const imageUrl = resolveImageUrl(scene.image_url, scene.local_path);
  const fields = sceneLibraryFields(scene, null, imageUrl, now);
  const existing = findExistingLibraryItem(db, 'scene_libraries', {
    dramaId: null,
    sourceType: 'scene',
    sourceId: scene.id,
    imageUrl,
    localPath: scene.local_path,
  });
  if (existing) {
    updateExistingLibraryItem(db, 'scene_libraries', existing.id, fields);
    log.info('Scene material library item reused', { scene_id: sceneId, library_item_id: existing.id });
    return { ok: true, item: getLibraryItem(db, String(existing.id)), duplicated: true };
  }
  const info = insertLibraryItem(db, 'scene_libraries', { ...fields, created_at: now });
  log.info('Scene added to material library (global)', { scene_id: sceneId, library_item_id: info.lastInsertRowid });
  return { ok: true, item: getLibraryItem(db, String(info.lastInsertRowid)), duplicated: false };
}

module.exports = {
  listLibraryItems,
  createLibraryItem,
  getLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  addSceneToLibrary,
  addSceneToMaterialLibrary,
};
