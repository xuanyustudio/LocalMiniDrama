// 与 Go ImageGenerationService.ExtractBackgroundsForEpisode + processBackgroundExtraction 对齐
const taskService = require('./taskService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const sceneService = require('./sceneService');
const { safeParseAIJSON } = require('../utils/safeJson');

async function extractBackgroundsFromScript(db, cfg, log, scriptContent, dramaId, model, style) {
  if (!scriptContent || !scriptContent.trim()) return [];
  const systemPrompt = promptI18n.getSceneExtractionPrompt(cfg, style);
  const prompt = (promptI18n.getLanguage(cfg) === 'en' ? '[Script Content]\n' : '【剧本内容】\n') + scriptContent;
  const text = await aiClient.generateText(db, log, 'text', prompt, systemPrompt, { model: model || undefined, temperature: 0.7 });
  let list = [];
  try {
    const parsed = safeParseAIJSON(text, []);
    if (Array.isArray(parsed)) list = parsed;
    else if (parsed && Array.isArray(parsed.backgrounds)) list = parsed.backgrounds;
    else if (parsed && parsed.backgrounds) list = parsed.backgrounds;
  } catch (_) {
    try {
      const obj = safeParseAIJSON(text, {});
      list = obj.backgrounds || (Array.isArray(obj) ? obj : []);
    } catch (_2) {
      list = [];
    }
  }
  return list.map((b) => ({
    location: b.location || '',
    time: b.time || '',
    prompt: b.prompt || '',
    atmosphere: b.atmosphere,
  }));
}

async function processBackgroundExtraction(db, cfg, log, taskID, episodeId, model, style) {
  taskService.updateTaskStatus(db, taskID, 'processing', 0, '正在提取场景信息...');
  const episode = db.prepare('SELECT id, drama_id, script_content FROM episodes WHERE id = ? AND deleted_at IS NULL').get(Number(episodeId));
  if (!episode) {
    taskService.updateTaskStatus(db, taskID, 'failed', 0, '剧集信息不存在');
    return;
  }
  const scriptContent = episode.script_content;
  if (!scriptContent || !String(scriptContent).trim()) {
    taskService.updateTaskStatus(db, taskID, 'failed', 0, '剧本内容为空');
    return;
  }
  let backgroundsInfo;
  try {
    backgroundsInfo = await extractBackgroundsFromScript(db, cfg, log, String(scriptContent), episode.drama_id, model, style);
  } catch (err) {
    log.error('Background extraction AI failed', { error: err.message, task_id: taskID });
    taskService.updateTaskStatus(db, taskID, 'failed', 0, 'AI提取场景失败: ' + err.message);
    return;
  }
  sceneService.deleteScenesByEpisodeId(db, log, episodeId);
  const scenes = [];
  for (const bg of backgroundsInfo) {
    const scene = sceneService.createSceneForEpisode(db, log, episode.drama_id, episodeId, {
      location: bg.location,
      time: bg.time,
      prompt: bg.prompt,
    });
    if (scene) scenes.push(scene);
  }
  taskService.updateTaskResult(db, taskID, {
    scenes,
    count: scenes.length,
    episode_id: episodeId,
    drama_id: episode.drama_id,
  });
  log.info('Background extraction completed', { task_id: taskID, episode_id: episodeId, count: scenes.length });
}

function extractBackgroundsForEpisode(db, cfg, log, episodeId, model, style) {
  const episode = db.prepare('SELECT id, script_content FROM episodes WHERE id = ? AND deleted_at IS NULL').get(Number(episodeId));
  if (!episode) throw new Error('episode not found');
  if (!episode.script_content || !String(episode.script_content).trim()) {
    throw new Error('episode has no script content');
  }
  const task = taskService.createTask(db, log, 'background_extraction', String(episodeId));
  setImmediate(() => {
    processBackgroundExtraction(db, cfg, log, task.id, episodeId, model, style).catch((err) => {
      log.error('processBackgroundExtraction fatal', { error: err.message, task_id: task.id });
    });
  });
  return task.id;
}

module.exports = {
  extractBackgroundsForEpisode,
};
