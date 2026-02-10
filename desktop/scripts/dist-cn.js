process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR = 'https://cdn.npmmirror.com/binaries/electron-builder-binaries/';

const { spawnSync } = require('child_process');
const isWin = process.platform === 'win32';
const result = spawnSync(isWin ? 'npm.cmd' : 'npm', ['run', 'dist'], {
  stdio: 'inherit',
  shell: isWin,
  cwd: require('path').join(__dirname, '..'),
});
process.exit(result.status || 0);
