const http = require('http');
const https = require('https');

function formatNetError(err) {
  const code = err && (err.code || (err.cause && err.cause.code));
  const msg = (err && err.message) || '网络请求失败';
  if (code && !String(msg).includes(code)) return `${msg} (${code})`;
  return msg;
}

/**
 * 用 Node http(s) 发请求，family: 4 固定走 IPv4。
 * Windows 上全局 fetch（undici）会优先连 IPv6；Cloudflare 的 AAAA 卡住时约 10 秒抛出 fetch failed，且本次不会再试 IPv4。
 * @returns {Promise<{ status: number, ok: boolean, text: () => string, buffer: () => Buffer }>}
 */
function ipv4Request(url, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  const timeoutMs = options.timeoutMs == null ? 120000 : options.timeoutMs;
  let payload = null;
  if (options.body != null) {
    payload = Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body));
    if (headers['Content-Length'] == null && headers['content-length'] == null) {
      headers['Content-Length'] = payload.length;
    }
  }
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      reject(e);
      return;
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
      family: 4,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        clearTimeout(timer);
        const raw = Buffer.concat(chunks);
        const status = res.statusCode || 0;
        resolve({
          status,
          ok: status >= 200 && status < 300,
          text: () => raw.toString('utf8'),
          buffer: () => raw,
        });
      });
      res.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    const timer = setTimeout(() => {
      req.destroy();
      const err = new Error(`IPv4 连接超时 ${timeoutMs}ms`);
      err.code = 'ETIMEDOUT';
      reject(err);
    }, timeoutMs);
    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { ipv4Request, formatNetError };
