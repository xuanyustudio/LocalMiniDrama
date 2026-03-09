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

/**
 * 四宫格模式：用 AI 生成 4 个帧提示词，拼成四宫格格式的单张图片提示词
 * 让 AI 图片生成模型直接输出一张 2×2 四格序列图
 */
async function buildQuadGridPrompt(db, log, cfg, storyboardId, model) {
  // 在函数内部 require，避免循环依赖
  const framePromptService = require('./framePromptService');
  const sb = framePromptService.loadStoryboard(db, storyboardId);
  if (!sb) return null;
  const scene = framePromptService.loadScene(db, sb.scene_id);
  const characterNames = framePromptService.loadStoryboardCharacterNames(db, storyboardId);

  log.info('[四宫格] 开始生成4帧提示词', { storyboard_id: storyboardId });
  const [first, key1, key2, last] = await Promise.all([
    framePromptService.generateSingleFrameExported(db, log, cfg, sb, scene, characterNames, model || undefined, 'first'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sb, scene, characterNames, model || undefined, 'key'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sb, scene, characterNames, model || undefined, 'key'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sb, scene, characterNames, model || undefined, 'last'),
  ]);
  log.info('[四宫格] 4帧提示词生成完成', { storyboard_id: storyboardId });

  const style = cfg?.style?.default_style || '';
  const styleNote = style ? `, consistent art style: ${style}` : '';
  return `Generate a 2x2 four-panel storyboard grid image (comic strip layout, clear visible borders separating panels${styleNote}). Show action sequence in order:
Panel 1 (top-left, first frame - initial state): ${first.prompt}
Panel 2 (top-right, key moment - action peak): ${key1.prompt}
Panel 3 (bottom-left, key moment - continuation): ${key2.prompt}
Panel 4 (bottom-right, last frame - final state): ${last.prompt}
Requirements: consistent character appearance across all panels, same scene/background adapted to each moment, clear panel dividers, sequential storytelling.`;
}

/**
 * 将 aspect_ratio（如 "9:16"）转换为图片生成 size 字符串（如 "720*1280"）
 * DashScope/Wan 用 W*H 格式，OpenAI 用 WxH 格式；统一返回 W*H，callDashScopeImageApi 内部会调 dashScopeSize 做最终校验
 */
function aspectRatioToSize(aspectRatio) {
  // 统一用 WxH（小写 x）格式：DashScope 的 dashScopeSize() 会把 x 转成 * 并自动缩放
  // 各尺寸均 >= 3,686,400 像素，满足 ChatFire/OpenAI 兼容接口的最低像素要求
  const map = {
    '16:9':  '2560x1440',
    '9:16':  '1440x2560',
    '1:1':   '1920x1920',
    '4:3':   '2240x1680',
    '3:4':   '1680x2240',
    '21:9':  '2940x1260',
  };
  return map[aspectRatio] || null;
}

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
  const t0 = Date.now();
  const elapsed = () => `${Date.now() - t0}ms`;

  const row = db.prepare('SELECT * FROM image_generations WHERE id = ? AND deleted_at IS NULL').get(Number(imageGenId));
  if (!row) {
    log.error('[图生] 记录不存在', { id: imageGenId });
    return;
  }
  if (row.status !== 'pending') {
    log.info('[图生] 已被处理，跳过', { id: imageGenId, status: row.status });
    return;
  }

  log.info('[图生] ▶ 开始', {
    id: imageGenId,
    storyboard_id: row.storyboard_id,
    scene_id: row.scene_id,
    drama_id: row.drama_id,
    model: row.model,
    prompt_preview: (row.prompt || '').slice(0, 80),
  });

  const now = new Date().toISOString();
  try {
    db.prepare('UPDATE image_generations SET status = ?, updated_at = ? WHERE id = ?').run('processing', now, imageGenId);
    const imageServiceType = row.storyboard_id ? 'storyboard_image' : 'image';

    // ── 四宫格模式：先生成4帧提示词，再拼装组合提示词 ──────────────────
    if (row.frame_type === 'quad_grid' && row.storyboard_id) {
      try {
        const loadConfig = require('../config').loadConfig;
        const cfg = loadConfig();
        const quadPrompt = await buildQuadGridPrompt(db, log, cfg, row.storyboard_id, row.model);
        if (quadPrompt) {
          db.prepare('UPDATE image_generations SET prompt = ?, updated_at = ? WHERE id = ?')
            .run(quadPrompt, new Date().toISOString(), imageGenId);
          row.prompt = quadPrompt;
          log.info('[图生] 四宫格提示词已生成', { id: imageGenId, prompt_len: quadPrompt.length });
        }
      } catch (quadErr) {
        log.warn('[图生] 四宫格提示词生成失败，使用原始提示词', { id: imageGenId, error: quadErr.message });
      }
    }

    // ── Step 1: 获取 AI 配置 ──────────────────────────────────────────
    const config = imageClient.getDefaultImageConfig(db, row.model, null, imageServiceType);
    if (!config) {
      log.error('[图生] ✗ 未找到图片 AI 配置', { id: imageGenId, imageServiceType, elapsed: elapsed() });
      db.prepare('UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?').run(
        'failed', '未配置图片模型', new Date().toISOString(), imageGenId
      );
      if (row.task_id) taskService.updateTaskError(db, row.task_id, '未配置图片模型');
      return;
    }
    log.info('[图生] Step1 AI配置', {
      id: imageGenId,
      provider: config.provider,
      model: config.model,
      api_protocol: config.api_protocol || '(auto)',
      elapsed: elapsed(),
    });

    // ── Step 2: 解析参考图 ───────────────────────────────────────────
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
          const scene = db.prepare('SELECT image_url, local_path, extra_images FROM scenes WHERE id = ? AND deleted_at IS NULL').get(sb.scene_id);
          if (scene && (scene.local_path || scene.image_url)) {
            refs.push(scene.local_path || scene.image_url);
            if (scene.extra_images) {
              try {
                const extras = JSON.parse(scene.extra_images);
                if (Array.isArray(extras) && extras[0]) refs.push(extras[0]);
              } catch (_) {}
            }
          }
        }
        if (sb.characters) {
          try {
            const charList = JSON.parse(sb.characters);
            if (Array.isArray(charList)) {
              for (const item of charList.slice(0, 4)) {
                const cid = typeof item === 'object' && item != null ? item.id : item;
                const c = db.prepare('SELECT image_url, local_path, extra_images FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(cid));
                if (!c) continue;
                // 优先使用 local_path，否则 image_url
                const primaryRef = c.local_path || c.image_url;
                if (primaryRef) refs.push(primaryRef);
                // 将 extra_images 中第一张也作为参考（多角度参考），但控制总量
                if (c.extra_images && refs.length < 6) {
                  try {
                    const extras = JSON.parse(c.extra_images);
                    if (Array.isArray(extras) && extras[0]) refs.push(extras[0]);
                  } catch (_) {}
                }
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
    log.info('[图生] Step2 参考图', {
      id: imageGenId,
      source: reference_source || '无',
      count: reference_image_urls ? reference_image_urls.length : 0,
      paths: (reference_image_urls || []).map(s => String(s).slice(0, 80)),
      elapsed: elapsed(),
    });

    // ── Step 3: 计算尺寸 ────────────────────────────────────────────
    const loadConfig = require('../config').loadConfig;
    const cfg = loadConfig();
    const filesBaseUrl = (cfg.storage && cfg.storage.base_url) ? String(cfg.storage.base_url).replace(/\/$/, '') : '';
    const storageLocalPath = path.isAbsolute(cfg.storage?.local_path)
      ? cfg.storage.local_path
      : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');

    let imageSize = row.size || null;
    if (!imageSize && row.drama_id) {
      try {
        const dramaRow = db.prepare('SELECT metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(row.drama_id);
        if (dramaRow && dramaRow.metadata) {
          const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
          if (meta && meta.aspect_ratio) imageSize = aspectRatioToSize(meta.aspect_ratio);
        }
      } catch (_) {}
    }
    if (!imageSize) {
      const cfgRatio = cfg?.style?.default_image_ratio;
      if (cfgRatio) imageSize = aspectRatioToSize(cfgRatio);
    }
    log.info('[图生] Step3 尺寸', { id: imageGenId, size: imageSize, elapsed: elapsed() });

    // ── Step 4: 调用图生 API ─────────────────────────────────────────
    log.info('[图生] Step4 调用图生 API →', { id: imageGenId, elapsed: elapsed() });
    const tApi = Date.now();
    const result = await imageClient.callImageApi(db, log, {
      prompt: row.prompt,
      model: row.model,
      size: imageSize,
      quality: row.quality,
      drama_id: row.drama_id,
      character_id: row.character_id,
      image_gen_id: imageGenId,
      imageServiceType,
      reference_image_urls: reference_image_urls || undefined,
      files_base_url: filesBaseUrl,
      storage_local_path: storageLocalPath,
    });
    log.info('[图生] Step4 图生 API 返回', { id: imageGenId, api_ms: Date.now() - tApi, has_error: !!result.error, elapsed: elapsed() });

    const now2 = new Date().toISOString();
    if (result.error) {
      db.prepare('UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?').run(
        'failed', (result.error || '').slice(0, 500), now2, imageGenId
      );
      if (row.task_id) taskService.updateTaskError(db, row.task_id, result.error);
      log.error('[图生] ✗ API返回错误', { id: imageGenId, error: result.error, total_elapsed: elapsed() });
      if (row.scene_id != null) {
        try { db.prepare('UPDATE scenes SET error_msg = ?, updated_at = ? WHERE id = ?').run(result.error, now2, row.scene_id); } catch (_) {}
      }
      if (row.storyboard_id != null) {
        try { db.prepare('UPDATE storyboards SET error_msg = ?, updated_at = ? WHERE id = ?').run(result.error, now2, row.storyboard_id); } catch (_) {}
      }
      return;
    }

    // ── Step 5: 保存图片到本地 ───────────────────────────────────────
    log.info('[图生] Step5 保存到本地 →', { id: imageGenId, elapsed: elapsed() });
    const tSave = Date.now();
    let localPath = null;
    try {
      const storagePath = path.isAbsolute(cfg.storage?.local_path)
        ? cfg.storage.local_path
        : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
      const category = row.scene_id != null ? 'scenes' : 'images';
      localPath = await uploadService.downloadImageToLocal(storagePath, result.image_url, category, log, 'ig');
      log.info('[图生] Step5 保存完成', { id: imageGenId, local_path: localPath, save_ms: Date.now() - tSave, elapsed: elapsed() });
    } catch (saveErr) {
      log.warn('[图生] Step5 保存失败（不影响结果）', { id: imageGenId, err: saveErr.message, elapsed: elapsed() });
    }

    // ── Step 6: 写库 & 任务完成 ──────────────────────────────────────
    db.prepare(
      'UPDATE image_generations SET status = ?, image_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
    ).run('completed', result.image_url, localPath, now2, now2, imageGenId);
    if (row.task_id) {
      taskService.updateTaskResult(db, row.task_id, { image_generation_id: imageGenId, image_url: result.image_url, status: 'completed' });
    }
    if (row.scene_id != null && row.storyboard_id == null) {
      db.prepare("UPDATE scenes SET image_url = ?, local_path = ?, status = 'generated', updated_at = ? WHERE id = ?").run(
        result.image_url, localPath, now2, row.scene_id
      );
    }
    log.info('[图生] ✓ 完成', { id: imageGenId, local_path: localPath, total_elapsed: elapsed() });

  } catch (err) {
    const now2 = new Date().toISOString();
    db.prepare('UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?').run(
      'failed', (err.message || '').slice(0, 500), now2, imageGenId
    );
    if (row.task_id) taskService.updateTaskError(db, row.task_id, err.message);
    log.error('[图生] ✗ 异常', { id: imageGenId, error: err.message, stack: (err.stack || '').slice(0, 400), total_elapsed: elapsed() });
    if (row.scene_id != null) {
      try { db.prepare('UPDATE scenes SET error_msg = ?, updated_at = ? WHERE id = ?').run(err.message, now2, row.scene_id); } catch (_) {}
    }
    if (row.storyboard_id != null) {
      try { db.prepare('UPDATE storyboards SET error_msg = ?, updated_at = ? WHERE id = ?').run(err.message, now2, row.storyboard_id); } catch (_) {}
    }
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
  aspectRatioToSize,
};
