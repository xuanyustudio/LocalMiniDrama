const propService = require('./propService');
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
    name: r.name,
    description: r.description,
    prompt: r.prompt,
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
  let sql = 'FROM prop_libraries WHERE deleted_at IS NULL';
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
    sql += ' AND (name LIKE ? OR description LIKE ? OR prompt LIKE ?)';
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
  const info = insertLibraryItem(db, 'prop_libraries', {
    drama_id: req.drama_id ?? null,
    name: req.name || '',
    description: req.description ?? null,
    prompt: req.prompt ?? null,
    image_url: req.image_url || '',
    local_path: req.local_path ?? null,
    category: req.category ?? null,
    tags: req.tags ?? null,
    source_type: sourceType,
    source_id: normalizeSourceId(req.source_id) || null,
    created_at: now,
    updated_at: now,
  });
  log.info('Prop library item created', { item_id: info.lastInsertRowid });
  return getLibraryItem(db, String(info.lastInsertRowid));
}

function getLibraryItem(db, id) {
  const row = db.prepare('SELECT * FROM prop_libraries WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return row ? rowToItem(row) : null;
}

function updateLibraryItem(db, log, id, req) {
  const row = db.prepare('SELECT id FROM prop_libraries WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!row) return null;
  const updates = [];
  const params = [];
  if (req.name != null) { updates.push('name = ?'); params.push(req.name); }
  if (req.description != null) { updates.push('description = ?'); params.push(req.description); }
  if (req.prompt != null) { updates.push('prompt = ?'); params.push(req.prompt); }
  if (req.image_url != null) { updates.push('image_url = ?'); params.push(req.image_url); }
  if (req.local_path != null) { updates.push('local_path = ?'); params.push(req.local_path); }
  if (req.category != null) { updates.push('category = ?'); params.push(req.category); }
  if (req.tags != null) { updates.push('tags = ?'); params.push(req.tags); }
  if (req.source_type != null) { updates.push('source_type = ?'); params.push(req.source_type); }
  if (req.source_id != null) { updates.push('source_id = ?'); params.push(normalizeSourceId(req.source_id)); }
  if (updates.length === 0) return getLibraryItem(db, id);
  params.push(new Date().toISOString(), Number(id));
  db.prepare('UPDATE prop_libraries SET ' + updates.join(', ') + ', updated_at = ? WHERE id = ?').run(...params);
  log.info('Prop library item updated', { item_id: id });
  return getLibraryItem(db, id);
}

function deleteLibraryItem(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE prop_libraries SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  if (result.changes === 0) return false;
  log.info('Prop library item deleted', { item_id: id });
  return true;
}

function resolveImageUrl(image_url, local_path) {
  if (image_url && !image_url.startsWith('data:')) return image_url;
  if (local_path) return `/static/${local_path}`;
  return image_url || null;
}

function propLibraryFields(prop, dramaId, imageUrl, now) {
  return {
    drama_id: dramaId,
    name: prop.name || '',
    description: prop.description || null,
    prompt: prop.prompt || null,
    image_url: imageUrl,
    local_path: prop.local_path || null,
    source_type: 'prop',
    source_id: normalizeSourceId(prop.id),
    updated_at: now,
  };
}

function addPropToLibrary(db, log, propId) {
  const prop = propService.getById(db, Number(propId));
  if (!prop) return { ok: false, error: 'prop not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(prop.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  if (!prop.image_url && !prop.local_path) return { ok: false, error: '道具还没有形象图片' };
  const now = new Date().toISOString();
  const imageUrl = resolveImageUrl(prop.image_url, prop.local_path);
  const fields = propLibraryFields(prop, prop.drama_id, imageUrl, now);
  const existing = findExistingLibraryItem(db, 'prop_libraries', {
    dramaId: prop.drama_id,
    sourceType: 'prop',
    sourceId: prop.id,
    imageUrl,
    localPath: prop.local_path,
  });
  if (existing) {
    updateExistingLibraryItem(db, 'prop_libraries', existing.id, fields);
    log.info('Prop library item reused', { prop_id: propId, drama_id: prop.drama_id, library_item_id: existing.id });
    return { ok: true, item: getLibraryItem(db, String(existing.id)), duplicated: true };
  }
  const info = insertLibraryItem(db, 'prop_libraries', { ...fields, created_at: now });
  log.info('Prop added to drama library', { prop_id: propId, drama_id: prop.drama_id, library_item_id: info.lastInsertRowid });
  return { ok: true, item: getLibraryItem(db, String(info.lastInsertRowid)), duplicated: false };
}

function addPropToMaterialLibrary(db, log, propId) {
  const prop = propService.getById(db, Number(propId));
  if (!prop) return { ok: false, error: 'prop not found' };
  if (!prop.image_url && !prop.local_path) return { ok: false, error: '道具还没有形象图片' };
  const now = new Date().toISOString();
  const imageUrl = resolveImageUrl(prop.image_url, prop.local_path);
  const fields = propLibraryFields(prop, null, imageUrl, now);
  const existing = findExistingLibraryItem(db, 'prop_libraries', {
    dramaId: null,
    sourceType: 'prop',
    sourceId: prop.id,
    imageUrl,
    localPath: prop.local_path,
  });
  if (existing) {
    updateExistingLibraryItem(db, 'prop_libraries', existing.id, fields);
    log.info('Prop material library item reused', { prop_id: propId, library_item_id: existing.id });
    return { ok: true, item: getLibraryItem(db, String(existing.id)), duplicated: true };
  }
  const info = insertLibraryItem(db, 'prop_libraries', { ...fields, created_at: now });
  log.info('Prop added to material library (global)', { prop_id: propId, library_item_id: info.lastInsertRowid });
  return { ok: true, item: getLibraryItem(db, String(info.lastInsertRowid)), duplicated: false };
}

module.exports = {
  listLibraryItems,
  createLibraryItem,
  getLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  addPropToLibrary,
  addPropToMaterialLibrary,
};
