const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker, workerData } = require('node:worker_threads');
const AdmZip = require('adm-zip');

// 压缩包在内存中生成；超过上限时按 图片→配音→分镜视频→整集视频 的优先级放入，放不下的列在 README 里
const MAX_MEDIA_BYTES = 400 * 1024 * 1024;

function srtTime(ms) {
  return [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60]
    .map(n => String(n).padStart(2, '0')).join(':') + ',' + String(ms % 1000).padStart(3, '0');
}

async function buildPackage(db, cfg, episodeId) {
  const episode = db.prepare('SELECT id, title, script_content, video_url FROM episodes WHERE id = ? AND deleted_at IS NULL').get(episodeId);
  if (!episode) return null;
  const shots = db.prepare(
    'SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number, id'
  ).all(episodeId);
  const root = path.resolve(cfg.storage.local_path);
  const movies = db.prepare("SELECT local_path FROM video_generations WHERE storyboard_id = ? AND status IN ('completed', 'succeeded') AND deleted_at IS NULL ORDER BY id DESC");
  const images = db.prepare("SELECT local_path FROM image_generations WHERE storyboard_id = ? AND status IN ('completed', 'succeeded') AND deleted_at IS NULL ORDER BY id DESC");
  for (const shot of shots) {
    shot.packageImage = images.all(shot.id).find(row => row.local_path)?.local_path || shot.local_path;
    shot.packageVideo = movies.all(shot.id).find(row => row.local_path)?.local_path || shot.video_url;
  }
  const folder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'localminidrama-jianying-'));
  const filename = path.join(folder, 'episode.zip');
  const cleanup = () => fs.promises.rm(folder, { recursive: true, force: true });
  try {
    await new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { jianying: { episode, shots, root, filename } } });
      worker.once('error', reject);
      worker.once('exit', code => code === 0 ? resolve() : reject(new Error(`剪映素材包生成失败（${code}）`)));
    });
    return { filename, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function writePackage({ episode, shots, root, filename, maxBytes = MAX_MEDIA_BYTES }) {
  const zip = new AdmZip();
  const subtitles = [];
  const candidates = [];
  let timelineMs = 0;
  const realRoot = fs.realpathSync(root);

  // 只解析路径和大小，暂不读入；最后按优先级放入压缩包
  function media(value, target, extensions, priority, order) {
    if (!value) return null;
    let name = String(value);
    if (name.startsWith('/static/')) name = name.slice(8);
    if (/^[A-Za-z]+:\/\//.test(name) || path.isAbsolute(name)) return null;
    let actual;
    try { actual = fs.realpathSync(path.resolve(root, name)); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    const relative = path.relative(realRoot, actual);
    const extension = path.extname(actual).toLowerCase();
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) ||
      !extensions.includes(extension)) return null;
    const stat = fs.statSync(actual);
    if (!stat.isFile()) return null;
    const item = { actual, size: stat.size, entry: target + extension, priority, order, included: false };
    candidates.push(item);
    return item;
  }

  const timeline = shots.map((shot, i) => {
    const stem = 'shot-' + String(i + 1).padStart(3, '0');
    const start = timelineMs;
    const duration = Number(shot.duration);
    timelineMs += Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) : 0;
    if (shot.dialogue?.trim() && timelineMs > start) {
      subtitles.push(`${subtitles.length + 1}\r\n${srtTime(start)} --> ${srtTime(timelineMs)}\r\n${shot.dialogue.trim()}`);
    }
    return {
      shot: i + 1, title: shot.title, start_ms: start, end_ms: timelineMs,
      dialogue: shot.dialogue || '', action: shot.action || '',
      image: media(shot.packageImage, 'images/' + stem, ['.png', '.jpg', '.jpeg', '.webp'], 0, i),
      video: media(shot.packageVideo, 'videos/' + stem, ['.mp4', '.mov', '.webm'], 2, i),
      dialogue_audio: media(shot.audio_local_path, 'audio/' + stem, ['.wav', '.mp3', '.m4a', '.aac'], 1, i),
    };
  });
  const finalVideo = media(episode.video_url, 'episode', ['.mp4', '.mov'], 3, 0);

  let bytes = 0;
  const skipped = [];
  for (const item of [...candidates].sort((a, b) => a.priority - b.priority || a.order - b.order)) {
    if (bytes + item.size > maxBytes) { skipped.push(item.entry); continue; }
    bytes += item.size;
    item.included = true;
    zip.addFile(item.entry, fs.readFileSync(item.actual));
  }
  const ref = (item) => (item ? (item.included ? item.entry : 'skipped:too_large') : null);
  const shotsOut = timeline.map(shot => ({ ...shot, image: ref(shot.image), video: ref(shot.video), dialogue_audio: ref(shot.dialogue_audio) }));

  let readme = '剪映交接包\r\n\r\n解压后导入 videos 和 audio，按 shot 编号排序。\r\n导入 dialogue.srt 作为字幕。字幕按分镜时长估算，精剪时请按对白重新对齐。\r\ntimeline.json 记录镜序和素材路径，null 表示该素材尚未生成。\r\nepisode.mp4 存在时可作为整集粗剪。\r\n';
  if (skipped.length) {
    readme += `\r\n素材总量超过 ${Math.round(maxBytes / 1024 / 1024)} MiB，以下文件未放入本包（timeline.json 中标为 skipped:too_large），请在工作台分镜里单独下载：\r\n${skipped.join('\r\n')}\r\n`;
  }
  zip.addFile('README.txt', Buffer.from(readme));
  zip.addFile('script.md', Buffer.from(episode.script_content || ''));
  zip.addFile('timeline.json', Buffer.from(JSON.stringify({ episode: episode.title, duration_ms: timelineMs, final_video: ref(finalVideo), skipped, shots: shotsOut }, null, 2)));
  if (subtitles.length) zip.addFile('dialogue.srt', Buffer.from('﻿' + subtitles.join('\r\n\r\n') + '\r\n'));
  zip.writeZip(filename);
}

if (workerData?.jianying) writePackage(workerData.jianying);

module.exports = { buildPackage, writePackage };
