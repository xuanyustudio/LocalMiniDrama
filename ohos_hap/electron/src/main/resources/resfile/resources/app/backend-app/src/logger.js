const fs = require('fs');
const path = require('path');

// 简单 logger，和 Go 端行为接近；若设置 LOG_FILE 则同时追加到该文件（便于打包 exe 双击时查日志）
function log(level, msg, ...args) {
  const time = new Date().toISOString();
  let rest = '';
  if (args.length && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    rest = ' ' + JSON.stringify(args[0]);
  } else if (args.length) {
    rest = ' ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  }
  const line = `${time} [${level}] ${msg}${rest}\n`;
  try {
    console.log(line.trimEnd());
  } catch (_) {}
  const logFile = process.env.LOG_FILE;
  if (logFile) {
    try {
      const dir = path.dirname(logFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(logFile, line);
    } catch (_) {}
  }
}

module.exports = {
  info(msg, ...args) {
    log('INFO', msg, ...args);
  },
  infow(msg, ...args) {
    log('INFO', msg, ...args);
  },
  warn(msg, ...args) {
    log('WARN', msg, ...args);
  },
  warnw(msg, ...args) {
    log('WARN', msg, ...args);
  },
  error(msg, ...args) {
    log('ERROR', msg, ...args);
  },
  errorw(msg, ...args) {
    log('ERROR', msg, ...args);
  },
};
