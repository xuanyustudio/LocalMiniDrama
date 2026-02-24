// 项目导入服务：解析 ZIP，还原剧集数据和媒体文件
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { randomUUID } = require('crypto');

function getStoragePath(cfg) {
  const raw = cfg?.storage?.local_path || './data/storage';
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * 解析 ZIP Buffer，返回 project.json 内容和媒体文件 Map
 * @returns {{ data: object, files: Map<string,Buffer> }}
 */
function parseZip(zipBuffer) {
  let zip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (e) {
    throw new Error('ZIP 文件损坏，无法解析');
  }

  const projectEntry = zip.getEntry('project.json');
  if (!projectEntry) {
    throw new Error('ZIP 格式不正确：缺少 project.json');
  }

  let data;
  try {
    data = JSON.parse(projectEntry.getData().toString('utf8'));
  } catch (e) {
    throw new Error('project.json 格式错误，无法解析 JSON');
  }

  if (!data.drama || !data.drama.title) {
    throw new Error('project.json 格式不正确：缺少 drama.title 字段');
  }

  // 读取所有媒体文件到 Map
  const files = new Map();
  for (const entry of zip.getEntries()) {
    if (!entry.isDirectory && entry.entryName !== 'project.json') {
      files.set(entry.entryName, entry.getData());
    }
  }

  return { data, files };
}

/**
 * 生成不重名的剧集标题
 */
function resolveTitle(db, baseTitle) {
  const existing = db.prepare('SELECT title FROM dramas WHERE deleted_at IS NULL').all().map(r => r.title);
  if (!existing.includes(baseTitle)) return baseTitle;
  let i = 1;
  while (existing.includes(`${baseTitle} 导入${i}`)) i++;
  return `${baseTitle} 导入${i}`;
}

/**
 * 保存媒体文件到 storage，返回相对路径
 */
function saveMediaFile(storagePath, category, files, zipPath, prefix) {
  if (!zipPath) return null;
  const buf = files.get(zipPath);
  if (!buf) return null;
  const ext = path.extname(zipPath) || '.jpg';
  const categoryPath = path.join(storagePath, category);
  ensureDir(categoryPath);
  const name = `${prefix}_${randomUUID().slice(0, 8)}${ext}`;
  const abs = path.join(categoryPath, name);
  fs.writeFileSync(abs, buf);
  return `${category}/${name}`;
}

/**
 * 导入 ZIP，创建剧集并还原所有数据
 * @param {Buffer} zipBuffer
 * @returns {{ drama_id: number, title: string }}
 */
function importDrama(db, cfg, log, zipBuffer) {
  const storagePath = getStoragePath(cfg);
  const { data, files } = parseZip(zipBuffer);

  const d = data.drama;
  const title = resolveTitle(db, d.title || '导入项目');
  const now = new Date().toISOString();

  let metadata = d.metadata || {};
  const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

  // ---- 创建 drama ----
  const dramaInfo = db.prepare(
    `INSERT INTO dramas (title, description, genre, style, status, tags, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title,
    d.description || null,
    d.genre || null,
    d.style || null,
    d.status || 'draft',
    d.tags || null,
    metaStr,
    now,
    now
  );
  const dramaId = dramaInfo.lastInsertRowid;

  // ---- 导入角色 ----
  const charNewIds = []; // 保存所有新角色 id，稍后关联集数
  for (let i = 0; i < (data.characters || []).length; i++) {
    const c = data.characters[i];
    if (!c.name) continue;
    const localPath = saveMediaFile(storagePath, 'characters', files, c.image_file, `char_imp`);
    const info = db.prepare(
      `INSERT INTO characters (drama_id, name, role, description, personality, appearance, voice_style, local_path, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dramaId, c.name, c.role || null, c.description || null, c.personality || null, c.appearance || null, c.voice_style || null, localPath, i, now, now);
    charNewIds.push(info.lastInsertRowid);
  }

  // ---- 导入剧集（先建好所有集，再关联角色/场景/道具） ----
  const episodeIdList = []; // 按顺序保存新集 id
  for (const ep of (data.episodes || [])) {
    const epInfo = db.prepare(
      `INSERT INTO episodes (drama_id, episode_number, title, description, script_content, duration, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dramaId, ep.episode_number || 1, ep.title || `第${ep.episode_number || 1}集`, ep.description || null, ep.script_content || null, ep.duration || 0, now, now);
    episodeIdList.push(epInfo.lastInsertRowid);
  }

  // ---- 关联角色到所有集（episode_characters） ----
  if (charNewIds.length > 0 && episodeIdList.length > 0) {
    const insEC = db.prepare('INSERT OR IGNORE INTO episode_characters (episode_id, character_id) VALUES (?, ?)');
    for (const charId of charNewIds) {
      for (const epId of episodeIdList) {
        try { insEC.run(epId, charId); } catch (_) {}
      }
    }
  }

  // ---- 导入场景（带 episode_id） ----
  for (let i = 0; i < (data.scenes || []).length; i++) {
    const s = data.scenes[i];
    // episode_index 由新版导出写入；旧版导出没有，则默认归属第一集
    const epIdx = s.episode_index;
    const epId = (epIdx != null && epIdx >= 0 && episodeIdList[epIdx])
      ? episodeIdList[epIdx]
      : (episodeIdList[0] || null);
    const localPath = saveMediaFile(storagePath, 'scenes', files, s.image_file, `scene_imp`);
    db.prepare(
      `INSERT INTO scenes (drama_id, episode_id, location, time, prompt, local_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dramaId, epId, s.location || null, s.time || null, s.prompt || '', localPath, now, now);
  }

  // ---- 导入道具（带 episode_id） ----
  for (const p of (data.props || [])) {
    if (!p.name) continue;
    const epIdx = p.episode_index;
    const epId = (epIdx != null && epIdx >= 0 && episodeIdList[epIdx])
      ? episodeIdList[epIdx]
      : (episodeIdList[0] || null);
    const localPath = saveMediaFile(storagePath, 'images', files, p.image_file, `prop_imp`);
    db.prepare(
      `INSERT INTO props (drama_id, episode_id, name, type, description, prompt, local_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dramaId, epId, p.name, p.type || null, p.description || null, p.prompt || null, localPath, now, now);
  }

  // ---- 导入分镜 ----
  for (let epIdx = 0; epIdx < (data.episodes || []).length; epIdx++) {
    const ep = data.episodes[epIdx];
    const episodeId = episodeIdList[epIdx];
    if (!episodeId) continue;

    for (const sb of (ep.storyboards || [])) {
      const sbImagePath = saveMediaFile(storagePath, 'images', files, sb.image_file, `sb_imp`);
      const sbInfo = db.prepare(
        `INSERT INTO storyboards (episode_id, storyboard_number, description, location, time, dialogue, action, atmosphere, result, shot_type, angle, movement, image_prompt, video_prompt, duration, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        episodeId,
        sb.storyboard_number || 1,
        sb.description || null,
        sb.location || null,
        sb.time || null,
        sb.dialogue || null,
        sb.action || null,
        sb.atmosphere || null,
        sb.result || null,
        sb.shot_type || null,
        sb.angle || null,
        sb.movement || null,
        sb.image_prompt || null,
        sb.video_prompt || null,
        sb.duration || 0,
        now,
        now
      );
      const sbId = sbInfo.lastInsertRowid;

      // 导入分镜图（写入 image_generations）
      if (sbImagePath) {
        db.prepare(
          `INSERT INTO image_generations (drama_id, storyboard_id, provider, prompt, status, local_path, created_at, updated_at)
           VALUES (?, ?, 'imported', ?, 'completed', ?, ?, ?)`
        ).run(dramaId, sbId, sb.image_prompt || '', sbImagePath, now, now);
      }

      // 导入视频
      if (sb.video_file) {
        const videoLocalPath = saveMediaFile(storagePath, 'videos', files, sb.video_file, `vid_imp`);
        if (videoLocalPath) {
          db.prepare(
            `INSERT INTO video_generations (drama_id, storyboard_id, provider, prompt, status, local_path, created_at, updated_at)
             VALUES (?, ?, 'imported', ?, 'completed', ?, ?, ?)`
          ).run(dramaId, sbId, sb.video_prompt || '', videoLocalPath, now, now);
        }
      }
    }
  }

  log.info('Drama imported', { drama_id: dramaId, title });
  return { drama_id: dramaId, title };
}

module.exports = { importDrama, parseZip };
