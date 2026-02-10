const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db/index.js');
const { loadConfig } = require('./config/index.js');
const logger = require('./logger.js');
const { setupRouter } = require('./routes/index.js');

function createApp() {
  const config = loadConfig();
  const db = getDb(config.database);
  const log = logger;

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    cors({
      origin: config.server.cors_origins && config.server.cors_origins.length
        ? config.server.cors_origins
        : '*',
    })
  );

  app.use((req, res, next) => {
    log.info(req.method, req.path);
    next();
  });

  if (config.storage?.local_path) {
    app.use('/static', express.static(config.storage.local_path));
  }

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      app: config.app.name,
      version: config.app.version,
    });
  });

  app.use('/api/v1', setupRouter(config, db, log));

  // 前端静态资源（与 Go 一致：web/dist）；Electron 打包时可设 WEB_DIST_PATH
  const webDist = process.env.WEB_DIST_PATH || path.join(process.cwd(), '..', 'frontweb', 'dist');
  console.log('webDist', webDist);
  if (fs.existsSync(webDist)) {
    app.use('/assets', express.static(path.join(webDist, 'assets')));
    app.get('/favicon.ico', (req, res) => {
      const fav = path.join(webDist, 'favicon.ico');
      if (fs.existsSync(fav)) res.sendFile(fav);
      else res.status(404).end();
    });
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const indexHtml = path.join(webDist, 'index.html');
      if (fs.existsSync(indexHtml)) res.sendFile(indexHtml);
      else next();
    });
  } else {
    app.get('/', (req, res) => {
      res.send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>LocalMiniDrama</title></head><body>' +
          '<h1>LocalMiniDrama API</h1><p>后端已启动。请先构建前端：</p>' +
          '<pre>cd web &amp;&amp; pnpm install &amp;&amp; pnpm build</pre>' +
          '<p>然后将 <code>web/dist</code> 放到与 backend-node 同级的 <code>web/dist</code>，或访问 <a href="/health">/health</a> 检查接口。</p></body></html>'
      );
    });
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.status(404).send('Not Found');
  });

  app.use((err, req, res, next) => {
    log.errorw('Unhandled error', { error: err.message, path: req.path });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message || '服务器错误' }, timestamp: new Date().toISOString() });
    }
  });

  return { app, config, db };
}

module.exports = { createApp };
