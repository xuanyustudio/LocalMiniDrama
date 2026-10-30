// 项目导入服务：解析 ZIP，还原剧集数据和媒体文件
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { randomUUID } = require('crypto');
const storageLayout = require('./storageLayout');

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
 * @param {string} projectDir 如 projects/0001_20250324_剧名，与工程内其它媒体一致
 */
function saveMediaFile(storagePath, projectDir, category, files, zipPath, prefix) {
  if (!zipPath) return null;
  const buf = files.get(zipPath);
  if (!buf) return null;
  const ext = path.extname(zipPath) || '.jpg';
  const categoryPath = path.join(storagePath, projectDir, category);
  ensureDir(categoryPath);
  const name = `${prefix}_${randomUUID().slice(0, 8)}${ext}`;
  const abs = path.join(categoryPath, name);
  fs.writeFileSync(abs, buf);
  return `${projectDir}/${category}/${name}`.replace(/\\/g, '/');
}

/**
 * 批量保存 extra_image_files 数组，返回本地路径 JSON 字符串
 */
const IMPORT_FIRST_FRAME_TYPES = ['storyboard_first', 'first', 'first_frame'];
const IMPORT_LAST_FRAME_TYPES = ['storyboard_last', 'last', 'tail', 'last_frame'];

/** 老版 ZIP 或未写入 frame_prompts 时，从已导入的首尾帧图生记录回填提示词 */
function restoreFramePromptsFromImageGens(db, sbId, now, log) {
  const insFp = db.prepare(
    'INSERT INTO frame_prompts (storyboard_id, frame_type, prompt, description, layout, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const [types, frameType] of [[IMPORT_FIRST_FRAME_TYPES, 'first'], [IMPORT_LAST_FRAME_TYPES, 'last']]) {
    const has = db.prepare('SELECT id FROM frame_prompts WHERE storyboard_id = ? AND frame_type = ?').get(sbId, frameType);
    if (has) continue;
    const ph = types.map(() => '?').join(',');
    const ig = db.prepare(
      `SELECT prompt FROM image_generations WHERE storyboard_id = ? AND deleted_at IS NULL
       AND frame_type IN (${ph}) AND prompt IS NOT NULL AND TRIM(prompt) != ''
       ORDER BY created_at DESC LIMIT 1`
    ).get(sbId, ...types);
    if (ig?.prompt?.trim()) {
      insFp.run(sbId, frameType, ig.prompt.trim(), null, null, now, now);
      try { log?.info?.('[导入] 从分镜图历史恢复帧提示词', { storyboard_id: sbId, frame_type: frameType }); } catch (_) {}
    }
  }
}

function saveExtraImages(storagePath, projectDir, category, files, zipPaths, prefix) {
  if (!Array.isArray(zipPaths) || zipPaths.length === 0) return null;
  const localPaths = [];
  for (const zipPath of zipPaths) {
    const localPath = saveMediaFile(storagePath, projectDir, category, files, zipPath, prefix);
    if (localPath) localPaths.push(localPath);
  }
  return localPaths.length > 0 ? JSON.stringify(localPaths) : null;
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
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch (_) {
      metadata = {};
    }
  }
  metadata.storage_folder_label = storageLayout.sanitizeFolderLabel(title);
  const metaStr = JSON.stringify(metadata);

  // 用事务包裹全部写入：任何步骤失败时整体回滚，避免部分导入
  let result;
  const runImport = db.transaction(() => {
    result = _doImport(db, storagePath, files, data, d, title, metaStr, now, log);
  });
  runImport();
  return result;
}

function _doImport(db, storagePath, files, data, d, title, metaStr, now, log) {

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
  const projectDir = storageLayout.buildProjectRelativeDir({
    id: dramaId,
    title,
    created_at: now,
    metadata: metaStr,
  });

  // ---- 导入角色 ----
  const charNewIds = []; // 按导出顺序保存新角色 id，用于恢复分镜 character_indices
  for (let i = 0; i < (data.characters || []).length; i++) {
    const c = data.characters[i];
    if (!c.name) { charNewIds.push(null); continue; }
    const localPath = saveMediaFile(storagePath, projectDir, 'characters', files, c.image_file, 'char_imp');
    const extraImagesJson = saveExtraImages(storagePath, projectDir, 'characters', files, c.extra_image_files, 'char_extra_imp');
    const info = db.prepare(
      `INSERT INTO characters (drama_id, name, role, description, personality, appearance, voice_style, polished_prompt, local_path, extra_images, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dramaId, c.name, c.role || null, c.description || null, c.personality || null, c.appearance || null, c.voice_style || null, c.polished_prompt || null, localPath, extraImagesJson, i, now, now);
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
      if (!charId) continue;
      for (const epId of episodeIdList) {
        try { insEC.run(epId, charId); } catch (_) {}
      }
    }
  }

  // ---- 导入场景（带 episode_id，按 location+time 去重：同名场景只创建一条记录）----
  const sceneNewIds = []; // 按导出顺序保存新场景 id（含去重后的映射），用于恢复分镜 scene_index
  const sceneDedupeMap = new Map(); // key: "location|time" → 已创建的 scene id
  for (let i = 0; i < (data.scenes || []).length; i++) {
    const s = data.scenes[i];
    const dedupeKey = `${(s.location || '').trim()}|${(s.time || '').trim()}`;
    if (sceneDedupeMap.has(dedupeKey)) {
      // 同 location+time 已存在，直接复用，不重复插入
      sceneNewIds.push(sceneDedupeMap.get(dedupeKey));
      continue;
    }
    const epIdx = s.episode_index;
    const epId = (epIdx != null && epIdx >= 0 && episodeIdList[epIdx])
      ? episodeIdList[epIdx]
      : (episodeIdList[0] || null);
    const localPath = saveMediaFile(storagePath, projectDir, 'scenes', files, s.image_file, 'scene_imp');
    const extraImagesJson = saveExtraImages(storagePath, projectDir, 'scenes', files, s.extra_image_files, 'scene_extra_imp');
    const info = db.prepare(
      `INSERT INTO scenes (drama_id, episode_id, location, time, prompt, polished_prompt, local_path, extra_images, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dramaId, epId, s.location || '', s.time || '', s.prompt || '', s.polished_prompt || null, localPath, extraImagesJson, now, now);
    sceneNewIds.push(info.lastInsertRowid);
    sceneDedupeMap.set(dedupeKey, info.lastInsertRowid);
  }

  // ---- 导入道具（带 episode_id） ----
  const propNewIds = []; // 按导出顺序保存新道具 id，用于恢复 storyboard_props
  for (const p of (data.props || [])) {
    if (!p.name) { propNewIds.push(null); continue; }
    const epIdx = p.episode_index;
    const epId = (epIdx != null && epIdx >= 0 && episodeIdList[epIdx])
      ? episodeIdList[epIdx]
      : (episodeIdList[0] || null);
    const localPath = saveMediaFile(storagePath, projectDir, 'props', files, p.image_file, 'prop_imp');
    const extraImagesJson = saveExtraImages(storagePath, projectDir, 'props', files, p.extra_image_files, 'prop_extra_imp');
    const pInfo = db.prepare(
      `INSERT INTO props (drama_id, episode_id, name, type, description, prompt, local_path, extra_images, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dramaId, epId, p.name, p.type || null, p.description || null, p.prompt || null, localPath, extraImagesJson, now, now);
    propNewIds.push(pInfo.lastInsertRowid);
  }

  // ---- 导入分镜 ----
  for (let epIdx = 0; epIdx < (data.episodes || []).length; epIdx++) {
    const ep = data.episodes[epIdx];
    const episodeId = episodeIdList[epIdx];
    if (!episodeId) continue;

    for (const sb of (ep.storyboards || [])) {
      const sbAudioPath = saveMediaFile(storagePath, projectDir, 'audio', files, sb.audio_file, 'sb_audio_imp');
      const sbNarrationAudioPath = saveMediaFile(storagePath, projectDir, 'audio', files, sb.narration_audio_file, 'sb_narr_audio_imp');

      // 还原 characters：从导出时记录的下标映射回新 ID
      const charIndices = Array.isArray(sb.character_indices) ? sb.character_indices : [];
      const sbCharIds = charIndices
        .map(idx => charNewIds[idx])
        .filter(id => id != null);
      const charactersJson = JSON.stringify(sbCharIds);

      // 还原 scene_id：从导出时记录的下标映射回新 ID
      const sbSceneId = (sb.scene_index != null && sceneNewIds[sb.scene_index])
        ? sceneNewIds[sb.scene_index]
        : null;

      // 还原 prop_ids：从导出时记录的下标映射回新 ID
      const propIndices = Array.isArray(sb.prop_indices) ? sb.prop_indices : [];
      const sbPropNewIds = propIndices
        .map(idx => propNewIds[idx])
        .filter(id => id != null);

      // 先插入分镜（首尾帧绑定ID、layout 稍后更新；image_url/local_path 由绑定逻辑设置）
      // 使用并行数组维护列名与值，确保列数与传参数量永远一致，避免“44 values for 43 columns”类错误
      const sbCols = [
        'episode_id', 'scene_id', 'storyboard_number', 'title', 'description', 'location', 'time',
        'dialogue', 'narration', 'action', 'atmosphere', 'result', 'shot_type', 'angle', 'angle_h', 'angle_v', 'angle_s',
        'movement', 'lighting_style', 'depth_of_field', 'image_prompt', 'polished_prompt', 'video_prompt', 'duration',
        'emotion', 'emotion_intensity', 'segment_index', 'segment_title', 'continuity_snapshot', 'creation_mode',
        'universal_segment_text', 'layout_description', 'first_frame_image_id', 'last_frame_image_id',
        'last_frame_image_url', 'last_frame_local_path', 'image_url', 'local_path', 'characters',
        'audio_local_path', 'narration_audio_local_path', 'created_at', 'updated_at'
      ];
      const sbVals = [
        episodeId,
        sbSceneId,
        sb.storyboard_number || 1,
        sb.title || null,
        sb.description || null,
        sb.location || null,
        sb.time || null,
        sb.dialogue || null,
        sb.narration || null,
        sb.action || null,
        sb.atmosphere || null,
        sb.result || null,
        sb.shot_type || null,
        sb.angle || null,
        sb.angle_h || null,
        sb.angle_v || null,
        sb.angle_s || null,
        sb.movement || null,
        sb.lighting_style || null,
        sb.depth_of_field || null,
        sb.image_prompt || null,
        sb.polished_prompt || null,
        sb.video_prompt || null,
        sb.duration || 0,
        sb.emotion || null,
        sb.emotion_intensity != null ? sb.emotion_intensity : null,
        sb.segment_index ?? 0,
        sb.segment_title || null,
        sb.continuity_snapshot || null,
        sb.creation_mode === 'universal' ? 'universal' : 'classic',
        sb.universal_segment_text || null,
        sb.layout_description || null,
        null, // first_frame_image_id 后设
        null, // last_frame_image_id 后设
        sb.last_frame_image_url || null,
        sb.last_frame_local_path || null,
        null, // image_url 由首帧绑定设置
        null, // local_path 由首帧绑定设置
        charactersJson,
        sbAudioPath || null,
        sbNarrationAudioPath || null,
        now,
        now
      ];
      if (sbCols.length !== sbVals.length) {
        throw new Error(`storyboards 导入列数不匹配: cols=${sbCols.length}, vals=${sbVals.length}`);
      }
      const sbInfo = db.prepare(
        `INSERT INTO storyboards (${sbCols.join(', ')})
         VALUES (${sbCols.map(() => '?').join(', ')})`
      ).run(...sbVals);
      const sbId = sbInfo.lastInsertRowid;

      // 还原 storyboard_props（分镜与道具的关联）
      if (sbPropNewIds.length > 0) {
        const insSP = db.prepare('INSERT OR IGNORE INTO storyboard_props (storyboard_id, prop_id) VALUES (?, ?)');
        for (const pid of sbPropNewIds) insSP.run(sbId, pid);
      }

      // 还原帧提示词（首尾帧/关键帧专用提示词 + layout 合同，必须恢复）
      if (Array.isArray(sb.frame_prompts) && sb.frame_prompts.length > 0) {
        const insFp = db.prepare('INSERT INTO frame_prompts (storyboard_id, frame_type, prompt, description, layout, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const fp of sb.frame_prompts) {
          insFp.run(sbId, fp.frame_type || 'first', fp.prompt || '', fp.description || null, fp.layout || null, fp.created_at || now, fp.updated_at || now);
        }
        try { require('../logger').info?.('[导入] 已恢复帧提示词', { storyboard_id: sbId, count: sb.frame_prompts.length }); } catch (_) {}
      }

      // 导入分镜图片完整历史（新版 v1.4+ 的 image_generations 数组；老版回退单张）
      const genOldToNew = new Map(); // original_id -> {newId, localPath}
      if (Array.isArray(sb.image_generations) && sb.image_generations.length > 0) {
        for (const gen of sb.image_generations) {
          const genLocalPath = saveMediaFile(storagePath, projectDir, 'images', files, gen.zip_file || gen.file, 'sb_imp_gen');
          if (genLocalPath) {
            const genInfo = db.prepare(
              `INSERT INTO image_generations (drama_id, storyboard_id, provider, prompt, negative_prompt, model, frame_type, size, quality, status, error_msg, local_path, created_at, updated_at, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              dramaId,
              sbId,
              gen.provider || 'imported',
              gen.prompt || sb.image_prompt || '',
              gen.negative_prompt || null,
              gen.model || null,
              gen.frame_type || null,
              gen.size || null,
              gen.quality || null,
              gen.status || 'completed',
              gen.error_msg || null,
              genLocalPath,
              gen.created_at || now,
              now,
              gen.completed_at || now
            );
            const newGenId = genInfo.lastInsertRowid;
            if (gen.original_id != null) {
              genOldToNew.set(Number(gen.original_id), { newId: newGenId, localPath: genLocalPath });
            }
          }
        }
      } else {
        // 老版兼容：仅单张 image_file（导入后只有这一个历史图，首尾帧绑定丢失是旧行为）
        const sbImagePath = saveMediaFile(storagePath, projectDir, 'images', files, sb.image_file, 'sb_imp');
        if (sbImagePath) {
          db.prepare(
            `INSERT INTO image_generations (drama_id, storyboard_id, provider, prompt, status, local_path, created_at, updated_at)
             VALUES (?, ?, 'imported', ?, 'completed', ?, ?, ?)`
          ).run(dramaId, sbId, sb.image_prompt || '', sbImagePath, now, now);
        }
      }

      // 导入视频（仍保持单条最新，视频首尾帧 URL 由生成时绑定）
      if (sb.video_file) {
        const videoLocalPath = saveMediaFile(storagePath, projectDir, 'videos', files, sb.video_file, 'vid_imp');
        if (videoLocalPath) {
          db.prepare(
            `INSERT INTO video_generations (drama_id, storyboard_id, provider, prompt, status, local_path, created_at, updated_at)
             VALUES (?, ?, 'imported', ?, 'completed', ?, ?, ?)`
          ).run(dramaId, sbId, sb.video_prompt || '', videoLocalPath, now, now);
        }
      }

      // 绑定首尾帧到 storyboards（关键：恢复 first_frame_image_id + image_url/local_path，以及 last_*）
      const now2 = new Date().toISOString();
      const firstOld = sb.first_frame_image_original_id ?? sb.first_frame_image_id;
      const lastOld = sb.last_frame_image_original_id ?? sb.last_frame_image_id;
      let boundFirst = false, boundLast = false;
      if (firstOld != null && genOldToNew.has(Number(firstOld))) {
        const { newId, localPath } = genOldToNew.get(Number(firstOld));
        db.prepare(
          `UPDATE storyboards SET image_url = ?, local_path = ?, first_frame_image_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`
        ).run(null, localPath, newId, now2, sbId);
        boundFirst = true;
      }
      if (lastOld != null && genOldToNew.has(Number(lastOld))) {
        const { newId, localPath } = genOldToNew.get(Number(lastOld));
        db.prepare(
          `UPDATE storyboards SET last_frame_image_url = ?, last_frame_local_path = ?, last_frame_image_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`
        ).run(null, localPath, newId, now2, sbId);
        boundLast = true;
      }
      if ((sb.image_generations && sb.image_generations.length) || boundFirst || boundLast) {
        try {
          require('../logger').info?.('[导入] 分镜图片历史+首尾帧绑定完成', {
            storyboard_id: sbId,
            gens_restored: genOldToNew.size,
            first_bound: boundFirst,
            last_bound: boundLast,
            had_original_first: firstOld != null,
            had_original_last: lastOld != null
          });
        } catch (_) {}
      }

      // 兼容老工程：ZIP 无 frame_prompts 时，用已导入的首/尾帧图生 prompt 回填
      restoreFramePromptsFromImageGens(db, sbId, now2, log);
    }
  }

  log.info('Drama imported', { drama_id: dramaId, title });
  return { drama_id: dramaId, title };
}

module.exports = { importDrama, parseZip };
