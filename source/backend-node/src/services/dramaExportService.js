// 项目导出服务：将剧集所有数据和媒体文件打包为 ZIP
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const EXPORT_VERSION = '1.4';  // 1.4: 完整导出分镜图片历史（含首尾帧 first/last 绑定）、frame_prompts、layout_description 等，支持导入后恢复首尾帧模式数据

function getStoragePath(cfg) {
  const raw = cfg?.storage?.local_path || './data/storage';
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

function safeReadFile(filePath) {
  try {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
  } catch (_) {}
  return null;
}

function localPathToAbs(storagePath, relPath) {
  if (!relPath) return null;
  return path.join(storagePath, relPath);
}

function extOf(relPath) {
  if (!relPath) return '.jpg';
  return path.extname(relPath) || '.jpg';
}

/** 解析 extra_images JSON 字段，返回本地路径数组 */
function parseExtraImages(raw) {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch (_) { return []; }
}

const EXPORT_FIRST_FRAME_TYPES = ['storyboard_first', 'first', 'first_frame'];
const EXPORT_LAST_FRAME_TYPES = ['storyboard_last', 'last', 'tail', 'last_frame'];

/** frame_prompts 表无记录时，从首尾帧图生历史补全导出（避免仅生过图、未单独存帧提示词时丢失） */
function supplementFramePromptsFromImageGens(db, sbId, fps) {
  const out = Array.isArray(fps) ? [...fps] : [];
  const hasType = (t) => out.some((f) => f && f.frame_type === t);
  const pickPrompt = (types) => {
    const ph = types.map(() => '?').join(',');
    const row = db.prepare(
      `SELECT prompt FROM image_generations WHERE storyboard_id = ? AND deleted_at IS NULL
       AND frame_type IN (${ph}) AND prompt IS NOT NULL AND TRIM(prompt) != ''
       ORDER BY created_at DESC LIMIT 1`
    ).get(sbId, ...types);
    return (row?.prompt || '').trim();
  };
  const now = new Date().toISOString();
  if (!hasType('first')) {
    const p = pickPrompt(EXPORT_FIRST_FRAME_TYPES);
    if (p) out.push({ frame_type: 'first', prompt: p, description: null, layout: null, created_at: now, updated_at: now });
  }
  if (!hasType('last')) {
    const p = pickPrompt(EXPORT_LAST_FRAME_TYPES);
    if (p) out.push({ frame_type: 'last', prompt: p, description: null, layout: null, created_at: now, updated_at: now });
  }
  return out;
}

/** 解析 storyboard.characters JSON 字段，返回 ID 数组 */
function parseSbChars(raw) {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr.map(Number).filter(n => !isNaN(n)) : [];
  } catch (_) { return []; }
}

/**
 * 导出一个剧集为 ZIP Buffer
 * @returns {Buffer}
 */
function exportDrama(db, cfg, log, dramaId) {
  const storagePath = getStoragePath(cfg);

  // ---- 1. 读取 drama 基本信息 ----
  const drama = db.prepare('SELECT * FROM dramas WHERE id = ? AND deleted_at IS NULL').get(Number(dramaId));
  if (!drama) throw new Error('剧本不存在');

  let metadata = {};
  try { metadata = drama.metadata ? (typeof drama.metadata === 'string' ? JSON.parse(drama.metadata) : drama.metadata) : {}; } catch (_) {}

  // ---- 2. 读取所有剧集 ----
  const episodes = db.prepare(
    'SELECT * FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number'
  ).all(Number(dramaId));

  // ---- 3. 读取各集分镜 ----
  const episodeIds = episodes.map(e => e.id);
  const storyboardsByEp = {};
  for (const ep of episodes) {
    storyboardsByEp[ep.id] = db.prepare(
      'SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number'
    ).all(ep.id);
  }

  // ---- 4. 读取分镜图（完整历史 + 首尾帧 first/last）和视频（取最新完成的） ----
  const allSbIds = Object.values(storyboardsByEp).flat().map(s => s.id);
  const allImagesBySb = {};  // sbId -> 所有 image_generations 记录（用于导出历史和首尾帧绑定）
  const videosBySb = {};
  for (const sbId of allSbIds) {
    // 导出所有非删除的图片生成记录（含历史、首尾帧、各种 frame_type），仅打包有 local_path 的文件
    const igs = db.prepare(
      "SELECT * FROM image_generations WHERE storyboard_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
    ).all(sbId);
    allImagesBySb[sbId] = igs.filter(ig => ig && ig.local_path);

    const vg = db.prepare(
      "SELECT video_url, local_path FROM video_generations WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
    ).get(sbId);
    if (vg) videosBySb[sbId] = vg;
  }

  // 收集需要打包的分镜图片文件（完整历史）
  const imageFilesToPack = [];
  for (const [sbIdStr, igs] of Object.entries(allImagesBySb)) {
    const sbId = Number(sbIdStr);
    for (const ig of igs) {
      if (!ig.local_path) continue;
      const zipPath = `media/storyboards/sb_${sbId}_gen_${ig.id}${extOf(ig.local_path)}`;
      imageFilesToPack.push({ localRelPath: ig.local_path, zipPath });
    }
  }

  // 预查询各分镜的帧提示词（首尾帧专用提示词编辑器内容，必须导出否则导入后丢失）
  const framePromptsBySb = {};
  for (const sbId of allSbIds) {
    try {
      const fps = db.prepare('SELECT frame_type, prompt, description, layout, created_at, updated_at FROM frame_prompts WHERE storyboard_id = ? ORDER BY created_at ASC').all(sbId);
      framePromptsBySb[sbId] = supplementFramePromptsFromImageGens(db, sbId, fps);
    } catch (_) { framePromptsBySb[sbId] = []; }
  }

  // ---- 5. 读取角色 ----
  const characters = db.prepare(
    'SELECT * FROM characters WHERE drama_id = ? AND deleted_at IS NULL ORDER BY sort_order, id'
  ).all(Number(dramaId));

  // ---- 6. 读取场景 ----
  const scenes = db.prepare(
    'SELECT * FROM scenes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id'
  ).all(Number(dramaId));

  // ---- 7. 读取道具 ----
  const props = db.prepare(
    'SELECT * FROM props WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id'
  ).all(Number(dramaId));

  // ---- 场景去重（数据库中可能存在同 location+time 的重复记录，导出时只保留第一条）----
  const seenSceneKeys = new Set();
  const dedupedScenes = [];
  for (const s of scenes) {
    const key = `${(s.location || '').trim()}|${(s.time || '').trim()}`;
    if (seenSceneKeys.has(key)) continue;
    seenSceneKeys.add(key);
    dedupedScenes.push(s);
  }
  // 为去重后被丢弃的重复场景 ID 建立到保留场景的映射，确保分镜 scene_index 仍指向保留的场景
  const sceneDedupeIdMap = new Map(); // 原 ID → 保留后的同 key 首个 ID
  for (const s of scenes) {
    const key = `${(s.location || '').trim()}|${(s.time || '').trim()}`;
    const kept = dedupedScenes.find(d => `${(d.location||'').trim()}|${(d.time||'').trim()}` === key);
    if (kept) sceneDedupeIdMap.set(s.id, kept.id);
  }

  // ---- 构建 ID → 导出数组下标 的映射（用于分镜 characters/scene_id/prop_ids 跨项目还原） ----
  const charIdToIndex = {};
  characters.forEach((c, idx) => { charIdToIndex[c.id] = idx; });
  const sceneIdToIndex = {};
  dedupedScenes.forEach((s, idx) => { sceneIdToIndex[s.id] = idx; });
  // 去重丢弃的重复场景 ID 也指向保留场景的下标
  for (const [origId, keptId] of sceneDedupeIdMap.entries()) {
    if (!(origId in sceneIdToIndex)) sceneIdToIndex[origId] = sceneIdToIndex[keptId];
  }
  const propIdToIndex = {};
  props.forEach((p, idx) => { propIdToIndex[p.id] = idx; });

  // ---- 读取所有分镜的道具关联（storyboard_props） ----
  const allSbIdsForProps = Object.values(storyboardsByEp).flat().map(s => s.id);
  const sbPropIds = {}; // storyboard_id → prop_id[]
  if (allSbIdsForProps.length > 0) {
    const placeholders = allSbIdsForProps.map(() => '?').join(',');
    const spRows = db.prepare(
      `SELECT storyboard_id, prop_id FROM storyboard_props WHERE storyboard_id IN (${placeholders})`
    ).all(...allSbIdsForProps);
    for (const row of spRows) {
      if (!sbPropIds[row.storyboard_id]) sbPropIds[row.storyboard_id] = [];
      sbPropIds[row.storyboard_id].push(row.prop_id);
    }
  }

  // ---- 8. 组装 project.json ----
  // 收集 extra_images 需要打包的文件：{ localRelPath, zipPath }
  const extraFilesToPack = [];

  const zipData = {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    drama: {
      title: drama.title,
      description: drama.description,
      genre: drama.genre,
      style: drama.style,
      status: drama.status,
      tags: drama.tags,
      metadata,
    },
    episodes: episodes.map(ep => {
      const sbs = storyboardsByEp[ep.id] || [];
      return {
        episode_number: ep.episode_number,
        title: ep.title,
        description: ep.description,
        script_content: ep.script_content,
        duration: ep.duration,
        storyboards: sbs.map(sb => {
          const igsForThis = allImagesBySb[sb.id] || [];
          // 兼容：仍提供 image_file（指向首帧或最新一张），旧版导入器可继续工作
          let mainIg = igsForThis.find(g => g.id === sb.first_frame_image_id) || igsForThis[igsForThis.length - 1];
          const sbImageFile = mainIg ? `media/storyboards/sb_${sb.id}_gen_${mainIg.id}${extOf(mainIg.local_path)}` : null;
          const vg = videosBySb[sb.id];
          const sbVideoFile = vg && vg.local_path ? `media/videos/sb_${sb.id}${extOf(vg.local_path)}` : null;
          const sbAudioFile = sb.audio_local_path
            ? `media/audio/sb_${sb.id}${extOf(sb.audio_local_path)}`
            : null;
          const sbNarrationAudioFile = sb.narration_audio_local_path
            ? `media/audio/sb_${sb.id}_narration${extOf(sb.narration_audio_local_path)}`
            : null;

          // characters: 存储角色在导出列表中的下标（而非原 ID），方便跨项目恢复
          const charIds = parseSbChars(sb.characters);
          const characterIndices = charIds
            .map(id => charIdToIndex[id])
            .filter(idx => idx !== undefined);

          // scene_id: 存储场景在导出列表中的下标
          const sceneIndex = sb.scene_id != null ? (sceneIdToIndex[sb.scene_id] ?? null) : null;

          // prop_ids: 存储道具在导出列表中的下标（storyboard_props 关联）
          const sbPropIdList = sbPropIds[sb.id] || [];
          const propIndices = sbPropIdList
            .map(id => propIdToIndex[id])
            .filter(idx => idx !== undefined);

          return {
            storyboard_number: sb.storyboard_number,
            title: sb.title,
            description: sb.description,
            location: sb.location,
            time: sb.time,
            dialogue: sb.dialogue,
            narration: sb.narration || null,
            action: sb.action,
            atmosphere: sb.atmosphere,
            result: sb.result,
            shot_type: sb.shot_type,
            angle: sb.angle,
            angle_h: sb.angle_h || null,
            angle_v: sb.angle_v || null,
            angle_s: sb.angle_s || null,
            movement: sb.movement,
            lighting_style: sb.lighting_style || null,
            depth_of_field: sb.depth_of_field || null,
            image_prompt: sb.image_prompt,
            polished_prompt: sb.polished_prompt || null,
            video_prompt: sb.video_prompt,
            duration: sb.duration,
            emotion: sb.emotion,
            emotion_intensity: sb.emotion_intensity,
            segment_index: sb.segment_index ?? 0,
            segment_title: sb.segment_title || null,
            continuity_snapshot: sb.continuity_snapshot || null,
            creation_mode: sb.creation_mode === 'universal' ? 'universal' : 'classic',
            universal_segment_text: sb.universal_segment_text || null,
            layout_description: sb.layout_description || null,
            // 用 original_id 记录首尾帧绑定的 image_generations 旧ID，导入时映射回新ID
            first_frame_image_original_id: sb.first_frame_image_id ?? null,
            last_frame_image_original_id: sb.last_frame_image_id ?? null,
            last_frame_image_url: sb.last_frame_image_url || null,
            last_frame_local_path: sb.last_frame_local_path || null,
            character_indices: characterIndices,
            scene_index: sceneIndex,
            prop_indices: propIndices,
            image_file: sbImageFile,
            video_file: sbVideoFile,
            audio_file: sbAudioFile,
            narration_audio_file: sbNarrationAudioFile,
            // 完整分镜图片历史（含首尾帧），导入后可恢复 getSbAllImages + 绑定
            image_generations: igsForThis.map(ig => ({
              original_id: ig.id,
              provider: ig.provider || 'imported',
              prompt: ig.prompt || null,
              negative_prompt: ig.negative_prompt || null,
              model: ig.model || null,
              frame_type: ig.frame_type || null,
              size: ig.size || null,
              quality: ig.quality || null,
              status: ig.status || 'completed',
              error_msg: ig.error_msg || null,
              created_at: ig.created_at || null,
              updated_at: ig.updated_at || null,
              completed_at: ig.completed_at || null,
              zip_file: `media/storyboards/sb_${sb.id}_gen_${ig.id}${extOf(ig.local_path)}`,
            })),
            // 首尾帧提示词编辑器保存的专业提示词（含 layout）
            frame_prompts: framePromptsBySb[sb.id] || [],
          };
        }),
      };
    }),
    characters: characters.map((c, idx) => {
      // 收集 extra_images 文件
      const extras = parseExtraImages(c.extra_images);
      const extraFiles = extras.map((relPath, i) => {
        const zipPath = `media/characters/extra_char_${c.id}_${i}${extOf(relPath)}`;
        extraFilesToPack.push({ localRelPath: relPath, zipPath });
        return zipPath;
      });
      return {
        name: c.name,
        role: c.role,
        description: c.description,
        personality: c.personality,
        appearance: c.appearance,
        voice_style: c.voice_style,
        polished_prompt: c.polished_prompt || null,
        image_file: c.local_path ? `media/characters/char_${c.id}${extOf(c.local_path)}` : null,
        extra_image_files: extraFiles,
      };
    }),
    scenes: dedupedScenes.map(s => {
      const epIdx = episodeIds.indexOf(s.episode_id);
      const extras = parseExtraImages(s.extra_images);
      const extraFiles = extras.map((relPath, i) => {
        const zipPath = `media/scenes/extra_scene_${s.id}_${i}${extOf(relPath)}`;
        extraFilesToPack.push({ localRelPath: relPath, zipPath });
        return zipPath;
      });
      return {
        location: s.location,
        time: s.time,
        prompt: s.prompt,
        polished_prompt: s.polished_prompt || null,
        episode_index: epIdx >= 0 ? epIdx : null,
        image_file: s.local_path ? `media/scenes/scene_${s.id}${extOf(s.local_path)}` : null,
        extra_image_files: extraFiles,
      };
    }),
    props: props.map(p => {
      const epIdx = episodeIds.indexOf(p.episode_id);
      const extras = parseExtraImages(p.extra_images);
      const extraFiles = extras.map((relPath, i) => {
        const zipPath = `media/props/extra_prop_${p.id}_${i}${extOf(relPath)}`;
        extraFilesToPack.push({ localRelPath: relPath, zipPath });
        return zipPath;
      });
      return {
        name: p.name,
        type: p.type,
        description: p.description,
        prompt: p.prompt,
        episode_index: epIdx >= 0 ? epIdx : null,
        image_file: p.local_path ? `media/props/prop_${p.id}${extOf(p.local_path)}` : null,
        extra_image_files: extraFiles,
      };
    }),
  };

  // ---- 9. 打包 ZIP ----
  const zip = new AdmZip();
  zip.addFile('project.json', Buffer.from(JSON.stringify(zipData, null, 2), 'utf8'));

  // 分镜图片完整历史（含首尾帧 first/last 专用图 + 所有历史生成）
  for (const { localRelPath, zipPath } of imageFilesToPack) {
    const abs = localPathToAbs(storagePath, localRelPath);
    const buf = safeReadFile(abs);
    if (buf) zip.addFile(zipPath, buf);
  }

  // 分镜视频
  for (const [sbId, vg] of Object.entries(videosBySb)) {
    if (vg.local_path) {
      const abs = localPathToAbs(storagePath, vg.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/videos/sb_${sbId}${extOf(vg.local_path)}`, buf);
    }
  }

  // 分镜对白 TTS / 解说旁白 TTS（分字段存储）
  for (const ep of episodes) {
    for (const sb of storyboardsByEp[ep.id] || []) {
      if (sb.audio_local_path) {
        const abs = localPathToAbs(storagePath, sb.audio_local_path);
        const buf = safeReadFile(abs);
        if (buf) zip.addFile(`media/audio/sb_${sb.id}${extOf(sb.audio_local_path)}`, buf);
      }
      if (sb.narration_audio_local_path) {
        const abs = localPathToAbs(storagePath, sb.narration_audio_local_path);
        const buf = safeReadFile(abs);
        if (buf) zip.addFile(`media/audio/sb_${sb.id}_narration${extOf(sb.narration_audio_local_path)}`, buf);
      }
    }
  }

  // 角色主图
  for (const c of characters) {
    if (c.local_path) {
      const abs = localPathToAbs(storagePath, c.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/characters/char_${c.id}${extOf(c.local_path)}`, buf);
    }
  }

  // 场景主图
  for (const s of dedupedScenes) {
    if (s.local_path) {
      const abs = localPathToAbs(storagePath, s.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/scenes/scene_${s.id}${extOf(s.local_path)}`, buf);
    }
  }

  // 道具主图
  for (const p of props) {
    if (p.local_path) {
      const abs = localPathToAbs(storagePath, p.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/props/prop_${p.id}${extOf(p.local_path)}`, buf);
    }
  }

  // extra_images（角色/场景/道具的额外参考图）
  for (const { localRelPath, zipPath } of extraFilesToPack) {
    const abs = localPathToAbs(storagePath, localRelPath);
    const buf = safeReadFile(abs);
    if (buf) zip.addFile(zipPath, buf);
  }

  log.info('Drama exported', { drama_id: dramaId, title: drama.title });
  return { buffer: zip.toBuffer(), title: drama.title };
}

module.exports = { exportDrama };
