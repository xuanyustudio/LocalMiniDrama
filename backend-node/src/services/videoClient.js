// ? Go pkg/video + VideoGenerationService ????????? API??????(????)
const fs = require('fs');
const path = require('path');
const aiConfigService = require('./aiConfigService');
let sharp; try { sharp = require('sharp'); } catch (_) { sharp = null; }
const { uploadLocalImageToProxy } = require('./uploadService');
const {
  signKlingOfficialJwt,
  normalizeKlingCredential,
  unsafeDecodeKlingJwtPayload,
  jwtPartLengths,
} = require('./klingJwt');

/**
 * ?? provider ??????????api_protocol ??????????
 */
function inferVideoProtocol(provider) {
  const p = String(provider || '').toLowerCase();
  if (p === 'dashscope') return 'dashscope';
  if (p === 'gemini' || p === 'google') return 'gemini';
  if (p === 'volces' || p === 'volcengine' || p === 'volc') return 'volcengine';
  if (p === 'vidu') return 'vidu';
  if (p === 'ffir') return 'kling_omni';
  if (p === 'kling' || p === 'klingai') return 'kling';
  return 'openai';
}

/** 可灵 Omni / 多图生视频（飞儿 ffir.cn 等中转）：可用环境变量临时覆盖配置 */
function applyKlingOmniEnvOverrides(config) {
  const c = { ...config };
  if (process.env.KLING_FFIR_BASE_URL) {
    c.base_url = String(process.env.KLING_FFIR_BASE_URL).replace(/\/$/, '');
  }
  if (process.env.KLING_FFIR_API_KEY) {
    c.api_key = process.env.KLING_FFIR_API_KEY;
  }
  if (process.env.KLING_FFIR_CREATE_PATH) {
    c.endpoint = process.env.KLING_FFIR_CREATE_PATH.startsWith('/')
      ? process.env.KLING_FFIR_CREATE_PATH
      : '/' + process.env.KLING_FFIR_CREATE_PATH;
  }
  if (process.env.KLING_FFIR_QUERY_PATH) {
    c.query_endpoint = process.env.KLING_FFIR_QUERY_PATH;
  }
  if (process.env.KLING_OFFICIAL_ACCESS_KEY) {
    c._kling_official_access_key = process.env.KLING_OFFICIAL_ACCESS_KEY;
  }
  if (process.env.KLING_OFFICIAL_SECRET_KEY) {
    c._kling_official_secret_key = process.env.KLING_OFFICIAL_SECRET_KEY;
  }
  if (process.env.KLING_OFFICIAL_BASE_URL) {
    c.base_url = String(process.env.KLING_OFFICIAL_BASE_URL).replace(/\/$/, '');
  }
  return c;
}

function parseConfigSettingsJson(config) {
  if (!config) return {};
  const raw = config.settings;
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

/** SecretKey 是否按 Base64 解码后再参与 HS256（部分控制台给出的 Secret 为 Base64 串） */
function resolveKlingSecretKeyBase64Flag(cfg) {
  const s = parseConfigSettingsJson(cfg);
  if (s.kling_secret_key_base64 === true || s.kling_secret_key_base64 === 1) return true;
  if (String(s.kling_secret_key_base64 || '').toLowerCase() === 'true') return true;
  const env = String(process.env.KLING_SECRET_KEY_BASE64 || '').toLowerCase();
  if (env === '1' || env === 'true' || env === 'yes') return true;
  return false;
}

/**
 * 官方 AccessKey+SecretKey → JWT；否则 api_key 视为 Bearer Token（中转站）
 */
function resolveKlingOmniBearerToken(cfg, log) {
  const s = parseConfigSettingsJson(cfg);
  const ak = normalizeKlingCredential(
    s.kling_access_key || s.access_key || cfg._kling_official_access_key || ''
  );
  const sk = normalizeKlingCredential(
    s.kling_secret_key || s.secret_key || cfg._kling_official_secret_key || ''
  );
  if (ak && sk) {
    try {
      const useB64 = resolveKlingSecretKeyBase64Flag(cfg);
      const token = signKlingOfficialJwt(ak, sk, {
        secretEncoding: useB64 ? 'base64' : 'utf8',
      });
      log.info('[KlingOmni] 鉴权：官方 AK/SK → JWT（HS256，payload: iss+exp+nbf）', {
        secret_key_hmac_input: useB64 ? 'base64_decoded_bytes' : 'utf8_string',
      });
      return token;
    } catch (e) {
      log.warn('[KlingOmni] JWT 生成失败', { message: e.message });
      return null;
    }
  }
  let bearer = normalizeKlingCredential(cfg.api_key || '');
  if (/^bearer\s+/i.test(bearer)) bearer = bearer.replace(/^bearer\s+/i, '');
  if (bearer) log.info('[KlingOmni] 鉴权：Bearer Token（api_key，预签 JWT 或中转 Key）');
  return bearer || null;
}

/** 便于排查 401：不打印 Secret、不打印完整 JWT */
function logKlingOmniAuthDebug(cfg, bearerToken, log) {
  if (!bearerToken || !log?.info) return;
  const s = parseConfigSettingsJson(cfg);
  const ak = normalizeKlingCredential(
    s.kling_access_key || s.access_key || cfg._kling_official_access_key || ''
  );
  const sk = normalizeKlingCredential(
    s.kling_secret_key || s.secret_key || cfg._kling_official_secret_key || ''
  );
  const now = Math.floor(Date.now() / 1000);
  if (ak && sk) {
    const payload = unsafeDecodeKlingJwtPayload(bearerToken);
    const lens = jwtPartLengths(bearerToken);
    log.info('[KlingOmni] 鉴权调试（无密钥/无完整 token）', {
      mode: 'official_jwt',
      secret_key_hmac_input: resolveKlingSecretKeyBase64Flag(cfg) ? 'base64_decoded_bytes' : 'utf8_string',
      access_key_len: ak.length,
      access_key_hint: ak.length <= 8 ? '****' : `${ak.slice(0, 4)}...${ak.slice(-4)}`,
      secret_key_len: sk.length,
      jwt_parts_b64url_len: lens,
      jwt_payload_decoded: payload
        ? { iss: payload.iss, exp: payload.exp, nbf: payload.nbf, iat: payload.iat }
        : null,
      server_time_unix: now,
      nbf_ok: payload && typeof payload.nbf === 'number' ? now >= payload.nbf : null,
      exp_ok: payload && typeof payload.exp === 'number' ? now < payload.exp : null,
    });
    return;
  }
  log.info('[KlingOmni] 鉴权调试（无密钥/无完整 token）', {
    mode: 'bearer_api_key',
    token_len: bearerToken.length,
    looks_like_jwt: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearerToken),
  });
}

/** 未填 base_url：官方凭据 → api-beijing.klingai.com；否则 ffir 中转默认 */
function resolveKlingOmniBaseUrl(cfg) {
  const b = (cfg.base_url || '').toString().replace(/\/$/, '').trim();
  if (b) return b;
  const s = parseConfigSettingsJson(cfg);
  const hasOfficial =
    ((s.kling_access_key || s.access_key) && (s.kling_secret_key || s.secret_key)) ||
    (cfg._kling_official_access_key && cfg._kling_official_secret_key);
  return hasOfficial ? 'https://api-beijing.klingai.com' : 'https://ffir.cn';
}

const KLING_OMNI_PROXY_CREATE = '/kling/v1/videos/omni-video';
const KLING_OMNI_PROXY_QUERY = '/kling/v1/images/omni-image/{taskId}';
const KLING_OMNI_OFFICIAL_CREATE = '/v1/videos/omni-video';
const KLING_OMNI_OFFICIAL_QUERY = '/v1/videos/omni-video/{taskId}';

/** Omni-Video 文档支持的 aspect_ratio；有参考图时也必须传，否则接口易默认 16:9 */
const KLING_OMNI_ASPECT_RATIOS = new Set(['9:16', '16:9', '1:1', '4:3', '3:4', '3:2', '2:3']);

/** 可灵官方 OpenAPI 域名（与 ffir 等 /kling/v1/... 中转路径不同） */
function isKlingOfficialOmniHost(baseUrl) {
  const raw = (baseUrl || '').toString().trim();
  if (!raw) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    const h = u.hostname.toLowerCase();
    return (
      h === 'api.klingai.com' ||
      h === 'api-beijing.klingai.com' ||
      h === 'api-singapore.klingai.com'
    );
  } catch (_) {
    return /api(-beijing|-singapore)?\.klingai\.com/i.test(raw);
  }
}

function resolveKlingOmniCreatePath(cfg, base) {
  const official = isKlingOfficialOmniHost(base);
  const ep = (cfg.endpoint || '').toString().trim();
  if (ep) {
    const norm = ep.startsWith('/') ? ep : '/' + ep;
    if (official && norm === KLING_OMNI_PROXY_CREATE) return KLING_OMNI_OFFICIAL_CREATE;
    return norm;
  }
  return official ? KLING_OMNI_OFFICIAL_CREATE : KLING_OMNI_PROXY_CREATE;
}

function resolveKlingOmniQueryPathTemplate(cfg, base) {
  const official = isKlingOfficialOmniHost(base);
  const q = (cfg.query_endpoint || '').toString().trim();
  if (q) {
    if (official && q === KLING_OMNI_PROXY_QUERY) return KLING_OMNI_OFFICIAL_QUERY;
    return q;
  }
  return official ? KLING_OMNI_OFFICIAL_QUERY : KLING_OMNI_PROXY_QUERY;
}

function omniDurationString(modelName, durationNum) {
  const m = (modelName || '').toLowerCase();
  const d = Number(durationNum);
  const safe = Number.isFinite(d) && d > 0 ? d : 5;
  if (m.includes('v3-omni') || m.includes('kling-v3')) {
    const allowed = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    let best = 5;
    let bestDiff = 999;
    for (const a of allowed) {
      const diff = Math.abs(a - safe);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = a;
      }
    }
    return String(best);
  }
  return safe <= 7 ? '5' : '10';
}

/**
 * 本地/内网图 → base64（图床上传失败时的兜底，与可灵 I2V 一致）
 */
function resolveImageInputForOmniLocalBase64(rawUrl, files_base_url, storage_local_path, log, video_gen_id) {
  const raw = (rawUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;
  if (/localhost|127\.0\.0\.1/i.test(raw) && storage_local_path) {
    const baseUrl = (files_base_url || '').replace(/\/$/, '');
    const afterStatic = raw.split('/static/')[1] || (baseUrl ? raw.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
    const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
    if (relPath) {
      const filePath = path.join(storage_local_path, relPath);
      try {
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'image/jpeg';
          log.info('[KlingOmni] 图床失败兜底 → base64', { file: filePath, video_gen_id });
          return 'data:' + mime + ';base64,' + buf.toString('base64');
        }
      } catch (e) {
        log.warn('[KlingOmni] 读本地图失败', { error: e.message, video_gen_id });
      }
    }
  }
  return raw;
}

/**
 * Omni 参考图：已是公网 http(s) 则直传；否则优先 uploadService 图床（中转可拉取），失败再 base64
 */
async function resolveImageInputForOmniAsync(rawUrl, files_base_url, storage_local_path, log, video_gen_id, index) {
  const raw = (rawUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;

  const isPublicHttp = /^https?:\/\//i.test(raw) && !/localhost|127\.0\.0\.1/i.test(raw);
  if (isPublicHttp) return raw;

  if (storage_local_path) {
    const tag = `kling_omni_vg${video_gen_id}_${index}`;
    const proxyUrl = await uploadLocalImageToProxy(storage_local_path, raw, log, tag);
    if (proxyUrl) {
      log.info('[KlingOmni] 已上传图床', { video_gen_id, index, url_head: proxyUrl.slice(0, 64) });
      return proxyUrl;
    }
    log.warn('[KlingOmni] 图床上传未返回 URL，尝试 base64', { video_gen_id, index });
  }

  return resolveImageInputForOmniLocalBase64(raw, files_base_url, storage_local_path, log, video_gen_id);
}

/**
 * 可灵 Omni-Video
 * - 官方（api.klingai.com / api-beijing.klingai.com）：POST {base}/v1/videos/omni-video，轮询 GET {base}/v1/videos/omni-video/{taskId}
 * - ffir 等中转：POST {base}/kling/v1/videos/omni-video，查询 GET {base}/kling/v1/images/omni-image/{taskId}
 * model_name：kling-video-o1 / kling-v3-omni
 */
async function callKlingOmniVideoApi(config, log, opts) {
  const cfg = applyKlingOmniEnvOverrides(config);
  const {
    prompt,
    model,
    duration,
    aspect_ratio,
    image_url,
    reference_urls,
    files_base_url,
    storage_local_path,
    video_gen_id,
  } = opts;

  const base = resolveKlingOmniBaseUrl(cfg);
  const bearerToken = resolveKlingOmniBearerToken(cfg, log);
  if (!bearerToken) {
    return {
      error:
        '可灵 Omni 未配置鉴权：请填写「API Key」（中转 Bearer），或在高级设置中填写官方 AccessKey + SecretKey（存 settings，自动生成 JWT）',
    };
  }
  logKlingOmniAuthDebug(cfg, bearerToken, log);
  const createEp = resolveKlingOmniCreatePath(cfg, base);
  const createUrl = base + createEp;
  log.info('[KlingOmni] 请求路由', {
    video_gen_id,
    base_url: base,
    create_path: createEp,
    official_host: isKlingOfficialOmniHost(base),
  });

  const modelName = model || 'kling-video-o1';
  const durStr = omniDurationString(modelName, duration);
  const ratioRaw = String(aspect_ratio || '16:9').trim();
  const ratio = KLING_OMNI_ASPECT_RATIOS.has(ratioRaw) ? ratioRaw : '16:9';

  const refList = Array.isArray(reference_urls) ? reference_urls.filter(Boolean) : [];
  const primary = (image_url || '').trim();
  const orderedUrls = [...(primary ? [primary] : []), ...refList.filter((u) => u !== primary)];

  const image_list = [];
  for (let i = 0; i < orderedUrls.length; i++) {
    const resolved = await resolveImageInputForOmniAsync(
      orderedUrls[i],
      files_base_url,
      storage_local_path,
      log,
      video_gen_id,
      i
    );
    if (!resolved) continue;
    const item = { image_url: resolved };
    if (orderedUrls.length === 1) {
      item.type = 'first_frame';
    } else if (i === 0) {
      item.type = 'first_frame';
    }
    image_list.push(item);
  }

  const textPrompt = (prompt || '').trim().slice(0, 2500);
  if (!textPrompt) {
    return { error: '可灵 Omni：multi_shot=false 时 prompt 不能为空' };
  }

  const body = {
    model_name: modelName,
    mode: 'std',
    duration: durStr,
    multi_shot: false,
    prompt: textPrompt,
    sound: 'off',
    aspect_ratio: ratio,
  };

  if (image_list.length) {
    body.image_list = image_list;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`,
  };

  log.info('[KlingOmni] 创建任务', {
    url: createUrl,
    model_name: modelName,
    duration: durStr,
    aspect_ratio: ratio,
    image_count: image_list.length,
    video_gen_id,
    prompt_head: textPrompt.slice(0, 120),
  });

  const res = await fetch(createUrl, { method: 'POST', headers, body: JSON.stringify(body) });
  const raw = await res.text();
  log.info('[KlingOmni] 创建响应', { video_gen_id, status: res.status, raw: raw.slice(0, 800) });

  if (!res.ok) {
    let errMsg = 'Kling Omni 创建失败: ' + res.status;
    let errJson;
    try {
      errJson = JSON.parse(raw);
      const msg = errJson.message || errJson.msg || errJson.error?.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 300);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    if (res.status === 401) {
      log.warn('[KlingOmni] 401 排查', {
        video_gen_id,
        request_id: errJson?.request_id,
        code: errJson?.code,
        secret_key_hmac_input: resolveKlingSecretKeyBase64Flag(cfg) ? 'base64_decoded_bytes' : 'utf8_string',
        mode_note:
          '若用官方 AK/SK：确认未与 Secret 对调；在 AI 配置中尝试勾选「SecretKey 为 Base64」；Base URL 区域（北京/新加坡）须与密钥一致',
      });
    }
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: 'Kling Omni 响应非 JSON: ' + raw.slice(0, 200) };
  }

  if (data.code !== undefined && Number(data.code) !== 0) {
    return { error: `Kling Omni 错误(${data.code}): ${data.message || data.msg || 'unknown'}` };
  }

  const directUrl = pickProxyVideoUrl(data);
  if (directUrl) return { video_url: directUrl };

  const taskId =
    data?.data?.task_id ||
    data?.data?.id ||
    data?.task_id ||
    data?.id ||
    data?.data?.task?.id ||
    data?.result?.task_id;
  if (!taskId) {
    return { error: 'Kling Omni 未返回 task_id: ' + raw.slice(0, 300) };
  }

  const encoded = 'omni:' + String(taskId);
  log.info('[KlingOmni] 已提交', { video_gen_id, task_id: taskId, encoded });
  return { task_id: encoded, status: 'submitted' };
}

function parseKlingOmniPollVideoUrl(data) {
  let u = pickProxyVideoUrl(data);
  if (u) return u;
  const tryPaths = [
    data?.data?.task_result?.videos?.[0]?.url,
    data?.data?.videos?.[0]?.url,
    data?.data?.video_url,
    data?.task_result?.videos?.[0]?.url,
    data?.result?.videos?.[0]?.url,
    data?.output?.video_url,
  ];
  for (const p of tryPaths) {
    if (p && typeof p === 'string') return p;
  }
  return null;
}

// ??????????????????listConfigs ?? is_default DESC, priority DESC ??
function getDefaultVideoConfig(db, preferredModel) {
  const configs = aiConfigService.listConfigs(db, 'video');
  const active = configs.filter((c) => c.is_active);
  if (active.length === 0) return null;
  if (preferredModel) {
    for (const c of active) {
      const models = Array.isArray(c.model) ? c.model : (c.model != null ? [c.model] : []);
      if (models.includes(preferredModel)) return c;
    }
  }
  const defaultOne = active.find((c) => c.is_default);
  return defaultOne != null ? defaultOne : active[0];
}

// ?????? API ????? /contents/generations/tasks?base ???????????????
const VOLC_VIDEO_CREATE_PATH = '/contents/generations/tasks';
const VOLC_VIDEO_QUERY_PATH = '/contents/generations/tasks';

function getVolcVideoBase(config) {
  let base = (config.base_url || '').replace(/\/$/, '');
  base = base.replace(/\/(contents|video)\/.*$/i, '');
  return base || 'https://ark.cn-beijing.volces.com/api/v3';
}

function buildVideoUrl(config) {
  const p = (config.provider || '').toLowerCase();
  const isVolc = p === 'volces' || p === 'volcengine' || p === 'volc';
  if (isVolc) return getVolcVideoBase(config) + VOLC_VIDEO_CREATE_PATH;
  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/video/generations';
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

function buildQueryUrl(config, taskId) {
  const p = (config.provider || '').toLowerCase();
  const proto = (config.api_protocol || '').toLowerCase();
  const isDashScope = proto === 'dashscope' || p === 'dashscope';
  const isVolc = p === 'volces' || p === 'volcengine' || p === 'volc';
  const isSora = proto === 'sora';
  if (isVolc) return getVolcVideoBase(config) + VOLC_VIDEO_QUERY_PATH + '/' + encodeURIComponent(taskId);
  const base = (config.base_url || '').replace(/\/$/, '');
  let defaultEp;
  if (isSora) defaultEp = '/v1/videos/{taskId}';
  else if (proto === 'veo3') defaultEp = '/v1/video/query?id={taskId}';
  else if (isDashScope) defaultEp = '/api/v1/tasks/{taskId}';
  else defaultEp = '/video/task/{taskId}';
  let ep = config.query_endpoint || defaultEp;
  ep = String(ep).replace(/\{taskId\}/gi, encodeURIComponent(taskId)).replace(/\{task_id\}/gi, encodeURIComponent(taskId)).replace(/\{id\}/gi, encodeURIComponent(taskId));
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

// ????????? ? API ?? ID ???API ????+???????
const VOLC_MODEL_ALIASES = {
  'doubao-seedance-1.0-pro-fast':  'doubao-seedance-1-0-pro-250528',
  'doubao-seedance-1.0-pro':       'doubao-seedance-1-0-pro-250528',
  'doubao-seedance-1-0-pro':       'doubao-seedance-1-0-pro-250528',
  'doubao-seedance-1.0-lite':      'doubao-seedance-1-0-lite-250428',
  'doubao-seedance-1-0-lite':      'doubao-seedance-1-0-lite-250428',
  'doubao-seedance-1.5-pro':       'doubao-seedance-1-5-pro-251215',
  'doubao-seedance-1-5-pro':       'doubao-seedance-1-5-pro-251215',
};

function normalizeVolcModel(name) {
  if (!name) return name;
  return VOLC_MODEL_ALIASES[name.toLowerCase()] || name;
}

function getModelFromConfig(config, preferredModel) {
  const models = Array.isArray(config.model) ? config.model : (config.model != null ? [config.model] : []);
  if (preferredModel && models.includes(preferredModel)) return preferredModel;
  if (config.default_model && models.includes(config.default_model)) return config.default_model;
  return models[0] || '';
}

/** 单层对象上的视频地址：兼容中转站使用 result_url 而非 video_url */
function videoUrlFromRecord(rec) {
  if (!rec || typeof rec !== 'object') return null;
  return rec.video_url || rec.result_url || rec.url || rec.output_url || null;
}

/**
 * OpenAI/Veo/Sora 类中转 JSON 中解析直链（含各层 result_url）
 */
function pickProxyVideoUrl(data) {
  if (!data || typeof data !== 'object') return null;
  let u = videoUrlFromRecord(data);
  if (u) return u;
  const d = data.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    u = videoUrlFromRecord(d);
    if (u) return u;
  }
  const r = data.result;
  if (r && typeof r === 'object') {
    u = videoUrlFromRecord(r);
    if (u) return u;
  }
  const c = data.content;
  if (c && typeof c === 'object') {
    u = videoUrlFromRecord(c);
    if (u) return u;
  }
  for (const k of ['videos', 'generations', 'works']) {
    const arr = data[k];
    if (Array.isArray(arr) && arr[0]) {
      u = videoUrlFromRecord(arr[0]);
      if (u) return u;
      const res = arr[0].resource;
      if (res && res.resource) return res.resource;
    }
  }
  if (Array.isArray(d) && d[0]) {
    u = videoUrlFromRecord(d[0]);
    if (u) return u;
  }
  return null;
}

// ? DashScope ?????????? URL
function parseDashScopeVideoUrl(data) {
  const out = data?.output;
  if (!out) return null;
  let u = videoUrlFromRecord(out);
  if (u) return u;
  if (out.output && typeof out.output === 'object') {
    u = videoUrlFromRecord(out.output);
    if (u) return u;
  }
  const results = out.results || out.result;
  if (Array.isArray(results) && results[0]) {
    const rec = results[0];
    u = videoUrlFromRecord(rec);
    if (u) return u;
    if (rec.output && typeof rec.output === 'object') {
      u = videoUrlFromRecord(rec.output);
      if (u) return u;
    }
  }
  const choices = out.choices;
  if (Array.isArray(choices) && choices[0]) {
    const c = choices[0];
    const msg = c?.message?.content || c?.content;
    if (Array.isArray(msg)) {
      for (const m of msg) {
        if (m) {
          u = videoUrlFromRecord(m);
          if (u) return u;
        }
      }
    }
  }
  return null;
}

/**
 * 调用可灵（Kling AI）视频生成 API（异步任务，返回 task_id）
 * 支持模型：kling-video / kling-omni-video / kling-motion-control
 * 接口：
 *   T2V  → POST /v1/videos/text2video      （无参考图）
 *   I2V  → POST /v1/videos/image2video     （有参考图/首帧）
 *   MC   → POST /v1/videos/motion-control  （kling-motion-control 模型，需首帧图）
 * task_id 编码格式：`t2v:xxx` / `i2v:xxx` / `mc:xxx` 用于轮询时还原正确的查询端点
 * 认证：Authorization: Bearer {api_key}
 */
async function callKlingVideoApi(config, log, opts) {
  const {
    prompt, model, duration, aspect_ratio, image_url,
    files_base_url, storage_local_path, video_gen_id,
  } = opts;

  const base = (config.base_url || 'https://api.klingai.com').replace(/\/$/, '');
  const apiKey = config.api_key || '';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey,
  };

  const m = model || 'kling-video';
  const isMotionControl = m === 'kling-motion-control';

  // 处理图片 URL（本地路径 → base64 转换）
  let imageInput = null;
  const rawImgUrl = (image_url || '').trim();
  if (rawImgUrl) {
    if (rawImgUrl.startsWith('data:')) {
      imageInput = rawImgUrl;
    } else if (/localhost|127\.0\.0\.1/i.test(rawImgUrl) && storage_local_path) {
      const baseUrl = (files_base_url || '').replace(/\/$/, '');
      const afterStatic = rawImgUrl.split('/static/')[1] || (baseUrl ? rawImgUrl.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
      const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
      if (relPath) {
        const filePath = require('path').join(storage_local_path, relPath);
        try {
          if (require('fs').existsSync(filePath)) {
            const buf = require('fs').readFileSync(filePath);
            const ext = require('path').extname(filePath).toLowerCase();
            const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'image/jpeg';
            imageInput = 'data:' + mime + ';base64,' + buf.toString('base64');
            log.info('[Kling视频] 本地图片 → base64', { file: filePath, size_kb: Math.round(buf.length / 1024), video_gen_id });
          }
        } catch (e) {
          log.warn('[Kling视频] 读取本地图片失败', { error: e.message, video_gen_id });
          imageInput = rawImgUrl;
        }
      }
    } else {
      imageInput = rawImgUrl;
    }
  }

  const hasImage = !!imageInput;
  const dur = duration ? Number(duration) : 5;
  const klingDuration = dur <= 5 ? '5' : '10';
  const ratio = aspect_ratio || '16:9';

  // 根据模型类型 & 是否有图片确定端点
  let createEp, taskType;
  if (isMotionControl) {
    createEp = '/v1/videos/motion-control';
    taskType = 'mc';
  } else if (hasImage) {
    createEp = '/v1/videos/image2video';
    taskType = 'i2v';
  } else {
    createEp = '/v1/videos/text2video';
    taskType = 't2v';
  }

  // 允许用户通过 config.endpoint 覆盖默认端点
  if (config.endpoint) {
    createEp = config.endpoint.startsWith('/') ? config.endpoint : '/' + config.endpoint;
  }
  const createUrl = base + createEp;

  let body;
  if (taskType === 'i2v' || taskType === 'mc') {
    body = {
      model: m,
      prompt: prompt || '',
      image: { type: 'url', url: imageInput },
      duration: klingDuration,
      cfg_scale: 0.5,
      callback_url: '',
    };
  } else {
    body = {
      model: m,
      prompt: prompt || '',
      aspect_ratio: ratio,
      duration: klingDuration,
      cfg_scale: 0.5,
      mode: 'std',
      callback_url: '',
    };
  }

  const bodyForLog = {
    ...body,
    image: body.image ? { ...body.image, url: body.image.url?.startsWith('data:') ? '(base64)' : body.image.url } : undefined,
  };
  log.info('[Kling视频] 发送请求', {
    url: createUrl, model: m, task_type: taskType,
    has_image: hasImage, duration: klingDuration, ratio,
    video_gen_id, body_preview: JSON.stringify(bodyForLog).slice(0, 400),
  });

  const res = await fetch(createUrl, { method: 'POST', headers, body: JSON.stringify(body) });
  const raw = await res.text();
  log.info('[Kling视频] 原始响应', { video_gen_id, status: res.status, raw: raw.slice(0, 500) });

  if (!res.ok) {
    let errMsg = '可灵视频生成请求失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.message || errJson.msg || errJson.error?.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    return { error: '可灵视频响应格式异常: ' + raw.slice(0, 200) };
  }

  if (data.code !== undefined && data.code !== 0) {
    return { error: `可灵错误(${data.code}): ${data.message || '未知错误'}` };
  }

  // 同步返回视频 URL（极少见，兜底）
  const directUrl = data?.data?.task_result?.videos?.[0]?.url;
  if (directUrl) {
    log.info('[Kling视频] 同步返回视频', { video_gen_id });
    return { video_url: directUrl };
  }

  const taskId = data?.data?.task_id;
  if (!taskId) {
    return { error: '可灵未返回 task_id: ' + raw.slice(0, 200) };
  }

  // 在 task_id 中编码任务类型，轮询时用于还原正确的查询端点
  const encodedTaskId = taskType + ':' + taskId;
  log.info('[Kling视频] 任务已提交', { video_gen_id, task_id: taskId, task_type: taskType, encoded_id: encodedTaskId });
  return { task_id: encodedTaskId, status: 'submitted' };
}

const DASHSCOPE_VIDEO_GENERATION = '/api/v1/services/aigc/video-generation/video-synthesis';
const DASHSCOPE_IMAGE2VIDEO = '/api/v1/services/aigc/image2video/video-synthesis';

/**
 * ???????????? endpoint ????????? /api/v1/tasks/{taskId}
 * - wan2.2-kf2v-flash: image2video, first_frame_url + last_frame_url
 * - wan2.6-t2v: video-generation, ? prompt??????
 * - wan2.6-i2v-flash: video-generation, prompt + img_url????????
 * - wanx2.1-vace-plus: video-generation, function image_reference + ref_images_url??? 3 ??
 * - wan2.6-r2v-flash: video-generation, reference_urls??? 5 ??
 */
async function callDashScopeVideoApi(config, log, opts) {
  const {
    prompt,
    model: modelName,
    image_url,
    first_frame_url,
    last_frame_url,
    reference_urls,
    duration,
    files_base_url,
    storage_local_path,
    video_gen_id,
  } = opts;
  const base = (config.base_url || '').replace(/\/$/, '');
  const model = modelName || 'wan2.2-kf2v-flash';
  const dur = duration ? Number(duration) : 10;
  const baseUrl = (files_base_url || '').replace(/\/$/, '');
  const isLocalhost = baseUrl && /localhost|127\.0\.0\.1/i.test(baseUrl);

  function toPublicUrl(value) {
    if (!value || !String(value).trim()) return null;
    const s = String(value).trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (baseUrl) return baseUrl + '/' + s.replace(/^\//, '');
    return s;
  }

  /** ?????? base_url ? localhost????????????? base64??? DashScope ? download image failed */
  function toImageInput(value) {
    if (!value || !String(value).trim()) return null;
    const s = String(value).trim();
    let relPath = null;
    if (s.startsWith('http://') || s.startsWith('https://')) {
      if (!isLocalhost || !storage_local_path) return s;
      const afterStatic = s.split('/static/')[1] || (baseUrl ? s.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
      if (afterStatic) relPath = afterStatic.replace(/^\//, '');
      else return s;
    } else if (storage_local_path) {
      relPath = s.replace(/^\//, '');
    }
    if (!relPath) return toPublicUrl(s);
    const filePath = path.join(storage_local_path, relPath);
    try {
      if (!fs.existsSync(filePath)) return toPublicUrl(s);
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' }[ext] || 'image/png';
      return 'data:' + mime + ';base64,' + buf.toString('base64');
    } catch (e) {
      return toPublicUrl(s);
    }
  }

  let url;
  let body;

  if (model === 'wan2.2-kf2v-flash') {
    url = base + DASHSCOPE_IMAGE2VIDEO;
    const firstRaw = (first_frame_url && first_frame_url.trim()) || (image_url && image_url.trim());
    const lastRaw = (last_frame_url && last_frame_url.trim()) || firstRaw;
    const firstUrl = toImageInput(firstRaw);
    const lastUrl = toImageInput(lastRaw);
    if (!firstUrl || !lastUrl) {
      return { error: 'wan2.2-kf2v-flash ?????????' };
    }
    body = {
      model,
      input: { prompt: prompt || '', first_frame_url: firstUrl, last_frame_url: lastUrl },
      parameters: { resolution: '480P', prompt_extend: true },
    };
  } else if (model === 'wan2.6-t2v') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    body = {
      model,
      input: { prompt: prompt || '' },
      parameters: { size: '1280*720', prompt_extend: true, duration: dur, shot_type: 'multi' },
    };
  } else if (model === 'wan2.6-i2v-flash') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    const imgRaw = (image_url && image_url.trim()) || (first_frame_url && first_frame_url.trim());
    const imgUrl = toImageInput(imgRaw);
    if (!imgUrl) return { error: 'wan2.6-i2v-flash ??????' };
    body = {
      model,
      input: { prompt: prompt || '', img_url: imgUrl },
      parameters: { resolution: '720P', prompt_extend: true, duration: dur, shot_type: 'multi' },
    };
  } else if (model === 'wanx2.1-vace-plus') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    const rawRefs = Array.isArray(reference_urls) ? reference_urls.filter(Boolean).slice(0, 3) : [];
    const refs = rawRefs.map(toImageInput).filter(Boolean);
    if (refs.length === 0) return { error: 'wanx2.1-vace-plus ???????? 3 ??' };
    body = {
      model,
      input: { function: 'image_reference', prompt: prompt || '', ref_images_url: refs },
      parameters: { prompt_extend: true, obj_or_bg: ['obj', 'bg'], size: '1280*720' },
    };
  } else if (model === 'wan2.6-r2v-flash') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    const rawRefs = Array.isArray(reference_urls) ? reference_urls.filter(Boolean).slice(0, 5) : [];
    const refs = rawRefs.map(toImageInput).filter(Boolean);
    if (refs.length === 0) return { error: 'wan2.6-r2v-flash ??????????? 5 ??' };
    body = {
      model,
      input: { prompt: prompt || '', reference_urls: refs },
      parameters: { prompt_extend: true },
    };
  } else {
    return { error: '????????????: ' + model };
  }

  const shorten = (v) => (v && v.startsWith('data:') ? '(base64 ???)' : v);
  const imageUrlsInBody = body.input
    ? {
        first_frame_url: shorten(body.input.first_frame_url),
        last_frame_url: shorten(body.input.last_frame_url),
        img_url: shorten(body.input.img_url),
        ref_images_url: Array.isArray(body.input.ref_images_url) ? body.input.ref_images_url.map(shorten) : body.input.ref_images_url,
        reference_urls: Array.isArray(body.input.reference_urls) ? body.input.reference_urls.map(shorten) : body.input.reference_urls,
      }
    : {};
  log.info('DashScope ???????base64 ??? = ?????? base64??? download image failed?', {
    model,
    video_gen_id,
    files_base_url: baseUrl || '(???)',
    image_urls: imageUrlsInBody,
  });
  log.info('Video API request (DashScope)', { url: url.slice(0, 70), model, video_gen_id });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (config.api_key || ''),
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let errMsg = '????????: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      if (errJson.message) errMsg += ' - ' + errJson.message;
      else if (errJson.code) errMsg += ' - ' + errJson.code;
    } catch (_) {
      if (raw && raw.length) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('DashScope video create failed', { status: res.status, body: raw.slice(0, 300), video_gen_id });
    return { error: errMsg };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: '??????????' };
  }
  if (data.code) {
    return { error: data.message || data.code || '????????' };
  }
  const taskId = data?.output?.task_id;
  if (taskId) return { task_id: taskId, status: 'PENDING' };
  const videoUrl = parseDashScopeVideoUrl(data);
  if (videoUrl) return { video_url: videoUrl };
  return { error: '??? task_id ? video_url' };
}

/**
 * ?? Google Gemini Veo ???? API?predictLongRunning ??????
 * ?????veo-3.1-generate-preview / veo-3.0-generate-preview / veo-3.0-fast-generate-preview
 * ?? t2v?????? i2v???????
 */
async function callGeminiVideoApi(config, log, opts) {
  const { prompt, duration, aspect_ratio, image_url, video_gen_id, files_base_url, storage_local_path, model } = opts;
  const apiKey = config.api_key || '';
  const base = (config.base_url || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const modelName = model || 'veo-3.0-generate-preview';

  // durationSeconds ??? 5-8 ?
  const durationSec = Math.min(8, Math.max(5, Math.round(Number(duration) || 8)));
  const ratio = aspect_ratio || '16:9';

  const instance = { prompt: prompt || '' };

  // i2v?????? base64?Gemini ??? localhost URL???????? fetch ?? URL?
  if (image_url && image_url.trim()) {
    let imageB64 = null;
    let mimeType = 'image/jpeg';
    const imgUrl = image_url.trim();
    if (imgUrl.startsWith('data:')) {
      const m = imgUrl.match(/^data:([\w/]+);base64,(.+)$/);
      if (m) { imageB64 = m[2]; mimeType = m[1]; }
    } else if ((files_base_url || '').match(/localhost|127\.0\.0\.1/i) && storage_local_path) {
      const baseUrl = (files_base_url || '').replace(/\/$/, '');
      const afterStatic = imgUrl.split('/static/')[1] || imgUrl.replace(baseUrl + '/', '').replace(baseUrl, '');
      const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
      if (relPath) {
        const filePath = path.join(storage_local_path, relPath);
        try {
          if (fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            mimeType = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'image/jpeg';
            imageB64 = buf.toString('base64');
          }
        } catch (_) {}
      }
    } else {
      try {
        const imgRes = await fetch(imgUrl, { method: 'GET' });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const ct = imgRes.headers.get('content-type') || 'image/jpeg';
          mimeType = ct.split(';')[0].trim();
          imageB64 = buf.toString('base64');
        }
      } catch (_) {}
    }
    if (imageB64) {
      instance.image = { bytesBase64Encoded: imageB64, mimeType };
    }
  }

  const body = {
    instances: [instance],
    parameters: {
      aspectRatio: ratio,
      durationSeconds: durationSec,
      sampleCount: 1,
    },
  };

  const url = `${base}/v1beta/models/${encodeURIComponent(modelName)}:predictLongRunning`;
  log.info('Gemini Video API request', { model: modelName, ratio, durationSec, video_gen_id, has_image: !!instance.image });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let errMsg = 'Gemini ????????: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('Gemini Video API failed', { status: res.status, body: raw.slice(0, 300), video_gen_id });
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: 'Gemini ??????????' };
  }

  // ?? operation name ?? task_id???? pollVideoTask ??
  const operationName = data.name;
  if (operationName) {
    log.info('Gemini Video task created', { operation: operationName, video_gen_id });
    return { task_id: operationName, status: 'processing' };
  }
  return { error: 'Gemini ??? operation name???? API Key ?????' };
}

/**
 * ?? Vidu ???? API??? api.vidu.cn/ent/v2?
 * ???Authorization: Token {api_key}?? Bearer?
 * ???POST /ent/v2/tasks
 * ???GET /ent/v2/tasks/{id}/creations
 * ?????viduq2 / viduq2-pro / viduq2-turbo / viduq3-pro
 */
async function callViduVideoApi(config, log, opts) {
  const { prompt, model, duration, aspect_ratio, image_url, video_gen_id, files_base_url, storage_local_path } = opts;
  const apiKey = config.api_key || '';
  const base = (config.base_url || 'https://api.vidu.cn').replace(/\/$/, '');
  const modelName = model || 'viduq2';
  const dur = Math.min(10, Math.max(1, Math.round(Number(duration) || 5)));
  const ratio = aspect_ratio || '16:9';
  const hasImage = !!(image_url && image_url.trim());

  // ?? api.vidu.cn: Token ??????: Bearer ??
  const isOfficialVidu = /api\.vidu\.cn/i.test(base);
  const authHeader = (isOfficialVidu ? 'Token ' : 'Bearer ') + apiKey;

  // ????????? /ent/v2/img2video ?????????
  const defaultEp = hasImage ? '/ent/v2/img2video' : '/ent/v2/text2video';
  let ep = config.endpoint || defaultEp;
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  const body = {
    model: modelName,
    prompt: prompt || '',
    duration: dur,
    resolution: '720p',
    aspect_ratio: ratio,
    movement_amplitude: 'auto',
    audio: false,
    off_peak: false,
    watermark: false,
  };

  // ????localhost ? ??????? URL
  if (hasImage) {
    const rawImgUrl = image_url.trim();
    let publicImgUrl = null;
    if (/localhost|127\.0\.0\.1/i.test(rawImgUrl)) {
      log.info('[Vidu] ???? localhost???????', { original: rawImgUrl, video_gen_id });
      publicImgUrl = await uploadLocalImageToProxy(storage_local_path, rawImgUrl, log, `vidu_vg${video_gen_id}`);
      if (publicImgUrl) {
        log.info('[Vidu] ????????', { proxy: publicImgUrl, video_gen_id });
      } else if (files_base_url && !/localhost|127\.0\.0\.1/i.test(files_base_url)) {
        publicImgUrl = (files_base_url || '').replace(/\/$/, '') + rawImgUrl.replace(/^https?:\/\/[^/]+/, '');
        log.warn('[Vidu] ????????? files_base_url', { converted: publicImgUrl, video_gen_id });
      } else {
        log.warn('[Vidu] ???????? URL??????', { video_gen_id });
      }
    } else {
      publicImgUrl = rawImgUrl;
    }
    if (publicImgUrl) body.images = [publicImgUrl];
  }

  log.info('[Vidu] Video API request', {
    url, model: modelName, auth: isOfficialVidu ? 'Token' : 'Bearer',
    dur, has_image: !!body.images, video_gen_id,
  });
  log.info('[Vidu] request body', { body: JSON.stringify({ ...body, images: body.images ? ['(url)'] : undefined }), video_gen_id });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  log.info('[Vidu] raw response', { status: res.status, raw: raw.slice(0, 600), video_gen_id });

  if (!res.ok) {
    let errMsg = 'Vidu request failed: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.message || errJson.err_code || errJson.error?.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('[Vidu] Video API failed', { status: res.status, body: raw.slice(0, 300), video_gen_id });
    return { error: errMsg };
  }

  let data;
  try { data = JSON.parse(raw); } catch (_) {
    return { error: 'Vidu bad response: ' + raw.slice(0, 200) };
  }

  const taskId = data?.task_id || data?.id;
  if (!taskId) {
    log.error('[Vidu] no task_id in response', { video_gen_id, raw: raw.slice(0, 300) });
    return { error: 'Vidu no task_id returned' };
  }
  log.info('[Vidu] task created', { task_id: taskId, state: data?.state, video_gen_id });
  return { task_id: taskId, status: data?.state || 'created' };
}

/**
 * Veo3 (api_protocol = 'veo3')
 * body: { model, prompt, enhance_prompt: true, images: [base64 or url] }
 * endpoint default: /v1/video/create
 */
async function callVeo3VideoApi(config, log, opts) {
  const { prompt, model, image_url, storage_local_path, video_gen_id } = opts;

  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/v1/video/create';
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  const body = {
    model: model || '',
    prompt: prompt || '',
    enhance_prompt: true,
  };

  const rawImgUrl = (image_url || '').trim();
  if (rawImgUrl) {
    let imageData = null;
    if (rawImgUrl.startsWith('data:')) {
      imageData = rawImgUrl;
    } else if (/localhost|127\.0\.0\.1/i.test(rawImgUrl)) {
      try {
        const afterStatic = rawImgUrl.split('/static/')[1];
        if (afterStatic && storage_local_path) {
          const localFile = path.join(storage_local_path, afterStatic.replace(/^\//, ''));
          if (fs.existsSync(localFile)) {
            const buf = fs.readFileSync(localFile);
            const ext = path.extname(localFile).toLowerCase();
            const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'image/jpeg';
            imageData = `data:${mime};base64,${buf.toString('base64')}`;
            log.info('[Veo3] local image -> base64', { file: localFile, size_kb: Math.round(buf.length / 1024), video_gen_id });
          } else {
            log.warn('[Veo3] local image not found', { file: localFile, video_gen_id });
          }
        }
      } catch (e) {
        log.warn('[Veo3] read local image failed', { error: e.message, video_gen_id });
      }
    } else {
      imageData = rawImgUrl;
    }
    if (imageData) body.images = [imageData];
  }

  log.info('[Veo3] Video API request', {
    url, model,
    has_image: !!body.images,
    prompt_len: (prompt || '').length,
    prompt_head: (prompt || '').slice(0, 200),
    video_gen_id,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (config.api_key || ''),
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  log.info('[Veo3] raw response', { status: res.status, raw: raw.slice(0, 1000), video_gen_id });

  if (!res.ok) {
    let errMsg = 'Veo3 request failed: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + (typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    return { error: 'Veo3 bad response: ' + e.message + ' | raw: ' + raw.slice(0, 200) };
  }

  const directUrl = pickProxyVideoUrl(data);
  if (directUrl) {
    log.info('[Veo3] direct video URL', { video_url: directUrl, video_gen_id });
    return { video_url: directUrl };
  }

  const taskId = data.task_id || data.id || data.request_id || data.data?.task_id || data.data?.id;
  if (taskId) {
    log.info('[Veo3] task ID returned', { task_id: taskId, status: data.status, video_gen_id });
    return { task_id: String(taskId), status: data.status || 'processing' };
  }

  log.error('[Veo3] cannot parse task_id or video_url', { data: JSON.stringify(data).slice(0, 500), video_gen_id });
  return { error: 'Veo3 no task_id or video_url: ' + JSON.stringify(data).slice(0, 300) };
}

/**
 * Sora (api_protocol = 'sora')
 * multipart/form-data: model, prompt, seconds, size, input_reference
 */
async function callSoraVideoApi(config, log, opts) {
  const { prompt, model, duration, aspect_ratio, image_url, storage_local_path, video_gen_id } = opts;

  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/v1/videos';
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  // seconds ?????? 4 / 8 / 12?????
  const rawSec = duration ? Number(duration) : 4;
  const dur = rawSec <= 4 ? '4' : rawSec <= 8 ? '8' : '12';

  // aspect_ratio ? size???? 4 ?????720x1280 / 1280x720 / 1024x1792 / 1792x1024?
  const sizeMap = {
    '9:16': '720x1280',  // ????
    '3:4':  '1024x1792', // ????
    '1:1':  '720x1280',  // ????????
    '16:9': '1280x720',  // ????
    '4:3':  '1280x720',  // ????
    '21:9': '1792x1024', // ????
  };
  const size = sizeMap[aspect_ratio || ''] || '720x1280';

  // ?? ????? Buffer ????????????????????????????????????????????
  let imageBuffer = null;
  let imageMime = 'image/jpeg';
  let imageFilename = 'reference.jpg';
  const rawImgUrl = (image_url || '').trim();

  if (rawImgUrl) {
    if (rawImgUrl.startsWith('data:')) {
      const m = rawImgUrl.match(/^data:([\w/]+);base64,(.+)$/s);
      if (m) {
        imageMime = m[1];
        imageBuffer = Buffer.from(m[2], 'base64');
        const ext = imageMime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        imageFilename = `reference.${ext}`;
      } else {
        log.warn('[Sora] ???? base64 ??????', { video_gen_id });
      }
    } else if (/localhost|127\.0\.0\.1/i.test(rawImgUrl)) {
      // localhost URL ? ?????????
      try {
        const afterStatic = rawImgUrl.split('/static/')[1];
        if (afterStatic && storage_local_path) {
          const localFile = path.join(storage_local_path, afterStatic.replace(/^\//, ''));
          if (fs.existsSync(localFile)) {
            imageBuffer = fs.readFileSync(localFile);
            const ext = path.extname(localFile).toLowerCase();
            const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
            imageMime = mimeMap[ext] || 'image/jpeg';
            imageFilename = path.basename(localFile);
            log.info('[Sora] ????????', { file: localFile, size_kb: Math.round(imageBuffer.length / 1024), video_gen_id });
          } else {
            log.warn('[Sora] ??????????', { file: localFile, video_gen_id });
          }
        }
      } catch (e) {
        log.warn('[Sora] ?????????', { error: e.message, video_gen_id });
      }
    } else {
      // ?? URL ? ??
      try {
        const dlRes = await fetch(rawImgUrl);
        if (dlRes.ok) {
          const ct = (dlRes.headers.get('content-type') || '').split(';')[0].trim();
          imageMime = ct || 'image/jpeg';
          imageBuffer = Buffer.from(await dlRes.arrayBuffer());
          const ext = imageMime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
          imageFilename = `reference.${ext}`;
          log.info('[Sora] ????????', { url: rawImgUrl, size_kb: Math.round(imageBuffer.length / 1024), video_gen_id });
        } else {
          log.warn('[Sora] ?????????', { status: dlRes.status, url: rawImgUrl, video_gen_id });
        }
      } catch (e) {
        log.warn('[Sora] ?????????', { error: e.message, video_gen_id });
      }
    }
  }

  // ?? ???? resize ?? size ???Sora ?????????????????
  if (imageBuffer && sharp) {
    try {
      const [targetW, targetH] = size.split('x').map(Number);
      const meta = await sharp(imageBuffer).metadata();
      if (meta.width !== targetW || meta.height !== targetH) {
        log.info('[Sora] ?????????? resize', {
          from: `${meta.width}x${meta.height}`, to: size, video_gen_id,
        });
        imageBuffer = await sharp(imageBuffer)
          .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 92 })
          .toBuffer();
        imageMime = 'image/jpeg';
        imageFilename = imageFilename.replace(/\.\w+$/, '.jpg');
        log.info('[Sora] ??? resize ??', { size, size_kb: Math.round(imageBuffer.length / 1024), video_gen_id });
      } else {
        log.info('[Sora] ????????', { size, video_gen_id });
      }
    } catch (e) {
      log.warn('[Sora] ??? resize ???????', { error: e.message, video_gen_id });
    }
  }

  // ?? ?? multipart/form-data ?????????????????????????????????????
  const boundary = 'soraform_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  const textFields = [
    ['model', model || 'sora-2'],
    ['prompt', prompt || ''],
    ['seconds', dur],
    ['size', size],
    ['watermark', 'false'],
    ['private', 'false'],
    ['character_url', ''],
    ['character_timestamps', ''],
    ['metadata', ''],
    ['character_from_task', ''],
    ['character_create', ''],
  ];

  const textPart = textFields
    .map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
    .join('');

  let bodyBuffer;
  if (imageBuffer) {
    const imgHeader = `--${boundary}\r\nContent-Disposition: form-data; name="input_reference"; filename="${imageFilename}"\r\nContent-Type: ${imageMime}\r\n\r\n`;
    bodyBuffer = Buffer.concat([
      Buffer.from(textPart, 'utf-8'),
      Buffer.from(imgHeader, 'utf-8'),
      imageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);
  } else {
    bodyBuffer = Buffer.concat([
      Buffer.from(textPart, 'utf-8'),
      Buffer.from(`--${boundary}--\r\n`, 'utf-8'),
    ]);
  }

  log.info('[Sora] Video API request', {
    url, model, size, seconds: dur,
    has_image: !!imageBuffer, image_file: imageBuffer ? imageFilename : null,
    prompt_len: (prompt || '').length,
    prompt_head: (prompt || '').slice(0, 200),
    video_gen_id,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: 'Bearer ' + (config.api_key || ''),
    },
    body: bodyBuffer,
  });
  const raw = await res.text();
  log.info('[Sora] raw response', { status: res.status, raw: raw.slice(0, 1000), video_gen_id });

  if (!res.ok) {
    let errMsg = 'Sora ????????: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + (typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    return { error: 'Sora ??????: ' + e.message + ' | raw: ' + raw.slice(0, 200) };
  }

  // ?????? URL（含中转 result_url）
  const directUrl = pickProxyVideoUrl(data);
  if (directUrl) {
    log.info('[Sora] ?????? URL', { video_url: directUrl, video_gen_id });
    return { video_url: directUrl };
  }

  // ???? ID
  const taskId = data.id || data.task_id || data.request_id || data.data?.id || data.data?.task_id;
  if (taskId) {
    log.info('[Sora] ???? ID', { task_id: taskId, status: data.status, video_gen_id });
    return { task_id: String(taskId), status: data.status || 'processing' };
  }

  log.error('[Sora] ???? task_id ? video_url', { data: JSON.stringify(data).slice(0, 500), video_gen_id });
  return { error: 'Sora ??? task_id ? video_url???: ' + JSON.stringify(data).slice(0, 300) };
}

/**
 * ?????? API?ChatFire/?? ? ?????
 * @returns {Promise<{ task_id?: string, video_url?: string, error?: string }>}
 */
async function callVideoApi(db, log, opts) {
  const { prompt, model: preferredModel, duration, aspect_ratio, resolution, seed, camera_fixed, watermark, image_url, video_gen_id } = opts;
  const config = getDefaultVideoConfig(db, preferredModel);
  if (!config) {
    throw new Error('???????????AI ?????? video ?????????');
  }
  const model = getModelFromConfig(config, preferredModel);
  const provider = (config.provider || '').toLowerCase();
  // api_protocol 优先，空时按 provider 名称推断
  const protocol = (config.api_protocol || '').toLowerCase() || inferVideoProtocol(provider);
  log.info('[视频] 路由协议', {
    video_gen_id,
    provider,
    api_protocol_raw: config.api_protocol || '(empty→auto)',
    protocol_used: protocol,
    model,
    endpoint: config.endpoint || '(auto)',
  });

  if (protocol === 'dashscope') {
    return callDashScopeVideoApi(config, log, {
      prompt,
      model,
      image_url: opts.image_url,
      first_frame_url: opts.first_frame_url,
      last_frame_url: opts.last_frame_url,
      reference_urls: opts.reference_urls,
      duration: opts.duration,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  if (protocol === 'gemini') {
    return callGeminiVideoApi(config, log, {
      prompt, model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      video_gen_id: opts.video_gen_id,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
    });
  }

  if (protocol === 'vidu') {
    return callViduVideoApi(config, log, {
      prompt, model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      video_gen_id: opts.video_gen_id,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
    });
  }

  if (protocol === 'kling') {
    return callKlingVideoApi(config, log, {
      prompt, model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  if (protocol === 'kling_omni') {
    return callKlingOmniVideoApi(applyKlingOmniEnvOverrides(config), log, {
      prompt,
      model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      reference_urls: opts.reference_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  // Veo3 protocol (api_protocol = 'veo3')
  if (protocol === 'veo3') {
    return callVeo3VideoApi(config, log, {
      prompt, model,
      image_url: opts.image_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  // Sora protocol (api_protocol = 'sora')
  if (protocol === 'sora') {
    return callSoraVideoApi(config, log, {
      prompt, model,
      duration: opts.duration,
      aspect_ratio,
      image_url: opts.image_url,
      resolution: opts.resolution,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  const url = buildVideoUrl(config);
  const dur = duration ? Number(duration) : 5;
  const ratio = aspect_ratio || '16:9';

  const isVolc = protocol === 'volcengine';
  // ???? model ???????????? API ?? ID?
  const finalModel = isVolc ? normalizeVolcModel(model) : model;
  const hasImage = !!(image_url && image_url.trim());
  // ?????doubao-seedance-1-5-pro ??? r2v?????? task_type???? i2v ??? reference_image ?????? r2v
  const volcTaskType = isVolc ? (hasImage ? 'i2v' : 't2v') : null;

  // 针对火山引擎 (Doubao) 修正 duration：只支持 5 或 10 秒
  // 若传入非标准值（如 3, 4, 8 等），自动吸附到最近的有效值
  let effectiveDuration = dur;
  if (isVolc) {
    if (effectiveDuration <= 7) effectiveDuration = 5;
    else effectiveDuration = 10;
    if (effectiveDuration !== dur) {
      log.info('Adjusted duration for Volcengine', { original: dur, adjusted: effectiveDuration, video_gen_id });
    }
  }

  // ???? localhost URL????????????? base64?? DashScope ???
  let imageUrlForApi = image_url && image_url.trim();
  if (hasImage && imageUrlForApi && (opts.files_base_url || '').match(/localhost|127\.0\.0\.1/i) && opts.storage_local_path) {
    const baseUrl = (opts.files_base_url || '').replace(/\/$/, '');
    const afterStatic = imageUrlForApi.split('/static/')[1] || (baseUrl ? imageUrlForApi.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
    const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
    if (relPath) {
      const filePath = path.join(opts.storage_local_path, relPath);
      try {
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' }[ext] || 'image/png';
          imageUrlForApi = 'data:' + mime + ';base64,' + buf.toString('base64');
        }
      } catch (_) {}
    }
  }

  // ratio?duration ????????????????/ChatFire ???????
  const body = {
    model: finalModel,
    content: [{ type: 'text', text: prompt || '' }],
    ratio,
    duration: effectiveDuration,
    watermark: (watermark != null) ? Boolean(watermark) : false,
  };
  if (resolution) body.resolution = resolution;
  if (seed != null) body.seed = Number(seed);
  if (camera_fixed != null) body.camera_fixed = Boolean(camera_fixed);
  if (volcTaskType) body.task_type = volcTaskType;
  if (hasImage && imageUrlForApi) {
    const imagePart = { type: 'image_url', image_url: { url: imageUrlForApi } };
    if (volcTaskType !== 'i2v') imagePart.role = 'reference_image';
    body.content.push(imagePart);
  }

  log.info('Video API request', {
    url,
    model,
    video_gen_id,
    task_type: body.task_type,
    request_body: JSON.stringify({ ...body, content: body.content?.map(c => c.type === 'image_url' ? { ...c, image_url: { url: '(omitted)' } } : c) }),
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (config.api_key || ''),
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  log.info('Video API raw response', { video_gen_id, status: res.status, raw: raw.slice(0, 1000) });
  if (!res.ok) {
    log.error('Video API failed', { status: res.status, body: raw.slice(0, 500) });
    let errMsg = '????????: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + (typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
    } catch (_) {
      if (raw && raw.length) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    log.error('Video API response JSON parse failed', { video_gen_id, raw: raw.slice(0, 1000), parse_error: e.message });
    return { error: '??????????: ' + e.message + ' | raw: ' + raw.slice(0, 200) };
  }
  log.info('Video API parsed response', { video_gen_id, data: JSON.stringify(data).slice(0, 500) });
  const taskId = data.id || data.task_id || (data.data && data.data.id);
  const status = data.status || (data.data && data.data.status);
  const videoUrl = pickProxyVideoUrl(data);
  if (videoUrl) {
    log.info('Video API returned video_url directly', { video_gen_id, video_url: videoUrl });
    return { video_url: videoUrl };
  }
  if (taskId) {
    log.info('Video API returned task_id', { video_gen_id, task_id: taskId, status });
    return { task_id: taskId, status: status || 'processing' };
  }
  log.error('Video API: no task_id or video_url in response', { video_gen_id, data: JSON.stringify(data).slice(0, 500) });
  return { error: '??? task_id ? video_url?????: ' + JSON.stringify(data).slice(0, 300) };
}

/**
 * ??????????????????/ChatFire ? ???? DashScope?
 */
async function pollVideoTask(db, log, videoGenId, taskId, config, maxAttempts = 300, intervalMs = 10000) {
  const provider = (config.provider || '').toLowerCase();
  const protocol = (config.api_protocol || '').toLowerCase() || inferVideoProtocol(provider);
  const isDashScope = protocol === 'dashscope';
  const isGemini = protocol === 'gemini';
  const isVidu = protocol === 'vidu';
  const isSora = protocol === 'sora';
  const isKling = protocol === 'kling';
  const isKlingOmni = protocol === 'kling_omni' || (typeof taskId === 'string' && taskId.startsWith('omni:'));
  const isVeo3 = protocol === 'veo3';
  const queryUrl = () => buildQueryUrl(config, taskId);
  log.info('[poll] ????', { video_gen_id: videoGenId, task_id: taskId, protocol, poll_url: queryUrl() });
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      let url, headers;
      if (isKling) {
        // task_id 编码格式：`t2v:xxx` / `i2v:xxx` / `mc:xxx`
        const klingBase = (config.base_url || 'https://api.klingai.com').replace(/\/$/, '');
        let actualTaskId = taskId;
        let videoType = 'text2video';
        if (taskId.startsWith('i2v:')) { actualTaskId = taskId.slice(4); videoType = 'image2video'; }
        else if (taskId.startsWith('t2v:')) { actualTaskId = taskId.slice(4); videoType = 'text2video'; }
        else if (taskId.startsWith('mc:'))  { actualTaskId = taskId.slice(3); videoType = 'motion-control'; }
        // 若用户配置了 query_endpoint，优先使用
        let qep = config.query_endpoint || `/v1/videos/${videoType}/{taskId}`;
        qep = String(qep).replace(/\{taskId\}/gi, encodeURIComponent(actualTaskId)).replace(/\{task_id\}/gi, encodeURIComponent(actualTaskId)).replace(/\{id\}/gi, encodeURIComponent(actualTaskId));
        if (!qep.startsWith('/')) qep = '/' + qep;
        url = klingBase + qep;
        headers = { Authorization: 'Bearer ' + (config.api_key || '') };
      } else if (isKlingOmni) {
        const cfgOmni = applyKlingOmniEnvOverrides(config);
        const omniBase = resolveKlingOmniBaseUrl(cfgOmni);
        let actualId = String(taskId);
        if (actualId.startsWith('omni:')) actualId = actualId.slice(5);
        let qep = resolveKlingOmniQueryPathTemplate(cfgOmni, omniBase);
        qep = String(qep)
          .replace(/\{taskId\}/gi, encodeURIComponent(actualId))
          .replace(/\{task_id\}/gi, encodeURIComponent(actualId))
          .replace(/\{id\}/gi, encodeURIComponent(actualId));
        if (!qep.startsWith('/')) qep = '/' + qep;
        url = omniBase + qep;
        const bt = resolveKlingOmniBearerToken(cfgOmni, log);
        headers = bt
          ? { Authorization: bt.startsWith('Bearer ') ? bt : `Bearer ${bt}` }
          : {};
      } else if (isGemini) {
        const base = (config.base_url || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
        url = `${base}/v1beta/${taskId}`;
        headers = { 'x-goog-api-key': config.api_key || '' };
      } else if (isVidu) {
        const viduBase = (config.base_url || 'https://api.vidu.cn').replace(/\/$/, '');
        const isOfficialVidu = /api\.vidu\.cn/i.test(viduBase);
        const defaultQep = isOfficialVidu ? '/ent/v2/tasks/{taskId}/creations' : '/ent/v2/tasks/{taskId}/creations';
        let qep = config.query_endpoint || defaultQep;
        qep = String(qep).replace(/\{taskId\}/gi, encodeURIComponent(taskId)).replace(/\{task_id\}/gi, encodeURIComponent(taskId)).replace(/\{id\}/gi, encodeURIComponent(taskId));
        if (!qep.startsWith('/')) qep = '/' + qep;
        url = viduBase + qep;
        headers = { Authorization: (isOfficialVidu ? 'Token ' : 'Bearer ') + (config.api_key || '') };
      } else {
        url = queryUrl();
        headers = { Authorization: 'Bearer ' + (config.api_key || '') };
      }
      log.info('[poll] ??????', { video_gen_id: videoGenId, attempt, url });
      const res = await fetch(url, { method: 'GET', headers });
      const raw = await res.text();
      log.info('[poll] ????', { video_gen_id: videoGenId, attempt, status: res.status, raw: raw.slice(0, 600) });
      if (!res.ok) {
        log.warn('[poll] ???? (non-200)', { video_gen_id: videoGenId, attempt, status: res.status, raw: raw.slice(0, 300) });
        continue;
      }
      const data = JSON.parse(raw);

      if (isKling) {
        if (data.code !== undefined && data.code !== 0) {
          const msg = data.message || `可灵错误码: ${data.code}`;
          log.warn('[Kling poll] API 错误', { video_gen_id: videoGenId, code: data.code, msg });
          return { error: msg };
        }
        const status = (data?.data?.task_status || '').toLowerCase();
        log.info('[Kling poll] 状态', { video_gen_id: videoGenId, attempt, status, task_id: taskId });
        if (status === 'succeed') {
          const videoUrl = data?.data?.task_result?.videos?.[0]?.url;
          if (videoUrl) {
            log.info('[Kling poll] 视频生成完成', { video_gen_id: videoGenId, video_url: videoUrl });
            return { video_url: videoUrl };
          }
          return { error: '可灵任务完成但未返回视频地址' };
        }
        if (status === 'failed') {
          const errMsg = data?.data?.task_status_msg || '任务失败';
          log.warn('[Kling poll] 任务失败', { video_gen_id: videoGenId, error: errMsg });
          return { error: '可灵视频生成失败: ' + errMsg };
        }
        // submitted / processing → 继续轮询
        continue;
      }

      if (isKlingOmni) {
        if (data.code !== undefined && Number(data.code) !== 0) {
          const msg = data.message || data.msg || `Kling Omni 错误码 ${data.code}`;
          log.warn('[KlingOmni poll] API 错误', { video_gen_id: videoGenId, code: data.code, msg });
          return { error: msg };
        }
        const st = (data?.data?.task_status || data?.task_status || data?.status || '').toLowerCase();
        const videoUrlOmni = parseKlingOmniPollVideoUrl(data);
        log.info('[KlingOmni poll] 状态', { video_gen_id: videoGenId, attempt, status: st, has_url: !!videoUrlOmni });
        if (videoUrlOmni) {
          log.info('[KlingOmni poll] 完成', { video_gen_id: videoGenId });
          return { video_url: videoUrlOmni };
        }
        if (st === 'succeed' || st === 'success' || st === 'completed' || st === 'succeeded' || st === 'done') {
          return { error: 'Kling Omni 标记完成但未解析到视频地址' };
        }
        if (st === 'failed' || st === 'error') {
          const errMsg = data?.data?.task_status_msg || data?.task_status_msg || data?.message || '任务失败';
          return { error: 'Kling Omni: ' + String(errMsg).slice(0, 400) };
        }
        continue;
      }

      if (isVeo3) {
        const status = (data.status || data.data?.status || data.task_status || '').toLowerCase();
        log.info('[Veo3 poll] task status', { video_gen_id: videoGenId, attempt, status, id: data.task_id || data.id });
        if (status === 'failed' || status === 'error') {
          const msg = data.error?.message || data.error || data.message || data.data?.error || 'Veo3 task failed';
          log.warn('[Veo3 poll] task failed', { video_gen_id: videoGenId, msg });
          return { error: String(msg) };
        }
        const videoUrl = pickProxyVideoUrl(data);
        if (videoUrl) {
          log.info('[Veo3 poll] video completed', { video_gen_id: videoGenId, video_url: videoUrl });
          return { video_url: videoUrl };
        }
        if (status === 'succeeded' || status === 'completed' || status === 'done') {
          log.warn('[Veo3 poll] completed but no video_url', { data: JSON.stringify(data).slice(0, 500) });
          return { error: 'Veo3 completed but no video URL: ' + JSON.stringify(data).slice(0, 300) };
        }
        continue;
      }

      if (isSora) {
        const status = (data.status || '').toLowerCase();
        log.info('[Sora poll] ????', { video_gen_id: videoGenId, attempt, status, progress: data.progress, id: data.id });
        if (status === 'failed' || status === 'error') {
          const msg = data.error?.message || data.error || data.message || 'Sora ??????';
          log.warn('[Sora poll] ????', { video_gen_id: videoGenId, msg, data: JSON.stringify(data).slice(0, 300) });
          return { error: String(msg) };
        }
        // succeeded / completed / done ? ??? URL
        const videoUrl = pickProxyVideoUrl(data);
        if (videoUrl) {
          log.info('[Sora poll] ????', { video_gen_id: videoGenId, video_url: videoUrl });
          return { video_url: videoUrl };
        }
        if (status === 'succeeded' || status === 'completed' || status === 'done') {
          log.warn('[Sora poll] ????????? video_url', { video_gen_id: videoGenId, data: JSON.stringify(data).slice(0, 500) });
          return { error: 'Sora ?????????????????: ' + JSON.stringify(data).slice(0, 300) };
        }
        // queued / processing / running ? ????
        continue;
      }

      if (isVidu) {
        const state = (data?.state || data?.status || data?.data?.status || '').toLowerCase();
        log.info('[Vidu poll] ????', { video_gen_id: videoGenId, attempt, state, id: taskId });
        if (state === 'failed' || state === 'error') {
          const msg = data?.err_code || data?.message || data?.error?.message || data?.error || 'Vidu ??????';
          log.warn('[Vidu poll] ????', { video_gen_id: videoGenId, msg });
          return { error: String(msg) };
        }
        // ?? ent/v2 ???????? success???? creations[0].url
        // ??????????????? succeeded/completed/done???? video_url/url ?
        const videoUrl =
          data?.creations?.[0]?.url ||
          videoUrlFromRecord(data?.creations?.[0]) ||
          pickProxyVideoUrl(data);
        if (videoUrl) {
          log.info('[Vidu poll] ????', { video_gen_id: videoGenId, video_url: videoUrl });
          return { video_url: videoUrl };
        }
        if (state === 'success' || state === 'succeeded' || state === 'completed' || state === 'done') {
          log.warn('[Vidu poll] ???????? video_url', { data: JSON.stringify(data).slice(0, 500) });
          return { error: 'Vidu ??????????' };
        }
        continue;
      }

      if (isGemini) {
        if (data.error) {
          return { error: data.error.message || 'Gemini ??????' };
        }
        if (data.done === true) {
          const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
          if (videoUri) return { video_url: videoUri };
          return { error: 'Gemini ??????????????' };
        }
        continue;
      }

      if (isDashScope) {
        const taskStatus = data?.output?.task_status;
        const videoUrl = parseDashScopeVideoUrl(data);
        if (videoUrl) return { video_url: videoUrl };
        if (taskStatus === 'FAILED' || taskStatus === 'CANCELED') {
          const msg = data?.message || data?.output?.message || taskStatus;
          log.warn('DashScope ????????? download image failed????? URL ???????? localhost?', {
            video_gen_id: videoGenId,
            task_id: taskId,
            task_status: taskStatus,
            message: msg,
            output: data?.output,
          });
          return { error: msg || '????????' };
        }
        continue;
      }
      const status = data.status || (data.data && data.data.status);
      // ?????????? video_url / result_url / Sora url / generations[].url / data.data.*
      const videoUrl = pickProxyVideoUrl(data);
      const errMsg = data.error && (typeof data.error === 'string' ? data.error : data.error.message);
      if (videoUrl) return { video_url: videoUrl };
      if (status === 'failed' || status === 'error' || status === 'cancelled' || errMsg) return { error: errMsg || status || '????' };
    } catch (e) {
      log.warn('Video poll request failed', { attempt, error: e.message });
    }
  }
  return { error: '??????' };
}

module.exports = {
  getDefaultVideoConfig,
  callVideoApi,
  pollVideoTask,
};
