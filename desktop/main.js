const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 显式固定 userData 目录，使开发模式与打包 exe 路径完全一致，防止 productName 变更导致路径漂移
const USERDATA_DIR = path.join(app.getPath('appData'), 'localminidrama-desktop');
app.setPath('userData', USERDATA_DIR);

// 兼容迁移：若旧路径 LocalMiniDrama 有数据而新路径为空，自动迁移
;(function migrateOldUserData() {
  const oldPath = path.join(app.getPath('appData'), 'LocalMiniDrama');
  if (fs.existsSync(oldPath) && !fs.existsSync(USERDATA_DIR)) {
    try {
      fs.renameSync(oldPath, USERDATA_DIR);
    } catch (e) {
      // rename 跨驱动器时会失败，此时静默忽略，用户数据仍可手动迁移
    }
  }
})();

const BACKEND_APP_PATH = path.join(__dirname, 'backend-app');
const BACKEND_NODE_PATH = path.join(__dirname, '..', 'backend-node');
const DEFAULT_PORT = 5679;

let serverInstance = null;

/** 开发模式用 backend-node（改代码即生效）；打包后用 backend-app */
function getBackendModulePath() {
  if (app.isPackaged) return BACKEND_APP_PATH;
  return fs.existsSync(BACKEND_NODE_PATH) ? BACKEND_NODE_PATH : BACKEND_APP_PATH;
}

function getBackendCwd() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'backend');
  }
  return getBackendModulePath();
}

function ensureBackendCwd(backendCwd) {
  if (!fs.existsSync(backendCwd)) {
    fs.mkdirSync(backendCwd, { recursive: true });
  }
  const configsDir = path.join(backendCwd, 'configs');
  const dataDir = path.join(backendCwd, 'data');
  const logsDir = path.join(backendCwd, 'logs');
  const configPath = path.join(configsDir, 'config.yaml');

  if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir, { recursive: true });
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  // 首次安装时，从打包内置的 config.yaml 复制到用户数据目录
  const bundledConfig = path.join(getBackendModulePath(), 'configs', 'config.yaml');
  if (!fs.existsSync(configPath) && fs.existsSync(bundledConfig)) {
    fs.copyFileSync(bundledConfig, configPath);
  }

  // 每次启动时，将内置 config.yaml 中的 vendor_lock 节强制同步到用户 config.yaml，
  // 确保打包时配置的锁定策略对所有用户生效，不受首次安装后遗留旧配置影响。
  if (fs.existsSync(bundledConfig) && fs.existsSync(configPath)) {
    try {
      const yaml = require('js-yaml');
      const userCfg = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
      const bundledCfg = yaml.load(fs.readFileSync(bundledConfig, 'utf8')) || {};
      if (bundledCfg.vendor_lock !== undefined) {
        userCfg.vendor_lock = bundledCfg.vendor_lock;
        fs.writeFileSync(configPath, yaml.dump(userCfg, { lineWidth: -1 }), 'utf8');
      }
    } catch (e) {
      console.warn('[config] Failed to sync vendor_lock from bundled config:', e.message);
    }
  }
}

/**
 * 首次启动时，将打包内置的 ffmpeg 自动复制到 userData/backend/tools/ffmpeg/。
 * 来源：process.resourcesPath/ffmpeg/（由 electron-builder extraResources 写入）。
 * 已存在则跳过，不会重复覆盖，也不影响用户手动替换版本。
 */
function ensureFfmpeg(backendCwd) {
  if (!app.isPackaged) return;
  const isWin = process.platform === 'win32';
  const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const ffprobeName = isWin ? 'ffprobe.exe' : 'ffprobe';

  const destDir = path.join(backendCwd, 'tools', 'ffmpeg');
  const destFfmpeg = path.join(destDir, ffmpegName);

  // 已存在则跳过（支持用户手动替换）
  if (fs.existsSync(destFfmpeg)) {
    console.log('[ffmpeg] Already exists at', destFfmpeg);
    return;
  }

  const srcDir = path.join(process.resourcesPath, 'ffmpeg');
  const srcFfmpeg = path.join(srcDir, ffmpegName);
  if (!fs.existsSync(srcFfmpeg)) {
    console.warn(
      '[ffmpeg] Bundled ffmpeg not found, skipping auto-extract. Expected:',
      srcFfmpeg,
      '(打包前请将 ffmpeg.exe 放入 backend-node/tools/ffmpeg，并确保 package.json 的 extraResources 包含该目录)'
    );
    return;
  }

  try {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcFfmpeg, destFfmpeg);
    if (!isWin) fs.chmodSync(destFfmpeg, 0o755);

    const srcFfprobe = path.join(srcDir, ffprobeName);
    if (fs.existsSync(srcFfprobe)) {
      const destFfprobe = path.join(destDir, ffprobeName);
      fs.copyFileSync(srcFfprobe, destFfprobe);
      if (!isWin) fs.chmodSync(destFfprobe, 0o755);
    }
    console.log('[ffmpeg] Auto-extracted to', destDir);
  } catch (e) {
    console.warn('[ffmpeg] Auto-extract failed:', e.message);
  }
}

function getWebDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontweb', 'dist');
  }
  return path.join(__dirname, '..', 'frontweb', 'dist');
}

/**
 * 探测端口是否空闲：优先使用 preferredPort，被占用时让 OS 分配一个随机空闲端口。
 * 返回最终可用的端口号。
 */
function findFreePort(preferredPort) {
  const net = require('net');
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => {
      // 首选端口被占，让 OS 随机分配
      const fallback = net.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const port = fallback.address().port;
        fallback.close(() => resolve(port));
      });
    });
    probe.listen(preferredPort, '127.0.0.1', () => {
      probe.close(() => resolve(preferredPort));
    });
  });
}

function createWindow(port) {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    show: false,
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://127.0.0.1:${port}`);
  win.on('closed', () => app.quit());
  if (process.env.LOCALMINIDRAMA_DEVTOOLS === '1') {
    win.webContents.openDevTools();
  }
}

/** 后端始终在主进程内运行（打包用子进程会重复启动 exe 导致大量进程，故取消） */
async function startBackend() {
  const backendCwd = getBackendCwd();
  ensureBackendCwd(backendCwd);
  ensureFfmpeg(backendCwd);
  process.env.WEB_DIST_PATH = getWebDistPath();
  if (app.isPackaged) {
    process.env.LOG_FILE = path.join(backendCwd, 'logs', 'app.log');
    process.env.EXAMPLE_DRAMA_PATH = path.join(process.resourcesPath, 'example_drama');
  } else {
    process.env.EXAMPLE_DRAMA_PATH = path.join(__dirname, '..', 'example_drama');
  }
  process.chdir(backendCwd);

  const backendModulePath = getBackendModulePath();
  try {
    require(path.join(backendModulePath, 'src', 'db', 'migrate.js'));
  } catch (err) {
    console.warn('Migration warning:', err.message);
  }

  const { createApp } = require(path.join(backendModulePath, 'src', 'app.js'));
  const { createServer } = require('http');
  const { app: expressApp, config } = createApp();
  const preferredPort = config.server?.port || DEFAULT_PORT;

  // 自动探测空闲端口：优先默认端口，被占时由 OS 分配，支持多实例同时运行
  const port = await findFreePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} in use, using ${port}`);
  }

  return new Promise((resolve, reject) => {
    const server = createServer(expressApp);
    serverInstance = server;
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      console.log('Backend listening on', port);
      resolve(port);
    });
  });
}

app.whenReady().then(async () => {
  let port;
  try {
    port = await startBackend();
  } catch (err) {
    console.error('Failed to start backend', err);
    app.quit();
    return;
  }
  // startBackend 的 Promise 在 listen 回调中 resolve，服务器此时已就绪，直接建窗口
  createWindow(port);
});

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
});
