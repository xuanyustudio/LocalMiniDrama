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
const fs = require('fs');
const imageClient = require('./imageClient');
const taskService = require('./taskService');
const uploadService = require('./uploadService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');

/**
 * 将四宫格整图拆成 4 张子图，保存到本地，并在 image_generations 表中分别建立记录。
 * @param {string} absLocalPath  图片的绝对路径（sharp 读取用）
 * @param {string} storagePath   存储根目录的绝对路径（用于计算写入 DB 的相对路径）
 * @param {string} imageUrl_     原图的远端 URL（用于推导子图 URL）
 * frame_type 分别为 quad_panel_0~3，对应左上/右上/左下/右下。
 */
async function splitQuadGridToImages(db, log, originalRow, absLocalPath, storagePath, imageUrl_) {
  if (!absLocalPath) {
    log.warn('[四宫格拆分] 缺少本地文件路径，跳过拆分', { id: originalRow.id });
    return;
  }
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    log.warn('[四宫格拆分] sharp 未安装，跳过拆分', { error: e.message });
    return;
  }
  try {
    const meta = await sharp(absLocalPath).metadata();
    const w = meta.width;
    const h = meta.height;
    const hw = Math.floor(w / 2);
    const hh = Math.floor(h / 2);
    // 4 象限：左上(0)、右上(1)、左下(2)、右下(3)
    const quadrants = [
      { left: 0,  top: 0,  width: hw,     height: hh,     idx: 0 },
      { left: hw, top: 0,  width: w - hw, height: hh,     idx: 1 },
      { left: 0,  top: hh, width: hw,     height: h - hh, idx: 2 },
      { left: hw, top: hh, width: w - hw, height: h - hh, idx: 3 },
    ];
    const labels = ['左上', '右上', '左下', '右下'];
    const absDir = path.dirname(absLocalPath);
    const ext = path.extname(absLocalPath) || '.jpg';
    const base = path.basename(absLocalPath, ext);
    const now = new Date().toISOString();
    for (const q of quadrants) {
      try {
        const panelFilename = `${base}_panel${q.idx}${ext}`;
        // 绝对路径（文件写入）
        const absPanelPath = path.join(absDir, panelFilename);
        // 相对路径（存 DB，与原图同格式：images/ig_xxx_panel0.jpg）
        const relPanelPath = path.relative(storagePath, absPanelPath).replace(/\\/g, '/');
        // 用 sharp 裁剪并添加文字标签 SVG 角标
        const labelSvg = `<svg width="${q.width}" height="${q.height}">
  <rect x="4" y="4" width="42" height="24" rx="4" fill="rgba(0,0,0,0.55)"/>
  <text x="25" y="21" font-size="14" fill="white" font-family="sans-serif" text-anchor="middle">${labels[q.idx]}</text>
</svg>`;
        await sharp(absLocalPath)
          .extract({ left: q.left, top: q.top, width: q.width, height: q.height })
          .composite([{ input: Buffer.from(labelSvg), top: 0, left: 0 }])
          .jpeg({ quality: 92 })
          .toFile(absPanelPath);
        // 推导远端 URL（与原图同目录，只替换文件名）
        const panelImageUrl = imageUrl_
          ? imageUrl_.replace(/[^/\\]+$/, panelFilename)
          : null;
        // 插入 image_generation 记录（status=completed，直接可用）
        db.prepare(
          `INSERT INTO image_generations (storyboard_id, drama_id, scene_id, character_id, provider, prompt, model, frame_type, image_url, local_path, status, created_at, updated_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`
        ).run(
          originalRow.storyboard_id ?? null,
          originalRow.drama_id ?? 0,
          originalRow.scene_id ?? null,
          originalRow.character_id ?? null,
          originalRow.provider || 'system',
          `[${labels[q.idx]}] ${originalRow.prompt || ''}`.slice(0, 1000),
          originalRow.model ?? null,
          `quad_panel_${q.idx}`,
          panelImageUrl,
          relPanelPath,
          now, now, now
        );
        log.info(`[四宫格拆分] 面板 ${q.idx}(${labels[q.idx]}) 已保存`, { rel_path: relPanelPath });
      } catch (panelErr) {
        log.warn(`[四宫格拆分] 面板 ${q.idx} 失败`, { error: panelErr.message });
      }
    }
    log.info('[四宫格拆分] 完成', { original_id: originalRow.id, storyboard_id: originalRow.storyboard_id });
  } catch (err) {
    log.warn('[四宫格拆分] 整体失败', { error: err.message });
  }
}

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

  // 四个面板使用差异明显的相机角度，方便用户挑选最佳构图
  const QUAD_PANEL_ANGLES = ['平视', '仰拍', '俯拍', '侧面'];
  const QUAD_PANEL_ANGLE_LABELS_EN = [
    'eye-level shot',
    'low-angle upward shot',
    'high-angle downward shot (bird\'s eye)',
    'side-angle profile shot',
  ];
  const [sbFirst, sbKey1, sbKey2, sbLast] = QUAD_PANEL_ANGLES.map((a) => ({ ...sb, angle: a }));

  log.info('[四宫格] 开始生成4帧提示词（四种相机角度）', {
    storyboard_id: storyboardId,
    angles: QUAD_PANEL_ANGLES,
  });
  const [first, key1, key2, last] = await Promise.all([
    framePromptService.generateSingleFrameExported(db, log, cfg, sbFirst, scene, characterNames, model || undefined, 'first'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sbKey1, scene, characterNames, model || undefined, 'key'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sbKey2, scene, characterNames, model || undefined, 'key'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sbLast, scene, characterNames, model || undefined, 'last'),
  ]);
  log.info('[四宫格] 4帧提示词生成完成', { storyboard_id: storyboardId });
  log.info('[四宫格] first.prompt:\n' + first.prompt);
  log.info('[四宫格] key1.prompt:\n' + key1.prompt);
  log.info('[四宫格] key2.prompt:\n' + key2.prompt);
  log.info('[四宫格] last.prompt:\n' + last.prompt);

  const style = cfg?.style?.default_style || '';
  const styleNote = style ? `. Art style: ${style}` : '';
  const quadPrompt = `Create a 2x2 grid storyboard image with EXACTLY 4 equal-sized panels arranged in 2 rows and 2 columns (like a coordinate quadrant layout). Each panel occupies exactly one quadrant of the image. NO borders of any color (black, white, gray), NO dividing lines, NO frames between panels — the 4 panels must be seamlessly adjacent with no gaps or separators${styleNote}.

Each panel uses a DIFFERENT camera angle to show the same scene from varied perspectives — this is intentional and required.

TOP ROW (left to right):
[Panel 1 - top-left quadrant, ${QUAD_PANEL_ANGLE_LABELS_EN[0]}, initial state]: ${first.prompt}
[Panel 2 - top-right quadrant, ${QUAD_PANEL_ANGLE_LABELS_EN[1]}, key action moment]: ${key1.prompt}

BOTTOM ROW (left to right):
[Panel 3 - bottom-left quadrant, ${QUAD_PANEL_ANGLE_LABELS_EN[2]}, action continuation]: ${key2.prompt}
[Panel 4 - bottom-right quadrant, ${QUAD_PANEL_ANGLE_LABELS_EN[3]}, final state]: ${last.prompt}

CRITICAL LAYOUT RULES: The image MUST be divided into 4 equal quadrants in a 2x2 grid. Do NOT arrange panels in a single strip. Do NOT add any black or dark borders/frames around the panels. Each panel is self-contained with consistent character appearance and art style. The camera angle MUST visually differ between panels as specified above.`;
  log.info('[四宫格] FINAL IMAGE PROMPT (发送给图片AI):\n' + quadPrompt);
  return quadPrompt;
}

/**
 * 九宫格模式：用 AI 生成 9 个帧提示词，拼成 3×3 格序列图提示词
 * 9 个面板各用一种不同相机角度，覆盖常见电影视角，供用户挑选最佳构图
 */
async function buildNineGridPrompt(db, log, cfg, storyboardId, model) {
  const framePromptService = require('./framePromptService');
  const sb = framePromptService.loadStoryboard(db, storyboardId);
  if (!sb) return null;
  const scene = framePromptService.loadScene(db, sb.scene_id);
  const characterNames = framePromptService.loadStoryboardCharacterNames(db, storyboardId);

  // 9 种差异明显的相机角度
  const NINE_PANEL_ANGLES = ['平视', '仰拍', '俯拍', '侧面左', '侧面右', '背面', '极端仰拍', '极端俯拍', '斜侧45度'];
  const NINE_PANEL_ANGLE_LABELS_EN = [
    'eye-level shot',
    'low-angle upward shot',
    'high-angle downward shot (bird\'s eye)',
    'left profile side shot',
    'right profile side shot',
    'rear shot from behind the character',
    'extreme low angle (worm\'s eye view)',
    'extreme high angle (aerial top-down view)',
    'diagonal 45-degree angle shot',
  ];
  // 时间线分布：首帧 × 1、关键帧 × 7、尾帧 × 1
  const frameKinds = ['first', 'key', 'key', 'key', 'key', 'key', 'key', 'key', 'last'];
  const sbVariants = NINE_PANEL_ANGLES.map((a) => ({ ...sb, angle: a }));

  log.info('[九宫格] 开始生成9帧提示词（九种相机角度）', { storyboard_id: storyboardId, angles: NINE_PANEL_ANGLES });
  const frames = await Promise.all(
    sbVariants.map((sbv, i) =>
      framePromptService.generateSingleFrameExported(db, log, cfg, sbv, scene, characterNames, model || undefined, frameKinds[i])
    )
  );
  log.info('[九宫格] 9帧提示词生成完成', { storyboard_id: storyboardId });
  frames.forEach((f, i) => log.info(`[九宫格] panel${i}.prompt:\n` + f.prompt));

  const style = cfg?.style?.default_style || '';
  const styleNote = style ? `. Art style: ${style}` : '';
  const ROWS = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];
  const rowNames = ['TOP ROW', 'MIDDLE ROW', 'BOTTOM ROW'];
  const colNames = ['left', 'center', 'right'];
  const panelDescs = frames.map((f, i) => `[Panel ${i + 1} - ${colNames[i % 3]}, ${NINE_PANEL_ANGLE_LABELS_EN[i]}]: ${f.prompt}`);

  const rowBlocks = ROWS.map((cols, r) =>
    `${rowNames[r]} (left to right):\n` + cols.map((c) => panelDescs[c]).join('\n')
  ).join('\n\n');

  const ninePrompt = `Create a 3x3 grid storyboard image with EXACTLY 9 equal-sized panels arranged in 3 rows and 3 columns. Each panel occupies exactly one cell of the 3×3 grid. NO borders of any color (black, white, gray), NO dividing lines, NO frames between panels — all 9 panels must be seamlessly adjacent with no gaps or separators${styleNote}.

Each panel uses a DIFFERENT camera angle to show the same scene from varied cinematic perspectives — this is intentional and required.

${rowBlocks}

CRITICAL LAYOUT RULES: The image MUST be divided into 9 equal cells in a 3×3 grid. Do NOT arrange panels in a single strip. Do NOT add any borders or frames. Each panel is self-contained with consistent character appearance and art style. The camera angle MUST visually differ between panels as specified above.`;
  log.info('[九宫格] FINAL IMAGE PROMPT (发送给图片AI):\n' + ninePrompt);
  return ninePrompt;
}

/**
 * 九宫格拆分：将一张 3×3 合成图拆成 9 张独立图，写入 image_generations
 * frame_type 分别为 nine_panel_0~8，对应 3×3 从左上到右下排列。
 */
async function splitNineGridToImages(db, log, originalRow, absLocalPath, storagePath, imageUrl_) {
  if (!absLocalPath) {
    log.warn('[九宫格拆分] 缺少本地文件路径，跳过拆分', { id: originalRow.id });
    return;
  }
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    log.warn('[九宫格拆分] sharp 未安装，跳过拆分', { error: e.message });
    return;
  }
  const labels = ['左上', '中上', '右上', '左中', '中间', '右中', '左下', '中下', '右下'];
  try {
    const meta = await sharp(absLocalPath).metadata();
    const w = meta.width;
    const h = meta.height;
    const cw = Math.floor(w / 3);
    const ch = Math.floor(h / 3);
    // 9 格：行×列，处理余数保证无缝覆盖
    const cells = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const left = col * cw;
        const top  = row * ch;
        const width  = col === 2 ? w - left : cw;
        const height = row === 2 ? h - top  : ch;
        cells.push({ left, top, width, height, idx: row * 3 + col });
      }
    }
    const absDir = path.dirname(absLocalPath);
    const ext = path.extname(absLocalPath) || '.jpg';
    const base = path.basename(absLocalPath, ext);
    const now = new Date().toISOString();
    for (const c of cells) {
      try {
        const panelFilename = `${base}_panel${c.idx}${ext}`;
        const absPanelPath = path.join(absDir, panelFilename);
        const relPanelPath = path.relative(storagePath, absPanelPath).replace(/\\/g, '/');
        const labelSvg = `<svg width="${c.width}" height="${c.height}">
  <rect x="4" y="4" width="42" height="24" rx="4" fill="rgba(0,0,0,0.55)"/>
  <text x="25" y="21" font-size="14" fill="white" font-family="sans-serif" text-anchor="middle">${labels[c.idx]}</text>
</svg>`;
        await sharp(absLocalPath)
          .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
          .composite([{ input: Buffer.from(labelSvg), top: 0, left: 0 }])
          .jpeg({ quality: 92 })
          .toFile(absPanelPath);
        const panelImageUrl = imageUrl_ ? imageUrl_.replace(/[^/\\]+$/, panelFilename) : null;
        db.prepare(
          `INSERT INTO image_generations (storyboard_id, drama_id, scene_id, provider, prompt, model, frame_type, image_url, local_path, status, created_at, updated_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`
        ).run(
          originalRow.storyboard_id ?? null,
          originalRow.drama_id ?? 0,
          originalRow.scene_id ?? null,
          originalRow.provider || 'system',
          `[${labels[c.idx]}] ${originalRow.prompt || ''}`.slice(0, 1000),
          originalRow.model ?? null,
          `nine_panel_${c.idx}`,
          panelImageUrl,
          relPanelPath,
          now, now, now
        );
        log.info(`[九宫格拆分] 面板 ${c.idx}(${labels[c.idx]}) 已保存`, { rel_path: relPanelPath });
      } catch (panelErr) {
        log.warn(`[九宫格拆分] 面板 ${c.idx} 失败`, { error: panelErr.message });
      }
    }
    log.info('[九宫格拆分] 完成', { original_id: originalRow.id, storyboard_id: originalRow.storyboard_id });
  } catch (err) {
    log.warn('[九宫格拆分] 整体失败', { error: err.message });
  }
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

        // 先检查同一分镜是否已有已完成的四宫格提示词缓存
        const cachedRow = db.prepare(
          `SELECT prompt FROM image_generations
            WHERE storyboard_id = ? AND frame_type = 'quad_grid'
              AND prompt IS NOT NULL AND prompt != ''
              AND status = 'completed'
              AND id != ?
            ORDER BY created_at DESC LIMIT 1`
        ).get(Number(row.storyboard_id), imageGenId);

        // 只复用包含多角度标记的新版缓存提示词，旧版单一角度缓存自动作废
        const QUAD_CACHE_MARKER = 'eye-level shot';
        let quadPrompt = null;
        if (cachedRow?.prompt && cachedRow.prompt.includes(QUAD_CACHE_MARKER)) {
          quadPrompt = cachedRow.prompt;
          log.info('[图生] 使用缓存的四宫格提示词（跳过 AI 生成）', { id: imageGenId, prompt_len: quadPrompt.length });
        } else {
          if (cachedRow?.prompt) {
            log.info('[图生] 旧版单一角度缓存已作废，重新生成多角度提示词', { id: imageGenId });
          }
          quadPrompt = await buildQuadGridPrompt(db, log, cfg, row.storyboard_id, row.model);
          if (quadPrompt) {
            log.info('[图生] 四宫格提示词已生成（新）', { id: imageGenId, prompt_len: quadPrompt.length });
          }
        }

        if (quadPrompt) {
          db.prepare('UPDATE image_generations SET prompt = ?, updated_at = ? WHERE id = ?')
            .run(quadPrompt, new Date().toISOString(), imageGenId);
          row.prompt = quadPrompt;
        }
      } catch (quadErr) {
        log.warn('[图生] 四宫格提示词生成失败，使用原始提示词', { id: imageGenId, error: quadErr.message });
      }
    }

    // ── 九宫格模式：先生成9帧提示词，再拼装组合提示词 ──────────────────
    if (row.frame_type === 'nine_grid' && row.storyboard_id) {
      try {
        const loadConfig = require('../config').loadConfig;
        const cfg = loadConfig();

        const NINE_CACHE_MARKER = 'worm\'s eye view';
        const cachedRow = db.prepare(
          `SELECT prompt FROM image_generations
            WHERE storyboard_id = ? AND frame_type = 'nine_grid'
              AND prompt IS NOT NULL AND prompt != ''
              AND status = 'completed'
              AND id != ?
            ORDER BY created_at DESC LIMIT 1`
        ).get(Number(row.storyboard_id), imageGenId);

        let ninePrompt = null;
        if (cachedRow?.prompt && cachedRow.prompt.includes(NINE_CACHE_MARKER)) {
          ninePrompt = cachedRow.prompt;
          log.info('[图生] 使用缓存的九宫格提示词（跳过 AI 生成）', { id: imageGenId, prompt_len: ninePrompt.length });
        } else {
          if (cachedRow?.prompt) {
            log.info('[图生] 旧版九宫格缓存已作废，重新生成多角度提示词', { id: imageGenId });
          }
          ninePrompt = await buildNineGridPrompt(db, log, cfg, row.storyboard_id, row.model);
          if (ninePrompt) {
            log.info('[图生] 九宫格提示词已生成（新）', { id: imageGenId, prompt_len: ninePrompt.length });
          }
        }

        if (ninePrompt) {
          db.prepare('UPDATE image_generations SET prompt = ?, updated_at = ? WHERE id = ?')
            .run(ninePrompt, new Date().toISOString(), imageGenId);
          row.prompt = ninePrompt;
        }
      } catch (nineErr) {
        log.warn('[图生] 九宫格提示词生成失败，使用原始提示词', { id: imageGenId, error: nineErr.message });
      }
    }

    // ── 单张分镜图：注入角度描述 + 单张输出约束 + 调试日志 ─────────────
    if (row.storyboard_id && row.frame_type !== 'quad_grid' && row.frame_type !== 'nine_grid') {
      try {
        const framePromptService = require('./framePromptService');
        const loadConfig = require('../config').loadConfig;
        const cfg = loadConfig();
        const sbRow = db.prepare('SELECT * FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(row.storyboard_id));
        const sbAngle = sbRow?.angle || null;
        const sbAngleH = sbRow?.angle_h || null;
        const sbAngleV = sbRow?.angle_v || null;
        const sbAngleS = sbRow?.angle_s || null;
        log.info('[图生] 单张分镜图 ── 调试信息', {
          id: imageGenId,
          storyboard_id: row.storyboard_id,
          angle_in_db: sbAngle,
          angle_struct: sbAngleH ? `${sbAngleH}/${sbAngleV}/${sbAngleS}` : '(旧格式)',
          prompt_preview: (row.prompt || '').slice(0, 200),
        });
        if (sbAngle || sbAngleH) {
          const isEn = (cfg?.language || 'zh') !== 'zh';
          // 优先使用结构化三元组（更精准），降级到旧文本
          const angleDesc = framePromptService.expandAngleDescription(sbAngle, isEn, sbAngleH, sbAngleV, sbAngleS);
          if (angleDesc) {
            const alreadyHas = row.prompt && row.prompt.toLowerCase().includes(angleDesc.toLowerCase().slice(0, 15));
            if (!alreadyHas) {
              row.prompt = (row.prompt || '') + ', ' + angleDesc;
              db.prepare('UPDATE image_generations SET prompt = ?, updated_at = ? WHERE id = ?')
                .run(row.prompt, new Date().toISOString(), imageGenId);
              log.info('[图生] 已注入角度描述到提示词', { id: imageGenId, angle: sbAngle, angle_struct: `${sbAngleH}/${sbAngleV}/${sbAngleS}`, angleDesc });
            }
          }
        }
        log.info('[图生] 单张分镜图 ── 角度注入后提示词:\n' + (row.prompt || ''));
      } catch (angleErr) {
        log.warn('[图生] 角度注入失败，使用原始提示词', { id: imageGenId, error: angleErr.message });
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
    // 参考图映射说明：告诉图片AI每张参考图对应哪个角色/场景，防止模型模仿宫格布局
    let reference_context_note = null;
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
        const refLabels = [];
        if (sb.scene_id) {
          const scene = db.prepare('SELECT image_url, local_path, location FROM scenes WHERE id = ? AND deleted_at IS NULL').get(sb.scene_id);
          if (scene) {
            const locationName = scene.location || 'scene';
            // 优先使用拆分后的单张面板（quad_panel_0=建立远景），比四视图合图更利于模型提取场景信息
            const scenePanel = db.prepare(
              `SELECT local_path, image_url FROM image_generations
               WHERE scene_id = ? AND frame_type = 'quad_panel_0' AND status = 'completed'
               ORDER BY id DESC LIMIT 1`
            ).get(sb.scene_id);
            const sceneRef = (scenePanel && (scenePanel.local_path || scenePanel.image_url))
              || scene.local_path || scene.image_url;
            if (sceneRef) {
              refs.push(sceneRef);
              const isPanel = !!(scenePanel && (scenePanel.local_path || scenePanel.image_url));
              refLabels.push(`Image ${refs.length}: scene background reference for "${locationName}"${isPanel ? ' (establishing wide shot)' : ' (four-view reference sheet)'}`);
            }
          }
        }
        if (sb.characters) {
          try {
            const charList = JSON.parse(sb.characters);
            if (Array.isArray(charList)) {
              for (const item of charList.slice(0, 3)) {
                const cid = typeof item === 'object' && item != null ? item.id : item;
                const c = db.prepare('SELECT image_url, local_path, name FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(cid));
                if (!c) continue;
                // 优先使用拆分后的正面全身图（quad_panel_1=右上=正面全身），比四视图合图更准确
                const charPanel = db.prepare(
                  `SELECT local_path, image_url FROM image_generations
                   WHERE character_id = ? AND frame_type = 'quad_panel_1' AND status = 'completed'
                   ORDER BY id DESC LIMIT 1`
                ).get(Number(cid));
                const charRef = (charPanel && (charPanel.local_path || charPanel.image_url))
                  || c.local_path || c.image_url;
                if (charRef) {
                  refs.push(charRef);
                  const isPanel = !!(charPanel && (charPanel.local_path || charPanel.image_url));
                  refLabels.push(`Image ${refs.length}: character appearance reference for "${c.name || 'character'}"${isPanel ? ' (front full-body view)' : ' (four-view reference sheet)'}`);
                }
              }
            }
          } catch (_) {}
        }
        // ── 补充：从 storyboard_characters 关联表查 character_libraries 的四视图 URL ──
        // 角色库中生成了四视图（four_view_image_url）的角色优先作为参考图
        try {
          const libLinks = db.prepare('SELECT character_id FROM storyboard_characters WHERE storyboard_id = ?').all(row.storyboard_id);
          const coveredNames = new Set();
          for (const link of libLinks.slice(0, 3)) {
            const lib = db.prepare(
              'SELECT id, name, four_view_image_url, image_url, local_path FROM character_libraries WHERE id = ? AND deleted_at IS NULL'
            ).get(link.character_id);
            if (!lib) continue;
            if (coveredNames.has(lib.name)) continue;
            // 优先使用四视图拆分面板（quad_panel_1=正面全身），次选 four_view_image_url，再选普通主图
            const libPanel = db.prepare(
              `SELECT local_path, image_url FROM image_generations
               WHERE character_id = ? AND frame_type = 'quad_panel_1' AND status = 'completed'
               ORDER BY id DESC LIMIT 1`
            ).get(lib.id);
            const libRef = (libPanel && (libPanel.local_path || libPanel.image_url))
              || lib.four_view_image_url || lib.local_path || lib.image_url;
            if (libRef && !refs.includes(libRef)) {
              refs.push(libRef);
              const isPanel = !!(libPanel && (libPanel.local_path || libPanel.image_url));
              const isFourView = !isPanel && !!lib.four_view_image_url;
              refLabels.push(`Image ${refs.length}: character appearance reference for "${lib.name || 'character'}"${isPanel ? ' (front full-body view)' : isFourView ? ' (four-view reference sheet)' : ' (character image)'}`);
              coveredNames.add(lib.name);
            }
          }
        } catch (_) {}

        if (refs.length > 0) {
          reference_image_urls = refs;
          reference_source = 'storyboard 自动解析';
          // refLabels 与 refs 一一对应，确保描述条数 === 实际图片数
          if (refLabels.length > 0) {
            reference_context_note = refLabels.slice(0, refs.length).join('\n');
          }
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

    // ── Step 2.3: 参考图智能过滤（仅单帧分镜 + 多张参考图时生效）────────────────────────────
    // 策略：从 reference_context_note 中提取角色名，判断是否在当前镜头的提示词里被提及。
    // 场景参考图始终保留；未被提及的角色参考图跳过，减少无关图片对模型的干扰。
    if (
      row.storyboard_id &&
      row.frame_type !== 'quad_grid' &&
      row.frame_type !== 'nine_grid' &&
      reference_image_urls && reference_image_urls.length > 1 &&
      reference_context_note
    ) {
      try {
        const promptText = ((row.prompt || '') + ' ' + (row.description || '')).toLowerCase();
        const labels = reference_context_note.split('\n');
        const filteredRefs = [];
        const filteredLabels = [];

        for (let fi = 0; fi < reference_image_urls.length; fi++) {
          const label = labels[fi] || '';
          const isCharRef = /character appearance reference/i.test(label);
          if (!isCharRef) {
            // 场景/其它参考图 → 始终保留
            filteredRefs.push(reference_image_urls[fi]);
            filteredLabels.push(label);
            continue;
          }
          // 提取角色名（格式：character appearance reference for "姓名"）
          const nameMatch = label.match(/for\s+"([^"]+)"/i);
          const charName = nameMatch ? nameMatch[1].trim() : '';
          const nameInPrompt = charName && promptText.includes(charName.toLowerCase());
          if (nameInPrompt || !charName) {
            filteredRefs.push(reference_image_urls[fi]);
            filteredLabels.push(label);
          } else {
            log.info('[图生] Step2.3 过滤不相关角色参考图', { id: imageGenId, name: charName });
          }
        }

        // 若过滤后至少有 1 张，则更新；否则保留全部（避免误杀）
        if (filteredRefs.length > 0 && filteredRefs.length < reference_image_urls.length) {
          reference_image_urls = filteredRefs;
          // 重新编号 Image N: 标签
          reference_context_note = filteredLabels
            .map((lbl, idx) => lbl.replace(/^Image\s+\d+/i, `Image ${idx + 1}`))
            .join('\n');
          log.info('[图生] Step2.3 参考图过滤完成', {
            id: imageGenId,
            before: reference_image_urls.length + filteredLabels.length - filteredRefs.length,
            after: filteredRefs.length,
          });
        }
      } catch (filterErr) {
        log.warn('[图生] Step2.3 参考图过滤异常，使用全部参考图', { id: imageGenId, error: filterErr.message });
      }
    }

    // ── Step 2.5: 单张分镜图 + 有参考图时，记录参考图映射（由 callGeminiImageApi 处理 parts 结构）───
    // Gemini 正确做法：文字说明→参考图→生成指令（交替结构），在 imageClient 中组装
    // 这里只记录日志，不再污染主 prompt 文本
    if (row.storyboard_id && row.frame_type !== 'quad_grid' && row.frame_type !== 'nine_grid' && reference_image_urls && reference_image_urls.length > 0) {
      log.info('[图生] Step2.5 参考图就绪，将由 Gemini parts 结构传递', {
        id: imageGenId,
        ref_count: reference_image_urls.length,
        context_note: reference_context_note || '(无标签)',
      });
    }

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

    // ── Step 3.5: 分镜 prompt 文本AI二次优化（仅分镜单帧，且 ai_model_map 中配置了 image_polish 才启用）──
    let finalPrompt = row.prompt;
    const isSingleStoryboard = row.storyboard_id && row.frame_type !== 'quad_grid' && row.frame_type !== 'nine_grid';
    if (isSingleStoryboard && row.prompt) {
      try {
        const polishMapped = aiClient.getConfigFromModelMap(db, 'image_polish');
        if (polishMapped) {
          log.info('[图生] Step3.5 文本AI优化 prompt 开始', { id: imageGenId, elapsed: elapsed() });
          const style = cfg?.style?.default_style || '';
          const assetNames = (reference_context_note || '').split('\n').map((l) => l.replace(/^Image \d+: [^"]*"([^"]+)".*/, '$1')).filter(Boolean).join(', ');
          const userPrompt = `PROMPT: ${row.prompt}\nSTYLE: ${style || 'cinematic'}\nASSETS: ${assetNames || 'none'}`;
          const systemPrompt = promptI18n.getImagePolishPrompt();
          const polishedPrompt = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
            scene_key: 'image_polish',
            max_tokens: 300,
            temperature: 0.3,
          });
          if (polishedPrompt && polishedPrompt.trim().length > 10) {
            finalPrompt = polishedPrompt.trim();
            db.prepare('UPDATE image_generations SET prompt = ?, updated_at = ? WHERE id = ?').run(
              finalPrompt, new Date().toISOString(), imageGenId
            );
            log.info('[图生] Step3.5 prompt 优化完成', {
              id: imageGenId,
              original_len: row.prompt.length,
              polished_len: finalPrompt.length,
              preview: finalPrompt.slice(0, 100),
              elapsed: elapsed(),
            });
          }
        }
      } catch (polishErr) {
        log.warn('[图生] Step3.5 prompt 优化失败，使用原始 prompt', { id: imageGenId, error: polishErr.message });
      }
    }

    // ── Step 4: 调用图生 API ─────────────────────────────────────────
    log.info('[图生] Step4 调用图生 API →', { id: imageGenId, elapsed: elapsed() });
    const tApi = Date.now();
    // 单张分镜图时，把参考图标签（reference_context_note）传给 Gemini，
    // 在 callGeminiImageApi 里解析为 per-image 标签，交替插入 parts 结构
    const apiSystemPrompt = (isSingleStoryboard && reference_context_note) ? reference_context_note : undefined;

    const result = await imageClient.callImageApi(db, log, {
      prompt: finalPrompt,
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
      system_prompt: apiSystemPrompt,
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

    // ── Step 7（四宫格）：自动拆分为 4 张子图，创建独立记录 ────────────
    if (row.frame_type === 'quad_grid' && localPath) {
      const storagePath2 = path.isAbsolute(cfg.storage?.local_path)
        ? cfg.storage.local_path
        : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
      const absLocalPath = path.join(storagePath2, localPath);
      splitQuadGridToImages(db, log, row, absLocalPath, storagePath2, result.image_url).catch((e) => {
        log.warn('[图生] Step7 四宫格拆分异常', { id: imageGenId, error: e.message });
      });
    }

    // ── Step 7（九宫格）：自动拆分为 9 张子图，创建独立记录 ────────────
    if (row.frame_type === 'nine_grid' && localPath) {
      const storagePath2 = path.isAbsolute(cfg.storage?.local_path)
        ? cfg.storage.local_path
        : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
      const absLocalPath = path.join(storagePath2, localPath);
      splitNineGridToImages(db, log, row, absLocalPath, storagePath2, result.image_url).catch((e) => {
        log.warn('[图生] Step7 九宫格拆分异常', { id: imageGenId, error: e.message });
      });
    }

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
