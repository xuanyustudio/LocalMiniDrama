function list(db, query) {
  let sql = 'FROM image_generations WHERE deleted_at IS NULL';
  const params = [];
  if (query.drama_id) {
    sql += ' AND drama_id = ?';
    params.push(query.drama_id);
  }
  if (query.storyboard_id) {
    sql += ' AND storyboard_id = ?';
    params.push(query.storyboard_id);
  }
  if (query.frame_type) {
    sql += ' AND frame_type = ?';
    params.push(query.frame_type);
  }
  if (query.status) {
    sql += ' AND status = ?';
    params.push(query.status);
  }
  const countRow = db.prepare('SELECT COUNT(*) as total ' + sql).get(...params);
  const total = countRow.total || 0;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.page_size, 10) || 20));
  const offset = (page - 1) * pageSize;
  const rows = db.prepare('SELECT * ' + sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, pageSize, offset);
  return { items: rows.map(rowToItem), total, page, pageSize };
}

function rowToItem(r) {
  return {
    id: r.id,
    storyboard_id: r.storyboard_id,
    drama_id: r.drama_id,
    scene_id: r.scene_id ?? undefined,
    character_id: r.character_id,
    provider: r.provider,
    prompt: r.prompt,
    model: r.model,
    image_url: r.image_url,
    local_path: r.local_path,
    status: r.status,
    task_id: r.task_id,
    error_msg: r.error_msg,
    frame_type: r.frame_type ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
    completed_at: r.completed_at,
  };
}

function getById(db, id) {
  const r = db.prepare('SELECT * FROM image_generations WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return r ? rowToItem(r) : null;
}

const path = require('path');
const imageClient = require('./imageClient');
const taskService = require('./taskService');
const uploadService = require('./uploadService');

function mergePromptWithStyle(prompt, style) {
  const base = (prompt || '').toString().trim();
  const styleText = (style || '').toString().trim();
  if (!styleText) return base;
  if (!base) return styleText;
  const lowerBase = base.toLowerCase();
  const lowerStyle = styleText.toLowerCase();
  if (lowerBase.includes(lowerStyle)) return base;
  return base + ', ' + styleText;
}

function create(db, log, req) {
  const now = new Date().toISOString();
  const task = taskService.createTask(db, log, 'image_generation', String(req.drama_id || ''));
  const taskId = task.id;
  const frameType = req.frame_type ?? null;
  const sceneId = req.scene_id != null ? Number(req.scene_id) : null;
  const refImagesJson =
    req.reference_images && Array.isArray(req.reference_images)
      ? JSON.stringify(req.reference_images.slice(0, 10))
      : null;
  if (req.reference_images && Array.isArray(req.reference_images)) {
    log.info('reference_images 完整路径（请求入参）', {
      image_gen_create: true,
      count: req.reference_images.length,
      reference_images: req.reference_images,
    });
  }
  const mergedPrompt = mergePromptWithStyle(req.prompt || '', req.style);
  const info = db.prepare(
    `INSERT INTO image_generations (storyboard_id, drama_id, scene_id, provider, prompt, negative_prompt, model, frame_type, reference_images, status, task_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).run(
    req.storyboard_id ?? null,
    Number(req.drama_id) || 0,
    sceneId,
    req.provider || 'openai',
    mergedPrompt,
    req.negative_prompt ?? null,
    req.model ?? null,
    frameType,
    refImagesJson,
    taskId,
    now,
    now
  );
  const imageGenId = info.lastInsertRowid;
  if (!imageGenId) throw new Error('insert failed');
  setImmediate(() => {
    processImageGeneration(db, log, imageGenId);
  });
  return { id: imageGenId, task_id: taskId, status: 'pending', ...getById(db, imageGenId) };
}

/**
 * 异步处理图片生成：与 Go ProcessImageGeneration 对齐，调用图生 API 并更新记录与任务
 */
async function processImageGeneration(db, log, imageGenId) {
  const row = db.prepare('SELECT * FROM image_generations WHERE id = ? AND deleted_at IS NULL').get(Number(imageGenId));
  if (!row) {
    log.error('Image generation not found', { id: imageGenId });
    return;
  }
  if (row.status !== 'pending') {
    log.info('Image generation already processed', { id: imageGenId, status: row.status });
    return;
  }
  const now = new Date().toISOString();
  try {
    db.prepare('UPDATE image_generations SET status = ?, updated_at = ? WHERE id = ?').run('processing', now, imageGenId);
    const imageServiceType = row.storyboard_id ? 'storyboard_image' : 'image';
    const config = imageClient.getDefaultImageConfig(db, row.model, null, imageServiceType);
    if (!config) {
      db.prepare('UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?').run(
        'failed',
        '未配置图片模型',
        new Date().toISOString(),
        imageGenId
      );
      if (row.task_id) taskService.updateTaskError(db, row.task_id, '未配置图片模型');
      return;
    }
    let reference_image_urls = null;
    let reference_source = null;
    if (row.reference_images) {
      try {
        const parsed = JSON.parse(row.reference_images);
        if (Array.isArray(parsed) && parsed.length > 0) {
          reference_image_urls = parsed;
          reference_source = 'DB';
        }
      } catch (_) {}
    }
    if (!reference_image_urls && row.storyboard_id) {
      const sb = db.prepare('SELECT scene_id, characters FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(row.storyboard_id);
      if (sb) {
        const refs = [];
        if (sb.scene_id) {
          const scene = db.prepare('SELECT image_url, local_path FROM scenes WHERE id = ? AND deleted_at IS NULL').get(sb.scene_id);
          if (scene && (scene.image_url || scene.local_path)) refs.push(scene.image_url || scene.local_path);
        }
        if (sb.characters) {
          try {
            const charList = JSON.parse(sb.characters);
            if (Array.isArray(charList)) {
              for (const item of charList.slice(0, 5)) {
                const cid = typeof item === 'object' && item != null ? item.id : item;
                const c = db.prepare('SELECT image_url, local_path FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(cid));
                if (c && (c.image_url || c.local_path)) refs.push(c.image_url || c.local_path);
              }
            }
          } catch (_) {}
        }
        if (refs.length > 0) {
          reference_image_urls = refs;
          reference_source = 'storyboard 自动解析';
        }
      }
    }
    log.info('reference_image_urls 完整路径（发给图生 API）', {
      image_gen_id: imageGenId,
      source: reference_source || (reference_image_urls ? 'DB' : '无'),
      count: reference_image_urls ? reference_image_urls.length : 0,
      reference_image_urls: reference_image_urls || [],
    });
    const loadConfig = require('../config').loadConfig;
    const cfg = loadConfig();
    const filesBaseUrl = (cfg.storage && cfg.storage.base_url) ? String(cfg.storage.base_url).replace(/\/$/, '') : '';
    const storageLocalPath = path.isAbsolute(cfg.storage?.local_path)
      ? cfg.storage.local_path
      : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
    const result = await imageClient.callImageApi(db, log, {
      prompt: row.prompt,
      model: row.model,
      size: row.size,
      quality: row.quality,
      drama_id: row.drama_id,
      character_id: row.character_id,
      image_gen_id: imageGenId,
      reference_image_urls: reference_image_urls || undefined,
      files_base_url: filesBaseUrl,
      storage_local_path: storageLocalPath,
    });
    const now2 = new Date().toISOString();
    if (result.error) {
      db.prepare('UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?').run(
        'failed',
        (result.error || '').slice(0, 500),
        now2,
        imageGenId
      );
      if (row.task_id) taskService.updateTaskError(db, row.task_id, result.error);
      log.error('Image generation failed', { id: imageGenId, error: result.error });
      return;
    }
    let localPath = null;
    try {
      const loadConfig = require('../config').loadConfig;
      const cfg = loadConfig();
      const storagePath = path.isAbsolute(cfg.storage?.local_path)
        ? cfg.storage.local_path
        : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
      const category = row.scene_id != null ? 'scenes' : 'images';
      localPath = await uploadService.downloadImageToLocal(storagePath, result.image_url, category, log, 'ig');
    } catch (_) {}
    db.prepare(
      'UPDATE image_generations SET status = ?, image_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
    ).run('completed', result.image_url, localPath, now2, now2, imageGenId);
    if (row.task_id) {
      taskService.updateTaskResult(db, row.task_id, { image_generation_id: imageGenId, image_url: result.image_url, status: 'completed' });
    }
    // 仅当本条是「场景图」时回写 scenes 表；分镜图（storyboard_id 非空）不覆盖场景封面，避免刷新后第一个场景图被分镜图替换
    if (row.scene_id != null && row.storyboard_id == null) {
      db.prepare("UPDATE scenes SET image_url = ?, local_path = ?, status = 'generated', updated_at = ? WHERE id = ?").run(
        result.image_url,
        localPath,
        now2,
        row.scene_id
      );
      log.info('Scene updated with generated image', { scene_id: row.scene_id, image_gen_id: imageGenId, local_path: localPath });
    }
    log.info('Image generation completed', { id: imageGenId, image_url: result.image_url, local_path: localPath });
  } catch (err) {
    const now2 = new Date().toISOString();
    db.prepare('UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?').run(
      'failed',
      (err.message || '').slice(0, 500),
      now2,
      imageGenId
    );
    if (row.task_id) taskService.updateTaskError(db, row.task_id, err.message);
    log.error('Image generation error', { id: imageGenId, error: err.message });
  }
}

function deleteById(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE image_generations SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  return result.changes > 0;
}

function getBackgroundsForEpisode(db, episodeId) {
  const rows = db.prepare(
    `SELECT s.id as scene_id, s.location, s.time, s.prompt, s.image_url, s.local_path, s.status
     FROM storyboards sb
     JOIN scenes s ON s.id = sb.scene_id AND s.deleted_at IS NULL
     WHERE sb.episode_id = ? AND sb.deleted_at IS NULL
     ORDER BY sb.storyboard_number`
  ).all(episodeId);
  return rows;
}

function upload(db, log, req) {
  const now = new Date().toISOString();
  const frameType = req.frame_type ?? null;
  const info = db.prepare(
    `INSERT INTO image_generations (storyboard_id, drama_id, provider, prompt, image_url, local_path, frame_type, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`
  ).run(
    req.storyboard_id ?? null,
    Number(req.drama_id) || 0,
    'upload',
    req.prompt || '',
    req.image_url || '',
    req.local_path ?? null,
    frameType,
    now,
    now
  );
  const row = db.prepare('SELECT * FROM image_generations WHERE id = ?').get(info.lastInsertRowid);
  return row ? rowToItem(row) : null;
}

module.exports = {
  list,
  getById,
  create,
  deleteById,
  getBackgroundsForEpisode,
  upload,
  processImageGeneration,
};
