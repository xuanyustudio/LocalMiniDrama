/**
 * 将 ffmpeg/ffprobe 从指定 bin 目录复制到 backend-node/tools/ffmpeg/
 * 用法：node scripts/copy-ffmpeg.js "D:\Program Files\ffmpeg-8.0.1-essentials_build\bin"
 */
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const targetDir = path.join(backendRoot, 'tools', 'ffmpeg');
const isWin = process.platform === 'win32';
const files = isWin ? ['ffmpeg.exe', 'ffprobe.exe'] : ['ffmpeg', 'ffprobe'];

const sourceDir = process.argv[2];
if (!sourceDir || !fs.existsSync(sourceDir)) {
  console.error('用法: node scripts/copy-ffmpeg.js <ffmpeg的bin目录路径>');
  console.error('示例: node scripts/copy-ffmpeg.js "D:\\Program Files\\ffmpeg-8.0.1-essentials_build\\bin"');
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

let copied = 0;
for (const name of files) {
  const src = path.join(sourceDir, name);
  const dest = path.join(targetDir, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('已复制:', name, '->', targetDir);
    copied++;
  } else {
    console.warn('跳过（源不存在）:', src);
  }
}

if (copied > 0) {
  console.log('完成。共复制', copied, '个文件到', targetDir);
} else {
  console.error('未复制任何文件，请检查源路径是否包含 ffmpeg.exe / ffprobe.exe');
  process.exit(1);
}
