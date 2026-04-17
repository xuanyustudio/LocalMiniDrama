const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const { mergeCfgStyleWithDrama } = require('../utils/dramaStyleMerge');

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
    `INSERT INTO props (drama_id, episode_id, name, type, description, prompt, image_url, local_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.drama_id,
    episodeId,
    req.name || '',
    req.type ?? null,
    req.description ?? null,
    req.prompt ?? null,
    req.image_url ?? null,
    req.local_path ?? null,
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
  if (updates.ref_image !== undefined) { set.push('ref_image = ?'); params.push(updates.ref_image ?? null); }
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

/** 软删除本集「从剧本提取」写入的道具（props.episode_id），避免再次提取时与旧数据累加 */
function softDeletePropsByEpisodeId(db, log, episodeId) {
  const now = new Date().toISOString();
  try {
    const result = db.prepare(
      'UPDATE props SET deleted_at = ? WHERE episode_id = ? AND deleted_at IS NULL'
    ).run(now, Number(episodeId));
    log.info('Props soft-deleted by episode', { episode_id: episodeId, count: result.changes });
    return result.changes;
  } catch (e) {
    if ((e.message || '').includes('episode_id')) return 0;
    throw e;
  }
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

  const dramaRow = prop.drama_id
    ? db.prepare('SELECT style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(prop.drama_id)
    : null;
  let polishCfg = mergeCfgStyleWithDrama(cfg, dramaRow || {});
  const so = (style && String(style).trim()) || '';
  if (so) {
    polishCfg = {
      ...polishCfg,
      style: {
        ...polishCfg.style,
        default_style_zh: so,
        default_style_en: so,
        default_style: so,
      },
    };
  }

  const descText = [
    prop.name ? `道具名称：${prop.name}` : '',
    prop.type ? `道具类型：${prop.type}` : '',
    prop.description ? `道具描述：${prop.description}` : '',
  ].filter(Boolean).join('\n') || prop.name || '';

  const systemPrompt = promptI18n.getPropPolishPrompt(polishCfg);
  const userPrompt = `请为以下道具生成**一段英文**图片提示词。\n**约束**：最终英文中不得出现人名、地名、组织名、台词或任何剧本专有信息（若下列「道具名称/描述」中含此类词，请改写为泛化物体描述）；只写已给出的可见外观信息，不要扩写未提及的细节。\n\n${descText}`;

  log.info('[道具提示词] 开始生成', { prop_id: propId, name: prop.name });

  let generatedPrompt;
  try {
    generatedPrompt = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'prop_image_polish',
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

/**
 * 从道具现有图片中反向提取外观描述，更新 description 字段。
 */
async function extractPropFromImage(db, log, cfg, propId) {
  const { generateTextWithVision, resolveEntityImageSource, EXTRACT_PROMPTS } = require('./aiClient');

  const prop = db.prepare(
    'SELECT id, name, type, image_url, local_path, extra_images, ref_image FROM props WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(propId));
  if (!prop) return { ok: false, error: 'prop not found' };

  const imgSrc = resolveEntityImageSource(prop, cfg);
  if (!imgSrc) return { ok: false, error: '该道具暂无参考图片，请先上传图片' };

  const propLabel = prop.name || '道具';
  const { system: systemPrompt, user: userFn } = EXTRACT_PROMPTS.prop;
  const userPrompt = userFn(propLabel);

  let description;
  try {
    description = await generateTextWithVision(db, log, 'text', userPrompt, systemPrompt, imgSrc, { max_tokens: 2000 });
  } catch (err) {
    log.error('[extractPropFromImage] AI 调用失败', { propId, error: err.message });
    const errMsg = /image|vision|visual|multimodal/i.test(err.message)
      ? `AI 模型不支持图片识别，请在「AI 配置」中使用支持视觉的模型（如 GPT-4o、Gemini 1.5 等）【原始错误：${err.message.slice(0, 120)}】`
      : `AI 分析失败：${err.message}`;
    return { ok: false, error: errMsg };
  }

  db.prepare('UPDATE props SET description = ?, updated_at = ? WHERE id = ?')
    .run(description, new Date().toISOString(), Number(propId));

  log.info('[extractPropFromImage] 道具描述提取成功', { propId, description_len: description.length });
  return { ok: true, description };
}

module.exports = {
  listByDramaId,
  create,
  getById,
  update,
  deleteById,
  softDeletePropsByEpisodeId,
  associateWithStoryboard,
  generatePropPromptOnly,
  extractPropFromImage,
};
