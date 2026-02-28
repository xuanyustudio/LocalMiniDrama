process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR = 'https://cdn.npmmirror.com/binaries/electron-builder-binaries/';

const { spawnSync } = require('child_process');
const path = require('path');
const isWin = process.platform === 'win32';
const cwd = path.join(__dirname, '..');

// 第一步：完整构建（含示例资源），前端/后端同时准备
console.log('\n========== [1/2] 构建完整版（含示例资源）==========\n');
const full = spawnSync(isWin ? 'npm.cmd' : 'npm', ['run', 'dist'], {
  stdio: 'inherit',
  shell: isWin,
  cwd,
});
if (full.status !== 0) {
  console.error('完整版构建失败，终止。');
  process.exit(full.status || 1);
}

// 第二步：纯净版构建（不含示例资源），前端/后端已准备好，直接调 electron-builder
console.log('\n========== [2/2] 构建纯净版（不含示例资源）==========\n');
const lite = spawnSync(
  isWin ? 'npx.cmd' : 'npx',
  ['electron-builder', '--win', '--config', 'electron-builder-lite.json'],
  {
    stdio: 'inherit',
    shell: isWin,
    cwd,
  }
);
if (lite.status !== 0) {
  console.error('纯净版构建失败。');
  process.exit(lite.status || 1);
}

console.log('\n========== 全部构建完成 ==========');
console.log('输出目录：release/');
console.log('  完整版安装包：LocalMiniDrama Setup x.x.x.exe');
console.log('  完整版便携版：LocalMiniDrama x.x.x.exe');
console.log('  纯净版安装包：LocalMiniDrama-Lite-Setup-x.x.x.exe');
console.log('  纯净版便携版：LocalMiniDrama-Lite-x.x.x.exe\n');
process.exit(0);
