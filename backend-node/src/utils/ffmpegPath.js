/**
 * 解析 ffmpeg / ffprobe 可执行路径：优先使用项目内 tools/ffmpeg，其次环境变量，最后系统 PATH。
 * 将 ffmpeg 拷贝到 backend-node/tools/ffmpeg/ 后无需配置环境变量即可使用。
 */
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
const ffprobeName = isWin ? 'ffprobe.exe' : 'ffprobe';

/** backend-node 根目录（本文件在 src/utils 下） */
const backendRoot = path.resolve(__dirname, '..', '..');
const toolsFfmpegDir = path.join(backendRoot, 'tools', 'ffmpeg');

function resolveFfmpegBin(name) {
  const fromEnv = process.env[name === ffmpegName ? 'FFMPEG_PATH' : 'FFPROBE_PATH'];
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const localPath = path.join(toolsFfmpegDir, name);
  if (fs.existsSync(localPath)) return localPath;
  return name;
}

/**
 * 返回 ffmpeg 可执行路径（用于 spawn/exec）。
 * 优先：项目 tools/ffmpeg/ffmpeg[.exe]，其次环境变量 FFMPEG_PATH，否则 'ffmpeg'（依赖系统 PATH）。
 */
function getFfmpegPath() {
  return resolveFfmpegBin(ffmpegName);
}

/**
 * 返回 ffprobe 可执行路径。
 * 优先：项目 tools/ffmpeg/ffprobe[.exe]，其次环境变量 FFPROBE_PATH，否则 'ffprobe'。
 */
function getFfprobePath() {
  return resolveFfmpegBin(ffprobeName);
}

/** 项目内 tools/ffmpeg 目录是否存在且包含 ffmpeg */
function hasLocalFfmpeg() {
  const p = path.join(toolsFfmpegDir, ffmpegName);
  return fs.existsSync(p);
}

module.exports = {
  getFfmpegPath,
  getFfprobePath,
  hasLocalFfmpeg,
  toolsFfmpegDir,
};
