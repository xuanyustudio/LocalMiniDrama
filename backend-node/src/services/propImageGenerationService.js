// 与 Go PropService.GeneratePropImage + processPropImageGeneration 对齐：道具图片生成
const path = require('path');
const taskService = require('./taskService');
const imageClient = require('./imageClient');
const propService = require('./propService');
const uploadService = require('./uploadService');

function appendPrompt(base, extra) {
  const add = (extra || '').toString().trim();
  if (!add) return (base || '').toString().trim();
  const current = (base || '').toString().trim();
  if (!current) return add;
  const lowerCurrent = current.toLowerCase();
  const lowerAdd = add.toLowerCase();
  if (lowerCurrent.includes(lowerAdd)) return current;
  return current + ', ' + add;
}

async function processPropImageGeneration(db, log, taskId, propId, opts) {
  taskService.updateTaskStatus(db, taskId, 'processing', 0, '正在生成图片...');

  const prop = propService.getById(db, propId);
  if (!prop) {
    taskService.updateTaskError(db, taskId, '道具不存在');
    return;
  }
  if (!prop.prompt || !String(prop.prompt).trim()) {
    taskService.updateTaskError(db, taskId, '道具没有图片提示词');
    return;
  }

  const loadConfig = require('../config').loadConfig;
  const cfg = loadConfig();
  const styleOverride = (opts && opts.style) ? String(opts.style).trim() : '';
  const baseStyle = styleOverride || (cfg?.style?.default_style || '');
  let style = '';
  style = appendPrompt(style, baseStyle);
  if (!styleOverride) {
    style = appendPrompt(style, cfg?.style?.default_prop_style || '');
  }
  const imageSize = cfg?.style?.default_image_size || '1024x1024';
  const fullPrompt = appendPrompt(String(prop.prompt).trim(), style);
  // 与角色/场景一致：使用前端「图片生成模型」选择的 model；未传时用 YAML default_image_provider 兜底
  const model = (opts && opts.model) ? String(opts.model).trim() || null : null;
  const preferredProvider = !model && cfg?.ai?.default_image_provider ? cfg.ai.default_image_provider : null;

  let result;
  try {
    result = await imageClient.callImageApi(db, log, {
      prompt: fullPrompt,
      size: imageSize,
      drama_id: prop.drama_id,
      model: model || undefined,
      preferred_provider: preferredProvider || undefined,
    });
  } catch (err) {
    const errMsg = '图片生成请求失败: ' + (err.message || '未知错误');
    log.error('Prop image API failed', { prop_id: propId, error: err.message });
    taskService.updateTaskError(db, taskId, errMsg);
    try {
      db.prepare('UPDATE props SET error_msg = ?, updated_at = ? WHERE id = ?').run(errMsg, new Date().toISOString(), propId);
    } catch (_) {}
    return;
  }

  if (result.error) {
    taskService.updateTaskError(db, taskId, result.error);
    try {
      db.prepare('UPDATE props SET error_msg = ?, updated_at = ? WHERE id = ?').run(result.error, new Date().toISOString(), propId);
    } catch (_) {}
    return;
  }
  if (!result.image_url) {
    const errMsg = '未返回图片地址';
    taskService.updateTaskError(db, taskId, errMsg);
    try {
      db.prepare('UPDATE props SET error_msg = ?, updated_at = ? WHERE id = ?').run(errMsg, new Date().toISOString(), propId);
    } catch (_) {}
    return;
  }

  taskService.updateTaskStatus(db, taskId, 'processing', 80, '正在保存图片...');

  let localPath = null;
  try {
    const storagePath = path.isAbsolute(cfg.storage?.local_path)
      ? cfg.storage.local_path
      : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
    localPath = await uploadService.downloadImageToLocal(
      storagePath,
      result.image_url,
      'images',
      log,
      'prop_' + propId
    );
  } catch (_) {}

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE props SET image_url = ?, local_path = ?, updated_at = ? WHERE id = ?'
  ).run(result.image_url, localPath, now, propId);

  taskService.updateTaskResult(db, taskId, {
    image_url: result.image_url,
    local_path: localPath,
    prop_id: propId,
  });
  log.info('Prop image generation completed', { prop_id: propId, image_url: result.image_url, local_path: localPath });
}

function generatePropImage(db, log, propId, opts) {
  const prop = propService.getById(db, propId);
  if (!prop) throw new Error('道具不存在');
  if (!prop.prompt || !String(prop.prompt).trim()) {
    throw new Error('道具没有图片提示词');
  }

  const task = taskService.createTask(db, log, 'prop_image_generation', String(propId));
  setImmediate(() => {
    processPropImageGeneration(db, log, task.id, propId, opts || {}).catch((err) => {
      log.error('processPropImageGeneration fatal', { error: err.message, task_id: task.id });
    });
  });
  return task.id;
}

module.exports = {
  generatePropImage,
  processPropImageGeneration,
};
