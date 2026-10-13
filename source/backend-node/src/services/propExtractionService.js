// 与 Go PropService.ExtractPropsFromScript + processPropExtraction 对齐：从剧本提取道具
const taskService = require('./taskService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const propService = require('./propService');
const { safeParseAIJSON, extractFirstArray } = require('../utils/safeJson');
let _cfg = null; // 由 extractPropsForEpisode 注入，供异步任务使用

async function processPropExtraction(db, log, taskId, episodeId) {
  taskService.updateTaskStatus(db, taskId, 'processing', 0, '正在分析剧本...');

  const episode = db.prepare(
    'SELECT id, drama_id, script_content FROM episodes WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(episodeId));
  if (!episode) {
    taskService.updateTaskError(db, taskId, '剧集不存在');
    return;
  }

  const scriptContent = episode.script_content;
  if (!scriptContent || !String(scriptContent).trim()) {
    taskService.updateTaskError(db, taskId, '剧本内容为空');
    return;
  }

  const loadConfig = require('../config').loadConfig;
  let cfg = loadConfig();
  // 用项目的 aspect_ratio 和 style 覆盖全局配置，使 image_prompt 使用正确比例和风格
  try {
    const dramaRow = db.prepare('SELECT style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(episode.drama_id);
    if (dramaRow) {
      const { mergeCfgStyleWithDrama } = require('../utils/dramaStyleMerge');
      let next = { ...cfg, style: { ...(cfg?.style || {}), default_prop_style: '' } };
      if (dramaRow.metadata) {
        const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
        if (meta && meta.aspect_ratio) {
          next.style.default_prop_ratio = meta.aspect_ratio;
          next.style.default_image_ratio = meta.aspect_ratio;
        }
      }
      cfg = mergeCfgStyleWithDrama(next, dramaRow);
    }
  } catch (_) {}
  const systemPrompt = promptI18n.getPropExtractionPrompt(cfg);
  const contentLabel = promptI18n.isEnglish(cfg) ? '[Script Content]\n' : '【剧本内容】\n';
  const prompt = contentLabel + String(scriptContent).trim();

  let response;
  try {
    response = await aiClient.generateText(db, log, 'text', prompt, systemPrompt, {
      scene_key: 'prop_extraction',
      max_tokens: 2000,
      temperature: 0.3,
    });
  } catch (err) {
    log.error('Prop extraction AI failed', { error: err.message, task_id: taskId });
    taskService.updateTaskError(db, taskId, 'AI 提取失败: ' + (err.message || '未知错误'));
    return;
  }

  let extractedProps = [];
  try {
    const parsed = safeParseAIJSON(response, log);
    extractedProps = extractFirstArray(parsed) || [];
  } catch (_) {
    taskService.updateTaskError(db, taskId, '解析 AI 返回的 JSON 失败');
    return;
  }

  taskService.updateTaskStatus(db, taskId, 'processing', 50, '正在保存道具...');

  propService.softDeletePropsByEpisodeId(db, log, episodeId);

  const dramaId = episode.drama_id;
  const createdProps = [];
  for (const p of extractedProps) {
    const name = (p.name && String(p.name).trim()) || '';
    if (!name) continue;
    const existing = db.prepare(
      'SELECT id FROM props WHERE drama_id = ? AND name = ? AND deleted_at IS NULL'
    ).get(dramaId, name);
    if (existing) {
      // 重新提取时更新描述和提示词（保留已有图片）
      const now = new Date().toISOString();
      db.prepare(
        'UPDATE props SET type = ?, description = ?, prompt = ?, updated_at = ? WHERE id = ?'
      ).run(
        (p.type && String(p.type).trim()) || null,
        (p.description && String(p.description).trim()) || null,
        (p.image_prompt && String(p.image_prompt).trim()) || null,
        now,
        existing.id
      );
      const updated = propService.getById(db, existing.id);
      if (updated) createdProps.push(updated);
      continue;
    }

    const prop = propService.create(db, log, {
      drama_id: dramaId,
      episode_id: episodeId,
      name,
      type: (p.type && String(p.type).trim()) || null,
      description: (p.description && String(p.description).trim()) || null,
      prompt: (p.image_prompt && String(p.image_prompt).trim()) || null,
    });
    if (prop) {
      createdProps.push(prop);
      // 若提取时没有生成 prompt，异步后台补生成
      if (!prop.prompt && _cfg) {
        setImmediate(() => {
          propService.generatePropPromptOnly(db, log, _cfg, prop.id, undefined, undefined).catch((err) => {
            log.warn('[提取道具] 预生成提示词失败', { prop_id: prop.id, error: err.message });
          });
        });
      }
    }
  }

  taskService.updateTaskResult(db, taskId, {
    props: createdProps,
    count: createdProps.length,
    episode_id: episodeId,
    drama_id: dramaId,
  });
  log.info('Prop extraction completed', {
    task_id: taskId,
    episode_id: episodeId,
    count: createdProps.length,
  });
}

function extractPropsForEpisode(db, log, episodeId, cfg) {
  if (cfg) _cfg = cfg;
  const episode = db.prepare(
    'SELECT id, drama_id, script_content FROM episodes WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(episodeId));
  if (!episode) throw new Error('episode not found');
  if (!episode.script_content || !String(episode.script_content).trim()) {
    throw new Error('剧集剧本内容为空，无法提取道具');
  }

  const task = taskService.createTask(db, log, 'prop_extraction', String(episodeId));
  setImmediate(() => {
    processPropExtraction(db, log, task.id, episodeId).catch((err) => {
      log.error('processPropExtraction fatal', { error: err.message, task_id: task.id });
    });
  });
  return task.id;
}

module.exports = {
  extractPropsForEpisode,
  processPropExtraction,
};
