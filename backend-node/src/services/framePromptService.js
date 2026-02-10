// 与 Go application/services/frame_prompt_service.go 对齐：生成首帧/关键帧/尾帧/分镜板/动作序列提示词
const loadConfig = require('../config').loadConfig;
const promptI18n = require('./promptI18n');
const aiClient = require('./aiClient');
const taskService = require('./taskService');
const storyboardService = require('./storyboardService');

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

function loadStoryboardCharacterNames(db, storyboardId) {
  const links = db.prepare('SELECT character_id FROM storyboard_characters WHERE storyboard_id = ?').all(Number(storyboardId));
  if (!links.length) return [];
  const ids = links.map((r) => r.character_id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, name FROM character_libraries WHERE id IN (${placeholders}) AND deleted_at IS NULL`).all(...ids);
  return rows.map((r) => r.name);
}

function loadScene(db, sceneId) {
  if (sceneId == null) return null;
  const row = db.prepare('SELECT id, location, time FROM scenes WHERE id = ? AND deleted_at IS NULL').get(Number(sceneId));
  return row ? { id: row.id, location: row.location, time: row.time } : null;
}

function buildStoryboardContext(cfg, sb, scene, characterNames) {
  const parts = [];
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
  if (sb.angle) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'angle_label', sb.angle));
  }
  if (sb.movement) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'movement_label', sb.movement));
  }
  return parts.join('\n');
}

function buildFallbackPrompt(sb, scene, suffix) {
  const parts = [];
  if (scene) {
    parts.push(`${scene.location}, ${scene.time}`);
  }
  return parts.join(', ') + (parts.length ? ', ' : '') + 'anime style, ' + suffix;
}

function parseFramePromptJSON(log, aiResponse) {
  let cleaned = (aiResponse || '').trim();
  const jsonBlock = /```json\s*([\s\S]*?)\s*```/.exec(cleaned);
  if (jsonBlock) {
    cleaned = jsonBlock[1].trim();
  } else {
    cleaned = cleaned.replace(/^`+|`+$/g, '').trim();
  }
  try {
    const data = JSON.parse(cleaned);
    if (data && typeof data.prompt === 'string') {
      return { prompt: data.prompt, description: data.description || '' };
    }
  } catch (e) {
    log.warn('Frame prompt JSON parse failed', { error: e.message, cleaned: cleaned.slice(0, 200) });
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
  let aiResponse;
  try {
    aiResponse = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, { model: model || undefined, max_tokens: 800 });
  } catch (err) {
    log.warn('Frame prompt AI failed, using fallback', { error: err.message });
    const suffix = frameKind === 'first' ? 'first frame, static shot' : frameKind === 'key' ? 'key frame, dynamic action' : 'last frame, final state';
    const prompt = buildFallbackPrompt(sb, scene, suffix);
    const desc =
      frameKind === 'first'
        ? '镜头开始的静态画面，展示初始状态'
        : frameKind === 'key'
          ? '动作高潮瞬间，展示关键动作'
          : '镜头结束画面，展示最终状态和结果';
    return { prompt, description: desc };
  }
  const parsed = parseFramePromptJSON(log, aiResponse);
  if (parsed) return parsed;
  const suffix = frameKind === 'first' ? 'first frame, static shot' : frameKind === 'key' ? 'key frame, dynamic action' : 'last frame, final state';
  return {
    prompt: buildFallbackPrompt(sb, scene, suffix),
    description: frameKind === 'last' ? '镜头结束画面，展示最终状态和结果' : frameKind === 'key' ? '动作高潮瞬间，展示关键动作' : '镜头开始的静态画面，展示初始状态',
  };
}

async function processFramePromptGeneration(db, log, taskId, storyboardId, frameType, panelCount, model) {
  const cfg = loadConfig();
  taskService.updateTaskStatus(db, taskId, 'processing', 0, '正在生成帧提示词...');

  const sb = loadStoryboard(db, storyboardId);
  if (!sb) {
    taskService.updateTaskError(db, taskId, '分镜信息不存在');
    log.error('Frame prompt: storyboard not found', { storyboard_id: storyboardId });
    return;
  }

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
  getFramePrompts: (db, storyboardId) => storyboardService.getFramePrompts(db, storyboardId),
};
