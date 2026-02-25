const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const BACKEND_APP_PATH = path.join(__dirname, 'backend-app');
const BACKEND_NODE_PATH = path.join(__dirname, '..', 'backend-node');
const DEFAULT_PORT = 5679;

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
  const examplePath = path.join(configsDir, 'config.example.yaml');

  if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir, { recursive: true });
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const sourceExample = path.join(getBackendModulePath(), 'configs', 'config.example.yaml');

  if (!fs.existsSync(configPath) && fs.existsSync(sourceExample)) {
    fs.copyFileSync(sourceExample, configPath);
  }
  if (!fs.existsSync(configPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, configPath);
  }
}

function getWebDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontweb', 'dist');
  }
  return path.join(__dirname, '..', 'frontweb', 'dist');
}

function waitForServer(port, maxWait = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const net = require('net');
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        if (Date.now() - start > maxWait) reject(new Error('Server start timeout'));
        else setTimeout(tryConnect, 200);
      });
      socket.on('timeout', () => {
        socket.destroy();
        if (Date.now() - start > maxWait) reject(new Error('Server start timeout'));
        else setTimeout(tryConnect, 200);
      });
      socket.connect(port, '127.0.0.1');
    };
    tryConnect();
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

let serverInstance = null;

/** 后端始终在主进程内运行（打包用子进程会重复启动 exe 导致大量进程，故取消） */
function startBackend() {
  const backendCwd = getBackendCwd();
  ensureBackendCwd(backendCwd);
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
  const port = config.server?.port || DEFAULT_PORT;

  const server = createServer(expressApp);
  server.listen(port, '127.0.0.1', () => {
    console.log('Backend listening on', port);
  });
  serverInstance = server;
  return port;
}

app.whenReady().then(() => {
  let port;
  try {
    port = startBackend();
  } catch (err) {
    console.error('Failed to start backend', err);
    app.quit();
    return;
  }
  waitForServer(port)
    .then(() => {
      createWindow(port);
    })
    .catch((err) => {
      console.error(err);
      app.quit();
    });
});

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
});
