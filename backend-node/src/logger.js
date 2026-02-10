// 简单 logger，和 Go 端行为接近
function log(level, msg, ...args) {
  const time = new Date().toISOString();
  let rest = '';
  if (args.length && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    rest = ' ' + JSON.stringify(args[0]);
  } else if (args.length) {
    rest = ' ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  }
  console.log(`${time} [${level}] ${msg}${rest}`);
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
