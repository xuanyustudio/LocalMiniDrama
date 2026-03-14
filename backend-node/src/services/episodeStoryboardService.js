// 与 Go StoryboardService.GenerateStoryboard + processStoryboardGeneration 对齐
const taskService = require('./taskService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const { safeParseAIJSON, extractJsonCandidate, repairTruncatedJsonArray, extractFirstArray } = require('../utils/safeJson');
const loadConfig = require('../config').loadConfig;
const angleService = require('./angleService');

function rowToScene(r) {
  if (!r) return null;
  return {
    id: r.id,
    drama_id: r.drama_id,
    location: r.location,
    time: r.time,
    prompt: r.prompt,
    storyboard_count: r.storyboard_count ?? 1,
    image_url: r.image_url,
    local_path: r.local_path,
    status: r.status || 'pending',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** 规范为数字秒：前端左侧用 {{ shot.duration }}s，右侧用 Math.round(duration)；避免 "5s" 导致 5ss，或非数字导致 NaN */
function normalizeDuration(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const s = String(v).trim().replace(/s$/i, '');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function getStoryboardsForEpisode(db, episodeId) {
  const rows = db.prepare(
    'SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number ASC'
  ).all(episodeId);
  return rows.map((r) => {
    let background = null;
    if (r.scene_id != null) {
      const sceneRow = db.prepare('SELECT * FROM scenes WHERE id = ? AND deleted_at IS NULL').get(r.scene_id);
      if (sceneRow) background = rowToScene(sceneRow);
    }
    return {
      id: r.id,
      episode_id: r.episode_id,
      scene_id: r.scene_id,
      storyboard_number: r.storyboard_number,
      title: r.title,
      description: r.description,
      location: r.location,
      time: r.time,
      duration: normalizeDuration(r.duration),
      dialogue: r.dialogue,
      action: r.action,
      result: r.result,
      atmosphere: r.atmosphere,
      image_prompt: r.image_prompt,
      video_prompt: r.video_prompt,
      shot_type: r.shot_type,
      angle: r.angle,
      angle_h: r.angle_h ?? null,
      angle_v: r.angle_v ?? null,
      angle_s: r.angle_s ?? null,
      movement: r.movement,
      segment_index: r.segment_index ?? 0,
      segment_title: r.segment_title ?? null,
      characters: (() => {
        if (!r.characters) return [];
        if (typeof r.characters !== 'string') return Array.isArray(r.characters) ? r.characters : [];
        try { return JSON.parse(r.characters); } catch (_) { return []; }
      })(),
      composed_image: r.composed_image,
      video_url: r.video_url,
      status: r.status || 'pending',
      created_at: r.created_at,
      updated_at: r.updated_at,
      background,
    };
  });
}

function extractInitialPose(action) {
  if (!action || typeof action !== 'string') return '';
  const processWords = [
    '然后', '接着', '接下来', '随后', '紧接着',
    '向下', '向上', '向前', '向后', '向左', '向右',
    '开始', '继续', '逐渐', '慢慢', '快速', '突然', '猛然',
  ];
  let result = action;
  for (const word of processWords) {
    const idx = result.indexOf(word);
    if (idx > 0) {
      result = result.slice(0, idx);
      break;
    }
  }
  return result.replace(/[，。,.]\s*$/, '').trim();
}

function generateImagePrompt(sb, style) {
  const parts = [];
  // 场景位置与时间
  if (sb.location) {
    let locationDesc = sb.location;
    if (sb.time) locationDesc += '，' + sb.time;
    parts.push(locationDesc);
  }
  // 镜头视角：优先结构化三元组（中文标签），降级到旧文本
  if (sb.angle_h && sb.angle_v && sb.angle_s) {
    parts.push(angleService.toChineseLabel(sb.angle_h, sb.angle_v, sb.angle_s));
  } else if (sb.angle || sb.shot_type) {
    const { h, v, s } = angleService.parseFromLegacyText(sb.angle || '', sb.shot_type || '');
    parts.push(angleService.toChineseLabel(h, v, s));
  }
  // 画面动作（取动作的起始状态）
  if (sb.action) {
    const initialPose = extractInitialPose(sb.action);
    if (initialPose) parts.push(initialPose);
  }
  // 情绪
  if (sb.emotion) parts.push(sb.emotion);
  // 风格（英文 prompt token，保持英文以兼容图片 AI）
  const styleText = style && String(style).trim();
  if (styleText) parts.push(styleText);
  parts.push('首帧静止画面');
  return parts.join('，');
}

function generateVideoPrompt(sb, style, videoRatio) {
  const parts = [];
  // 场景与标题
  if (sb.scene_description) {
    parts.push('场景：' + sb.scene_description);
  } else if (sb.location) {
    const scene = sb.time ? sb.location + '，' + sb.time : sb.location;
    parts.push('场景：' + scene);
  }
  if (sb.title) parts.push('镜头标题：' + sb.title);
  // 动作与对白（核心叙事）
  if (sb.action) parts.push('动作：' + sb.action);
  if (sb.dialogue) parts.push('对话：' + sb.dialogue);
  if (sb.result) parts.push('结果：' + sb.result);
  // 镜头与运镜
  const shotType = sb.shot_type || sb.camera_shot_type;
  if (shotType) parts.push('景别：' + shotType);
  // 结构化视角：中文标签 + 英文描述（兼顾中英文视频模型）
  if (sb.angle_h && sb.angle_v && sb.angle_s) {
    const chLabel = angleService.toChineseLabel(sb.angle_h, sb.angle_v, sb.angle_s);
    const angleFragment = angleService.toPromptFragment(sb.angle_h, sb.angle_v, sb.angle_s);
    parts.push(`镜头角度：${chLabel}（${angleFragment}）`);
  } else {
    const angle = sb.angle ?? sb.camera_angle;
    if (angle) parts.push('镜头角度：' + angle);
  }
  const movement = sb.movement ?? sb.camera_movement;
  if (movement) parts.push('运镜：' + movement);
  // 氛围与情绪
  if (sb.atmosphere) parts.push('氛围：' + sb.atmosphere);
  if (sb.emotion) parts.push('情绪：' + sb.emotion);
  if (sb.emotion_intensity != null && sb.emotion_intensity !== '') {
    parts.push('情绪强度：' + String(sb.emotion_intensity));
  }
  // 声音
  if (sb.bgm_prompt) parts.push('配乐：' + sb.bgm_prompt);
  if (sb.sound_effect) parts.push('音效：' + sb.sound_effect);
  // 时长
  const durationSec = normalizeDuration(sb.duration) || 5;
  parts.push('时长：' + durationSec + '秒');
  // 风格（英文 token 保持英文以兼容视频 AI）与画面比例
  if (style) parts.push('风格：' + style);
  if (videoRatio) parts.push('=VideoRatio: ' + videoRatio);
  return parts.length ? parts.join('。') : '视频场景';
}

/**
 * 将单个分镜对象插入 DB，供增量流式保存使用。
 * 返回插入后的 id，出错则返回 null（不抛异常）。
 */
function insertOneStoryboard(db, episodeIdNum, sb, style, videoRatio, now) {
  const shotNumber = sb.shot_number ?? sb.storyboard_number ?? 0;
  const title = sb.title ?? '';
  const shotType = sb.shot_type ?? '';
  const movement = sb.movement ?? sb.camera_movement ?? '';
  const angle = sb.angle ?? sb.camera_angle ?? null;
  const action = sb.action ?? '';
  const dialogue = sb.dialogue ?? '';
  const result = sb.result ?? '';
  const emotion = sb.emotion ?? '';
  const segmentIndex = sb.segment_index != null ? Number(sb.segment_index) : 0;
  const segmentTitle = sb.segment_title ?? null;
  // scene_description 向后兼容（旧版 AI 输出合并字段，尝试拆分为 location+time）
  if (!sb.location && sb.scene_description) {
    const sceneDesc = String(sb.scene_description).trim();
    // 格式通常是 "地点，时间" 或 "location, time"
    const sepIdx = sceneDesc.search(/[，,、]/);
    if (sepIdx > 0) {
      sb.location = sceneDesc.slice(0, sepIdx).trim();
      if (!sb.time) sb.time = sceneDesc.slice(sepIdx + 1).trim();
    } else {
      sb.location = sceneDesc;
    }
  }
  // 结构化视角三元组：优先使用 AI 直接输出的字段，否则从旧文本解析
  const { h: angleH, v: angleV, s: angleS } = (angle || shotType)
    ? angleService.parseFromLegacyText(angle || '', shotType || '')
    : { h: null, v: null, s: null };
  const description = `【镜头类型】${shotType}\n【运镜】${movement}\n【动作】${action}\n【对话】${dialogue}\n【结果】${result}\n【情绪】${emotion}`;
  // 将解析好的结构化三元组写回 sb，供 generateImagePrompt/generateVideoPrompt 使用
  const sbWithAngles = { ...sb, angle_h: angleH, angle_v: angleV, angle_s: angleS };
  const imagePrompt = generateImagePrompt(sbWithAngles, style);
  const videoPrompt = generateVideoPrompt(sbWithAngles, style, videoRatio);
  const sceneId = sb.scene_id != null ? Number(sb.scene_id) : null;
  const charactersJson = Array.isArray(sb.characters) ? JSON.stringify(sb.characters) : (sb.characters ? JSON.stringify([].concat(sb.characters)) : '[]');
  try {
    db.prepare(
      `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, action, result, atmosphere, image_prompt, video_prompt, characters, shot_type, angle, angle_h, angle_v, angle_s, movement, segment_index, segment_title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      episodeIdNum, sceneId, shotNumber, title || null, description,
      sb.location ?? null, sb.time ?? null, sb.duration ?? 5,
      dialogue || null, action || null, result || null, sb.atmosphere ?? null,
      imagePrompt, videoPrompt, charactersJson,
      shotType || null, angle, angleH, angleV, angleS,
      movement || null, segmentIndex, segmentTitle, now, now
    );
    const newId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    // 保存道具关联（AI 输出的 props 字段为道具 ID 数组）
    const propIds = Array.isArray(sb.props) ? sb.props.map(Number).filter(Number.isFinite) : [];
    if (propIds.length > 0) {
      try {
        const insProp = db.prepare('INSERT OR IGNORE INTO storyboard_props (storyboard_id, prop_id) VALUES (?, ?)');
        for (const pid of propIds) insProp.run(newId, pid);
      } catch (_) {}
    }
    return newId;
  } catch (_) {
    return null;
  }
}

/**
 * 在流式输出过程中，从已积累的文本尝试解析并保存尚未保存的分镜。
 * savedNums：已保存的 storyboard_number Set，用于去重。
 */
function tryIncrementalSave(db, log, episodeIdNum, accumulated, savedNums, style, videoRatio) {
  try {
    const cleaned = accumulated.trim()
      .replace(/^```json\s*/gm, '').replace(/^```\s*/gm, '').replace(/```\s*$/gm, '').trim();
    const candidate = extractJsonCandidate(cleaned);
    if (!candidate) return;
    const repaired = repairTruncatedJsonArray(candidate);
    if (!repaired) return;
    let parsed;
    try { parsed = JSON.parse(repaired); } catch (_) { return; }
    const items = Array.isArray(parsed) ? parsed : extractFirstArray(parsed);
    if (!items || items.length === 0) return;
    const now = new Date().toISOString();
    let newCount = 0;
    for (const sb of items) {
      const shotNumber = sb.shot_number ?? sb.storyboard_number ?? 0;
      if (savedNums.has(shotNumber)) continue;
      const id = insertOneStoryboard(db, episodeIdNum, sb, style, videoRatio, now);
      if (id !== null) {
        savedNums.add(shotNumber);
        newCount++;
      }
    }
    if (newCount > 0) {
      log.info('Storyboard incremental save', { episode_id: episodeIdNum, new_count: newCount, total_saved: savedNums.size });
    }
  } catch (_) { /* 流式解析错误静默忽略，等待最终完整解析 */ }
}

/**
 * @param {Set|null} skipShotNumbers - 已通过增量流式保存的 storyboard_number 集合，跳过重复插入
 */
function saveStoryboards(db, log, episodeId, storyboards, cfg, styleOverride, skipShotNumbers = null) {
  const episodeIdNum = Number(episodeId);
  if (storyboards.length === 0) {
    throw new Error('AI生成分镜失败：返回的分镜数量为0');
  }
  const style = (styleOverride && String(styleOverride).trim()) || cfg?.style?.default_style || '';
  const videoRatio = cfg?.style?.default_video_ratio || '16:9';
  const now = new Date().toISOString();

  // 仅在非增量模式下才删除旧数据（增量模式时已在流式开始前删除）
  if (skipShotNumbers === null) {
    const existing = db.prepare('SELECT id FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL').all(episodeIdNum);
    if (existing.length > 0) {
      db.prepare('UPDATE storyboards SET deleted_at = ? WHERE episode_id = ?').run(now, episodeIdNum);
    }
  }

  const saved = [];
  const angleVal = (sb) => sb.angle ?? sb.camera_angle ?? null;
  for (const sb of storyboards) {
    const shotNumber = sb.shot_number ?? sb.storyboard_number ?? 0;

    // 已由增量流式保存过的分镜：直接从 DB 读取已保存记录，无需重复 INSERT
    if (skipShotNumbers && skipShotNumbers.has(shotNumber)) {
      const existing = db.prepare(
        'SELECT * FROM storyboards WHERE episode_id = ? AND storyboard_number = ? AND deleted_at IS NULL'
      ).get(episodeIdNum, shotNumber);
      if (existing) {
        saved.push({
          id: existing.id,
          episode_id: episodeIdNum,
          scene_id: existing.scene_id,
          storyboard_number: shotNumber,
          title: existing.title,
          description: existing.description,
          location: existing.location,
          time: existing.time,
          duration: existing.duration,
          dialogue: existing.dialogue,
          action: existing.action,
          result: existing.result,
          atmosphere: existing.atmosphere,
          image_prompt: existing.image_prompt,
          video_prompt: existing.video_prompt,
          shot_type: existing.shot_type,
          angle: existing.angle,
          movement: existing.movement,
          segment_index: existing.segment_index ?? 0,
          segment_title: existing.segment_title ?? null,
          characters: (() => { try { return JSON.parse(existing.characters || '[]'); } catch(_) { return []; } })(),
          status: existing.status,
          created_at: existing.created_at,
          updated_at: existing.updated_at,
        });
        continue;
      }
      // 若 DB 中找不到（极少情况），fallthrough 正常 INSERT
    }

    const title = sb.title ?? '';
    const shotType = sb.shot_type ?? '';
    const movement = sb.movement ?? sb.camera_movement ?? '';
    const angle = angleVal(sb);
    const action = sb.action ?? '';
    const dialogue = sb.dialogue ?? '';
    const result = sb.result ?? '';
    const emotion = sb.emotion ?? '';
    const segmentIndex = sb.segment_index != null ? Number(sb.segment_index) : 0;
    const segmentTitle = sb.segment_title ?? null;
    // scene_description 向后兼容（旧版 AI 输出合并字段，尝试拆分为 location+time）
    if (!sb.location && sb.scene_description) {
      const sceneDesc = String(sb.scene_description).trim();
      const sepIdx = sceneDesc.search(/[，,、]/);
      if (sepIdx > 0) {
        sb.location = sceneDesc.slice(0, sepIdx).trim();
        if (!sb.time) sb.time = sceneDesc.slice(sepIdx + 1).trim();
      } else {
        sb.location = sceneDesc;
      }
    }
    // 结构化视角三元组
    const { h: angleH, v: angleV, s: angleS } = (angle || shotType)
      ? angleService.parseFromLegacyText(angle || '', shotType || '')
      : { h: null, v: null, s: null };
    const description = `【镜头类型】${shotType}\n【运镜】${movement}\n【动作】${action}\n【对话】${dialogue}\n【结果】${result}\n【情绪】${emotion}`;
    // 将解析好的结构化三元组写回 sb，供 generateImagePrompt/generateVideoPrompt 使用
    const sbWithAngles = { ...sb, angle_h: angleH, angle_v: angleV, angle_s: angleS };
    const imagePrompt = generateImagePrompt(sbWithAngles, style);
    const videoPrompt = generateVideoPrompt(sbWithAngles, style, videoRatio);
    const sceneId = sb.scene_id != null ? Number(sb.scene_id) : null;
    const charactersJson = Array.isArray(sb.characters) ? JSON.stringify(sb.characters) : (sb.characters ? JSON.stringify([].concat(sb.characters)) : '[]');

    try {
      db.prepare(
        `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, action, result, atmosphere, image_prompt, video_prompt, characters, shot_type, angle, angle_h, angle_v, angle_s, movement, segment_index, segment_title, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).run(
        episodeIdNum, sceneId, shotNumber, title || null, description,
        sb.location ?? null, sb.time ?? null, sb.duration ?? 5,
        dialogue || null, action || null, result || null, sb.atmosphere ?? null,
        imagePrompt, videoPrompt, charactersJson,
        shotType || null, angle, angleH, angleV, angleS,
        movement || null, segmentIndex, segmentTitle,
        now, now
      );
    } catch (e) {
      if ((e.message || '').includes('shot_type') || (e.message || '').includes('angle') || (e.message || '').includes('movement') || (e.message || '').includes('result') || (e.message || '').includes('segment')) {
        // Fallback if columns missing (should not happen if migration runs)
        db.prepare(
          `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, action, atmosphere, image_prompt, video_prompt, characters, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        ).run(
          episodeIdNum, sceneId, shotNumber, title || null, description,
          sb.location ?? null, sb.time ?? null, sb.duration ?? 5,
          dialogue || null, action || null, sb.atmosphere ?? null,
          imagePrompt, videoPrompt, charactersJson, now, now
        );
      } else {
        throw e;
      }
    }
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
    // 保存道具关联（AI 输出的 props 字段为道具 ID 数组）
    const propIds = Array.isArray(sb.props) ? sb.props.map(Number).filter(Number.isFinite) : [];
    if (propIds.length > 0) {
      try {
        const insProp = db.prepare('INSERT OR IGNORE INTO storyboard_props (storyboard_id, prop_id) VALUES (?, ?)');
        for (const pid of propIds) insProp.run(id, pid);
      } catch (_) {}
    }
    saved.push({
      id,
      episode_id: episodeIdNum,
      scene_id: sceneId,
      storyboard_number: shotNumber,
      title: title || null,
      description,
      location: sb.location ?? null,
      time: sb.time ?? null,
      duration: sb.duration ?? 5,
      dialogue: dialogue || null,
      action: action || null,
      result: result || null,
      atmosphere: sb.atmosphere ?? null,
      image_prompt: imagePrompt,
      video_prompt: videoPrompt,
      shot_type: shotType || null,
      angle: angle,
      movement: movement || null,
      segment_index: segmentIndex,
      segment_title: segmentTitle,
      characters: Array.isArray(sb.characters) ? sb.characters : [],
      prop_ids: propIds,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
  }
  log.info('Storyboards saved', { episode_id: episodeId, count: saved.length });
  return saved;
}

/**
 * 构建续写 prompt：当首次响应被截断时，携带已生成分镜末尾作为上下文，
 * 请求 AI 从 lastShotNum+1 继续生成剩余分镜。
 */
function buildContinuationPrompt(originalUserPrompt, alreadySaved, lastShotNum, attempt) {
  const lastCtx = alreadySaved.slice(-5).map((sb) => {
    const num = sb.shot_number ?? sb.storyboard_number ?? 0;
    const title = (sb.title || '').replace(/"/g, '\\"');
    const loc = (sb.location || '').replace(/"/g, '\\"');
    const action = (sb.action || '').slice(0, 80).replace(/"/g, '\\"');
    return `  {"shot_number": ${num}, "title": "${title}", "location": "${loc}", "action": "${action}"}`;
  }).join(',\n');

  return `[续写指令 - 第${attempt}次续写]
之前的分镜生成因长度限制在 shot_number ${lastShotNum} 处中断，已生成 ${alreadySaved.length} 个分镜。

最后几个已生成的分镜（仅供连贯性参考，不要重复）：
[
${lastCtx}
]

请从 shot_number ${lastShotNum + 1} 继续生成剩余分镜，直至剧本全部场景覆盖完毕。
要求：
- 仅返回新增分镜（JSON数组），shot_number 从 ${lastShotNum + 1} 开始递增
- 格式与之前完全相同，字段保持一致
- 不要重复已生成的分镜，不要输出任何解释文字

原始剧本与任务说明：
${originalUserPrompt}`;
}

async function processStoryboardGeneration(db, log, cfg, taskId, episodeId, model, style, userPrompt, systemPrompt) {
  // 增量保存状态放在 try 外，catch 里可用于部分恢复
  const episodeIdNum = Number(episodeId);
  const streamSavedNums = new Set();
  const streamStyle = (style && String(style).trim()) || cfg?.style?.default_style || '';
  const streamVideoRatio = cfg?.style?.default_video_ratio || '16:9';
  let streamThrottle = 0;

  try {
    taskService.updateTaskStatus(db, taskId, 'processing', 10, '开始生成分镜头...');
    log.info('Processing storyboard generation', { task_id: taskId, episode_id: episodeId });
    log.info('Storyboard prompt preview', {
      user_prompt_len: userPrompt ? userPrompt.length : 0,
      system_prompt_len: systemPrompt ? systemPrompt.length : 0,
      user_prompt_head: userPrompt ? userPrompt.slice(0, 200) : '',
    });

    // 提前删除旧分镜，为增量流式保存腾出位置
    const deleteNow = new Date().toISOString();
    db.prepare('UPDATE storyboards SET deleted_at = ? WHERE episode_id = ? AND deleted_at IS NULL').run(deleteNow, episodeIdNum);

    // max_tokens 不在此硬编码，由 AI 配置的 settings.max_tokens 控制（用户可按模型上限自行设置）。
    // 若用户未配置则不传，让模型使用自身默认值，避免超出不同模型的上限导致 400 错误。
    // 不使用 json_mode：response_format:json_object 要求返回 JSON 对象而非数组，会导致模型包装成
    // {"storyboards":[...]} 或产生乱码 key，改由 extractFirstArray 统一处理任意包装格式。
    const text = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      model: model || undefined,
      temperature: 0.7,
      // 每积累约 400 字符触发一次增量解析，尝试提前保存已完成的分镜
      streamCallback: (accumulated) => {
        if (accumulated.length - streamThrottle < 400) return;
        streamThrottle = accumulated.length;
        tryIncrementalSave(db, log, episodeIdNum, accumulated, streamSavedNums, streamStyle, streamVideoRatio);
        // 同步更新任务进度（根据已保存分镜数量）
        if (streamSavedNums.size > 0) {
          taskService.updateTaskStatus(db, taskId, 'processing', 30,
            `已解析 ${streamSavedNums.size} 个分镜，生成中...`);
        }
      },
    });

    taskService.updateTaskStatus(db, taskId, 'processing', 50, '分镜头生成完成，正在解析结果...');

    log.info('AI raw response received', {
      task_id: taskId,
      text_type: typeof text,
      text_length: text ? String(text).length : 0,
      text_preview: text ? String(text).slice(0, 2000) : '(empty)',
    });

    let storyboards = [];
    const parseMeta = {};
    try {
      const parsed = safeParseAIJSON(text, null, log, parseMeta);
      storyboards = extractFirstArray(parsed) || [];
    } catch (e) {
      log.error('Parse storyboard JSON failed', {
        error: e.message,
        task_id: taskId,
        text_type: typeof text,
        text_length: text ? String(text).length : 0,
        raw_text: text ? String(text).slice(0, 2000) : '(empty)',
      });

      // 解析失败时，若流式增量保存已有部分分镜，视为截断的部分成功
      if (streamSavedNums.size > 0) {
        const partialBoards = getStoryboardsForEpisode(db, episodeIdNum);
        if (partialBoards.length > 0) {
          const totalDuration = partialBoards.reduce((s, sb) => s + (Number(sb.duration) || 0), 0);
          log.warn('Parse failed but partial storyboards already saved incrementally, treating as truncated success', {
            task_id: taskId, recovered_count: partialBoards.length, parse_error: e.message,
          });
          taskService.updateTaskResult(db, taskId, {
            storyboards: partialBoards,
            total: partialBoards.length,
            total_duration: totalDuration,
            duration_minutes: Math.ceil((totalDuration + 59) / 60),
            truncated: true,
            error_message: `AI输出含JSON格式缺陷（${e.message}），已恢复 ${partialBoards.length} 个分镜`,
          });
          return;
        }
      }

      taskService.updateTaskError(db, taskId, '解析分镜头结果失败: ' + (e.message || ''));
      return;
    }

    if (storyboards.length === 0) {
      // 最终解析为空，但流式已保存了内容，同样回退使用增量结果
      if (streamSavedNums.size > 0) {
        const partialBoards = getStoryboardsForEpisode(db, episodeIdNum);
        if (partialBoards.length > 0) {
          const totalDuration = partialBoards.reduce((s, sb) => s + (Number(sb.duration) || 0), 0);
          log.warn('Final parse returned 0 items but incremental saves exist, using those', {
            task_id: taskId, recovered_count: partialBoards.length,
          });
          taskService.updateTaskResult(db, taskId, {
            storyboards: partialBoards,
            total: partialBoards.length,
            total_duration: totalDuration,
            duration_minutes: Math.ceil((totalDuration + 59) / 60),
            truncated: true,
          });
          return;
        }
      }
      log.error('AI returned 0 storyboards', { task_id: taskId });
      taskService.updateTaskError(db, taskId, 'AI生成分镜失败：返回的分镜数量为0');
      return;
    }

    if (parseMeta.truncated) {
      log.warn('Storyboard JSON was truncated by AI (max_tokens limit), will attempt continuation', {
        task_id: taskId, episode_id: episodeId,
        rescued_count: storyboards.length,
        raw_text_length: text ? String(text).length : 0,
      });
    }
    log.info('Storyboard initial parse', { task_id: taskId, episode_id: episodeId, count: storyboards.length, truncated: parseMeta.truncated || false });

    // ── 自动续写：若 AI 输出被截断，最多续写 3 次直到完整 ──────────────────
    const MAX_CONTINUATION = 3;
    let contAttempt = 0;
    while (parseMeta.truncated && storyboards.length > 0 && contAttempt < MAX_CONTINUATION) {
      contAttempt++;
      const lastShot = Math.max(...storyboards.map(s => Number(s.shot_number ?? s.storyboard_number) || 0));
      log.info('Storyboard continuation start', { task_id: taskId, attempt: contAttempt, last_shot: lastShot, current_count: storyboards.length });
      taskService.updateTaskStatus(db, taskId, 'processing', 50 + contAttempt * 5,
        `已生成 ${storyboards.length} 个分镜，正在续写剩余部分（第${contAttempt}次）...`);

      const contPrompt = buildContinuationPrompt(userPrompt, storyboards, lastShot, contAttempt);
      streamThrottle = 0; // 重置节流，让续写段落也能增量保存

      // 等待 3 秒后再发续写请求：避免流式请求刚结束服务端连接未释放导致 "socket hang up"
      await new Promise(r => setTimeout(r, 3000));

      let contText;
      try {
        contText = await aiClient.generateText(db, log, 'text', contPrompt, systemPrompt, {
          model: model || undefined,
          temperature: 0.7,
          streamCallback: (accumulated) => {
            if (accumulated.length - streamThrottle < 400) return;
            streamThrottle = accumulated.length;
            tryIncrementalSave(db, log, episodeIdNum, accumulated, streamSavedNums, streamStyle, streamVideoRatio);
          },
        });
      } catch (e) {
        log.warn('Continuation request failed', { task_id: taskId, attempt: contAttempt, error: e.message });
        break;
      }

      const contMeta = {};
      let contItems = [];
      try {
        const contParsed = safeParseAIJSON(contText, null, log, contMeta);
        contItems = extractFirstArray(contParsed) || [];
      } catch (e) {
        log.warn('Continuation parse failed', { task_id: taskId, attempt: contAttempt, error: e.message });
        break;
      }

      if (contItems.length === 0) {
        log.warn('Continuation returned 0 items', { task_id: taskId, attempt: contAttempt });
        break;
      }

      // 按 shot_number 去重，防止 AI 重复已生成的分镜
      const existingNums = new Set(storyboards.map(s => Number(s.shot_number ?? s.storyboard_number) || 0));
      const newItems = contItems.filter(s => !existingNums.has(Number(s.shot_number ?? s.storyboard_number) || 0));
      if (newItems.length === 0) {
        log.warn('Continuation returned only duplicate items', { task_id: taskId, attempt: contAttempt });
        break;
      }

      storyboards = [...storyboards, ...newItems];
      parseMeta.truncated = contMeta.truncated || false;
      log.info('Storyboard continuation done', {
        task_id: taskId, attempt: contAttempt,
        new_items: newItems.length, total_count: storyboards.length, still_truncated: parseMeta.truncated,
      });
    }
    // ── 续写结束 ────────────────────────────────────────────────────────────

    const totalDuration = storyboards.reduce((sum, sb) => sum + (Number(sb.duration) || 0), 0);
    if (parseMeta.truncated) {
      log.warn('Storyboard still truncated after max continuations', {
        task_id: taskId, final_count: storyboards.length, continuation_attempts: contAttempt,
      });
    }
    log.info('Storyboard generated', { task_id: taskId, episode_id: episodeId, count: storyboards.length, total_duration_seconds: totalDuration, truncated: parseMeta.truncated || false, continuation_attempts: contAttempt });

    taskService.updateTaskStatus(db, taskId, 'processing', 70, '正在保存分镜头...');

    // 传入 streamSavedNums：已增量保存的项目直接从 DB 读取，跳过重复 INSERT
    const saved = saveStoryboards(db, log, episodeId, storyboards, cfg, style, streamSavedNums);

    taskService.updateTaskStatus(db, taskId, 'processing', 90, '正在更新剧集时长...');

    const durationMinutes = Math.ceil((totalDuration + 59) / 60);
    db.prepare('UPDATE episodes SET duration = ?, updated_at = ? WHERE id = ?').run(durationMinutes, new Date().toISOString(), Number(episodeId));
    log.info('Episode duration updated', { episode_id: episodeId, duration_seconds: totalDuration, duration_minutes: durationMinutes });

    const resultData = {
      storyboards: saved,
      total: saved.length,
      total_duration: totalDuration,
      duration_minutes: durationMinutes,
      truncated: parseMeta.truncated || false,
    };
    taskService.updateTaskResult(db, taskId, resultData);
    log.info('Storyboard generation completed', { task_id: taskId, episode_id: episodeId });
  } catch (err) {
    log.error('Storyboard generation failed', { error: err.message, task_id: taskId });

    // 若连接中断（ECONNRESET 等）但已通过增量流式保存了部分分镜，视为部分成功而非彻底失败
    if (streamSavedNums.size > 0) {
      try {
        const partialBoards = getStoryboardsForEpisode(db, episodeIdNum);
        if (partialBoards.length > 0) {
          const totalDuration = partialBoards.reduce((s, sb) => s + (Number(sb.duration) || 0), 0);
          log.warn('Partial storyboards recovered after error, treating as truncated success', {
            task_id: taskId, recovered_count: partialBoards.length, error: err.message,
          });
          taskService.updateTaskResult(db, taskId, {
            storyboards: partialBoards,
            total: partialBoards.length,
            total_duration: totalDuration,
            duration_minutes: Math.ceil((totalDuration + 59) / 60),
            truncated: true,
            error_message: `连接中断（${err.message}），已恢复 ${partialBoards.length} 个分镜`,
          });
          return;
        }
      } catch (_) {}
    }

    taskService.updateTaskError(db, taskId, (err.message || '生成分镜头失败'));
  }
}

function generateStoryboard(db, log, episodeId, model, style, storyboardCount, videoDuration, aspectRatio) {
  const cfg = loadConfig();
  const episode = db.prepare(
    'SELECT id, script_content, description, drama_id FROM episodes WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(episodeId));
  if (!episode) {
    throw new Error('剧集不存在或无权限访问');
  }

  // 获取剧集风格和比例（如果未指定，则从 drama 中获取）
  const drama = db.prepare('SELECT style, metadata FROM dramas WHERE id = ?').get(episode.drama_id);
  const finalStyle = style || (drama && drama.style) || 'realistic';

  // 图片比例 + 每镜时长：优先用传入值，再从 drama.metadata 读，最后兜底全局配置
  let dramaAspectRatio = null;
  let videoClipDuration = null;
  try {
    if (drama && drama.metadata) {
      const meta = typeof drama.metadata === 'string' ? JSON.parse(drama.metadata) : drama.metadata;
      if (meta && meta.aspect_ratio) dramaAspectRatio = meta.aspect_ratio;
      if (meta && meta.video_clip_duration) videoClipDuration = Number(meta.video_clip_duration) || null;
    }
  } catch (_) {}
  const imageRatio = aspectRatio || dramaAspectRatio || cfg?.style?.default_video_ratio || '16:9';

  // 计算单镜建议时长（秒）：
  // 若同时指定了总时长和数量，按比例推算（优先级最高）；
  // 否则使用项目下拉框里的视频片段时长；
  // 均未设置则传 null，由 suffix 提示 AI 自行估算
  let effectiveShotDuration = null;
  if (videoDuration && storyboardCount) {
    const implied = Math.round(Number(videoDuration) / Number(storyboardCount));
    effectiveShotDuration = implied > 0 ? implied : videoClipDuration;
  } else {
    effectiveShotDuration = videoClipDuration;
  }

  let scriptContent = (episode.script_content && String(episode.script_content).trim())
    ? String(episode.script_content)
    : (episode.description && String(episode.description).trim())
      ? String(episode.description)
      : '';
  if (!scriptContent) {
    throw new Error('剧本内容为空，请先生成剧集内容');
  }

  const characters = db.prepare(
    'SELECT id, name FROM characters WHERE drama_id = ? AND deleted_at IS NULL ORDER BY name ASC'
  ).all(episode.drama_id);
  let characterList = '无角色';
  if (characters.length > 0) {
    characterList = '[' + characters.map((c) => `{"id": ${c.id}, "name": "${(c.name || '').replace(/"/g, '\\"')}"}`).join(', ') + ']';
  }

  const scenes = db.prepare(
    'SELECT id, location, time FROM scenes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY location ASC, time ASC'
  ).all(episode.drama_id);
  let sceneList = '无场景';
  if (scenes.length > 0) {
    sceneList = '[' + scenes.map((s) => `{"id": ${s.id}, "location": "${(s.location || '').replace(/"/g, '\\"')}", "time": "${(s.time || '').replace(/"/g, '\\"')}"}`).join(', ') + ']';
  }

  const props = db.prepare(
    'SELECT id, name, type FROM props WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id ASC'
  ).all(episode.drama_id);
  let propList = '无道具';
  if (props.length > 0) {
    propList = '[' + props.map((p) => `{"id": ${p.id}, "name": "${(p.name || '').replace(/"/g, '\\"')}"${p.type ? `, "type": "${p.type.replace(/"/g, '\\"')}"` : ''}}`).join(', ') + ']';
  }

  const scriptLabel = promptI18n.formatUserPrompt(cfg, 'script_content_label');
  const taskLabel = promptI18n.formatUserPrompt(cfg, 'task_label');
  const taskInstruction = promptI18n.formatUserPrompt(cfg, 'task_instruction');
  
  // 处理分镜数量和时长约束
  let extraConstraint = '';
  // 宽松判断：只要有值（包括字符串形式的数字），就尝试转换并添加约束
  if (storyboardCount) {
    const countVal = Number(storyboardCount);
    if (Number.isFinite(countVal) && countVal > 0) {
      const countLabel = promptI18n.formatUserPrompt(cfg, 'storyboard_count_constraint', countVal);
      if (countLabel) extraConstraint += `\n${countLabel}`;
    }
  }
  if (videoDuration) {
    const durationVal = Number(videoDuration);
    if (Number.isFinite(durationVal) && durationVal > 0) {
      const durationLabel = promptI18n.formatUserPrompt(cfg, 'video_duration_constraint', durationVal);
      if (durationLabel) extraConstraint += `\n${durationLabel}`;
    }
  }
  // 当同时指定总时长和数量时，额外注入推算出的单镜目标时长，让两个约束在数学上对齐
  if (storyboardCount && videoDuration && effectiveShotDuration) {
    const isEn = promptI18n.isEnglish(cfg);
    if (isEn) {
      extraConstraint += `\nEach shot target duration: approximately ${effectiveShotDuration}s (= total ${Number(videoDuration)}s ÷ ${Number(storyboardCount)} shots). Set each shot's duration field to this value, adjusting ±1s for dialogue/action length.`;
    } else {
      extraConstraint += `\n每镜头目标时长：约 ${effectiveShotDuration} 秒（= 总时长 ${Number(videoDuration)}s ÷ ${Number(storyboardCount)} 个镜头）。每个镜头的 duration 字段请设为此值，可根据对话/动作长短适当调整 ±1 秒。`;
    }
  }

  log.info('Storyboard generation params', {
    storyboard_count: storyboardCount,
    video_duration: videoDuration,
    video_clip_duration: videoClipDuration,
    effective_shot_duration: effectiveShotDuration,
  });

  const charListLabel = promptI18n.formatUserPrompt(cfg, 'character_list_label');
  const charConstraint = promptI18n.formatUserPrompt(cfg, 'character_constraint');
  const sceneListLabel = promptI18n.formatUserPrompt(cfg, 'scene_list_label');
  const sceneConstraint = promptI18n.formatUserPrompt(cfg, 'scene_constraint');
  const propListLabel = promptI18n.formatUserPrompt(cfg, 'prop_list_label');
  const propConstraint = promptI18n.formatUserPrompt(cfg, 'prop_constraint');
  const suffix = promptI18n.getStoryboardUserPromptSuffix(cfg, effectiveShotDuration);

  const userPrompt =
    `${scriptLabel}\n${scriptContent}\n\n${taskLabel}\n${taskInstruction}${extraConstraint}\n\n${charListLabel}\n${characterList}\n\n${charConstraint}\n\n${sceneListLabel}\n${sceneList}\n\n${sceneConstraint}\n\n${propListLabel}\n${propList}\n\n${propConstraint}\n\n${suffix}`;

  let systemPrompt = promptI18n.getStoryboardSystemPrompt(cfg);

  // 当用户指定了分镜数量时，在系统提示词后追加最高优先级覆盖指令，
  // 使"目标数量"优先于默认的"一动作一镜头、禁止合并"原则
  if (storyboardCount && Number(storyboardCount) > 0) {
    const targetCount = Number(storyboardCount);
    const isEn = systemPrompt.includes('[Role]');
    if (isEn) {
      systemPrompt += `\n\n[HIGHEST PRIORITY — USER SPECIFIED COUNT]
The user requires exactly ${targetCount} shots (±10% tolerance is acceptable).
This requirement OVERRIDES the "one action = one shot, no merging" rule above.
You MUST merge related consecutive actions into fewer shots OR split key moments into more shots to reach this target.
Do NOT produce a shot count far from ${targetCount} under any circumstance.`;
    } else {
      systemPrompt += `\n\n【最高优先级——用户指定分镜数量】
用户要求生成恰好 ${targetCount} 个分镜（允许 ±10% 的偏差，即 ${Math.floor(targetCount * 0.9)}~${Math.ceil(targetCount * 1.1)} 个均可接受）。
此要求优先级高于上述所有原则，包括"一动作一镜头、禁止合并"的规则。
- 若动作较多、自然拆分超过目标数量，请将相关联的连续小动作合并为一个镜头
- 若动作较少、自然拆分不足目标数量，请将重要场景或情绪转折拆分为多个镜头
- 严禁生成数量与 ${targetCount} 相差悬殊的分镜方案`;
    }
  }

  const task = taskService.createTask(db, log, 'storyboard_generation', String(episodeId));
  log.info('Generating storyboard asynchronously', {
    task_id: task.id,
    episode_id: episodeId,
    drama_id: episode.drama_id,
    script_length: scriptContent.length,
    character_count: characters.length,
    scene_count: scenes.length,
    storyboard_count: storyboardCount,
    video_duration: videoDuration
  });

  setImmediate(() => {
    // 传入 imageRatio 同时覆盖 default_video_ratio 和 default_image_ratio，
    // 确保分镜图/视频提示词、场景提取提示词都使用项目设定的比例
    const runCfg = { ...cfg, style: { ...(cfg?.style || {}), default_video_ratio: imageRatio, default_image_ratio: imageRatio } };
    // 如果 model 为 null，则传 undefined，让 generateText 内部去兜底找默认配置
    processStoryboardGeneration(db, log, runCfg, task.id, String(episodeId), model || undefined, finalStyle, userPrompt, systemPrompt);
  });

  return { task_id: task.id, status: 'pending', message: '分镜生成任务已创建，正在后台处理...' };
}

module.exports = {
  getStoryboardsForEpisode,
  generateStoryboard,
};
