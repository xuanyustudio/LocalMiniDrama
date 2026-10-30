const { loadConfig } = require('./config/index.js');

const preConfig = loadConfig();
const tlsFlag = preConfig.server?.insecure_tls ?? preConfig.server?.INSECURE_TLS;
const insecureTlsOn =
  tlsFlag === true ||
  tlsFlag === 1 ||
  tlsFlag === '1' ||
  String(tlsFlag).toLowerCase() === 'true';
if (insecureTlsOn) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[config] server.insecure_tls 已启用：全局跳过 TLS 证书校验，仅用于测试');
}

const { createApp } = require('./app.js');
const { closeDb } = require('./db/index.js');
const logger = require('./logger.js');

const path = require('path');
const { app, config, db } = createApp();
const port = Number(process.env.PORT) || config.server?.port || 5679;
const host = config.server?.host || '0.0.0.0';

let server;
async function start() {
  try {
    const { initAgent } = await import('./mastra/index.mjs');
    const dataDir = path.resolve(path.dirname(config.database.path));
    await initAgent({ db, log: logger, config, dataDir });
  } catch (err) {
    logger.warn('助手未就绪', { error: err.message });
  }
  server = app.listen(port, host, () => {
    logger.info('Server starting', { port, host });
    logger.info('Frontend:  http://localhost:' + port);
    logger.info('API:       http://localhost:' + port + '/api/v1');
    logger.info('Health:    http://localhost:' + port + '/health');
    logger.info('Server is ready!');
  });
}
start();

function shutdown() {
  logger.info('Shutting down server...');
  server.close(() => {
    closeDb();
    logger.info('Server exited');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
