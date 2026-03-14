const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');

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
    extra_images: r.extra_images || null,
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
    extra_images: r.extra_images || null,
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
  if (updates.extra_images !== undefined) { set.push('extra_images = ?'); params.push(updates.extra_images ?? null); }
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

/**
 * 用文字 AI 生成道具图片提示词并保存到 props.prompt
 * 供「提取道具后异步预生成」和「重新生成提示词」按钮调用
 */
async function generatePropPromptOnly(db, log, cfg, propId, modelName, style) {
  const prop = getById(db, propId);
  if (!prop) return { ok: false, error: 'prop not found' };

  const descText = [
    prop.name ? `道具名称：${prop.name}` : '',
    prop.type ? `道具类型：${prop.type}` : '',
    prop.description ? `道具描述：${prop.description}` : '',
  ].filter(Boolean).join('\n') || prop.name || '';

  const styleText = (style && String(style).trim()) || cfg?.style?.default_style || '';
  const polishCfg = { ...cfg, style: { ...(cfg?.style || {}), default_style: styleText } };
  const systemPrompt = promptI18n.getPropPolishPrompt(polishCfg);
  const userPrompt = `请为以下道具生成图片提示词：\n\n${descText}`;

  log.info('[道具提示词] 开始生成', { prop_id: propId, name: prop.name });

  let generatedPrompt;
  try {
    generatedPrompt = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      model: modelName || undefined,
      max_tokens: 800,
    });
  } catch (err) {
    log.error('[道具提示词] 文字AI失败', { error: err.message });
    return { ok: false, error: err.message };
  }

  if (generatedPrompt && generatedPrompt.trim()) {
    db.prepare('UPDATE props SET prompt = ?, updated_at = ? WHERE id = ?').run(
      generatedPrompt.trim(), new Date().toISOString(), Number(propId)
    );
    log.info('[道具提示词] 生成并保存完成', { prop_id: propId, length: generatedPrompt.length });
    return { ok: true, prompt: generatedPrompt.trim() };
  }
  return { ok: false, error: 'AI返回内容为空' };
}

module.exports = {
  listByDramaId,
  create,
  getById,
  update,
  deleteById,
  associateWithStoryboard,
  generatePropPromptOnly,
};
