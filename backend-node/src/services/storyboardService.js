// 分镜：create, update, delete；帧提示词 get/save
function createStoryboard(db, log, req) {
  const now = new Date().toISOString();
  const episodeId = Number(req.episode_id);
  const num = Number(req.storyboard_number ?? 0) || 0;
  const info = db.prepare(
    `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, action, atmosphere, image_prompt, video_prompt, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    episodeId,
    req.scene_id ?? null,
    num,
    req.title ?? null,
    req.description ?? null,
    req.location ?? null,
    req.time ?? null,
    req.duration ?? 0,
    req.dialogue ?? null,
    req.action ?? null,
    req.atmosphere ?? null,
    req.image_prompt ?? null,
    req.video_prompt ?? null,
    now,
    now
  );
  log.info('Storyboard created', { id: info.lastInsertRowid, episode_id: episodeId });
  return getStoryboardById(db, info.lastInsertRowid);
}

function updateStoryboard(db, log, id, req) {
  const row = db.prepare('SELECT id FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!row) return null;
  const allowed = ['title', 'description', 'location', 'time', 'duration', 'dialogue', 'action', 'atmosphere', 'image_prompt', 'video_prompt', 'scene_id', 'characters', 'composed_image', 'video_url', 'status', 'shot_type', 'angle', 'movement'];
  const updates = [];
  const params = [];
  // 前端可能传 character_ids，与 characters 统一：存为 JSON 字符串
  const charactersValue = req.character_ids !== undefined ? req.character_ids : req.characters;
  if (charactersValue !== undefined) {
    updates.push('characters = ?');
    params.push(Array.isArray(charactersValue) ? JSON.stringify(charactersValue) : (typeof charactersValue === 'string' ? charactersValue : '[]'));
  }
  for (const key of allowed) {
    if (key === 'characters') continue;
    if (req[key] !== undefined) {
      updates.push(key + ' = ?');
      const val = req[key];
      params.push(val);
    }
  }
  if (updates.length === 0) return getStoryboardById(db, id);
  params.push(new Date().toISOString(), id);
  db.prepare('UPDATE storyboards SET ' + updates.join(', ') + ', updated_at = ? WHERE id = ?').run(...params);
  log.info('Storyboard updated', { id });
  return getStoryboardById(db, id);
}

function deleteStoryboard(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE storyboards SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  if (result.changes === 0) return false;
  log.info('Storyboard deleted', { id });
  return true;
}

function getStoryboardById(db, id) {
  const r = db.prepare('SELECT * FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!r) return null;
  let characters = [];
  if (r.characters) {
    if (typeof r.characters === 'string') {
      try { characters = JSON.parse(r.characters); } catch (_) {}
    } else if (Array.isArray(r.characters)) characters = r.characters;
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
    duration: r.duration ?? 0,
    dialogue: r.dialogue,
    action: r.action,
    atmosphere: r.atmosphere,
    image_prompt: r.image_prompt,
    video_prompt: r.video_prompt,
    shot_type: r.shot_type,
    angle: r.angle,
    movement: r.movement,
    characters,
    composed_image: r.composed_image,
    video_url: r.video_url,
    status: r.status || 'pending',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function getFramePrompts(db, storyboardId) {
  const rows = db.prepare(
    'SELECT * FROM frame_prompts WHERE storyboard_id = ? ORDER BY created_at ASC'
  ).all(Number(storyboardId));
  return rows.map((r) => ({
    id: r.id,
    storyboard_id: r.storyboard_id,
    frame_type: r.frame_type,
    prompt: r.prompt,
    description: r.description,
    layout: r.layout,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

function saveFramePrompt(db, log, storyboardId, frameType, prompt, description, layout) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM frame_prompts WHERE storyboard_id = ? AND frame_type = ?').get(Number(storyboardId), frameType);
  if (existing) {
    db.prepare('UPDATE frame_prompts SET prompt = ?, description = ?, layout = ?, updated_at = ? WHERE id = ?').run(
      prompt,
      description ?? null,
      layout ?? null,
      now,
      existing.id
    );
    return getFramePrompts(db, storyboardId);
  }
  db.prepare(
    `INSERT INTO frame_prompts (storyboard_id, frame_type, prompt, description, layout, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(Number(storyboardId), frameType, prompt, description ?? null, layout ?? null, now, now);
  log.info('Frame prompt saved', { storyboard_id: storyboardId, frame_type: frameType });
  return getFramePrompts(db, storyboardId);
}

module.exports = {
  createStoryboard,
  updateStoryboard,
  deleteStoryboard,
  getStoryboardById,
  getFramePrompts,
  saveFramePrompt,
};
