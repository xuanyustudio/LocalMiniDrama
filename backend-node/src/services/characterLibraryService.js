// 角色库：与 Go character_library_service 对齐
const imageClient = require('./imageClient');

function generateCharacterImage(db, log, cfg, characterId, modelName, style) {
  const charRow = db.prepare(
    'SELECT id, drama_id, name, appearance, description FROM characters WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };

  let prompt = '';
  if (charRow.appearance && String(charRow.appearance).trim()) {
    prompt = String(charRow.appearance);
  } else if (charRow.description && String(charRow.description).trim()) {
    prompt = String(charRow.description);
  } else {
    prompt = charRow.name || '';
  }
  prompt += (cfg?.style?.default_style || '');
  prompt += (cfg?.style?.default_role_style || '');
  prompt += (cfg?.style?.default_role_ratio || '') || (cfg?.style?.default_image_ratio ? ', image ratio: ' + cfg.style.default_image_ratio : '');

  const imageGen = imageClient.createAndGenerateImage(db, log, {
    drama_id: charRow.drama_id,
    character_id: charRow.id,
    prompt,
    model: modelName || undefined,
    size: '2560x1440',
    quality: 'standard',
    provider: 'openai',
  });
  return { ok: true, image_generation: imageGen };
}

function listLibraryItems(db, query) {
  let sql = 'FROM character_libraries WHERE deleted_at IS NULL';
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
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    const k = '%' + query.keyword + '%';
    params.push(k, k);
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
    `INSERT INTO character_libraries (name, category, image_url, local_path, description, tags, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.name || '',
    req.category ?? null,
    req.image_url || '',
    req.local_path ?? null,
    req.description ?? null,
    req.tags ?? null,
    sourceType,
    now,
    now
  );
  log.info('Library item created', { item_id: info.lastInsertRowid });
  return getLibraryItem(db, String(info.lastInsertRowid));
}

function getLibraryItem(db, id) {
  const row = db.prepare('SELECT * FROM character_libraries WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return row ? rowToItem(row) : null;
}

function deleteLibraryItem(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE character_libraries SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  if (result.changes === 0) return false;
  log.info('Library item deleted', { item_id: id });
  return true;
}

function applyLibraryItemToCharacter(db, log, characterId, libraryItemId) {
  const item = getLibraryItem(db, libraryItemId);
  if (!item) return { ok: false, error: 'library item not found' };
  const charRow = db.prepare('SELECT id, drama_id FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  const now = new Date().toISOString();
  db.prepare('UPDATE characters SET image_url = ?, local_path = ?, updated_at = ? WHERE id = ?').run(
    item.image_url || null,
    item.local_path || null,
    now,
    Number(characterId)
  );
  log.info('Library item applied to character', { character_id: characterId, library_item_id: libraryItemId });
  return { ok: true };
}

function uploadCharacterImage(db, log, characterId, imageUrl) {
  const charRow = db.prepare('SELECT id, drama_id FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  const now = new Date().toISOString();
  db.prepare('UPDATE characters SET image_url = ?, updated_at = ? WHERE id = ?').run(imageUrl || null, now, Number(characterId));
  log.info('Character image uploaded', { character_id: characterId });
  return { ok: true };
}

function addCharacterToLibrary(db, log, characterId, category) {
  const charRow = db.prepare('SELECT * FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  if (!charRow.image_url) return { ok: false, error: '角色还没有形象图片' };
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO character_libraries (name, image_url, local_path, description, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'character', ?, ?)`
  ).run(charRow.name, charRow.image_url, charRow.local_path || null, charRow.description || null, now, now);
  log.info('Character added to library', { character_id: characterId, library_item_id: info.lastInsertRowid });
  return { ok: true, item: getLibraryItem(db, String(info.lastInsertRowid)) };
}

function updateCharacter(db, log, characterId, req) {
  const charRow = db.prepare('SELECT id, drama_id FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  const updates = [];
  const params = [];
  if (req.name != null) { updates.push('name = ?'); params.push(req.name); }
  if (req.role != null) { updates.push('role = ?'); params.push(req.role); }
  if (req.appearance != null) { updates.push('appearance = ?'); params.push(req.appearance); }
  if (req.personality != null) { updates.push('personality = ?'); params.push(req.personality); }
  if (req.description != null) { updates.push('description = ?'); params.push(req.description); }
  if (req.image_url != null) { updates.push('image_url = ?'); params.push(req.image_url); }
  if (req.local_path != null) { updates.push('local_path = ?'); params.push(req.local_path); }
  if (updates.length === 0) return { ok: true };
  params.push(new Date().toISOString(), characterId);
  db.prepare('UPDATE characters SET ' + updates.join(', ') + ', updated_at = ? WHERE id = ?').run(...params);
  log.info('Character updated', { character_id: characterId });
  return { ok: true };
}

function deleteCharacter(db, log, characterId) {
  const charRow = db.prepare('SELECT id, drama_id FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  const now = new Date().toISOString();
  db.prepare('UPDATE characters SET deleted_at = ? WHERE id = ?').run(now, Number(characterId));
  log.info('Character deleted', { id: characterId });
  return { ok: true };
}

/**
 * 批量生成角色图片（与 Go BatchGenerateCharacterImages 对齐：为每个角色单独起一个异步任务并发生成）
 */
function batchGenerateCharacterImages(db, log, cfg, characterIds, modelName) {
  const ids = Array.isArray(characterIds) ? characterIds.map((id) => String(id)) : [];
  if (ids.length === 0) return { ok: false, error: 'character_ids 不能为空' };
  if (ids.length > 10) return { ok: false, error: '单次最多生成10个角色' };
  log.info('Starting batch character image generation', { count: ids.length, model: modelName, character_ids: ids });
  // 与 Go 一致：每个角色单独起一个“协程”，不阻塞响应
  for (const characterId of ids) {
    const charId = characterId;
    setImmediate(() => {
      try {
        const out = generateCharacterImage(db, log, cfg, charId, modelName, undefined);
        if (!out.ok) {
          log.warn('Batch character image skip', { character_id: charId, error: out.error });
          return;
        }
        log.info('Batch character image submitted', { character_id: charId, image_gen_id: out.image_generation?.id });
      } catch (err) {
        log.error('Batch character image failed', { character_id: charId, error: err.message });
      }
    });
  }
  log.info('Batch character image generation tasks queued', { total: ids.length });
  return { ok: true, count: ids.length };
}

function rowToItem(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    image_url: r.image_url,
    local_path: r.local_path,
    description: r.description,
    tags: r.tags,
    source_type: r.source_type || 'generated',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

module.exports = {
  listLibraryItems,
  createLibraryItem,
  getLibraryItem,
  deleteLibraryItem,
  applyLibraryItemToCharacter,
  uploadCharacterImage,
  addCharacterToLibrary,
  updateCharacter,
  deleteCharacter,
  generateCharacterImage,
  batchGenerateCharacterImages,
};
