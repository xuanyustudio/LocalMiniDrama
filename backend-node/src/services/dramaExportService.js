// 项目导出服务：将剧集所有数据和媒体文件打包为 ZIP
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const EXPORT_VERSION = '1.0';

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

  // ---- 4. 读取分镜图和视频（取最新完成的） ----
  const allSbIds = Object.values(storyboardsByEp).flat().map(s => s.id);
  const imagesBySb = {};
  const videosBySb = {};
  for (const sbId of allSbIds) {
    const ig = db.prepare(
      "SELECT local_path FROM image_generations WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
    ).get(sbId);
    if (ig && ig.local_path) imagesBySb[sbId] = ig;

    const vg = db.prepare(
      "SELECT video_url, local_path FROM video_generations WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
    ).get(sbId);
    if (vg) videosBySb[sbId] = vg;
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

  // ---- 8. 组装 project.json ----
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
          const ig = imagesBySb[sb.id];
          const sbImageFile = ig ? `media/storyboards/sb_${sb.id}${extOf(ig.local_path)}` : null;
          const vg = videosBySb[sb.id];
          const sbVideoFile = vg && vg.local_path ? `media/videos/sb_${sb.id}${extOf(vg.local_path)}` : null;
          return {
            storyboard_number: sb.storyboard_number,
            description: sb.description,
            location: sb.location,
            time: sb.time,
            dialogue: sb.dialogue,
            action: sb.action,
            atmosphere: sb.atmosphere,
            result: sb.result,
            shot_type: sb.shot_type,
            angle: sb.angle,
            movement: sb.movement,
            image_prompt: sb.image_prompt,
            video_prompt: sb.video_prompt,
            duration: sb.duration,
            image_file: sbImageFile,
            video_file: sbVideoFile,
          };
        }),
      };
    }),
    characters: characters.map(c => ({
      name: c.name,
      role: c.role,
      description: c.description,
      personality: c.personality,
      appearance: c.appearance,
      voice_style: c.voice_style,
      image_file: c.local_path ? `media/characters/char_${c.id}${extOf(c.local_path)}` : null,
    })),
    scenes: scenes.map(s => {
      const epIdx = episodeIds.indexOf(s.episode_id);
      return {
        location: s.location,
        time: s.time,
        prompt: s.prompt,
        episode_index: epIdx >= 0 ? epIdx : null,
        image_file: s.local_path ? `media/scenes/scene_${s.id}${extOf(s.local_path)}` : null,
      };
    }),
    props: props.map(p => {
      const epIdx = episodeIds.indexOf(p.episode_id);
      return {
        name: p.name,
        type: p.type,
        description: p.description,
        prompt: p.prompt,
        episode_index: epIdx >= 0 ? epIdx : null,
        image_file: p.local_path ? `media/props/prop_${p.id}${extOf(p.local_path)}` : null,
      };
    }),
  };

  // ---- 9. 打包 ZIP ----
  const zip = new AdmZip();
  zip.addFile('project.json', Buffer.from(JSON.stringify(zipData, null, 2), 'utf8'));

  // 分镜图（从 image_generations 取）
  for (const [sbId, ig] of Object.entries(imagesBySb)) {
    if (ig.local_path) {
      const abs = localPathToAbs(storagePath, ig.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/storyboards/sb_${sbId}${extOf(ig.local_path)}`, buf);
    }
  }

  // 分镜视频
  for (const [sbId, vg] of Object.entries(videosBySb)) {
    if (vg.local_path) {
      const abs = localPathToAbs(storagePath, vg.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/videos/sb_${sbId}${extOf(vg.local_path)}`, buf);
    }
  }

  // 角色图
  for (const c of characters) {
    if (c.local_path) {
      const abs = localPathToAbs(storagePath, c.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/characters/char_${c.id}${extOf(c.local_path)}`, buf);
    }
  }

  // 场景图
  for (const s of scenes) {
    if (s.local_path) {
      const abs = localPathToAbs(storagePath, s.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/scenes/scene_${s.id}${extOf(s.local_path)}`, buf);
    }
  }

  // 道具图
  for (const p of props) {
    if (p.local_path) {
      const abs = localPathToAbs(storagePath, p.local_path);
      const buf = safeReadFile(abs);
      if (buf) zip.addFile(`media/props/prop_${p.id}${extOf(p.local_path)}`, buf);
    }
  }

  log.info('Drama exported', { drama_id: dramaId, title: drama.title });
  return { buffer: zip.toBuffer(), title: drama.title };
}

module.exports = { exportDrama };
