// 与 Go StoryboardService.GenerateStoryboard + processStoryboardGeneration 对齐
const taskService = require('./taskService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const { safeParseAIJSON } = require('../utils/safeJson');
const loadConfig = require('../config').loadConfig;

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
      movement: r.movement,
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
  if (sb.location) {
    let locationDesc = sb.location;
    if (sb.time) locationDesc += ', ' + sb.time;
    parts.push(locationDesc);
  }
  if (sb.action) {
    const initialPose = extractInitialPose(sb.action);
    if (initialPose) parts.push(initialPose);
  }
  if (sb.emotion) parts.push(sb.emotion);
  const styleText = style && String(style).trim();
  if (styleText) parts.push(styleText + ', first frame');
  else parts.push('first frame');
  return parts.length ? parts.join(', ') : (styleText ? styleText + ', first frame' : 'first frame');
}

function generateVideoPrompt(sb, style, videoRatio) {
  const parts = [];
  // 场景与标题（便于视频模型理解画面环境）
  if (sb.scene_description) {
    parts.push('Scene: ' + sb.scene_description);
  } else if (sb.location) {
    const scene = sb.time ? sb.location + ', ' + sb.time : sb.location;
    parts.push('Scene: ' + scene);
  }
  if (sb.title) parts.push('Title: ' + sb.title);
  // 动作与对白（核心叙事）
  if (sb.action) parts.push('Action: ' + sb.action);
  if (sb.dialogue) parts.push('Dialogue: ' + sb.dialogue);
  if (sb.result) parts.push('Result: ' + sb.result);
  // 镜头与运镜
  const shotType = sb.shot_type || sb.camera_shot_type;
  if (shotType) parts.push('Shot type: ' + shotType);
  const angle = sb.angle ?? sb.camera_angle;
  if (angle) parts.push('Camera angle: ' + angle);
  const movement = sb.movement ?? sb.camera_movement;
  if (movement) parts.push('Camera movement: ' + movement);
  // 氛围与情绪
  if (sb.atmosphere) parts.push('Atmosphere: ' + sb.atmosphere);
  if (sb.emotion) parts.push('Mood: ' + sb.emotion);
  if (sb.emotion_intensity != null && sb.emotion_intensity !== '') {
    parts.push('Emotion intensity: ' + String(sb.emotion_intensity));
  }
  // 声音
  if (sb.bgm_prompt) parts.push('BGM: ' + sb.bgm_prompt);
  if (sb.sound_effect) parts.push('Sound effects: ' + sb.sound_effect);
  // 时长（便于视频模型控制片段长度）
  const durationSec = normalizeDuration(sb.duration) || 5;
  parts.push('Duration: ' + durationSec + ' seconds');
  // 风格与比例
  if (style) parts.push('Style: ' + style);
  if (videoRatio) parts.push('=VideoRatio: ' + videoRatio);
  return parts.length ? parts.join('. ') : 'Video scene';
}

function saveStoryboards(db, log, episodeId, storyboards, cfg, styleOverride) {
  const episodeIdNum = Number(episodeId);
  if (storyboards.length === 0) {
    throw new Error('AI生成分镜失败：返回的分镜数量为0');
  }
  const style = (styleOverride && String(styleOverride).trim()) || cfg?.style?.default_style || '';
  const videoRatio = cfg?.style?.default_video_ratio || '16:9';
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL').all(episodeIdNum);
  if (existing.length > 0) {
    db.prepare('UPDATE storyboards SET deleted_at = ? WHERE episode_id = ?').run(now, episodeIdNum);
  }

  const saved = [];
  const angleVal = (sb) => sb.angle ?? sb.camera_angle ?? null;
  for (const sb of storyboards) {
    const shotNumber = sb.shot_number ?? sb.storyboard_number ?? 0;
    const title = sb.title ?? '';
    const shotType = sb.shot_type ?? '';
    const movement = sb.movement ?? sb.camera_movement ?? '';
    const angle = angleVal(sb);
    const action = sb.action ?? '';
    const dialogue = sb.dialogue ?? '';
    const result = sb.result ?? '';
    const emotion = sb.emotion ?? '';
    const description = `【镜头类型】${shotType}\n【运镜】${movement}\n【动作】${action}\n【对话】${dialogue}\n【结果】${result}\n【情绪】${emotion}`;
    const imagePrompt = generateImagePrompt(sb, style);
    const videoPrompt = generateVideoPrompt(sb, style, videoRatio);
    const sceneId = sb.scene_id != null ? Number(sb.scene_id) : null;
    const charactersJson = Array.isArray(sb.characters) ? JSON.stringify(sb.characters) : (sb.characters ? JSON.stringify([].concat(sb.characters)) : '[]');

    try {
      const insertWithVisual = db.prepare(
        `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, action, result, atmosphere, image_prompt, video_prompt, characters, shot_type, angle, movement, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      );
      insertWithVisual.run(
        episodeIdNum,
        sceneId,
        shotNumber,
        title || null,
        description,
        sb.location ?? null,
        sb.time ?? null,
        sb.duration ?? 5,
        dialogue || null,
        action || null,
        result || null,
        sb.atmosphere ?? null,
        imagePrompt,
        videoPrompt,
        charactersJson,
        shotType || null,
        angle,
        movement || null,
        now,
        now
      );
    } catch (e) {
      if ((e.message || '').includes('shot_type') || (e.message || '').includes('angle') || (e.message || '').includes('movement') || (e.message || '').includes('result')) {
        // Fallback if columns missing (should not happen if migration runs)
        const insertBasic = db.prepare(
          `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, action, atmosphere, image_prompt, video_prompt, characters, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        );
        insertBasic.run(
          episodeIdNum,
          sceneId,
          shotNumber,
          title || null,
          description,
          sb.location ?? null,
          sb.time ?? null,
          sb.duration ?? 5,
          dialogue || null,
          action || null,
          sb.atmosphere ?? null,
          imagePrompt,
          videoPrompt,
          charactersJson,
          now,
          now
        );
      } else {
        throw e;
      }
    }
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
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
      characters: Array.isArray(sb.characters) ? sb.characters : [],
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
  }
  log.info('Storyboards saved', { episode_id: episodeId, count: saved.length });
  return saved;
}

async function processStoryboardGeneration(db, log, cfg, taskId, episodeId, model, style, userPrompt, systemPrompt) {
  try {
    taskService.updateTaskStatus(db, taskId, 'processing', 10, '开始生成分镜头...');
    log.info('Processing storyboard generation', { task_id: taskId, episode_id: episodeId });

    // 添加系统提示词：明确要求数量和时长
    const constraintPrompt = `\nIMPORTANT: Please strictly follow the user's constraints on "Total shot count" and "Total video duration". Consolidate or split shots as needed to meet these targets within ±20% margin.`;
    
    const text = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt + constraintPrompt, {
      model: model || undefined,
      temperature: 0.7,
      max_tokens: 8192,
    });

    taskService.updateTaskStatus(db, taskId, 'processing', 50, '分镜头生成完成，正在解析结果...');

    let storyboards = [];
    try {
      const parsed = safeParseAIJSON(text, {});
      if (Array.isArray(parsed)) {
        storyboards = parsed;
      } else if (parsed && Array.isArray(parsed.storyboards)) {
        storyboards = parsed.storyboards;
      }
    } catch (e) {
      try {
        const arr = safeParseAIJSON(text, []);
        storyboards = Array.isArray(arr) ? arr : [];
      } catch (e2) {
        log.error('Parse storyboard JSON failed', { error: e2.message, task_id: taskId });
        taskService.updateTaskError(db, taskId, '解析分镜头结果失败: ' + (e2.message || ''));
        return;
      }
    }

    if (storyboards.length === 0) {
      log.error('AI returned 0 storyboards', { task_id: taskId });
      taskService.updateTaskError(db, taskId, 'AI生成分镜失败：返回的分镜数量为0');
      return;
    }

    const totalDuration = storyboards.reduce((sum, sb) => sum + (Number(sb.duration) || 0), 0);
    log.info('Storyboard generated', { task_id: taskId, episode_id: episodeId, count: storyboards.length, total_duration_seconds: totalDuration });

    taskService.updateTaskStatus(db, taskId, 'processing', 70, '正在保存分镜头...');

    const saved = saveStoryboards(db, log, episodeId, storyboards, cfg, style);

    taskService.updateTaskStatus(db, taskId, 'processing', 90, '正在更新剧集时长...');

    const durationMinutes = Math.ceil((totalDuration + 59) / 60);
    db.prepare('UPDATE episodes SET duration = ?, updated_at = ? WHERE id = ?').run(durationMinutes, new Date().toISOString(), Number(episodeId));
    log.info('Episode duration updated', { episode_id: episodeId, duration_seconds: totalDuration, duration_minutes: durationMinutes });

    const resultData = {
      storyboards: saved,
      total: saved.length,
      total_duration: totalDuration,
      duration_minutes: durationMinutes,
    };
    taskService.updateTaskResult(db, taskId, resultData);
    log.info('Storyboard generation completed', { task_id: taskId, episode_id: episodeId });
  } catch (err) {
    log.error('Storyboard generation failed', { error: err.message, task_id: taskId });
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

  // 获取剧集风格（如果未指定，则从 drama 中获取）
  const drama = db.prepare('SELECT style FROM dramas WHERE id = ?').get(episode.drama_id);
  const finalStyle = style || (drama && drama.style) || 'realistic';
  
  // 图片比例
  const imageRatio = aspectRatio || cfg?.style?.default_video_ratio || '16:9';

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
  
  console.log('==c storyboardCount:', storyboardCount, 'videoDuration:', videoDuration, 'extraConstraint:', extraConstraint);

  const charListLabel = promptI18n.formatUserPrompt(cfg, 'character_list_label');
  const charConstraint = promptI18n.formatUserPrompt(cfg, 'character_constraint');
  const sceneListLabel = promptI18n.formatUserPrompt(cfg, 'scene_list_label');
  const sceneConstraint = promptI18n.formatUserPrompt(cfg, 'scene_constraint');
  const suffix = promptI18n.getStoryboardUserPromptSuffix(cfg);

  const userPrompt =
    `${scriptLabel}\n${scriptContent}\n\n${taskLabel}\n${taskInstruction}${extraConstraint}\n\n${charListLabel}\n${characterList}\n\n${charConstraint}\n\n${sceneListLabel}\n${sceneList}\n\n${sceneConstraint}\n\n【剧本原文】\n${scriptContent}\n\n${suffix}`;
console.log("==c 用户提示词：",userPrompt);
  const systemPrompt = promptI18n.getStoryboardSystemPrompt(cfg);

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
