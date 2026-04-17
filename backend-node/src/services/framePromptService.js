// 与 Go application/services/frame_prompt_service.go 对齐：生成首帧/关键帧/尾帧/分镜板/动作序列提示词
const loadConfig = require('../config').loadConfig;
const promptI18n = require('./promptI18n');
const aiClient = require('./aiClient');
const taskService = require('./taskService');
const { safeParseAIJSON } = require('../utils/safeJson');
const storyboardService = require('./storyboardService');
const angleService = require('./angleService');

/**
 * 将分镜角度值扩展为带透视含义的完整描述，注入图像提示词上下文
 * 优先使用结构化三元组（angle_h/angle_v/angle_s），降级到旧文本解析
 */
function expandAngleDescription(angle, isEn, angleH, angleV, angleS) {
  // 如果提供了结构化三元组，直接用 angleService 生成高质量描述（英文）
  if (angleH && angleV && angleS) {
    return angleService.toPromptFragment(angleH, angleV, angleS);
  }
  // 如果只有旧文本，用 angleService 解析后生成
  if (angle) {
    return angleService.fromLegacyText(angle, '');
  }
  return null;
}

/** 旧版兼容：仅传 angle 文本时的快捷调用（保持向后兼容） */
function expandAngleDescriptionLegacy(angle, isEn) {
  if (!angle) return null;
  const a = String(angle).trim().toLowerCase();
  if (isEn) {
    if (a.includes('low') || a.includes('仰')) {
      return "camera angle: low-angle upward shot, background shows sky/ceiling/treetops from below, strong upward perspective distortion";
    }
    if (a.includes('high') || a.includes('俯')) {
      return "camera angle: high-angle downward shot, bird's eye view perspective, background shows ground/floor/scene from above with downward perspective distortion";
    }
    if (a.includes('side') || a.includes('侧')) {
      return "camera angle: side-angle shot, profile composition, background extends laterally";
    }
    if (a.includes('back') || a.includes('背')) {
      return "camera angle: rear shot from behind character, character's back to camera, background scene stretches ahead into the distance";
    }
    return "camera angle: eye-level horizontal shot, normal perspective, straight-on composition";
  } else {
    if (a.includes('仰') || a.includes('low')) {
      return '相机角度：低角度仰拍，背景呈现天空/天花板/树冠的仰视透视效果，视角由下向上倾斜';
    }
    if (a.includes('俯') || a.includes('high')) {
      return '相机角度：高角度俯拍，鸟瞰视角，背景呈现地面/场景的俯视透视效果，视角由上向下倾斜';
    }
    if (a.includes('侧') || a.includes('side')) {
      return '相机角度：侧面视角，侧向构图，背景向两侧水平延展';
    }
    if (a.includes('背') || a.includes('back')) {
      return '相机角度：从角色背后拍摄，角色背对镜头，背景场景在角色前方向远处延伸';
    }
    return '相机角度：平视水平拍摄，正常透视构图，正面取景';
  }
}

const FRAME_TYPES = ['first', 'key', 'last', 'panel', 'action'];

function loadStoryboard(db, storyboardId) {
  const row = db.prepare('SELECT * FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(storyboardId));
  return row
    ? {
        id: row.id,
        description: row.description,
        location: row.location,
        time: row.time,
        dialogue: row.dialogue,
        action: row.action,
        atmosphere: row.atmosphere,
        result: row.result,
        scene_id: row.scene_id,
        shot_type: row.shot_type,
        angle: row.angle,
        movement: row.movement,
      }
    : null;
}

/**
 * 将 identity_anchors JSON 转换为适合注入分镜提示词的结构化描述
 * 优先使用结构化锚点，无锚点时 fallback 到 appearance 文本
 */
function buildCharacterAnchorText(name, anchors, appearance) {
  if (anchors && typeof anchors === 'object' && Object.keys(anchors).length > 0) {
    const parts = [`Character: ${name}`];
    if (anchors.face_shape && anchors.face_shape !== 'unspecified') {
      parts.push(`Face: ${anchors.face_shape}`);
    }
    if (anchors.facial_features && anchors.facial_features !== 'unspecified') {
      parts.push(`Features: ${anchors.facial_features}`);
    }
    if (anchors.hair_style && anchors.hair_style !== 'unspecified') {
      parts.push(`Hair: ${anchors.hair_style}`);
    }
    if (anchors.skin_texture && anchors.skin_texture !== 'unspecified') {
      parts.push(`Skin: ${anchors.skin_texture}`);
    }
    if (anchors.color_anchors && typeof anchors.color_anchors === 'object') {
      const colors = Object.entries(anchors.color_anchors)
        .filter(([, v]) => v && v !== 'unspecified')
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      if (colors) parts.push(`Colors: ${colors}`);
    }
    if (anchors.unique_marks && anchors.unique_marks !== 'none' && anchors.unique_marks !== 'unspecified') {
      parts.push(`Marks: ${anchors.unique_marks}`);
    }
    return parts.join('; ');
  }
  // fallback: 使用 appearance 文本
  const app = (appearance || '').toString().trim();
  return app ? `${name}（${app}）` : name;
}

function loadStoryboardCharacterNames(db, storyboardId) {
  const links = db.prepare('SELECT character_id FROM storyboard_characters WHERE storyboard_id = ?').all(Number(storyboardId));
  if (!links.length) return [];
  const ids = links.map((r) => r.character_id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, name, appearance, identity_anchors FROM character_libraries WHERE id IN (${placeholders}) AND deleted_at IS NULL`
  ).all(...ids);
  return rows.map((r) => {
    let anchors = null;
    if (r.identity_anchors) {
      try { anchors = JSON.parse(r.identity_anchors); } catch (_) {}
    }
    return buildCharacterAnchorText(r.name, anchors, r.appearance);
  });
}

function loadScene(db, sceneId) {
  if (sceneId == null) return null;
  const row = db.prepare('SELECT id, location, time FROM scenes WHERE id = ? AND deleted_at IS NULL').get(Number(sceneId));
  return row ? { id: row.id, location: row.location, time: row.time } : null;
}

function buildStoryboardContext(cfg, sb, scene, characterNames) {
  const parts = [];
  const styleZh = (cfg?.style?.default_style_zh || '').toString().trim();
  const styleEn = (cfg?.style?.default_style_en || cfg?.style?.default_style || '').toString().trim();
  if (styleZh) parts.push(`【画风·最高优先级】${styleZh}`);
  if (styleEn && styleEn !== styleZh) parts.push(`MANDATORY ART STYLE: ${styleEn}`);
  else if (styleEn && !styleZh) parts.push(`MANDATORY ART STYLE: ${styleEn}`);
  if (sb.description) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'shot_description_label', sb.description));
  }
  if (scene) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'scene_label', scene.location, scene.time));
  } else if (sb.location || sb.time) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'scene_label', sb.location || '', sb.time || ''));
  }
  if (characterNames.length) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'characters_label', characterNames.join(', ')));
  }
  if (sb.action) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'action_label', sb.action));
  }
  if (sb.result) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'result_label', sb.result));
  }
  if (sb.dialogue) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'dialogue_label', sb.dialogue));
  }
  if (sb.atmosphere) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'atmosphere_label', sb.atmosphere));
  }
  if (sb.shot_type) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'shot_type_label', sb.shot_type));
  }
  if (sb.angle || (sb.angle_h && sb.angle_v && sb.angle_s)) {
    const isEn = promptI18n.isEnglish(cfg);
    const angleDesc = expandAngleDescription(sb.angle, isEn, sb.angle_h, sb.angle_v, sb.angle_s);
    if (angleDesc) parts.push(angleDesc);
  }
  if (sb.movement) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'movement_label', sb.movement));
  }
  return parts.join('\n');
}

function buildFallbackPrompt(cfg, scene, suffix) {
  const parts = [];
  if (scene) {
    parts.push(`${scene.location}, ${scene.time}`);
  }
  const style = (cfg?.style?.default_style || '').toString().trim();
  if (style) parts.push(style);
  if (suffix) parts.push(suffix);
  return parts.join(', ');
}

function parseFramePromptJSON(log, aiResponse) {
  try {
    const data = safeParseAIJSON(aiResponse, {}, log);
    if (data && typeof data.prompt === 'string') {
      return { prompt: data.prompt, description: data.description || '' };
    }
  } catch (e) {
    log.warn('Frame prompt JSON parse failed', { error: e.message, response_head: (aiResponse || '').slice(0, 200) });
  }
  return null;
}

function saveFramePrompt(db, log, storyboardId, frameType, prompt, description, layout) {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM frame_prompts WHERE storyboard_id = ? AND frame_type = ?').run(Number(storyboardId), frameType);
  db.prepare(
    `INSERT INTO frame_prompts (storyboard_id, frame_type, prompt, description, layout, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(Number(storyboardId), frameType, prompt, description ?? null, layout ?? null, now, now);
  log.info('Frame prompt saved', { storyboard_id: storyboardId, frame_type: frameType });
}

async function generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, frameKind) {
  const context = buildStoryboardContext(cfg, sb, scene, characterNames);
  const systemKey = frameKind === 'first' ? 'getFirstFramePrompt' : frameKind === 'key' ? 'getKeyFramePrompt' : 'getLastFramePrompt';
  const userKey = frameKind === 'first' ? 'frame_info' : frameKind === 'key' ? 'key_frame_info' : 'last_frame_info';
  const systemPrompt = promptI18n[systemKey](cfg);
  const userPrompt = promptI18n.formatUserPrompt(cfg, userKey, context);

  // ── 调试日志：打印完整提示词，方便确认角度/视角是否正确注入 ──
  log.info('[帧提示词] ===== generateSingleFrame DEBUG =====', {
    frame_kind: frameKind,
    storyboard_id: sb?.id,
    angle: sb?.angle,
    shot_type: sb?.shot_type,
    movement: sb?.movement,
  });
  log.info('[帧提示词] CONTEXT (角色/场景/角度上下文):\n' + context);
  log.info('[帧提示词] SYSTEM PROMPT:\n' + systemPrompt);
  log.info('[帧提示词] USER PROMPT:\n' + userPrompt);
  log.info('[帧提示词] ==========================================');

  let aiResponse;
  try {
    aiResponse = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, { scene_key: 'frame_prompt', model: model || undefined, max_tokens: 800 });
  } catch (err) {
    log.warn('Frame prompt AI failed, using fallback', { error: err.message });
    const suffix = frameKind === 'first' ? 'first frame, static shot' : frameKind === 'key' ? 'key frame, dynamic action' : 'last frame, final state';
    const prompt = buildFallbackPrompt(cfg, scene, suffix);
    const desc =
      frameKind === 'first'
        ? '镜头开始的静态画面，展示初始状态'
        : frameKind === 'key'
          ? '动作高潮瞬间，展示关键动作'
          : '镜头结束画面，展示最终状态和结果';
    return { prompt, description: desc };
  }
  log.info('[帧提示词] AI RAW RESPONSE:\n' + (aiResponse || '(empty)'));
  const parsed = parseFramePromptJSON(log, aiResponse);
  if (parsed) {
    log.info('[帧提示词] PARSED RESULT prompt:\n' + parsed.prompt);
    return parsed;
  }
  const suffix = frameKind === 'first' ? 'first frame, static shot' : frameKind === 'key' ? 'key frame, dynamic action' : 'last frame, final state';
  const fallback = buildFallbackPrompt(cfg, scene, suffix);
  log.warn('[帧提示词] JSON 解析失败，使用 FALLBACK prompt:\n' + fallback);
  return {
    prompt: fallback,
    description: frameKind === 'last' ? '镜头结束画面，展示最终状态和结果' : frameKind === 'key' ? '动作高潮瞬间，展示关键动作' : '镜头开始的静态画面，展示初始状态',
  };
}

async function processFramePromptGeneration(db, log, taskId, storyboardId, frameType, panelCount, model) {
  let cfg = loadConfig();
  taskService.updateTaskStatus(db, taskId, 'processing', 0, '正在生成帧提示词...');

  const sb = loadStoryboard(db, storyboardId);
  if (!sb) {
    taskService.updateTaskError(db, taskId, '分镜信息不存在');
    log.error('Frame prompt: storyboard not found', { storyboard_id: storyboardId });
    return;
  }

  // 通过 storyboard → episode → drama 链路读取项目 style 和 aspect_ratio
  try {
    const epRow = db.prepare(
      'SELECT drama_id FROM episodes WHERE id = (SELECT episode_id FROM storyboards WHERE id = ? AND deleted_at IS NULL) AND deleted_at IS NULL'
    ).get(Number(storyboardId));
    if (epRow && epRow.drama_id) {
      const dramaRow = db.prepare('SELECT style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(epRow.drama_id);
      if (dramaRow) {
        const { mergeCfgStyleWithDrama } = require('../utils/dramaStyleMerge');
        let next = { ...cfg, style: { ...(cfg?.style || {}) } };
        if (dramaRow.metadata) {
          const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
          if (meta && meta.aspect_ratio) {
            next.style.default_image_ratio = meta.aspect_ratio;
            next.style.default_video_ratio = meta.aspect_ratio;
          }
        }
        cfg = mergeCfgStyleWithDrama(next, dramaRow);
      }
    }
  } catch (_) {}

  const scene = loadScene(db, sb.scene_id);
  const characterNames = loadStoryboardCharacterNames(db, storyboardId);

  const storyboardIdStr = String(storyboardId);
  let combinedPrompt = '';
  let description = '';
  let layout = '';

  try {
    if (frameType === 'first' || frameType === 'key' || frameType === 'last') {
      const frameKind = frameType;
      const single = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, frameKind);
      saveFramePrompt(db, log, storyboardId, frameType, single.prompt, single.description, '');
      combinedPrompt = single.prompt;
      description = single.description;
    } else if (frameType === 'panel') {
      const count = panelCount || 3;
      layout = `horizontal_${count}`;
      const prompts = [];
      if (count === 3) {
        const first = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'first');
        const key = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'key');
        const last = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'last');
        prompts.push(first.prompt, key.prompt, last.prompt);
        description = '分镜板组合提示词';
      } else if (count === 4) {
        const first = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'first');
        const key1 = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'key');
        const key2 = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'key');
        const last = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'last');
        prompts.push(first.prompt, key1.prompt, key2.prompt, last.prompt);
        description = '分镜板组合提示词';
      } else {
        prompts.push((await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'first')).prompt);
        for (let i = 0; i < count - 2; i++) {
          prompts.push((await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'key')).prompt);
        }
        prompts.push((await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'last')).prompt);
        description = '分镜板组合提示词';
      }
      combinedPrompt = prompts.join('\n---\n');
      saveFramePrompt(db, log, storyboardId, frameType, combinedPrompt, description, layout);
    } else if (frameType === 'action') {
      layout = 'horizontal_5';
      const first = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'first');
      const key1 = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'key');
      const key2 = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'key');
      const key3 = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'key');
      const last = await generateSingleFrame(db, log, cfg, sb, scene, characterNames, model, 'last');
      combinedPrompt = [first.prompt, key1.prompt, key2.prompt, key3.prompt, last.prompt].join('\n---\n');
      description = '动作序列组合提示词';
      saveFramePrompt(db, log, storyboardId, frameType, combinedPrompt, description, layout);
    } else {
      taskService.updateTaskError(db, taskId, '不支持的帧类型');
      log.error('Frame prompt: unsupported frame_type', { frame_type: frameType });
      return;
    }

    taskService.updateTaskResult(db, taskId, {
      storyboard_id: storyboardIdStr,
      frame_type: frameType,
      response: { frame_type: frameType, single_frame: combinedPrompt ? { prompt: combinedPrompt, description } : undefined, layout: layout || undefined },
    });
    log.info('Frame prompt generation completed', { task_id: taskId, storyboard_id: storyboardId, frame_type: frameType });
  } catch (err) {
    log.error('Frame prompt generation error', { task_id: taskId, error: err.message });
    taskService.updateTaskError(db, taskId, err.message || '生成失败');
  }
}

function generateFramePrompt(db, log, storyboardId, frameType, panelCount, model) {
  const sid = Number(storyboardId);
  const sb = db.prepare('SELECT id FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(sid);
  if (!sb) {
    throw new Error('分镜不存在');
  }
  const validTypes = FRAME_TYPES.includes(frameType);
  if (!validTypes) {
    throw new Error('不支持的 frame_type，可选: first, key, last, panel, action');
  }
  const task = taskService.createTask(db, log, 'frame_prompt_generation', String(storyboardId));
  setImmediate(() => {
    processFramePromptGeneration(db, log, task.id, storyboardId, frameType, panelCount || 0, model);
  });
  log.info('Frame prompt task created', { task_id: task.id, storyboard_id: storyboardId, frame_type: frameType });
  return task.id;
}

module.exports = {
  generateFramePrompt,
  loadStoryboard,
  loadStoryboardCharacterNames,
  loadScene,
  buildCharacterAnchorText,
  getFramePrompts: (db, storyboardId) => storyboardService.getFramePrompts(db, storyboardId),
  generateSingleFrameExported: generateSingleFrame,
  expandAngleDescription,
};
