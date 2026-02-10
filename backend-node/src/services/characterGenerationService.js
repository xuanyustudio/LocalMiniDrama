// 与 Go ScriptGenerationService.GenerateCharacters + processCharacterGeneration 对齐
const taskService = require('./taskService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const { safeParseAIJSON } = require('../utils/safeJson');

async function processCharacterGeneration(db, cfg, log, taskID, req) {
  taskService.updateTaskStatus(db, taskID, 'processing', 0, '正在生成角色...');
  const count = req.count || 5;
  let outlineText = req.outline || '';
  if (!outlineText) {
    const drama = db.prepare('SELECT id, title, description, genre FROM dramas WHERE id = ? AND deleted_at IS NULL').get(Number(req.drama_id));
    if (!drama) {
      taskService.updateTaskStatus(db, taskID, 'failed', 0, '剧本信息不存在');
      return;
    }
    outlineText = promptI18n.formatUserPrompt(
      cfg,
      'drama_info_template',
      drama.title || '',
      drama.description || '',
      drama.genre || ''
    );
  }
  const userPrompt = promptI18n.formatUserPrompt(cfg, 'character_request', outlineText, count);
  const systemPrompt = promptI18n.getCharacterExtractionPrompt(cfg);
  const temperature = req.temperature != null ? req.temperature : 0.7;

  let text;
  try {
    text = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      model: req.model || undefined,
      temperature,
    });
  } catch (err) {
    log.error('Character generation AI failed', { error: err.message, task_id: taskID });
    taskService.updateTaskStatus(db, taskID, 'failed', 0, 'AI生成失败: ' + err.message);
    return;
  }

  let result;
  try {
    result = safeParseAIJSON(text, []);
    if (!Array.isArray(result)) result = [];
  } catch (err) {
    log.error('Character generation parse failed', { error: err.message, task_id: taskID });
    taskService.updateTaskStatus(db, taskID, 'failed', 0, '解析AI返回结果失败');
    return;
  }

  const dramaId = Number(req.drama_id);
  const now = new Date().toISOString();
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
    characters.push({
      id: info.lastInsertRowid,
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
      count: req.count || 5,
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
};
