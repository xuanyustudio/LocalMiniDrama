export function dramaThreadId(dramaId) {
  return `drama-${Number(dramaId)}`;
}

export function resolveEpisode(db, dramaId, episodeId) {
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(Number(dramaId));
  if (!drama) return { ok: false, error: '项目不存在' };

  if (episodeId != null && episodeId !== '') {
    const episode = db.prepare(
      'SELECT id FROM episodes WHERE id = ? AND drama_id = ? AND deleted_at IS NULL'
    ).get(Number(episodeId), Number(dramaId));
    if (!episode) return { ok: false, error: '这一集不属于当前项目' };
    return { ok: true, episodeId: episode.id };
  }

  const episodes = db.prepare(
    'SELECT id FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number ASC, id ASC'
  ).all(Number(dramaId));
  if (episodes.length === 0) return { ok: false, error: '这部剧还没有分集' };
  if (episodes.length === 1) return { ok: true, episodeId: episodes[0].id };
  return { ok: false, error: '请指定哪一集' };
}

export function assertOwned(db, dramaId, type, id) {
  const dramaIdNum = Number(dramaId);
  if (type === 'character') {
    const row = db.prepare(
      'SELECT id, name, drama_id FROM characters WHERE id = ? AND deleted_at IS NULL'
    ).get(Number(id));
    if (!row || Number(row.drama_id) !== dramaIdNum) return { ok: false, error: '这个角色不属于当前项目' };
    return { ok: true, label: row.name || String(id) };
  }
  if (type === 'scene') {
    const row = db.prepare(
      'SELECT id, location, drama_id FROM scenes WHERE id = ? AND deleted_at IS NULL'
    ).get(Number(id));
    if (!row || Number(row.drama_id) !== dramaIdNum) return { ok: false, error: '这个场景不属于当前项目' };
    return { ok: true, label: row.location || String(id) };
  }
  if (type === 'storyboard') {
    const row = db.prepare(
      `SELECT s.id, s.storyboard_number, e.drama_id
       FROM storyboards s
       JOIN episodes e ON e.id = s.episode_id
       WHERE s.id = ? AND s.deleted_at IS NULL AND e.deleted_at IS NULL`
    ).get(Number(id));
    if (!row || Number(row.drama_id) !== dramaIdNum) return { ok: false, error: '这个分镜不属于当前项目' };
    return { ok: true, label: String(row.storyboard_number) };
  }
  if (type === 'task') {
    const row = db.prepare(
      'SELECT id, type, resource_id FROM async_tasks WHERE id = ? AND deleted_at IS NULL'
    ).get(String(id));
    if (!row) return { ok: false, error: '任务不存在' };
    const resource = String(row.resource_id);
    if (resource === String(dramaIdNum)) return { ok: true, label: row.type || String(id) };
    const episode = db.prepare(
      'SELECT id FROM episodes WHERE id = ? AND drama_id = ? AND deleted_at IS NULL'
    ).get(Number(resource), dramaIdNum);
    if (episode) return { ok: true, label: row.type || String(id) };
    return { ok: false, error: '这个任务不属于当前项目' };
  }
  return { ok: false, error: '未知类型' };
}

export function validateChatBody(db, body) {
  const message = body && typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return { ok: false, status: 400, message: '请输入内容' };
  const dramaId = Number(body && body.dramaId);
  if (!Number.isInteger(dramaId) || dramaId <= 0) return { ok: false, status: 400, message: '项目不存在' };
  const drama = db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(dramaId);
  if (!drama) return { ok: false, status: 400, message: '项目不存在' };
  if (body.episodeId == null || body.episodeId === '') {
    return { ok: true, dramaId, episodeId: null };
  }
  const episode = db.prepare(
    'SELECT id FROM episodes WHERE id = ? AND drama_id = ? AND deleted_at IS NULL'
  ).get(Number(body.episodeId), dramaId);
  if (!episode) return { ok: false, status: 400, message: '这一集不属于当前项目' };
  return { ok: true, dramaId, episodeId: episode.id };
}
