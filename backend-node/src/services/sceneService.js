// 场景：与 Go scene_handler + storyboard_composition 对齐
const imageClient = require('./imageClient');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const { mergeCfgStyleWithDrama } = require('../utils/dramaStyleMerge');

function applySceneStyleOverride(cfg, styleOverride) {
  const o = (styleOverride || '').toString().trim();
  if (!o) return cfg;
  return {
    ...cfg,
    style: {
      ...(cfg?.style || {}),
      default_style_zh: o,
      default_style_en: o,
      default_style: o,
    },
  };
}
function updateScene(db, log, sceneId, req) {
  const row = db.prepare('SELECT id FROM scenes WHERE id = ? AND deleted_at IS NULL').get(Number(sceneId));
  if (!row) return { ok: false, error: 'scene not found' };
  const updates = [];
  const params = [];
  if (req.location != null) { updates.push('location = ?'); params.push(req.location); }
  if (req.time != null) { updates.push('time = ?'); params.push(req.time); }
  if (req.prompt != null) { updates.push('prompt = ?'); params.push(req.prompt); }
  if (req.polished_prompt != null) { updates.push('polished_prompt = ?'); params.push(req.polished_prompt); }
  if (req.image_url != null) { updates.push('image_url = ?'); params.push(req.image_url); }
  if (req.local_path !== undefined) { updates.push('local_path = ?'); params.push(req.local_path); }
  if (req.extra_images !== undefined) { updates.push('extra_images = ?'); params.push(req.extra_images ?? null); }
  if (req.ref_image !== undefined) { updates.push('ref_image = ?'); params.push(req.ref_image ?? null); }
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
  const episodeId = req.episode_id != null ? Number(req.episode_id) : null;
  try {
    const info = db.prepare(
      `INSERT INTO scenes (drama_id, episode_id, location, time, prompt, image_url, local_path, storyboard_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?)`
    ).run(
      Number(dramaId),
      episodeId,
      req.location || '',
      req.time || '',
      req.prompt || '',
      req.image_url ?? null,
      req.local_path ?? null,
      now,
      now
    );
    log.info('Scene created', { scene_id: info.lastInsertRowid, drama_id: dramaId, episode_id: episodeId });
    return getSceneById(db, info.lastInsertRowid);
  } catch (e) {
    // 老库可能没有 episode_id 列，降级为不含 episode_id 的 INSERT
    if ((e.message || '').includes('episode_id')) {
      const info = db.prepare(
        `INSERT INTO scenes (drama_id, location, time, prompt, image_url, local_path, storyboard_count, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?)`
      ).run(Number(dramaId), req.location || '', req.time || '', req.prompt || '', req.image_url ?? null, req.local_path ?? null, now, now);
      return getSceneById(db, info.lastInsertRowid);
    }
    throw e;
  }
}

function createSceneForEpisode(db, log, dramaId, episodeId, req) {
  return createScene(db, log, dramaId, { ...req, episode_id: episodeId });
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
  return row ? {
    id: row.id,
    drama_id: row.drama_id,
    location: row.location,
    time: row.time,
    prompt: row.prompt,
    polished_prompt: row.polished_prompt || null,
    image_url: row.image_url,
    local_path: row.local_path,
    extra_images: row.extra_images || null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  } : null;
}

/**
 * 将文字AI的四视图描述 + 布局指令 + 风格 合并为完整的图片AI提示词
 * 与角色的 buildFourViewImagePrompt 对应（画风置顶 + 尾部重申）
 */
function buildSceneFourViewImagePrompt(fourViewDescription, styleEn, styleZh) {
  const imageLayoutInstruction = promptI18n.getSceneGenerateImagePrompt();
  const zh = (styleZh || '').trim();
  const en = (styleEn || '').trim();

  const styleLines = [];
  if (zh) styleLines.push(`【画风·最高优先级】四格统一：${zh}`);
  if (en && en !== zh) styleLines.push(`MANDATORY ART STYLE (all 4 panels): ${en}.`);
  else if (en && !zh) styleLines.push(`MANDATORY ART STYLE (all 4 panels): ${en}.`);
  const styleHeader = styleLines.length ? `${styleLines.join('\n')}\n\n` : '';

  const tailParts = [];
  if (zh || en) tailParts.push(`Reiterate: same art style as above (${en || zh}). No people, no text.`);
  const tail = tailParts.length ? `\n\n---\n\n${tailParts.join(' ')}` : '';

  return `${styleHeader}${imageLayoutInstruction}\n\n---\n\n${fourViewDescription}${tail}`;
}

/**
 * 仅生成（并保存）场景四视图完整图片提示词到 scenes.polished_prompt，不触发图片生成。
 * 与角色的 generateCharacterPromptOnly 对应：
 *   Step 1: 文字AI将 location/time/prompt(原始描述) → fourViewDescription
 *   Step 2: 拼接布局指令 + fourViewDescription + 硬性要求 → polished_prompt（完整英文图片提示词）
 * 供「提取场景后异步预生成」和「重新生成提示词」按钮调用。
 */
async function generateScenePromptOnly(db, log, cfg, sceneId, modelName, style) {
  const sceneRow = db.prepare(
    'SELECT id, drama_id, location, time, prompt FROM scenes WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(sceneId));
  if (!sceneRow) return { ok: false, error: 'scene not found' };

  const dramaFull = db.prepare('SELECT id, style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(sceneRow.drama_id);
  let mergedCfg = mergeCfgStyleWithDrama(cfg, dramaFull || {});
  mergedCfg = applySceneStyleOverride(mergedCfg, style);

  const location = (sceneRow.location || '').trim();
  const time = (sceneRow.time || '').trim();
  const rawPrompt = (sceneRow.prompt || '').trim();
  const fourViewCfg = mergedCfg;

  // 构建文字AI输入（location + time + 原始描述）
  const sceneDesc = [
    location ? `场景地点：${location}` : '',
    time ? `时间/时段：${time}` : '',
    rawPrompt ? `场景描述：${rawPrompt}` : '',
  ].filter(Boolean).join('\n') || location || '未知场景';

  const systemPrompt = promptI18n.getScenePolishPrompt(fourViewCfg);
  const userPrompt = `请根据以下场景信息，生成四格场景参考图的提示词：\n\n${sceneDesc}`;

  log.info('[场景提示词] Step1 开始生成四视图描述', { scene_id: sceneId, location, time });

  let fourViewDescription;
  try {
    fourViewDescription = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'scene_image_polish',
      model: modelName || undefined,
      max_tokens: 4000,
    });
  } catch (err) {
    log.error('[场景提示词] 文字AI失败', { error: err.message });
    return { ok: false, error: err.message };
  }

  if (!fourViewDescription || !fourViewDescription.trim()) {
    return { ok: false, error: 'AI返回内容为空' };
  }

  const styleEn = (mergedCfg.style.default_style_en || mergedCfg.style.default_style || '').trim();
  const styleZh = (mergedCfg.style.default_style_zh || '').trim();
  const polishedPrompt = buildSceneFourViewImagePrompt(fourViewDescription.trim(), styleEn, styleZh);

  db.prepare('UPDATE scenes SET polished_prompt = ?, updated_at = ? WHERE id = ?').run(
    polishedPrompt, new Date().toISOString(), Number(sceneId)
  );
  log.info('[场景提示词] 生成并保存完成', { scene_id: sceneId, length: polishedPrompt.length });
  return { ok: true, polished_prompt: polishedPrompt };
}

/**
 * 场景四视图生成：两步流程
 * Step 1: 文本AI将 location/time/prompt 转换为四格场景参考图描述
 * Step 2: 图片AI根据描述生成 16:9 四格场景参考图
 * 如果已有 polished_prompt（预生成的完整提示词），直接使用，跳过 Step 1
 */
async function generateSceneFourViewImage(db, log, cfg, sceneId, modelName, style) {
  const sceneRow = db.prepare(
    'SELECT id, drama_id, location, time, prompt, polished_prompt FROM scenes WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(sceneId));
  if (!sceneRow) return { ok: false, error: 'scene not found' };
  const dramaFull = db.prepare('SELECT id, style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(sceneRow.drama_id);
  if (!dramaFull) return { ok: false, error: 'unauthorized' };

  let mergedCfg = mergeCfgStyleWithDrama(cfg, dramaFull);
  mergedCfg = applySceneStyleOverride(mergedCfg, style);
  let imagePrompt;

  if (sceneRow.polished_prompt && String(sceneRow.polished_prompt).trim()) {
    imagePrompt = String(sceneRow.polished_prompt).trim();
    log.info('[场景四视图] 使用已保存的 polished_prompt，跳过文字AI', { scene_id: sceneId });
  } else {
    const location = (sceneRow.location || '').toString().trim();
    const time = (sceneRow.time || '').toString().trim();
    const rawPrompt = (sceneRow.prompt || '').toString().trim();
    const sceneDesc = [
      location ? `场景地点：${location}` : '',
      time ? `时间/时段：${time}` : '',
      rawPrompt ? `场景描述：${rawPrompt}` : '',
    ].filter(Boolean).join('\n');
    const inputText = sceneDesc || (location || '未知场景');

    const systemPrompt = promptI18n.getScenePolishPrompt(mergedCfg);
    const userMsg = `请根据以下场景信息，生成四格场景参考图的提示词：\n\n${inputText}`;

    log.info('[场景四视图] Step1 开始生成提示词', { scene_id: sceneId, location, time });

    let fourViewDescription;
    try {
      fourViewDescription = await aiClient.generateText(db, log, 'text', userMsg, systemPrompt, {
        scene_key: 'scene_image_polish',
        model: modelName || undefined,
        max_tokens: 4000,
      });
    } catch (err) {
      log.error('[场景四视图] Step1 文本AI失败，降级为直接使用场景描述', { error: err.message });
      fourViewDescription = inputText;
    }

    const styleEn = (mergedCfg.style.default_style_en || mergedCfg.style.default_style || '').trim();
    const styleZh = (mergedCfg.style.default_style_zh || '').trim();
    imagePrompt = buildSceneFourViewImagePrompt(fourViewDescription, styleEn, styleZh);

    // 顺带保存，供下次复用
    try {
      db.prepare('UPDATE scenes SET polished_prompt = ?, updated_at = ? WHERE id = ?').run(
        imagePrompt, new Date().toISOString(), Number(sceneId)
      );
    } catch (_) {}

    log.info('[场景四视图] Step1 完成，开始Step2生图', { scene_id: sceneId });
  }

  const imageGen = imageClient.createAndGenerateImage(db, log, {
    drama_id: sceneRow.drama_id,
    scene_id: sceneId,
    prompt: imagePrompt,
    model: modelName || undefined,
    size: '1792x1024',
    quality: 'standard',
    provider: 'openai',
  });

  log.info('[场景四视图] Step2 图片生成任务已提交', { scene_id: sceneId, image_gen_id: imageGen?.id });

  return { ok: true, image_generation: imageGen };
}

/**
 * 从场景现有图片中反向提取场景描述，更新 prompt 字段。
 */
async function extractSceneFromImage(db, log, cfg, sceneId) {
  const { generateTextWithVision, resolveEntityImageSource, EXTRACT_PROMPTS } = require('./aiClient');

  const sceneRow = db.prepare(
    'SELECT id, location, time, image_url, local_path, extra_images, ref_image FROM scenes WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(sceneId));
  if (!sceneRow) return { ok: false, error: 'scene not found' };

  const imgSrc = resolveEntityImageSource(sceneRow, cfg);
  if (!imgSrc) return { ok: false, error: '该场景暂无参考图片，请先上传图片' };

  const locationLabel = [sceneRow.location, sceneRow.time].filter(Boolean).join(' · ') || '场景';
  const { system: systemPrompt, user: userFn } = EXTRACT_PROMPTS.scene;
  const userPrompt = userFn(locationLabel);

  let prompt;
  try {
    prompt = await generateTextWithVision(db, log, 'text', userPrompt, systemPrompt, imgSrc, { max_tokens: 2000 });
  } catch (err) {
    log.error('[extractSceneFromImage] AI 调用失败', { sceneId, error: err.message });
    const errMsg = /image|vision|visual|multimodal/i.test(err.message)
      ? `AI 模型不支持图片识别，请在「AI 配置」中使用支持视觉的模型（如 GPT-4o、Gemini 1.5 等）【原始错误：${err.message.slice(0, 120)}】`
      : `AI 分析失败：${err.message}`;
    return { ok: false, error: errMsg };
  }

  db.prepare('UPDATE scenes SET prompt = ?, updated_at = ? WHERE id = ?')
    .run(prompt, new Date().toISOString(), Number(sceneId));

  log.info('[extractSceneFromImage] 场景描述提取成功', { sceneId, prompt_len: prompt.length });
  return { ok: true, prompt };
}

module.exports = {
  updateScene,
  updateScenePrompt,
  deleteScene,
  createScene,
  createSceneForEpisode,
  deleteScenesByEpisodeId,
  getSceneById,
  generateSceneFourViewImage,
  generateScenePromptOnly,
  extractSceneFromImage,
};
