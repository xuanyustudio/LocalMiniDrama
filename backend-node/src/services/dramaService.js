// 对应 Go application/services/drama_service.go

function createDrama(db, log, req) {
  const now = new Date().toISOString();
  const metadataStr = req.metadata ? (typeof req.metadata === 'string' ? req.metadata : JSON.stringify(req.metadata)) : null;
  const stmt = db.prepare(`
    INSERT INTO dramas (title, description, genre, style, metadata, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
  `);
  const info = stmt.run(
    req.title || '',
    req.description || null,
    req.genre || null,
    req.style || 'realistic',
    metadataStr,
    now,
    now
  );
  const id = info.lastInsertRowid;
  log.info('Drama created', { drama_id: id });
  return getDramaById(db, id);
}

function getDramaById(db, id) {
  const row = db.prepare('SELECT * FROM dramas WHERE id = ? AND deleted_at IS NULL').get(id);
  return row ? rowToDrama(row) : null;
}

function getDrama(db, dramaId, baseUrl) {
  const drama = getDramaById(db, Number(dramaId));
  if (!drama) return null;
  // 加载 episodes、characters、scenes、props、storyboards（简化：只查当前 drama 的）
  const episodes = db.prepare(
    'SELECT * FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number ASC'
  ).all(drama.id);
  drama.episodes = episodes.map((e) => rowToEpisode(e));
  for (const ep of drama.episodes) {
    const storyboards = db.prepare(
      'SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number ASC'
    ).all(ep.id);
    ep.storyboards = storyboards.map((s) => rowToStoryboard(s));
    ep.duration = ep.storyboards.reduce((sum, s) => sum + (s.duration || 0), 0);
    if (ep.duration > 0) ep.duration = Math.ceil(ep.duration / 60); // 转为分钟
    // 本集关联的角色（与 Go Preload("Episodes.Characters") 一致）
    try {
      const epChars = db.prepare(
        `SELECT c.* FROM characters c
         INNER JOIN episode_characters ec ON c.id = ec.character_id
         WHERE ec.episode_id = ? AND c.deleted_at IS NULL
         ORDER BY c.sort_order ASC, c.name ASC`
      ).all(ep.id);
      ep.characters = epChars.map((c) => rowToCharacter(c));
    } catch (_) {
      ep.characters = [];
    }
    // 本集关联的场景（与 Go Preload("Episodes.Scenes") 一致，用于提取完成后展示）
    try {
      const epScenes = db.prepare(
        'SELECT * FROM scenes WHERE episode_id = ? AND deleted_at IS NULL ORDER BY id ASC'
      ).all(ep.id);
      ep.scenes = epScenes.map((s) => rowToScene(s));
    } catch (_) {
      ep.scenes = [];
    }
    // 本集关联的道具：本集提取的（episode_id=本集）+ 本集分镜中出现的（storyboard_props），合并去重
    try {
      const byEpisode = db.prepare(
        'SELECT * FROM props WHERE episode_id = ? AND deleted_at IS NULL ORDER BY id ASC'
      ).all(ep.id);
      const byStoryboard = db.prepare(
        `SELECT DISTINCT p.* FROM props p
         INNER JOIN storyboard_props sp ON p.id = sp.prop_id
         INNER JOIN storyboards sb ON sb.id = sp.storyboard_id AND sb.episode_id = ? AND sb.deleted_at IS NULL
         WHERE p.deleted_at IS NULL ORDER BY p.id ASC`
      ).all(ep.id);
      const seen = new Set();
      ep.props = [];
      for (const p of byEpisode) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          ep.props.push(rowToProp(p));
        }
      }
      for (const p of byStoryboard) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          ep.props.push(rowToProp(p));
        }
      }
      ep.props.sort((a, b) => a.id - b.id);
    } catch (_) {
      ep.props = [];
    }
  }
  const characters = db.prepare(
    'SELECT * FROM characters WHERE drama_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC'
  ).all(drama.id);
  drama.characters = characters.map((c) => rowToCharacter(c));
  const scenes = db.prepare(
    'SELECT * FROM scenes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id ASC'
  ).all(drama.id);
  drama.scenes = scenes.map((s) => rowToScene(s));
  const props = db.prepare(
    'SELECT * FROM props WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id ASC'
  ).all(drama.id);
  drama.props = props.map((p) => rowToProp(p));
  return drama;
}

function listDramas(db, query) {
  let sql = 'FROM dramas WHERE deleted_at IS NULL';
  const params = [];
  if (query.status) {
    sql += ' AND status = ?';
    params.push(query.status);
  }
  if (query.genre) {
    sql += ' AND genre = ?';
    params.push(query.genre);
  }
  if (query.keyword) {
    sql += ' AND (title LIKE ? OR description LIKE ?)';
    const k = '%' + query.keyword + '%';
    params.push(k, k);
  }
  const countRow = db.prepare('SELECT COUNT(*) as total ' + sql).get(...params);
  const total = countRow.total || 0;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.page_size, 10) || 20));
  const offset = (page - 1) * pageSize;
  const list = db.prepare(
    'SELECT * ' + sql + ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).all(...params, pageSize, offset);
  const dramas = list.map((r) => rowToDrama(r));
  for (const d of dramas) {
    const episodes = db.prepare(
      'SELECT * FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number ASC'
    ).all(d.id);
    d.episodes = episodes.map((e) => {
      const ep = rowToEpisode(e);
      const storyboards = db.prepare(
        'SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number ASC'
      ).all(ep.id);
      ep.storyboards = storyboards.map((s) => rowToStoryboard(s));
      ep.duration = ep.storyboards.reduce((sum, s) => sum + (s.duration || 0), 0);
      if (ep.duration > 0) ep.duration = Math.ceil(ep.duration / 60);
      return ep;
    });
  }
  return { dramas, total, page, pageSize };
}

function updateDrama(db, log, dramaId, req) {
  const drama = getDramaById(db, Number(dramaId));
  if (!drama) return null;
  const updates = [];
  const params = [];
  if (req.title != null) {
    updates.push('title = ?');
    params.push(req.title);
  }
  if (req.description != null) {
    updates.push('description = ?');
    params.push(req.description || null);
  }
  if (req.genre != null) {
    updates.push('genre = ?');
    params.push(req.genre || null);
  }
  if (req.status != null) {
    updates.push('status = ?');
    params.push(req.status);
  }
  if (updates.length === 0) return drama;
  params.push(new Date().toISOString(), dramaId);
  db.prepare(
    'UPDATE dramas SET ' + updates.join(', ') + ', updated_at = ? WHERE id = ?'
  ).run(...params);
  log.info('Drama updated', { drama_id: dramaId });
  return getDramaById(db, dramaId);
}

function generateStoryboard(db, log, episodeId, options) {
  const episodeStoryboardService = require('./episodeStoryboardService');
  const { model, style, storyboard_count, video_duration, aspect_ratio } = options || {};
  // 转换可能为字符串的数字
  const count = storyboard_count ? Number(storyboard_count) : undefined;
  const duration = video_duration ? Number(video_duration) : undefined;
  return episodeStoryboardService.generateStoryboard(db, log, episodeId, model || undefined, style, count, duration, aspect_ratio);
}

function deleteDrama(db, log, dramaId) {
  const result = db.prepare('UPDATE dramas SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(
    new Date().toISOString(),
    Number(dramaId)
  );
  if (result.changes === 0) return false;
  log.info('Drama deleted', { drama_id: dramaId });
  return true;
}

function getDramaStats(db) {
  const total = db.prepare('SELECT COUNT(*) as c FROM dramas WHERE deleted_at IS NULL').get().c;
  const byStatus = db.prepare(
    'SELECT status, COUNT(*) as count FROM dramas WHERE deleted_at IS NULL GROUP BY status'
  ).all();
  return { total, by_status: byStatus };
}

function rowToDrama(r) {
  let metadata = r.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch (e) {
      metadata = {};
    }
  }
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    genre: r.genre,
    style: r.style || 'realistic',
    total_episodes: r.total_episodes ?? 1,
    total_duration: r.total_duration ?? 0,
    status: r.status || 'draft',
    thumbnail: r.thumbnail,
    tags: r.tags,
    metadata: metadata || {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function rowToEpisode(r) {
  return {
    id: r.id,
    drama_id: r.drama_id,
    episode_number: r.episode_number,
    title: r.title,
    script_content: r.script_content,
    description: r.description,
    duration: r.duration ?? 0,
    status: r.status || 'draft',
    video_url: r.video_url,
    thumbnail: r.thumbnail,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function parseStoryboardCharacters(charactersStr) {
  if (!charactersStr || typeof charactersStr !== 'string') return [];
  try {
    const parsed = JSON.parse(charactersStr);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => (typeof c === 'object' && c != null && c.id != null ? Number(c.id) : Number(c))).filter((n) => Number.isFinite(n));
  } catch (_) {
    return [];
  }
}

function rowToStoryboard(r) {
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
    shot_type: r.shot_type ?? null,
    angle: r.angle ?? null,
    movement: r.movement ?? null,
    characters: parseStoryboardCharacters(r.characters),
    composed_image: r.composed_image,
    video_url: r.video_url,
    status: r.status || 'pending',
    error_msg: r.error_msg,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function rowToCharacter(r) {
  return {
    id: r.id,
    drama_id: r.drama_id,
    name: r.name,
    role: r.role,
    description: r.description,
    appearance: r.appearance,
    personality: r.personality,
    voice_style: r.voice_style,
    image_url: r.image_url,
    local_path: r.local_path,
    reference_images: r.reference_images,
    seed_value: r.seed_value,
    sort_order: r.sort_order ?? 0,
    error_msg: r.error_msg,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function rowToScene(r) {
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
    error_msg: r.error_msg,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function rowToProp(r) {
  return {
    id: r.id,
    drama_id: r.drama_id,
    name: r.name,
    type: r.type,
    description: r.description,
    prompt: r.prompt,
    image_url: r.image_url,
    local_path: r.local_path,
    error_msg: r.error_msg,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function saveOutline(db, log, dramaId, req) {
  const drama = getDramaById(db, Number(dramaId));
  if (!drama) return false;
  const now = new Date().toISOString();
  const tagsStr = Array.isArray(req.tags) ? JSON.stringify(req.tags) : null;
  // Merge new metadata with existing metadata
  let existingMetadata = {};
  if (drama.metadata) {
    try {
      existingMetadata = typeof drama.metadata === 'string' ? JSON.parse(drama.metadata) : drama.metadata;
    } catch (e) {
      existingMetadata = {};
    }
  }
  let newMetadata = {};
  if (req.metadata) {
    try {
      newMetadata = typeof req.metadata === 'string' ? JSON.parse(req.metadata) : req.metadata;
    } catch (e) {
      newMetadata = {};
    }
  }
  const mergedMetadata = { ...existingMetadata, ...newMetadata };
  const metadataStr = JSON.stringify(mergedMetadata);
  
  db.prepare(
    `UPDATE dramas SET title = ?, description = ?, genre = ?, tags = ?, style = ?, metadata = ?, updated_at = ? WHERE id = ?`
  ).run(
    req.title || drama.title, 
    req.summary ?? drama.description, 
    req.genre !== undefined ? req.genre : drama.genre, 
    tagsStr, 
    req.style !== undefined ? req.style : drama.style, 
    metadataStr, 
    now, 
    dramaId
  );
  log.info('Outline saved', { drama_id: dramaId, style: req.style, genre: req.genre, metadata: mergedMetadata });
  return true;
}

function getCharacters(db, dramaId, episodeId) {
  const did = Number(dramaId);
  const drama = getDramaById(db, did);
  if (!drama) return null;
  let rows;
  if (episodeId) {
    const exists = db.prepare('SELECT 1 FROM episodes WHERE id = ? AND drama_id = ?').get(episodeId, did);
    if (!exists) return null;
    rows = db.prepare(
      `SELECT c.* FROM characters c
       INNER JOIN episode_characters ec ON ec.character_id = c.id
       WHERE ec.episode_id = ? AND c.deleted_at IS NULL ORDER BY c.sort_order ASC, c.name ASC`
    ).all(episodeId);
  } else {
    rows = db.prepare(
      'SELECT * FROM characters WHERE drama_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC'
    ).all(did);
  }
  const characters = rows.map((r) => rowToCharacter(r));
  for (const c of characters) {
    const img = db.prepare(
      'SELECT status, error_msg FROM image_generations WHERE character_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(c.id);
    if (img && ['pending', 'processing', 'failed'].includes(img.status)) {
      c.image_generation_status = img.status;
      if (img.error_msg) c.image_generation_error = img.error_msg;
    }
  }
  return characters;
}

function saveCharacters(db, log, dramaId, req) {
  const did = Number(dramaId);
  const drama = getDramaById(db, did);
  if (!drama) return false;
  if (req.episode_id) {
    const ep = db.prepare('SELECT 1 FROM episodes WHERE id = ? AND drama_id = ?').get(req.episode_id, did);
    if (!ep) return false;
  }
  const characterIds = [];
  const chars = req.characters || [];
  for (const char of chars) {
    if (char.id) {
      const ex = db.prepare('SELECT id FROM characters WHERE id = ? AND drama_id = ?').get(char.id, did);
      if (ex) {
        characterIds.push(ex.id);
        db.prepare(
          `UPDATE characters SET name = ?, role = ?, description = ?, personality = ?, appearance = ?, image_url = ?, updated_at = ? WHERE id = ?`
        ).run(char.name, char.role ?? null, char.description ?? null, char.personality ?? null, char.appearance ?? null, char.image_url ?? null, new Date().toISOString(), char.id);
        continue;
      }
    }
    const byName = db.prepare('SELECT id FROM characters WHERE drama_id = ? AND name = ?').get(did, char.name);
    if (byName) {
      characterIds.push(byName.id);
      continue;
    }
    const now = new Date().toISOString();
    const info = db.prepare(
      `INSERT INTO characters (drama_id, name, role, description, personality, appearance, image_url, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(did, char.name, char.role ?? null, char.description ?? null, char.personality ?? null, char.appearance ?? null, char.image_url ?? null, now, now);
    characterIds.push(info.lastInsertRowid);
  }
  if (req.episode_id && characterIds.length > 0) {
    db.prepare('DELETE FROM episode_characters WHERE episode_id = ?').run(req.episode_id);
    const ins = db.prepare('INSERT OR IGNORE INTO episode_characters (episode_id, character_id) VALUES (?, ?)');
    for (const cid of characterIds) ins.run(req.episode_id, cid);
  }
  db.prepare('UPDATE dramas SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), did);
  log.info('Characters saved', { drama_id: dramaId, count: chars.length });
  return true;
}

function saveEpisodes(db, log, dramaId, req) {
  const did = Number(dramaId);
  const drama = getDramaById(db, did);
  if (!drama) return false;
  const episodes = req.episodes || [];
  const now = new Date().toISOString();

  // 按 episode_number upsert：保留已有分集的 id，避免关联数据（角色/场景/道具/分镜）孤岛化
  const keptNumbers = new Set();
  for (const ep of episodes) {
    const num = ep.episode_number ?? 0;
    keptNumbers.add(num);
    // 查找已有的（包含软删除的，以防重新激活）
    const existing = db.prepare(
      'SELECT id FROM episodes WHERE drama_id = ? AND episode_number = ? ORDER BY deleted_at IS NOT NULL ASC, id ASC LIMIT 1'
    ).get(did, num);
    if (existing) {
      // 更新已有分集，保留 id
      db.prepare(
        `UPDATE episodes SET title = ?, script_content = ?, description = ?, duration = ?, deleted_at = NULL, updated_at = ? WHERE id = ?`
      ).run(ep.title || '', ep.script_content ?? null, ep.description ?? null, ep.duration ?? 0, now, existing.id);
    } else {
      // 新增
      db.prepare(
        `INSERT INTO episodes (drama_id, episode_number, title, script_content, description, duration, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
      ).run(did, num, ep.title || '', ep.script_content ?? null, ep.description ?? null, ep.duration ?? 0, now, now);
    }
  }

  // 软删除本次未提交的分集（如用户删掉了某一集）
  const liveEpisodes = db.prepare(
    'SELECT id, episode_number FROM episodes WHERE drama_id = ? AND deleted_at IS NULL'
  ).all(did);
  for (const row of liveEpisodes) {
    if (!keptNumbers.has(row.episode_number)) {
      db.prepare('UPDATE episodes SET deleted_at = ? WHERE id = ?').run(now, row.id);
    }
  }

  db.prepare('UPDATE dramas SET updated_at = ? WHERE id = ?').run(now, did);
  log.info('Episodes saved', { drama_id: dramaId, count: episodes.length });
  return true;
}

function saveProgress(db, log, dramaId, req) {
  const drama = getDramaById(db, Number(dramaId));
  if (!drama) return false;
  let meta = {};
  if (drama.metadata) try { meta = JSON.parse(drama.metadata); } catch (_) {}
  meta.current_step = req.current_step;
  if (req.step_data) meta.step_data = req.step_data;
  const now = new Date().toISOString();
  db.prepare('UPDATE dramas SET metadata = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(meta), now, dramaId);
  log.info('Progress saved', { drama_id: dramaId, step: req.current_step });
  return true;
}

/**
 * 取某分镜的视频地址：优先 video_generations 已完成记录的 video_url/local_path，否则 storyboard.video_url
 */
function getVideoUrlForStoryboard(db, storyboardId, baseUrl) {
  const vg = db.prepare(
    "SELECT video_url, local_path FROM video_generations WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).get(storyboardId);
  if (vg) {
    if (vg.video_url && String(vg.video_url).trim()) return vg.video_url;
    if (vg.local_path && String(vg.local_path).trim() && baseUrl) {
      const base = (baseUrl || '').replace(/\/$/, '');
      const path = String(vg.local_path).replace(/^\//, '');
      return path ? base + '/' + path : null;
    }
  }
  const sb = db.prepare('SELECT video_url FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(storyboardId);
  return sb && sb.video_url && String(sb.video_url).trim() ? sb.video_url : null;
}

function finalizeEpisode(db, log, episodeId, baseUrl) {
  const ep = db.prepare('SELECT id, drama_id, episode_number FROM episodes WHERE id = ? AND deleted_at IS NULL').get(episodeId);
  if (!ep) return null;
  const drama = db.prepare('SELECT title FROM dramas WHERE id = ? AND deleted_at IS NULL').get(ep.drama_id);
  const storyboards = db.prepare(
    'SELECT id, storyboard_number, duration FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number ASC'
  ).all(episodeId);
  const videoMergeService = require('./videoMergeService');
  const scenes = [];
  for (let i = 0; i < storyboards.length; i++) {
    const sb = storyboards[i];
    const videoUrl = getVideoUrlForStoryboard(db, sb.id, baseUrl);
    if (!videoUrl) {
      log.warn('Finalize skip storyboard (no video)', { storyboard_id: sb.id, storyboard_number: sb.storyboard_number });
      continue;
    }
    scenes.push({
      scene_id: sb.id,
      video_url: videoUrl,
      duration: Number(sb.duration) || 5,
      order: i,
    });
  }
  if (scenes.length === 0) {
    log.warn('Finalize no scenes with video', { episode_id: episodeId });
    return { message: '本集没有可合成的视频片段', merge_id: null, episode_id: episodeId, scenes_count: 0, task_id: null };
  }
  const title = drama && drama.title ? `${drama.title} - 第${ep.episode_number ?? episodeId}集` : null;
  const mergeReq = {
    episode_id: episodeId,
    drama_id: ep.drama_id,
    title,
    scenes,
    provider: 'ffmpeg',
  };
  const created = videoMergeService.create(db, log, mergeReq);
  const mergeId = created.merge_id || created.id;
  db.prepare('UPDATE episodes SET status = ? WHERE id = ?').run('processing', episodeId);
  setImmediate(() => {
    videoMergeService.processVideoMerge(db, log, mergeId, baseUrl);
  });
  return {
    message: '视频合成任务已创建，正在后台处理',
    merge_id: mergeId,
    episode_id: episodeId,
    scenes_count: scenes.length,
    task_id: created.task_id,
  };
}

function downloadEpisodeVideo(db, episodeId) {
  const ep = db.prepare('SELECT id, title, episode_number, video_url FROM episodes WHERE id = ? AND deleted_at IS NULL').get(episodeId);
  if (!ep) return null;
  if (!ep.video_url) return { error: '该剧集还没有生成视频' };
  return { video_url: ep.video_url, title: ep.title, episode_number: ep.episode_number };
}

module.exports = {
  createDrama,
  getDrama,
  getDramaById,
  listDramas,
  updateDrama,
  deleteDrama,
  getDramaStats,
  saveOutline,
  getCharacters,
  saveCharacters,
  saveEpisodes,
  saveProgress,
  finalizeEpisode,
  downloadEpisodeVideo,
  generateStoryboard,
};
