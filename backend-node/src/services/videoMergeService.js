const path = require('path');
const fs = require('fs');
const { getFfmpegPath, getFfprobePath, hasLocalFfmpeg } = require('../utils/ffmpegPath');
const storageLayout = require('./storageLayout');

function list(db, query) {
  let sql = 'FROM video_merges WHERE deleted_at IS NULL';
  const params = [];
  if (query.episode_id) {
    sql += ' AND episode_id = ?';
    params.push(query.episode_id);
  }
  if (query.drama_id) {
    sql += ' AND drama_id = ?';
    params.push(query.drama_id);
  }
  const rows = db.prepare('SELECT * ' + sql + ' ORDER BY created_at DESC').all(...params);
  return rows.map(rowToItem);
}

function rowToItem(r) {
  return {
    id: r.id,
    episode_id: r.episode_id,
    drama_id: r.drama_id,
    title: r.title,
    provider: r.provider,
    status: r.status,
    merged_url: r.merged_url,
    duration: r.duration ?? undefined,
    task_id: r.task_id,
    error_msg: r.error_msg ?? undefined,
    created_at: r.created_at,
    completed_at: r.completed_at,
  };
}

function getById(db, id) {
  const r = db.prepare('SELECT * FROM video_merges WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return r ? rowToItem(r) : null;
}

function create(db, log, req) {
  const now = new Date().toISOString();
  const taskService = require('./taskService');
  const task = taskService.createTask(db, log, 'video_merge', String(req.episode_id || ''));
  const mergeOptionsJson = (() => {
    const o = req.merge_options;
    if (o && typeof o === 'object') return JSON.stringify(o);
    return '{}';
  })();
  const info = db.prepare(
    `INSERT INTO video_merges (episode_id, drama_id, title, provider, model, status, scenes, merge_options, task_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).run(
    Number(req.episode_id) || 0,
    Number(req.drama_id) || 0,
    req.title ?? null,
    req.provider || 'ffmpeg',
    req.model ?? null,
    req.scenes ? JSON.stringify(req.scenes) : '[]',
    mergeOptionsJson,
    task.id,
    now
  );
  return { merge_id: info.lastInsertRowid, task_id: task.id, ...getById(db, info.lastInsertRowid) };
}

function deleteById(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE video_merges SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  return result.changes > 0;
}

/** 获取 storage 根目录（绝对路径） */
function getStorageRoot() {
  const loadConfig = require('../config').loadConfig;
  const cfg = loadConfig();
  const p = cfg.storage?.local_path || './data/storage';
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

/** 将 video_url 解析为本地文件路径，或下载到 temp 返回路径 */
async function resolveVideoToLocalPath(videoUrl, baseUrl, storageRoot, tempDir, index, log) {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  const u = videoUrl.trim();
  // 1) URL 以 baseUrl 开头（如 http://localhost:5679/static）-> 对应 storageRoot 下相对路径
  if (baseUrl && (u.startsWith(baseUrl) || u.startsWith(baseUrl.replace(/\/$/, '')))) {
    const base = baseUrl.replace(/\/$/, '');
    const rel = u.startsWith(base + '/') ? u.slice(base.length + 1) : u.slice(base.length).replace(/^\//, '');
    if (rel && !rel.startsWith('http')) {
      const localPath = path.join(storageRoot, rel.replace(/\//g, path.sep));
      if (fs.existsSync(localPath)) {
        log.info('Video merge: using local static file', { index, path: localPath });
        return localPath;
      }
    }
  }
  // 2) 已是本地绝对路径且存在
  if (path.isAbsolute(u) && fs.existsSync(u)) {
    log.info('Video merge: using absolute path', { index, path: u });
    return u;
  }
  // 3) 相对路径（相对 storageRoot）
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    const localPath = path.join(storageRoot, u.replace(/^\//, '').replace(/\//g, path.sep));
    if (fs.existsSync(localPath)) {
      log.info('Video merge: using relative path', { index, path: localPath });
      return localPath;
    }
  }
  // 4) 远程 URL：下载到 temp
  const ext = u.includes('.mp4') ? '.mp4' : u.includes('.webm') ? '.webm' : '.mp4';
  const destPath = path.join(tempDir, `dl_${Date.now()}_${index}${ext}`);
  try {
    const res = await fetch(u, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    log.info('Video merge: downloaded to temp', { index, dest: destPath });
    return destPath;
  } catch (e) {
    log.warn('Video merge: download failed', { index, url: u, error: e.message });
    return null;
  }
}

/** 使用 ffmpeg concat 合并多个视频文件 */
function runFfmpegConcat(localPaths, outputPath, log) {
  const ffmpegBin = getFfmpegPath();
  const isWin = process.platform === 'win32';
  const listFile = path.join(path.dirname(outputPath), `concat_list_${Date.now()}.txt`);
  try {
    const lines = localPaths.map((p) => {
      const normalized = p.replace(/\\/g, '/');
      return `file '${normalized.replace(/'/g, "'\\''")}'`;
    });
    fs.writeFileSync(listFile, lines.join('\n'), 'utf8');
    const { spawnSync } = require('child_process');
    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      '-y',
      outputPath,
    ];
    const result = spawnSync(ffmpegBin, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (result.error) {
      log.warn('Video merge: ffmpeg spawn error', { error: result.error.message });
      return false;
    }
    if (result.status !== 0) {
      log.warn('Video merge: ffmpeg failed', { stderr: result.stderr?.slice(-500) });
      return false;
    }
    return true;
  } finally {
    try { if (fs.existsSync(listFile)) fs.unlinkSync(listFile); } catch (_) {}
  }
}

function probeMedia(localPath) {
  const { spawnSync } = require('child_process');
  const result = spawnSync(getFfprobePath(), [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', localPath,
  ], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout || '{}');
    const duration = Number(parsed.format?.duration);
    return {
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      hasAudio: Array.isArray(parsed.streams) && parsed.streams.some((s) => s.codec_type === 'audio'),
    };
  } catch (_) {
    return null;
  }
}

/**
 * 用约两帧的微交叠消除编码边界。连续性链路已让下一镜继承上一镜真实尾帧，
 * 因此这里只做亚感知融合；常规长度的溶解会把生成模型的细微形变暴露成双影。
 * 任何媒体不满足条件时由调用方回退到确定性 concat。
 */
function runFfmpegCrossfade(localPaths, outputPath, transitionSeconds, log) {
  if (localPaths.length < 2) return false;
  const media = localPaths.map(probeMedia);
  if (media.some((item) => !item || item.duration <= transitionSeconds * 2)) return false;
  const allHaveAudio = media.every((item) => item.hasAudio);
  const { spawnSync } = require('child_process');
  const args = [];
  localPaths.forEach((p) => args.push('-i', p));
  const filters = [];
  let videoIn = '[0:v]';
  let audioIn = '[0:a]';
  let cumulative = media[0].duration;
  for (let i = 1; i < localPaths.length; i++) {
    const videoOut = i === localPaths.length - 1 ? '[vout]' : `[vx${i}]`;
    const offset = Math.max(0.01, cumulative - transitionSeconds * i);
    filters.push(`${videoIn}[${i}:v]xfade=transition=fade:duration=${transitionSeconds}:offset=${offset.toFixed(3)}${videoOut}`);
    videoIn = videoOut;
    if (allHaveAudio) {
      const audioOut = i === localPaths.length - 1 ? '[aout]' : `[ax${i}]`;
      filters.push(`${audioIn}[${i}:a]acrossfade=d=${transitionSeconds}:c1=tri:c2=tri${audioOut}`);
      audioIn = audioOut;
    }
    cumulative += media[i].duration;
  }
  args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
  if (allHaveAudio) args.push('-map', '[aout]');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p');
  if (allHaveAudio) args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-movflags', '+faststart', '-y', outputPath);
  const result = spawnSync(getFfmpegPath(), args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) {
    log.warn('Video merge: crossfade failed, will use concat fallback', { stderr: result.stderr?.slice(-800) });
    return false;
  }
  return true;
}

/** Read the actual container duration after FFmpeg has written the final file. */
function readMediaDurationSeconds(localPath) {
  try {
    const { spawnSync } = require('child_process');
    const probe = spawnSync(getFfprobePath(), [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', localPath,
    ], { encoding: 'utf8' });
    if (probe.status !== 0) return null;
    const seconds = Number.parseFloat(String(probe.stdout || '').trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch (_) {
    return null;
  }
}

function failVideoMerge(db, taskService, mergeId, taskId, episodeId, message) {
  const now = new Date().toISOString();
  db.prepare('UPDATE video_merges SET status = ?, error_msg = ?, completed_at = ? WHERE id = ?')
    .run('failed', message, now, mergeId);
  db.prepare('UPDATE episodes SET status = ?, updated_at = ? WHERE id = ?')
    .run('failed', now, episodeId);
  if (taskId) taskService.updateTaskError(db, taskId, message);
}

/**
 * 异步处理视频合成。成片必须包含全部片段；任一片段不可用或 FFmpeg 合成失败时明确失败，绝不以首段冒充成片。
 */
async function processVideoMerge(db, log, mergeId, baseUrl) {
  const r = db.prepare('SELECT * FROM video_merges WHERE id = ? AND deleted_at IS NULL').get(mergeId);
  if (!r) return;
  const taskId = r.task_id;
  const episodeId = r.episode_id;
  let scenes = [];
  try {
    scenes = JSON.parse(r.scenes || '[]');
  } catch (_) {
    log.warn('video merge parse scenes failed', { merge_id: mergeId });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE video_merges SET status = ? WHERE id = ?').run('processing', mergeId);
  const taskService = require('./taskService');
  if (scenes.length === 0) {
    failVideoMerge(db, taskService, mergeId, taskId, episodeId, '无有效视频片段');
    return;
  }

  const plannedDuration = scenes.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const storageRoot = getStorageRoot();
  const tempDir = path.join(require('os').tmpdir(), 'drama-video-merge');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const localPaths = [];
  const toCleanup = [];
  for (let i = 0; i < scenes.length; i++) {
    const p = await resolveVideoToLocalPath(
      scenes[i].video_url,
      baseUrl,
      storageRoot,
      tempDir,
      i,
      log
    );
    if (p) {
      localPaths.push(p);
      if (p.startsWith(tempDir)) toCleanup.push(p);
    }
  }

  const ffmpegAvailable = hasLocalFfmpeg();
  log.info('Video merge: ffmpeg check', {
    merge_id: mergeId,
    has_ffmpeg: ffmpegAvailable,
    ffmpeg_path: getFfmpegPath(),
    local_video_count: localPaths.length,
    cwd: process.cwd(),
  });

  if (localPaths.length !== scenes.length) {
    for (const p of toCleanup) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} }
    failVideoMerge(db, taskService, mergeId, taskId, episodeId, `视频片段不完整：需要 ${scenes.length} 段，仅成功读取 ${localPaths.length} 段`);
    return;
  }
  if (!ffmpegAvailable) {
    for (const p of toCleanup) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} }
    failVideoMerge(db, taskService, mergeId, taskId, episodeId, 'FFmpeg 不可用，无法生成完整成片');
    return;
  }
  if (localPaths.length > 100) {
    for (const p of toCleanup) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} }
    failVideoMerge(db, taskService, mergeId, taskId, episodeId, '单次合成最多支持 100 段，请拆分剧集或使用分块合成');
    return;
  }

  let mergedRelativePath = null;
  {
    const projectSubdir = storageLayout.getProjectStorageSubdir(db, r.drama_id);
    const sub = projectSubdir && String(projectSubdir).trim();
    const mergedDir = sub
      ? path.join(storageRoot, sub, 'videos', 'merged')
      : path.join(storageRoot, 'videos', 'merged');
    if (!fs.existsSync(mergedDir)) fs.mkdirSync(mergedDir, { recursive: true });
    const outputFileName = `merged_${Date.now()}.mp4`;
    const outputPath = path.join(mergedDir, outputFileName);
    let mergeOptsForRender = {};
    try { mergeOptsForRender = JSON.parse(r.merge_options || '{}'); } catch (_) {}
    const transitionSeconds = Math.min(0.5, Math.max(0, Number(mergeOptsForRender.transition_duration) || 0));
    const ok = (transitionSeconds > 0 && runFfmpegCrossfade(localPaths, outputPath, transitionSeconds, log))
      || runFfmpegConcat(localPaths, outputPath, log);
    if (ok && fs.existsSync(outputPath)) {
      mergedRelativePath = sub
        ? path.join(sub, 'videos', 'merged', outputFileName).replace(/\\/g, '/')
        : path.join('videos', 'merged', outputFileName).replace(/\\/g, '/');
      log.info('Video merge completed (ffmpeg)', { merge_id: mergeId, episode_id: episodeId, output: mergedRelativePath });
    }
  }

  let mergeOpts = {};
  try {
    mergeOpts = JSON.parse(r.merge_options || '{}');
  } catch (_) {
    mergeOpts = {};
  }
  const postNeed =
    !!mergeOpts.burn_narration_subtitles
    || !!mergeOpts.burn_dialogue_audio
    || !!(mergeOpts.watermark_text && String(mergeOpts.watermark_text).trim());
  if (mergedRelativePath && ffmpegAvailable && postNeed) {
    const mergedAbsPath = path.join(storageRoot, mergedRelativePath.replace(/\//g, path.sep));
    if (fs.existsSync(mergedAbsPath)) {
      const mergedPP = require('./mergedEpisodePostProcess');
      const post = await mergedPP.runMergedEpisodePostProcess(db, log, {
        mergedAbsPath,
        storageRoot,
        scenes,
        episodeId,
        mergeOpts,
      });
      if (post.ok && post.relativePath) {
        mergedRelativePath = post.relativePath;
        log.info('Video merge: merged episode post-process', { merge_id: mergeId, out: mergedRelativePath });
      } else if (post.error && post.error !== 'NO_POST_OPTS') {
        log.warn('Video merge: post-process skipped', { merge_id: mergeId, err: post.error });
      }
    }
  }

  for (const p of toCleanup) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  }

  if (!mergedRelativePath) {
    failVideoMerge(db, taskService, mergeId, taskId, episodeId, 'FFmpeg 合成失败，未生成完整成片');
    return;
  }
  const actualDuration = readMediaDurationSeconds(path.join(storageRoot, mergedRelativePath.replace(/\//g, path.sep)));
  const finalMergedUrl = mergedRelativePath;
  db.prepare(
    'UPDATE video_merges SET status = ?, merged_url = ?, duration = ?, completed_at = ?, error_msg = ? WHERE id = ?'
  ).run('completed', finalMergedUrl, Math.round(actualDuration || plannedDuration) || null, now, null, mergeId);
  db.prepare('UPDATE episodes SET video_url = ?, status = ?, updated_at = ? WHERE id = ?').run(finalMergedUrl, 'completed', now, episodeId);
  if (taskId) {
    taskService.updateTaskResult(db, taskId, {
      merge_id: mergeId,
      video_url: finalMergedUrl,
      duration: Math.round(actualDuration || plannedDuration),
      actual_duration_seconds: actualDuration,
    });
  }
}

module.exports = {
  list,
  getById,
  create,
  deleteById,
  processVideoMerge,
};
