// 与 Go PropService.GeneratePropImage + processPropImageGeneration 对齐：道具图片生成
const path = require('path');
const taskService = require('./taskService');
const imageClient = require('./imageClient');
const propService = require('./propService');
const uploadService = require('./uploadService');
const storageLayout = require('./storageLayout');
const { aspectRatioToSize } = require('./imageService');

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
  const { mergeCfgStyleWithDrama } = require('../utils/dramaStyleMerge');
  let cfg = loadConfig();
  if (prop.drama_id) {
    try {
      const dr = db.prepare('SELECT style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(prop.drama_id);
      cfg = mergeCfgStyleWithDrama(cfg, dr || {});
    } catch (_) {}
  }
  const styleOverride = (opts && opts.style) ? String(opts.style).trim() : '';
  const baseStyle = styleOverride || (cfg?.style?.default_style_en || cfg?.style?.default_style || '');
  let style = '';
  style = appendPrompt(style, baseStyle);
  if (!styleOverride) {
    style = appendPrompt(style, cfg?.style?.default_prop_style || '');
  }
  // 优先用项目 aspect_ratio 推导尺寸；兜底 1920x1920（满足 ≥3,686,400 像素要求）
  let imageSize = null;
  if (prop.drama_id) {
    try {
      const dramaRow = db.prepare('SELECT metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(prop.drama_id);
      if (dramaRow && dramaRow.metadata) {
        const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
        if (meta && meta.aspect_ratio) imageSize = aspectRatioToSize(meta.aspect_ratio);
      }
    } catch (_) {}
  }
  if (!imageSize) imageSize = cfg?.style?.default_image_size || '1920x1920';
  const fullPrompt = appendPrompt(String(prop.prompt).trim(), style);
  // 与角色/场景一致：使用前端「图片生成模型」选择的 model；未传时用 YAML default_image_provider 兜底
  const model = (opts && opts.model) ? String(opts.model).trim() || null : null;
  const preferredProvider = !model && cfg?.ai?.default_image_provider ? cfg.ai.default_image_provider : null;
  const userNeg = imageClient.resolveAssetUserNegativeForApi(model, prop.negative_prompt);

  let result;
  try {
    result = await imageClient.callImageApi(db, log, {
      prompt: fullPrompt,
      size: imageSize,
      drama_id: prop.drama_id,
      model: model || undefined,
      preferred_provider: preferredProvider || undefined,
      user_negative_prompt: userNeg || undefined,
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
    const projectSubdir = storageLayout.getProjectStorageSubdir(db, prop.drama_id);
    localPath = await uploadService.downloadImageToLocal(
      storagePath,
      result.image_url,
      'props',
      log,
      'prop_' + propId,
      projectSubdir
    );
  } catch (_) {}

  const now = new Date().toISOString();
  // 旧图追加到 extra_images，与上传逻辑保持一致
  const oldProp = db.prepare('SELECT local_path, image_url, extra_images FROM props WHERE id = ?').get(propId);
  const oldPath = oldProp?.local_path || oldProp?.image_url || '';
  let extras = [];
  try { extras = oldProp?.extra_images ? JSON.parse(oldProp.extra_images) : []; } catch (_) {}
  if (!Array.isArray(extras)) extras = [];
  if (oldPath && !extras.includes(oldPath)) extras.push(oldPath);
  const extraJson = extras.length ? JSON.stringify(extras) : null;
  try {
    db.prepare(
      'UPDATE props SET image_url = ?, local_path = ?, extra_images = ?, updated_at = ? WHERE id = ?'
    ).run(result.image_url, localPath, extraJson, now, propId);
  } catch (e) {
    if ((e.message || '').includes('extra_images')) {
      db.prepare('UPDATE props SET image_url = ?, local_path = ?, updated_at = ? WHERE id = ?').run(result.image_url, localPath, now, propId);
    } else {
      throw e;
    }
  }

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
