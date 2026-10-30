import { createRequire } from 'module';
import { assertOwned, resolveEpisode } from './context.mjs';

function fail(error) {
  return { ok: false, error };
}

function dramaRow(db, dramaId) {
  return db.prepare(
    'SELECT id, title, style, metadata, description FROM dramas WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(dramaId));
}

function listEpisodes(db, dramaId) {
  return db.prepare(
    `SELECT id, episode_number, title FROM episodes
     WHERE drama_id = ? AND deleted_at IS NULL
     ORDER BY episode_number ASC, id ASC`
  ).all(Number(dramaId));
}

function clip(text, max) {
  const value = String(text || '');
  return value.length > max ? value.slice(0, max) : value;
}

export function executeGetCurrentProject(db, dramaId, episodeId) {
  const drama = dramaRow(db, dramaId);
  if (!drama) return fail('项目不存在');
  const episodes = listEpisodes(db, dramaId);
  let resolvedId = null;
  let episodeSpecified = false;
  if (episodeId != null && episodeId !== '') {
    const resolved = resolveEpisode(db, dramaId, episodeId);
    if (!resolved.ok) return resolved;
    resolvedId = resolved.episodeId;
    episodeSpecified = true;
  } else if (episodes.length === 1) {
    resolvedId = episodes[0].id;
    episodeSpecified = true;
  }

  let aspectRatio = '';
  try {
    const meta = drama.metadata ? JSON.parse(drama.metadata) : null;
    aspectRatio = meta && meta.aspect_ratio ? meta.aspect_ratio : '';
  } catch (_) {}

  let script = '';
  let scriptTruncated = false;
  let storyboards = [];
  if (resolvedId != null) {
    const episode = db.prepare('SELECT script_content FROM episodes WHERE id = ?').get(resolvedId);
    const full = episode && episode.script_content ? episode.script_content : '';
    script = clip(full, 12000);
    scriptTruncated = full.length > 12000;
    storyboards = db.prepare(
      `SELECT id, storyboard_number, description, image_prompt FROM storyboards
       WHERE episode_id = ? AND deleted_at IS NULL
       ORDER BY storyboard_number ASC, id ASC`
    ).all(resolvedId).map((row) => ({
      id: row.id,
      number: row.storyboard_number,
      summary: clip(row.description || row.image_prompt || '', 200),
      hasImage: false,
    }));
  }

  const characters = db.prepare(
    `SELECT id, name, role, image_url, local_path FROM characters
     WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id ASC`
  ).all(Number(dramaId)).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    hasImage: Boolean(row.image_url || row.local_path),
  }));
  const scenes = db.prepare(
    `SELECT id, location, image_url, local_path FROM scenes
     WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id ASC`
  ).all(Number(dramaId)).map((row) => ({
    id: row.id,
    location: row.location,
    hasImage: Boolean(row.image_url || row.local_path),
  }));

  return {
    ok: true,
    summary: `项目《${drama.title || ''}》`,
    project: {
      id: drama.id,
      title: drama.title,
      style: drama.style,
      aspectRatio,
      episodes: episodes.map((ep) => ({ id: ep.id, number: ep.episode_number, title: ep.title })),
      episodeSpecified,
      script,
      scriptTruncated,
      characters,
      scenes,
      storyboards,
    },
  };
}

export function executeSaveEpisodeScript(db, dramaId, episodeId, input) {
  const drama = dramaRow(db, dramaId);
  if (!drama) return fail('项目不存在');
  const scriptContent = input && input.scriptContent != null ? String(input.scriptContent) : '';
  const episodes = listEpisodes(db, dramaId);
  let targetId = episodeId;
  if (targetId == null || targetId === '') {
    if (episodes.length === 0) {
      const info = db.prepare(
        `INSERT INTO episodes (drama_id, episode_number, title, script_content, description)
         VALUES (?, 1, ?, ?, ?)`
      ).run(Number(dramaId), (input && input.title) || '', scriptContent, (input && input.description) || null);
      return { ok: true, id: Number(info.lastInsertRowid), summary: '已创建第 1 集并写入剧本' };
    }
    if (episodes.length > 1) return fail('请指定哪一集');
    targetId = episodes[0].id;
  } else {
    const resolved = resolveEpisode(db, dramaId, targetId);
    if (!resolved.ok) return resolved;
    targetId = resolved.episodeId;
  }
  const existing = db.prepare('SELECT title, description FROM episodes WHERE id = ? AND drama_id = ?').get(targetId, Number(dramaId));
  if (!existing) return fail('这一集不属于当前项目');
  db.prepare(
    `UPDATE episodes SET title = ?, script_content = ?, description = ? WHERE id = ? AND drama_id = ?`
  ).run(
    input && input.title != null ? input.title : existing.title,
    scriptContent,
    input && input.description != null ? input.description : existing.description,
    targetId,
    Number(dramaId)
  );
  return { ok: true, id: targetId, summary: '已保存剧本' };
}

function requireService(name) {
  return createRequire(import.meta.url)(`../services/${name}`);
}

function needEpisode(db, dramaId, episodeId) {
  return resolveEpisode(db, dramaId, episodeId == null || episodeId === '' ? null : episodeId);
}

export function executeUpdateCharacter(db, log, dramaId, episodeId, input) {
  const data = input || {};
  if (data.id != null) {
    const owned = assertOwned(db, dramaId, 'character', data.id);
    if (!owned.ok) return owned;
    const patch = {};
    for (const key of ['name', 'role', 'appearance', 'personality', 'description']) {
      if (data[key] != null) patch[key] = data[key];
    }
    const result = requireService('characterLibraryService.js').updateCharacter(db, log, data.id, patch);
    if (!result || result.ok === false) return fail((result && result.error) || '更新角色失败');
    return { ok: true, id: Number(data.id), name: patch.name, summary: '已更新角色' };
  }
  const episode = needEpisode(db, dramaId, episodeId);
  if (!episode.ok) return episode;
  if (!data.name) return fail('请提供角色名字');
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO characters (drama_id, name, role, description, personality, appearance, image_url, local_path, negative_prompt, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?)`
  ).run(Number(dramaId), data.name, data.role ?? null, data.description ?? null, data.personality ?? null, data.appearance ?? null, now, now);
  const id = Number(info.lastInsertRowid);
  db.prepare('INSERT OR IGNORE INTO episode_characters (episode_id, character_id) VALUES (?, ?)').run(episode.episodeId, id);
  return { ok: true, id, name: data.name, summary: '已新建角色' };
}

export function executeUpdateScene(db, log, dramaId, episodeId, input) {
  const data = input || {};
  const sceneService = requireService('sceneService.js');
  if (data.id != null) {
    const owned = assertOwned(db, dramaId, 'scene', data.id);
    if (!owned.ok) return owned;
    const patch = {};
    for (const key of ['location', 'time', 'prompt']) {
      if (data[key] != null) patch[key] = data[key];
    }
    const result = sceneService.updateScene(db, log, data.id, patch);
    if (!result || result.ok === false) return fail((result && result.error) || '更新场景失败');
    return { ok: true, id: Number(data.id), name: patch.location, summary: '已更新场景' };
  }
  const episode = needEpisode(db, dramaId, episodeId);
  if (!episode.ok) return episode;
  const created = sceneService.createSceneForEpisode(db, log, dramaId, episode.episodeId, {
    location: data.location || '',
    time: data.time || '',
    prompt: data.prompt || '',
  });
  return { ok: true, id: created.id, name: created.location, summary: '已新建场景' };
}

export function executeUpdateStoryboard(db, log, dramaId, input) {
  const data = input || {};
  const owned = assertOwned(db, dramaId, 'storyboard', data.id);
  if (!owned.ok) return owned;
  const patch = {};
  if (data.dialogue != null) patch.dialogue = data.dialogue;
  if (data.action != null) patch.action = data.action;
  if (data.description != null) patch.description = data.description;
  if (data.imagePrompt != null) patch.image_prompt = data.imagePrompt;
  const updated = requireService('storyboardService.js').updateStoryboard(db, log, data.id, patch);
  if (!updated) return fail('更新分镜失败');
  return { ok: true, id: Number(data.id), summary: '已更新分镜' };
}

function taskResult(value, summary) {
  const taskId = value && typeof value === 'object' && value.task_id != null ? value.task_id : value;
  return { ok: true, taskId: String(taskId), summary };
}

function runTask(fn) {
  try {
    return fn();
  } catch (err) {
    return fail(err.message || '执行失败');
  }
}

export function executeGenerateStory(db, log, dramaId, deps) {
  return runTask(() => taskResult(deps.startStoryGeneration(db, log, { drama_id: Number(dramaId) }), '已开始生成剧本'));
}

export function executeGenerateCharacters(db, cfg, log, dramaId, episodeId, deps) {
  const episode = needEpisode(db, dramaId, episodeId);
  if (!episode.ok) return episode;
  return runTask(() => taskResult(
    deps.generateCharacters(db, cfg, log, { drama_id: Number(dramaId), episode_id: episode.episodeId }),
    '已开始生成角色'
  ));
}

export function executeGenerateScenes(db, cfg, log, dramaId, episodeId, deps) {
  const episode = needEpisode(db, dramaId, episodeId);
  if (!episode.ok) return episode;
  return runTask(() => taskResult(
    deps.extractBackgroundsForEpisode(db, cfg, log, episode.episodeId, undefined, undefined, undefined),
    '已开始提取场景'
  ));
}

export function executeGenerateStoryboards(db, log, dramaId, episodeId, input, deps) {
  const episode = needEpisode(db, dramaId, episodeId);
  if (!episode.ok) return episode;
  const count = input && input.storyboardCount != null ? input.storyboardCount : undefined;
  return runTask(() => taskResult(
    deps.generateStoryboard(db, log, episode.episodeId, undefined, undefined, count, undefined, undefined, false, false),
    '已开始生成分镜'
  ));
}

export async function executeGenerateImage(db, log, cfg, dramaId, input, deps) {
  const data = input || {};
  const owned = assertOwned(db, dramaId, data.type, data.id);
  if (!owned.ok) return owned;
  try {
    if (data.type === 'character') {
      const image = await deps.generateCharacterFourViewImage(db, log, cfg, data.id, undefined, undefined);
      return {
        ok: true,
        id: Number(data.id),
        imageUrl: image && (image.image_url || image.imageUrl) || '',
        localPath: image && (image.local_path || image.localPath) || '',
        summary: '已生成角色图',
      };
    }
    if (data.type === 'scene') {
      const generate = data.view === 'four' ? deps.generateSceneFourViewImage : deps.generateSceneSingleImage;
      const image = await generate(db, log, cfg, data.id, undefined, undefined);
      return {
        ok: true,
        id: Number(data.id),
        imageUrl: image && (image.image_url || image.imageUrl) || '',
        localPath: image && (image.local_path || image.localPath) || '',
        summary: '已生成场景图',
      };
    }
    if (data.type === 'storyboard') {
      let prompt = data.prompt;
      if (prompt) deps.updateStoryboard(db, log, data.id, { image_prompt: prompt });
      else {
        const row = db.prepare('SELECT image_prompt FROM storyboards WHERE id = ?').get(Number(data.id));
        prompt = row && row.image_prompt ? row.image_prompt : '';
      }
      const created = await deps.createImage(db, log, {
        drama_id: Number(dramaId),
        storyboard_id: Number(data.id),
        prompt,
      });
      return taskResult(created, '已开始生成分镜图');
    }
    return fail('不支持的出图类型');
  } catch (err) {
    return fail(err.message || '出图失败');
  }
}

export function executeGetTask(db, dramaId, input) {
  const owned = assertOwned(db, dramaId, 'task', input && input.taskId);
  if (!owned.ok) return owned;
  const row = db.prepare(
    'SELECT id, type, status, message, error FROM async_tasks WHERE id = ? AND deleted_at IS NULL'
  ).get(String(input.taskId));
  if (!row) return fail('任务不存在');
  return { ok: true, taskId: row.id, summary: `${row.type || '任务'}：${row.status || ''}` };
}

export const deleteItemSpec = { id: 'delete_item', requireApproval: true };

export function executeDeleteItem(db, log, dramaId, input) {
  const data = input || {};
  const owned = assertOwned(db, dramaId, data.type, data.id);
  if (!owned.ok) return owned;
  if (data.type === 'character') {
    const result = requireService('characterLibraryService.js').deleteCharacter(db, log, data.id);
    if (!result || result.ok === false) return fail((result && result.error) || '删除角色失败');
  } else if (data.type === 'scene') {
    const result = requireService('sceneService.js').deleteScene(db, log, data.id);
    if (!result || result.ok === false) return fail((result && result.error) || '删除场景失败');
  } else if (data.type === 'storyboard') {
    const result = requireService('storyboardService.js').deleteStoryboard(db, log, data.id);
    if (!result) return fail('删除分镜失败');
  } else {
    return fail('不支持的删除类型');
  }
  return { ok: true, id: Number(data.id), name: owned.label, summary: '已删除' };
}
