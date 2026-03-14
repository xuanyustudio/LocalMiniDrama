// 场景：与 Go scene_handler + storyboard_composition 对齐
const imageClient = require('./imageClient');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
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
  const info = db.prepare(
    `INSERT INTO scenes (drama_id, location, time, prompt, storyboard_count, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 'pending', ?, ?)`
  ).run(
    Number(dramaId),
    req.location || '',
    req.time || '',
    req.prompt || '',
    now,
    now
  );
  log.info('Scene created', { scene_id: info.lastInsertRowid, drama_id: dramaId });
  return getSceneById(db, info.lastInsertRowid);
}

function createSceneForEpisode(db, log, dramaId, episodeId, req) {
  const now = new Date().toISOString();
  try {
    const info = db.prepare(
      `INSERT INTO scenes (drama_id, episode_id, location, time, prompt, storyboard_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 'pending', ?, ?)`
    ).run(
      Number(dramaId),
      Number(episodeId),
      req.location || '',
      req.time || '',
      req.prompt || '',
      now,
      now
    );
    log.info('Scene created for episode', { scene_id: info.lastInsertRowid, episode_id: episodeId });
    return getSceneById(db, info.lastInsertRowid);
  } catch (e) {
    if ((e.message || '').includes('episode_id')) {
      const info = db.prepare(
        `INSERT INTO scenes (drama_id, location, time, prompt, storyboard_count, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 'pending', ?, ?)`
      ).run(Number(dramaId), req.location || '', req.time || '', req.prompt || '', now, now);
      return getSceneById(db, info.lastInsertRowid);
    }
    throw e;
  }
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
 * 与角色的 buildFourViewImagePrompt 对应
 */
function buildSceneFourViewImagePrompt(fourViewDescription, styleText) {
  const imageLayoutInstruction = promptI18n.getSceneGenerateImagePrompt();
  const styleAppend = styleText ? ` Art style: ${styleText}.` : '';
  return `${imageLayoutInstruction}\n\n---\n\n${fourViewDescription}\n\n---\n\nCRITICAL OUTPUT REQUIREMENT: Generate ONE single image containing a 2×2 grid (4 panels): top-left=establishing wide shot, top-right=main activity zone, bottom-left=signature environmental detail, bottom-right=atmospheric variant (different lighting/time). No human figures. No text labels.${styleAppend}`;
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

  const location = (sceneRow.location || '').trim();
  const time = (sceneRow.time || '').trim();
  const rawPrompt = (sceneRow.prompt || '').trim();
  const styleText = (style && String(style).trim()) || cfg?.style?.default_style || '';
  const fourViewCfg = { ...cfg, style: { ...(cfg?.style || {}), default_style: styleText } };

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

  // Step 2: 拼接完整图片提示词（与 generateSceneFourViewImage 保持一致）
  const polishedPrompt = buildSceneFourViewImagePrompt(fourViewDescription.trim(), styleText);

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
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(sceneRow.drama_id);
  if (!drama) return { ok: false, error: 'unauthorized' };

  const styleText = (style && String(style).trim()) || cfg?.style?.default_style || '';
  let imagePrompt;

  if (sceneRow.polished_prompt && String(sceneRow.polished_prompt).trim()) {
    imagePrompt = String(sceneRow.polished_prompt).trim();
    log.info('[场景四视图] 使用已保存的 polished_prompt，跳过文字AI', { scene_id: sceneId });
  } else {
    const location = (sceneRow.location || '').toString().trim();
    const time = (sceneRow.time || '').toString().trim();
    const rawPrompt = (sceneRow.prompt || '').toString().trim();
    const fourViewCfg = { ...cfg, style: { ...(cfg?.style || {}), default_style: styleText } };

    const sceneDesc = [
      location ? `场景地点：${location}` : '',
      time ? `时间/时段：${time}` : '',
      rawPrompt ? `场景描述：${rawPrompt}` : '',
    ].filter(Boolean).join('\n');
    const inputText = sceneDesc || (location || '未知场景');

    const systemPrompt = promptI18n.getScenePolishPrompt(fourViewCfg);
    const userMsg = `请根据以下场景信息，生成四格场景参考图的提示词：\n\n${inputText}`;

    log.info('[场景四视图] Step1 开始生成提示词', { scene_id: sceneId, location, time });

    let fourViewDescription;
    try {
      fourViewDescription = await aiClient.generateText(db, log, 'text', userMsg, systemPrompt, {
        model: modelName || undefined,
        max_tokens: 4000,
      });
    } catch (err) {
      log.error('[场景四视图] Step1 文本AI失败，降级为直接使用场景描述', { error: err.message });
      fourViewDescription = inputText;
    }

    imagePrompt = buildSceneFourViewImagePrompt(fourViewDescription, styleText);

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
};
