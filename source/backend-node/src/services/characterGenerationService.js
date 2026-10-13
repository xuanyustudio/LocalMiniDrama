
const taskService = require('./taskService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const { safeParseAIJSON, extractFirstArray } = require('../utils/safeJson');
const characterLibraryService = require('./characterLibraryService');
const { mergeCfgStyleWithDrama } = require('../utils/dramaStyleMerge');

/**
 * 从角色外貌描述中提炼 6层视觉锚点，写入 characters.identity_anchors
 * 异步后台执行，不阻塞角色生成主流程
 */
async function enrichIdentityAnchors(db, log, characterId, appearance) {
  if (!appearance || !String(appearance).trim()) return;
  try {
    const systemPrompt = promptI18n.getIdentityAnchorsPrompt();
    const userPrompt = `Character appearance description:\n${appearance}`;
    const raw = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'identity_anchors',
      max_tokens: 800,
      temperature: 0.1,
    });
    const anchors = safeParseAIJSON(raw, log);
    if (!anchors || typeof anchors !== 'object') return;
    const colorPalette = anchors.color_anchors ? JSON.stringify(Object.values(anchors.color_anchors)) : null;
    db.prepare(
      'UPDATE characters SET identity_anchors = ?, color_palette = ?, updated_at = ? WHERE id = ?'
    ).run(JSON.stringify(anchors), colorPalette, new Date().toISOString(), characterId);
    log.info('[锚点] identity_anchors 提炼完成', { character_id: characterId });
  } catch (err) {
    log.warn('[锚点] identity_anchors 提炼失败', { character_id: characterId, error: err.message });
  }
}

async function processCharacterGeneration(db, cfg, log, taskID, req) {
  taskService.updateTaskStatus(db, taskID, 'processing', 0, '正在生成角色...');
  let outlineText = req.outline || '';

  // 读取剧的 style 和 metadata.aspect_ratio，覆盖全局 cfg
  let effectiveCfg = cfg;
  const dramaRow = db.prepare('SELECT id, title, description, genre, style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(Number(req.drama_id));
  if (!dramaRow) {
    taskService.updateTaskStatus(db, taskID, 'failed', 0, '剧本信息不存在');
    return;
  }
  try {
    let next = { ...cfg, style: { ...(cfg?.style || {}) } };
    if (dramaRow.metadata) {
      const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
      if (meta && meta.aspect_ratio) {
        next.style.default_image_ratio = meta.aspect_ratio;
      }
    }
    effectiveCfg = mergeCfgStyleWithDrama(next, dramaRow);
  } catch (_) {}

  if (!outlineText) {
    outlineText = promptI18n.formatUserPrompt(
      effectiveCfg,
      'drama_info_template',
      dramaRow.title || '',
      dramaRow.description || '',
      dramaRow.genre || ''
    );
  }
  const userPrompt = promptI18n.formatUserPrompt(effectiveCfg, 'character_request', outlineText);
  const systemPrompt = promptI18n.getCharacterExtractionPrompt(effectiveCfg);
  const temperature = req.temperature != null ? req.temperature : 0.7;

  // 固定 6000 tokens：足够约 10-12 个角色（每角色约 400-500 tokens）
  // repairTruncatedJsonArray 兜底处理极端截断情况
  const maxTokensForChars = 6000;

  let text;
  try {
    text = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'role_extraction',
      model: req.model || undefined,
      temperature,
      max_tokens: maxTokensForChars,
    });
  } catch (err) {
    log.error('Character generation AI failed', { error: err.message, task_id: taskID });
    taskService.updateTaskStatus(db, taskID, 'failed', 0, 'AI生成失败: ' + err.message);
    return;
  }

  console.log('[角色生成] AI 原始返回：\n' + text);

  let result;
  try {
    const parsed = safeParseAIJSON(text, log);
    result = extractFirstArray(parsed) || [];
  } catch (err) {
    log.error('Character generation parse failed', { error: err.message, task_id: taskID });
    console.error('[角色生成] JSON解析失败，原始内容：\n' + text);
    taskService.updateTaskStatus(db, taskID, 'failed', 0, '解析AI返回结果失败');
    return;
  }

  const dramaId = Number(req.drama_id);
  const now = new Date().toISOString();

  // 再次「从剧本提取角色」时先清空本集已关联角色，避免与旧数据累加；仅软删除不再被任何分集引用的角色行
  if (req.episode_id) {
    const episodeId = Number(req.episode_id);
    const linkedRows = db.prepare('SELECT character_id FROM episode_characters WHERE episode_id = ?').all(episodeId);
    for (const row of linkedRows) {
      const cid = Number(row.character_id);
      const other = db
        .prepare('SELECT COUNT(*) AS n FROM episode_characters WHERE character_id = ? AND episode_id != ?')
        .get(cid, episodeId);
      if (other && other.n === 0) {
        db.prepare('UPDATE characters SET deleted_at = ? WHERE id = ? AND drama_id = ? AND deleted_at IS NULL').run(
          now,
          cid,
          dramaId
        );
      }
    }
    db.prepare('DELETE FROM episode_characters WHERE episode_id = ?').run(episodeId);
  }

  const characters = [];

  for (const char of result) {
    const name = (char.name || '').trim();
    if (!name) continue;
    const existing = db.prepare('SELECT id, name FROM characters WHERE drama_id = ? AND name = ? AND deleted_at IS NULL').get(dramaId, name);
    if (existing) {
      characters.push({
        id: existing.id,
        drama_id: dramaId,
        name: existing.name,
        role: null,
        description: null,
        personality: null,
        appearance: null,
        voice_style: null,
      });
      continue;
    }
    const info = db.prepare(
      `INSERT INTO characters (drama_id, name, role, description, personality, appearance, voice_style, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      dramaId,
      name,
      char.role ?? null,
      char.description ?? null,
      char.personality ?? null,
      char.appearance ?? null,
      char.voice_style ?? null,
      now,
      now
    );
    const newCharId = info.lastInsertRowid;
    // 异步后台提炼视觉锚点 + 预生成图片提示词，不阻塞主流程
    if (char.appearance) {
      setImmediate(() => {
        enrichIdentityAnchors(db, log, newCharId, char.appearance).catch(() => {});
        characterLibraryService.generateCharacterPromptOnly(db, log, effectiveCfg, newCharId, undefined, undefined).catch((err) => {
          log.warn('[提取角色] 预生成polished_prompt失败', { character_id: newCharId, error: err.message });
        });
      });
    }
    characters.push({
      id: newCharId,
      drama_id: dramaId,
      name,
      role: char.role ?? null,
      description: char.description ?? null,
      personality: char.personality ?? null,
      appearance: char.appearance ?? null,
      voice_style: char.voice_style ?? null,
    });
  }

  if (req.episode_id && characters.length > 0) {
    const episodeId = Number(req.episode_id);
    for (const c of characters) {
      try {
        db.prepare('INSERT OR IGNORE INTO episode_characters (episode_id, character_id) VALUES (?, ?)').run(episodeId, c.id);
      } catch (_) {}
    }
  }

  taskService.updateTaskResult(db, taskID, { characters, count: characters.length });
  log.info('Character generation completed', { task_id: taskID, drama_id: req.drama_id, character_count: characters.length });
}

function generateCharacters(db, cfg, log, req) {
  const dramaId = String(req.drama_id || '');
  if (!dramaId) throw new Error('drama_id 必填');
  const task = taskService.createTask(db, log, 'character_generation', dramaId);
  setImmediate(() => {
    processCharacterGeneration(db, cfg, log, task.id, {
      drama_id: req.drama_id,
      episode_id: req.episode_id,
      outline: req.outline,
      temperature: req.temperature,
      model: req.model,
    }).catch((err) => {
      log.error('processCharacterGeneration fatal', { error: err.message, task_id: task.id });
    });
  });
  return task.id;
}

module.exports = {
  generateCharacters,
  enrichIdentityAnchors,
};
