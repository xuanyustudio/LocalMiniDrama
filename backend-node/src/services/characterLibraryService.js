// 角色库：与 Go character_library_service 对齐
const imageClient = require('./imageClient');
const { aspectRatioToSize } = require('./imageService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');

function appendPrompt(base, extra) {
  const add = (extra || '').toString().trim();
  if (!add) return base;
  const current = (base || '').toString().trim();
  if (!current) return add;
  const lowerCurrent = current.toLowerCase();
  const lowerAdd = add.toLowerCase();
  if (lowerCurrent.includes(lowerAdd)) return current;
  return current + ', ' + add;
}

function generateCharacterImage(db, log, cfg, characterId, modelName, style) {
  const charRow = db.prepare(
    'SELECT id, drama_id, name, appearance, description FROM characters WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };

  // 用项目的 aspect_ratio 覆盖全局 cfg 中的 default_image_ratio
  let effectiveCfg = cfg;
  try {
    const meta = drama.metadata ? (typeof drama.metadata === 'string' ? JSON.parse(drama.metadata) : drama.metadata) : null;
    if (meta && meta.aspect_ratio) {
      effectiveCfg = { ...cfg, style: { ...(cfg?.style || {}), default_image_ratio: meta.aspect_ratio } };
    }
  } catch (_) {}

  let prompt = '';
  if (charRow.appearance && String(charRow.appearance).trim()) {
    prompt = String(charRow.appearance);
  } else if (charRow.description && String(charRow.description).trim()) {
    prompt = String(charRow.description);
  } else {
    prompt = charRow.name || '';
  }
  const styleOverride = (style && String(style).trim()) || '';
  const styleText = styleOverride || (effectiveCfg?.style?.default_style || '');
  prompt = appendPrompt(prompt, styleText);
  if (!styleOverride) {
    prompt = appendPrompt(prompt, effectiveCfg?.style?.default_role_style || '');
  }
  const ratioText = effectiveCfg?.style?.default_role_ratio
    ? String(effectiveCfg.style.default_role_ratio)
    : (effectiveCfg?.style?.default_image_ratio ? 'image ratio: ' + effectiveCfg.style.default_image_ratio : '');
  prompt = appendPrompt(prompt, ratioText);
  // 根据项目 aspect_ratio 动态计算图片尺寸，兜底 1920x1920
  let imageSize = null;
  try {
    const meta = drama.metadata ? (typeof drama.metadata === 'string' ? JSON.parse(drama.metadata) : drama.metadata) : null;
    if (meta && meta.aspect_ratio) imageSize = aspectRatioToSize(meta.aspect_ratio);
  } catch (_) {}
  imageSize = imageSize || '1920x1920';
  const imageGen = imageClient.createAndGenerateImage(db, log, {
    drama_id: charRow.drama_id,
    character_id: charRow.id,
    prompt,
    model: modelName || undefined,
    size: imageSize,
    quality: 'standard',
    provider: 'openai',
  });
  return { ok: true, image_generation: imageGen };
}

function listLibraryItems(db, query) {
  let sql = 'FROM character_libraries WHERE deleted_at IS NULL';
  const params = [];
  if (query.global === '1' || query.global === 1) {
    // 仅全局素材库（drama_id IS NULL）
    sql += ' AND drama_id IS NULL';
  } else if (query.drama_id != null && query.drama_id !== '') {
    // 本剧资源库
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
    `INSERT INTO character_libraries (drama_id, name, category, image_url, local_path, description, tags, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.drama_id ?? null,
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

function updateLibraryItem(db, log, id, req) {
  const row = db.prepare('SELECT id FROM character_libraries WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!row) return null;
  const updates = [];
  const params = [];
  if (req.name != null) { updates.push('name = ?'); params.push(req.name); }
  if (req.category != null) { updates.push('category = ?'); params.push(req.category); }
  if (req.description != null) { updates.push('description = ?'); params.push(req.description); }
  if (req.tags != null) { updates.push('tags = ?'); params.push(req.tags); }
  if (req.image_url != null) { updates.push('image_url = ?'); params.push(req.image_url); }
  if (req.local_path != null) { updates.push('local_path = ?'); params.push(req.local_path); }
  if (req.source_type != null) { updates.push('source_type = ?'); params.push(req.source_type); }
  if (updates.length === 0) return getLibraryItem(db, id);
  params.push(new Date().toISOString(), Number(id));
  db.prepare('UPDATE character_libraries SET ' + updates.join(', ') + ', updated_at = ? WHERE id = ?').run(...params);
  log.info('Library item updated', { item_id: id });
  return getLibraryItem(db, id);
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

// 加入本剧资源库（带 drama_id）
function addCharacterToLibrary(db, log, characterId, category) {
  const charRow = db.prepare('SELECT * FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };
  if (!charRow.image_url && !charRow.local_path) return { ok: false, error: '角色还没有形象图片' };
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO character_libraries (drama_id, name, image_url, local_path, description, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'character', ?, ?)`
  ).run(charRow.drama_id, charRow.name, charRow.image_url || null, charRow.local_path || null, charRow.description || null, now, now);
  log.info('Character added to drama library', { character_id: characterId, drama_id: charRow.drama_id, library_item_id: info.lastInsertRowid });
  return { ok: true, item: getLibraryItem(db, String(info.lastInsertRowid)) };
}

// 加入全局素材库（drama_id = NULL）
function addCharacterToMaterialLibrary(db, log, characterId) {
  const charRow = db.prepare('SELECT * FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  if (!charRow.image_url && !charRow.local_path) return { ok: false, error: '角色还没有形象图片' };
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO character_libraries (drama_id, name, image_url, local_path, description, source_type, created_at, updated_at)
     VALUES (NULL, ?, ?, ?, ?, 'character', ?, ?)`
  ).run(charRow.name, charRow.image_url || null, charRow.local_path || null, charRow.description || null, now, now);
  log.info('Character added to material library (global)', { character_id: characterId, library_item_id: info.lastInsertRowid });
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
function batchGenerateCharacterImages(db, log, cfg, characterIds, modelName, style) {
  const ids = Array.isArray(characterIds) ? characterIds.map((id) => String(id)) : [];
  if (ids.length === 0) return { ok: false, error: 'character_ids 不能为空' };
  if (ids.length > 10) return { ok: false, error: '单次最多生成10个角色' };
  log.info('Starting batch character four-view generation', { count: ids.length, model: modelName, character_ids: ids });
  // 每个角色单独起一个异步任务，不阻塞响应
  for (const characterId of ids) {
    const charId = characterId;
    setImmediate(async () => {
      try {
        const out = await generateCharacterFourViewImage(db, log, cfg, charId, modelName, style);
        if (!out.ok) {
          log.warn('Batch character four-view skip', { character_id: charId, error: out.error });
          return;
        }
        log.info('Batch character four-view submitted', { character_id: charId, image_gen_id: out.image_generation ? out.image_generation.id : null });
      } catch (err) {
        log.error('Batch character four-view failed', { character_id: charId, error: err.message });
      }
    });
  }
  log.info('Batch character four-view tasks queued', { total: ids.length });
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

/**
 * 角色四视图生成：两步流程
 * Step 1: 文本AI将 appearance 转换为标准四视图绘图描述
 * Step 2: 图片AI根据描述生成 16:9 四格角色参考图
 */
async function generateCharacterFourViewImage(db, log, cfg, characterId, modelName, style) {
  const charRow = db.prepare(
    'SELECT id, drama_id, name, appearance, description FROM characters WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(characterId));
  if (!charRow) return { ok: false, error: 'character not found' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };

  // 构建角色描述：优先用 appearance，其次 description，最后仅用名字
  let appearanceText = '';
  if (charRow.appearance && String(charRow.appearance).trim()) {
    appearanceText = String(charRow.appearance).trim();
  } else if (charRow.description && String(charRow.description).trim()) {
    appearanceText = String(charRow.description).trim();
  } else {
    appearanceText = charRow.name || '';
  }

  const styleText = (style && String(style).trim()) || cfg?.style?.default_style || '';

  // 构建 cfg（带风格，不带 image ratio，四视图固定 16:9）
  const fourViewCfg = { ...cfg, style: { ...(cfg?.style || {}), default_style: styleText } };

  // Step 1: 文本 AI 生成四视图提示词描述
  const systemPrompt = promptI18n.getRolePolishPrompt(fourViewCfg);
  const userPrompt = `角色名称：${charRow.name}\n\n角色描述：\n${appearanceText}`;

  log.info('[四视图] Step1 开始生成四视图提示词', { character_id: characterId, name: charRow.name });

  let fourViewDescription;
  try {
    fourViewDescription = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      model: modelName || undefined,
      max_tokens: 4000,
    });
  } catch (err) {
    log.error('[四视图] Step1 文本AI失败，降级为直接使用外貌描述', { error: err.message });
    fourViewDescription = appearanceText;
  }

  log.info('[四视图] Step1 完成，开始Step2生图', { character_id: characterId, desc_length: (fourViewDescription || '').length });

  // Step 2: 图片AI生成四视图，固定 16:9
  // 注意：图片生成API不支持独立 system_prompt，必须将布局规则合并进 prompt
  const imageLayoutInstruction = promptI18n.getRoleGenerateImagePrompt();
  const imagePrompt = `${imageLayoutInstruction}\n\n---\n\n${fourViewDescription}\n\n---\n\nCRITICAL OUTPUT REQUIREMENT: Generate ONE single image containing a 2×2 grid (4 panels): top-left=head close-up, top-right=front full body, bottom-left=left side full body, bottom-right=back full body. Pure white background. No text labels. No props in hands. Neutral expression. Arms at sides.`;

  const imageGen = imageClient.createAndGenerateImage(db, log, {
    drama_id: charRow.drama_id,
    character_id: charRow.id,
    prompt: imagePrompt,
    model: modelName || undefined,
    size: '1792x1024',
    quality: 'standard',
    provider: 'openai',
  });

  log.info('[四视图] Step2 图片生成任务已提交', { character_id: characterId, image_gen_id: imageGen?.id });

  return { ok: true, image_generation: imageGen };
}

module.exports = {
  listLibraryItems,
  createLibraryItem,
  getLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  applyLibraryItemToCharacter,
  uploadCharacterImage,
  addCharacterToLibrary,
  addCharacterToMaterialLibrary,
  updateCharacter,
  deleteCharacter,
  generateCharacterImage,
  batchGenerateCharacterImages,
  generateCharacterFourViewImage,
};
