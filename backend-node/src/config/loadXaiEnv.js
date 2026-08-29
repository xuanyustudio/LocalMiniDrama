const fs = require('fs');
const path = require('path');

/**
 * Fill process.env.XAI_API_KEY from a local .env file if the variable is unset.
 * Never logs the key. Backend still only reads process.env.XAI_API_KEY.
 */
function parseXaiApiKeyFromEnvText(text) {
  if (text == null) return '';
  const lines = String(text).split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^XAI_API_KEY\s*=\s*(.*)$/.exec(t);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
      (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
    ) {
      v = v.slice(1, -1);
    }
    return v.trim();
  }
  return '';
}

function applyXaiApiKeyFromFile(filePath, log) {
  if (process.env.XAI_API_KEY && String(process.env.XAI_API_KEY).trim()) return false;
  if (!filePath || !fs.existsSync(filePath)) return false;
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return false;
  }
  const key = parseXaiApiKeyFromEnvText(text);
  if (!key) return false;
  process.env.XAI_API_KEY = key;
  if (log && log.info) {
    log.info('XAI_API_KEY loaded from file', { path: path.basename(filePath) });
  }
  return true;
}

function loadXaiApiKeyFromDefaultLocations(extraDirs, log) {
  if (process.env.XAI_API_KEY && String(process.env.XAI_API_KEY).trim()) return 'env';
  const dirs = [];
  const add = (d) => {
    if (!d) return;
    const n = path.resolve(d);
    if (!dirs.includes(n)) dirs.push(n);
  };
  if (Array.isArray(extraDirs)) extraDirs.forEach(add);
  add(process.cwd());
  add(path.join(process.cwd(), 'configs'));
  for (const dir of dirs) {
    if (applyXaiApiKeyFromFile(path.join(dir, '.env'), log)) return 'file';
  }
  return '';
}

module.exports = {
  parseXaiApiKeyFromEnvText,
  applyXaiApiKeyFromFile,
  loadXaiApiKeyFromDefaultLocations,
};
