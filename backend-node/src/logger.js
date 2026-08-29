const fs = require('fs');
const path = require('path');

const SENSITIVE_KEY = /api[_-]?key|authorization|xai_api_key|secret|password|access_token|bearer/i;

function redactDeep(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/xai-[A-Za-z0-9_-]{8,}/gi, 'xai-[redacted]');
  }
  if (Array.isArray(value)) return value.map(redactDeep);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redactDeep(v);
    }
    return out;
  }
  return value;
}

function redactLogArgs(args) {
  return args.map((a) => (typeof a === 'object' && a !== null ? redactDeep(a) : redactDeep(a)));
}

// 简单 logger，和 Go 端行为接近；若设置 LOG_FILE 则同时追加到该文件（便于打包 exe 双击时查日志）
function log(level, msg, ...args) {
  const time = new Date().toISOString();
  const safeArgs = redactLogArgs(args);
  let rest = '';
  if (safeArgs.length && typeof safeArgs[0] === 'object' && safeArgs[0] !== null && !Array.isArray(safeArgs[0])) {
    rest = ' ' + JSON.stringify(safeArgs[0]);
  } else if (safeArgs.length) {
    rest = ' ' + safeArgs.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
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
  redactDeep,
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
