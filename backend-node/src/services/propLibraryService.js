// 道具库：仿 characterLibraryService
const propService = require('./propService');

function rowToItem(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    prompt: r.prompt,
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
  let sql = 'FROM prop_libraries WHERE deleted_at IS NULL';
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
  const info = db.prepare(
    `INSERT INTO prop_libraries (name, description, prompt, image_url, local_path, category, tags, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.name || '',
    req.description ?? null,
    req.prompt ?? null,
    req.image_url || '',
    req.local_path ?? null,
    req.category ?? null,
    req.tags ?? null,
    sourceType,
    now,
    now
  );
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

function addPropToLibrary(db, log, propId, category) {
  const prop = propService.getById(db, Number(propId));
  if (!prop) return { ok: false, error: 'prop not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(prop.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  if (!prop.image_url) return { ok: false, error: '道具还没有形象图片' };
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO prop_libraries (name, description, prompt, image_url, local_path, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'prop', ?, ?)`
  ).run(
    prop.name || '',
    prop.description || null,
    prop.prompt || null,
    prop.image_url,
    prop.local_path || null,
    now,
    now
  );
  log.info('Prop added to library', { prop_id: propId, library_item_id: info.lastInsertRowid });
  return { ok: true, item: getLibraryItem(db, String(info.lastInsertRowid)) };
}

module.exports = {
  listLibraryItems,
  createLibraryItem,
  getLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  addPropToLibrary,
};
