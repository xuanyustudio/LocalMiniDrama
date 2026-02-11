const { createApp } = require('./app.js');
const { closeDb } = require('./db/index.js');
const logger = require('./logger.js');

const { app, config } = createApp();
const port = Number(process.env.PORT) || config.server?.port || 5679;
const host = config.server?.host || '0.0.0.0';

const server = app.listen(port, host, () => {
  logger.info('Server starting', { port, host });
  logger.info('Frontend:  http://localhost:' + port);
  logger.info('API:       http://localhost:' + port + '/api/v1');
  logger.info('Health:    http://localhost:' + port + '/health');
  logger.info('Server is ready!');
});

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
