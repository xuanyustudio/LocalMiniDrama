// backend-node/src/services/omnivoiceService.js
// 封装对本地 OmniVoice 推理服务（server/omnivoice_server.py）的调用。
// 该服务只监听 127.0.0.1，且 ref_audio 以本机文件路径传递（模型进程与 Node 后端运行在同一台机器上）。
const https = require('https');
const http = require('http');
const aiConfigService = require('./aiConfigService');

const DEFAULT_BASE_URL = 'http://127.0.0.1:8712';

function getOmnivoiceConfig(db) {
  const configs = aiConfigService.listConfigs(db, 'tts');
  const cfg = configs.find((c) => c.is_active && (c.provider || '').toLowerCase() === 'omnivoice');
  return { baseUrl: ((cfg && cfg.base_url) || DEFAULT_BASE_URL).replace(/\/+$/, '') };
}

function checkHealth(baseUrl) {
  return new Promise((resolve) => {
    const parsed = new URL('/health', baseUrl);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(parsed, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          resolve({ ready: !!json.ready, statusCode: res.statusCode });
        } catch (_) {
          resolve({ ready: false, statusCode: res.statusCode });
        }
      });
    });
    req.on('error', () => resolve({ ready: false, statusCode: 0 }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ ready: false, statusCode: 0 }); });
  });
}

async function ensureHealthy(baseUrl) {
  const health = await checkHealth(baseUrl);
  if (!health.ready) {
    throw new Error('OmniVoice 本地服务未启动或模型未加载完成，请先运行 server/omnivoice_server.py（参考 OmniVoice-master/server/omnivoice_server.py）');
  }
}

function postSynthesize(baseUrl, body, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL('/synthesize', baseUrl);
    const mod = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);
    const req = mod.request(parsed, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          let errMsg = buf.toString('utf-8').slice(0, 500);
          try { errMsg = JSON.parse(errMsg).error || errMsg; } catch (_) {}
          reject(new Error(`OmniVoice HTTP ${res.statusCode}: ${errMsg}`));
          return;
        }
        resolve(buf);
      });
    });
    const timer = setTimeout(() => { req.destroy(); reject(new Error('OmniVoice 合成请求超时')); }, timeoutMs);
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.on('close', () => clearTimeout(timer));
    req.write(bodyStr);
    req.end();
  });
}

/** 克隆模式：refAudioAbsPath 必须是 OmniVoice 服务进程能直接读取的本机绝对路径。 */
async function synthesizeCloning(text, refAudioAbsPath, refText, baseUrl) {
  await ensureHealthy(baseUrl);
  return postSynthesize(baseUrl, { text, ref_audio: refAudioAbsPath, ref_text: refText });
}

/** 语音设计模式：仅凭 attributes 描述（instruct）生成音色，不需要参考音频。 */
async function synthesizeDesign(text, instruct, baseUrl) {
  await ensureHealthy(baseUrl);
  return postSynthesize(baseUrl, { text, instruct });
}

module.exports = { DEFAULT_BASE_URL, getOmnivoiceConfig, checkHealth, synthesizeCloning, synthesizeDesign };
