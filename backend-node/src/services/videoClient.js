// ? Go pkg/video + VideoGenerationService ????????? API??????(????)
const fs = require('fs');
const path = require('path');
const aiConfigService = require('./aiConfigService');
let sharp; try { sharp = require('sharp'); } catch (_) { sharp = null; }
const { uploadLocalImageToProxy, uploadToImageProxy } = require('./uploadService');
const {
  clampToGeminiImageAspectRatio,
  clampToViduAspectRatio,
  pickViduResolutionParam,
  isGeminiOfficialHost,
} = require('./mediaAspectRatioSpec');
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
  if (p === 'jimeng_ai_api') return 'jimeng_ai_api';
  if (p === 'xai' || p === 'grok') return 'xai';
  return 'openai';
}

/**
 * 显式 api_protocol 优先；未配置时推断。
 * Grok / xAI 官方为 prompt + aspect_ratio + GET /v1/videos/{request_id}，与中转站用的 ratio + content 不同。
 */
function resolveVideoProtocol(config, modelHint) {
  const provider = (config.provider || '').toLowerCase();
  const explicit = String(config.api_protocol || '').trim();
  let protocol = explicit.toLowerCase() || inferVideoProtocol(provider);
  const baseLower = String(config.base_url || '').toLowerCase();
  const modelLower = String(modelHint || '').toLowerCase();
  if (!explicit && protocol === 'openai') {
    if (/api\.x\.ai(\/|$)/.test(baseLower)) protocol = 'xai';
    else if (/grok-imagine|grok.*video/.test(modelLower)) protocol = 'xai';
  }
  return protocol;
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

/**
 * 归一化前端/元数据里的画幅字符串，便于命中可灵枚举（全角冒号、别名等）
 * @returns {string|null} 可灵支持的比值，无法识别时返回 null
 */
function normalizeAspectRatioForApi(raw) {
  if (raw == null) return null;
  let s = String(raw)
    .trim()
    .replace(/\uFF1A/g, ':')
    .replace(/[×xX＊*]/g, ':')
    .replace(/\s+/g, '');
  if (!s) return null;
  const lower = s.toLowerCase();
  const aliases = {
    portrait: '9:16',
    landscape: '16:9',
    square: '1:1',
    vertical: '9:16',
    horizontal: '16:9',
  };
  if (aliases[lower]) s = aliases[lower];
  return KLING_OMNI_ASPECT_RATIOS.has(s) ? s : null;
}

function resolveKlingOmniAspectRatio(aspect_ratio, log, video_gen_id) {
  const normalized = normalizeAspectRatioForApi(aspect_ratio);
  if (normalized) return normalized;
  const raw = aspect_ratio != null ? String(aspect_ratio).trim() : '';
  if (raw) {
    log.warn('[KlingOmni] aspect_ratio 不在可灵支持列表，回退 16:9', {
      raw: aspect_ratio,
      video_gen_id,
      supported: [...KLING_OMNI_ASPECT_RATIOS].join(', '),
    });
  }
  return '16:9';
}

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

/** config.yaml：image_proxy.use_for_video=true 时才对视频全能模式走中转图床（默认 false，避免私有网关拉不到图床） */
function useImageProxyForVideo() {
  try {
    const { loadConfig } = require('../config');
    return !!(loadConfig()?.image_proxy?.use_for_video);
  } catch (_) {
    return false;
  }
}

/**
 * 火山方舟 Seedance 全能/多图参考：公网 URL 直传；本地图默认 base64；可选图床（use_for_video）
 */
async function resolveVolcOmniImageAsync(rawUrl, files_base_url, storage_local_path, log, video_gen_id, index) {
  const raw = (rawUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;

  const isPublicHttp = /^https?:\/\//i.test(raw) && !/localhost|127\.0\.0\.1/i.test(raw);
  if (isPublicHttp) return raw;

  if (storage_local_path && !useImageProxyForVideo()) {
    const b64 = resolveVolcClassicImage(raw, files_base_url, storage_local_path, log, video_gen_id, `ref_${index}`);
    if (b64 && String(b64).startsWith('data:')) {
      log.info('[VolcOmni] 本地参考图 → base64（image_proxy.use_for_video 未启用）', { video_gen_id, index });
      return b64;
    }
  }

  if (storage_local_path && useImageProxyForVideo()) {
    const tag = `volc_omni_vg${video_gen_id}_${index}`;
    const proxyUrl = await uploadLocalImageToProxy(storage_local_path, raw, log, tag);
    if (proxyUrl) {
      log.info('[VolcOmni] 已上传图床', { video_gen_id, index, url_head: proxyUrl.slice(0, 64) });
      return proxyUrl;
    }
    log.warn('[VolcOmni] 图床上传未返回 URL，尝试 base64', { video_gen_id, index });
  }

  return resolveImageInputForOmniLocalBase64(raw, files_base_url, storage_local_path, log, video_gen_id);
}

/**
 * 火山 Seedance 系列：按模型版本归一化时长（秒）。
 * - 2.x：4–15
 * - 1.5 Pro/Lite：5–12（官方文档）
 * - 1.0 Pro/Lite：仅 5 或 10
 */
function normalizeVolcengineDuration(modelName, durationNum) {
  const m = String(modelName || '').toLowerCase();
  const d = Number(durationNum);
  const safe = Number.isFinite(d) && d > 0 ? Math.round(d) : 5;

  if (/seedance[-_]?2|seedance2|2[-_]0[-_]/.test(m)) {
    return Math.min(15, Math.max(4, safe));
  }

  if (/seedance[-_]?1[-_.]?5|1-5-pro|1-5-lite|251215/.test(m)) {
    return Math.min(12, Math.max(5, safe));
  }

  if (/seedance|doubao-seedance/.test(m)) {
    return safe <= 7 ? 5 : 10;
  }

  return Math.min(12, Math.max(5, safe));
}

/** @deprecated 名称保留，实现与 normalizeVolcengineDuration 一致 */
function normalizeVolcOmniDuration(modelName, durationNum) {
  return normalizeVolcengineDuration(modelName, durationNum);
}

/**
 * 火山引擎方舟 — Seedance 2.0 等「全能/多参考图」视频
 * 与标准 volcengine 共用：POST {base}/contents/generations/tasks，GET {base}/contents/generations/tasks/{id}
 * content：首条 text；全能模式每张均为参考图（场景/角色/道具…），每张必须带 role：一律 reference_image
 */
async function callVolcengineOmniVideoApi(config, log, opts) {
  const {
    prompt,
    model: preferredModel,
    duration,
    aspect_ratio,
    resolution,
    seed,
    camera_fixed,
    watermark,
    image_url,
    reference_urls,
    files_base_url,
    storage_local_path,
    video_gen_id,
    voice_reference_url,   // Seedance 2.0 音色参考（全能模式专用）
  } = opts;

  const url = buildVideoUrl(config, { defaultEndpoint: '/v1/videos/generations' });
  const model = getModelFromConfig(config, preferredModel);
  const finalModel = normalizeVolcModel(model);
  const ratio = aspect_ratio || '16:9';
  const effectiveDuration = normalizeVolcOmniDuration(finalModel, duration);

  const refList = Array.isArray(reference_urls) ? reference_urls.filter(Boolean) : [];
  const primary = (image_url || '').trim();
  const orderedUrls = [...(primary ? [primary] : []), ...refList.filter((u) => u !== primary)];
  const maxRef = 9;
  const urls = orderedUrls.slice(0, maxRef);

  const body = {
    model: finalModel,
    content: [{ type: 'text', text: (prompt || '').trim() }],
    ratio,
    duration: effectiveDuration,
    watermark: watermark != null ? Boolean(watermark) : false,
  };
  if (resolution) body.resolution = resolution;
  if (seed != null) body.seed = Number(seed);
  if (camera_fixed != null) body.camera_fixed = Boolean(camera_fixed);

  if (urls.length) {
    for (let i = 0; i < urls.length; i++) {
      let u = await resolveVolcOmniImageAsync(
        urls[i],
        files_base_url,
        storage_local_path,
        log,
        video_gen_id,
        i
      );
      if (!u) continue;
      if (/localhost|127\.0\.0\.1/i.test(u) && storage_local_path && (files_base_url || '').match(/localhost|127\.0\.0\.1/i)) {
        const baseUrl = (files_base_url || '').replace(/\/$/, '');
        const afterStatic = u.split('/static/')[1] || (baseUrl ? u.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
        const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
        if (relPath) {
          const filePath = path.join(storage_local_path, relPath);
          try {
            if (fs.existsSync(filePath)) {
              const buf = fs.readFileSync(filePath);
              const ext = path.extname(filePath).toLowerCase();
              const mime =
                { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' }[
                  ext
                ] || 'image/png';
              u = 'data:' + mime + ';base64,' + buf.toString('base64');
            }
          } catch (_) {}
        }
      }
      const part = {
        type: 'image_url',
        image_url: { url: u },
        role: 'reference_image',
      };
      body.content.push(part);
    }
    if (body.content.length > 1) body.task_type = 'i2v';
  }

  // Seedance 2.0 音色参考音频支持（仅 Seedance 2.x 模型有效）
  const isSeedance2 = /seedance[-_]?2|seedance2|2[-_]0[-_]/.test(finalModel);
  if (isSeedance2 && opts.voice_reference_url) {
    let voiceUrl = String(opts.voice_reference_url).trim();
    if (voiceUrl) {
      // 复用图片的本地文件转 base64 逻辑
      if (/localhost|127\.0\.0\.1/i.test(voiceUrl) && storage_local_path && (files_base_url || '').match(/localhost|127\.0\.0\.1/i)) {
        const baseUrl = (files_base_url || '').replace(/\/$/, '');
        const afterStatic = voiceUrl.split('/static/')[1] || (baseUrl ? voiceUrl.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
        const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
        if (relPath) {
          const filePath = path.join(storage_local_path, relPath);
          try {
            if (fs.existsSync(filePath)) {
              const buf = fs.readFileSync(filePath);
              const ext = path.extname(filePath).toLowerCase();
              const mime =
                { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' }[ext] || 'audio/mpeg';
              voiceUrl = 'data:' + mime + ';base64,' + buf.toString('base64');
            }
          } catch (_) {}
        }
      }
      body.content.push({
        type: 'audio_url',
        audio_url: { url: voiceUrl },
        role: 'reference_audio',
      });
      log.info('[VolcOmni] 已注入 Seedance 2.0 音色参考音频', { video_gen_id, voice_ref: String(opts.voice_reference_url).slice(0, 80) });
    }
  }

  // ===== 全能模式（Seedance 2.0 / Omni）最终请求结构体日志 =====
  // 方便调试确认：图片参考 + 音色参考是否真正被加入 content 数组
  try {
    const contentSummary = body.content.map((part, idx) => {
      const t = part.type || 'unknown';
      const role = part.role || null;
      let preview = '';
      if (t === 'text' && part.text) {
        preview = String(part.text).slice(0, 80);
      } else if (part.image_url?.url) {
        preview = String(part.image_url.url).slice(0, 80);
      } else if (part.audio_url?.url) {
        preview = String(part.audio_url.url).slice(0, 80);
      }
      return { idx, type: t, role, preview };
    });

    const hasAudioRef = body.content.some(p => p.role === 'reference_audio' || p.type === 'audio_url');

    log.info('[VolcOmni][全能结构体] 最终发往火山的 content 概览（含音色参考验证）', {
      video_gen_id,
      model: finalModel,
      content_length: body.content.length,
      has_reference_audio: hasAudioRef,
      voice_reference_url_from_opts: voice_reference_url ? String(voice_reference_url).slice(0, 100) : null,
      content_summary: contentSummary
    });
  } catch (e) {
    log.warn('[VolcOmni] 结构体日志序列化失败', { error: e.message });
  }

  log.info('[VolcOmni] 创建任务', {
    url,
    model: finalModel,
    ratio,
    duration: effectiveDuration,
    image_count: urls.length,
    has_voice_ref: !!voice_reference_url,
    video_gen_id,
    prompt_head: ((prompt || '').trim()).slice(0, 120),
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
  log.info('[VolcOmni] 创建响应', { video_gen_id, status: res.status, raw: raw.slice(0, 1000) });

  if (!res.ok) {
    let errMsg = '火山 Seedance 全能创建失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 300);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: '火山 Seedance 全能响应非 JSON: ' + raw.slice(0, 200) };
  }

  const taskId = data.id || data.task_id || (data.data && data.data.id);
  const status = data.status || (data.data && data.data.status);
  const videoUrl = pickProxyVideoUrl(data);
  if (videoUrl) {
    log.info('[VolcOmni] 直接返回 video_url', { video_gen_id });
    return { video_url: videoUrl };
  }
  if (taskId) {
    log.info('[VolcOmni] 返回 task_id', { video_gen_id, task_id: taskId, status });
    return { task_id: taskId, status: status || 'processing' };
  }
  return { error: '火山 Seedance 全能未返回 task_id 或 video_url: ' + JSON.stringify(data).slice(0, 300) };
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
  const ratio = resolveKlingOmniAspectRatio(aspect_ratio, log, video_gen_id);

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

/**
 * 非官方火山厂商（中转、自托管等）走 OpenAI/即梦类路径；默认 /video/generations 为旧版中转。
 * volcengine_omni 传入 defaultEndpoint: '/v1/videos/generations' 以对齐方舟文档与 302.ai / jimeng-free-api。
 */
function buildVideoUrl(config, options = {}) {
  const p = (config.provider || '').toLowerCase();
  const isVolc = p === 'volces' || p === 'volcengine' || p === 'volc';
  if (isVolc) return getVolcVideoBase(config) + VOLC_VIDEO_CREATE_PATH;
  const base = (config.base_url || '').replace(/\/$/, '');
  const fallbackEp = options.defaultEndpoint != null ? options.defaultEndpoint : '/video/generations';
  let ep = config.endpoint || fallbackEp;
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

function buildQueryUrl(config, taskId) {
  const p = (config.provider || '').toLowerCase();
  const proto = resolveVideoProtocol(config);
  const isDashScope = proto === 'dashscope' || p === 'dashscope';
  const isVolc = p === 'volces' || p === 'volcengine' || p === 'volc';
  const isSora = proto === 'sora';
  if (isVolc) return getVolcVideoBase(config) + VOLC_VIDEO_QUERY_PATH + '/' + encodeURIComponent(taskId);
  const base = (config.base_url || '').replace(/\/$/, '');
  let defaultEp;
  if (isSora) defaultEp = '/v1/videos/{taskId}';
  else if (proto === 'xai') defaultEp = '/v1/videos/{taskId}';
  else if (proto === 'veo3') defaultEp = '/v1/video/query?id={taskId}';
  else if (isDashScope) defaultEp = '/api/v1/tasks/{taskId}';
  else if (proto === 'volcengine_omni') defaultEp = '/v1/videos/generations/async/{taskId}';
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
  'doubao-seedance-2.0-pro':       'doubao-seedance-2-0-260128',
  'doubao-seedance-2-0-pro':       'doubao-seedance-2-0-260128',
  'doubao-seedance-2.0-fast':      'doubao-seedance-2-0-fast-260128',
  'doubao-seedance-2-0-fast':      'doubao-seedance-2-0-fast-260128',
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

/** 仅把 http(s) 当作可下载直链，避免方舟/中转让 result_url 填入错误文案 */
function isPlausibleHttpVideoUrl(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return /^https?:\/\//i.test(t);
}

function coerceHttpVideoUrl(s) {
  return isPlausibleHttpVideoUrl(s) ? String(s).trim() : null;
}

/** 轮询 JSON 中的任务状态（兼容中转 data.data.status = FAILURE） */
function extractPollTaskStatus(data) {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data.status,
    data.state,
    data.task_status,
    data.data?.status,
    data.data?.state,
    data.data?.task_status,
    data.output?.task_status,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return String(c).trim().toLowerCase();
  }
  return '';
}

function isPollTaskFailed(status) {
  return (
    status === 'failed' ||
    status === 'failure' ||
    status === 'error' ||
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'fail'
  );
}

/** 失败时的可读错误（fail_reason、非 http 的 result_url 等） */
function extractPollFailureMessage(data) {
  if (!data || typeof data !== 'object') return '';
  const inner = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : null;
  const deep = inner?.data && typeof inner.data === 'object' ? inner.data : null;
  const candidates = [
    inner?.fail_reason,
    data.fail_reason,
    inner?.message,
    deep?.msg,
    data.error?.message,
    typeof data.error === 'string' ? data.error : null,
    data.message,
    typeof data.msg === 'string' ? data.msg : null,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s && !/^https?:\/\//i.test(s)) return s;
  }
  for (const rec of [inner, data]) {
    if (!rec || typeof rec !== 'object') continue;
    for (const k of ['result_url', 'video_url']) {
      const u = rec[k];
      if (typeof u === 'string' && u.trim() && !isPlausibleHttpVideoUrl(u)) return u.trim();
    }
  }
  return '';
}

/** 单层对象上的视频地址：兼容中转站使用 result_url 而非 video_url */
function videoUrlFromRecord(rec) {
  if (!rec || typeof rec !== 'object') return null;
  return (
    coerceHttpVideoUrl(rec.video_url) ||
    coerceHttpVideoUrl(rec.result_url) ||
    coerceHttpVideoUrl(rec.url) ||
    coerceHttpVideoUrl(rec.output_url) ||
    null
  );
}

/** 方舟 / 豆包 Seedance 等：video.transcoded_video.origin.video_url，或 play/download 直链 */
function videoUrlFromArkVideoNode(video) {
  if (!video || typeof video !== 'object') return null;
  const origin =
    video.transcoded_video && typeof video.transcoded_video === 'object' ? video.transcoded_video.origin : null;
  if (origin && typeof origin === 'object' && typeof origin.video_url === 'string') {
    const u = coerceHttpVideoUrl(origin.video_url);
    if (u) return u;
  }
  for (const k of ['download_url', 'play_url', 'url', 'video_url']) {
    const u = coerceHttpVideoUrl(video[k]);
    if (u) return u;
  }
  return null;
}

/** 查询结果里 item_list[0] 形态（与中转站 videos 控制器一致） */
function pickVideoUrlFromItemList(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const item = list[0];
  if (!item || typeof item !== 'object') return null;
  const ca = item.common_attr;
  const fromCommon =
    ca &&
    ca.transcoded_video &&
    typeof ca.transcoded_video === 'object' &&
    ca.transcoded_video.origin &&
    typeof ca.transcoded_video.origin.video_url === 'string' &&
    ca.transcoded_video.origin.video_url.trim()
      ? ca.transcoded_video.origin.video_url.trim()
      : null;
  const fromVideo = videoUrlFromArkVideoNode(item.video);
  const fromResult = coerceHttpVideoUrl(item.result_url);
  const flat = videoUrlFromRecord(item);
  return fromCommon || fromVideo || fromResult || flat || null;
}

/**
 * 方舟类「任务查询」里常见：result 本体无 video_url，而在 result.content.video_url
 */
function pickVideoUrlFromResultShape(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let x = videoUrlFromRecord(obj);
  if (x) return typeof x === 'string' ? x.trim() : x;
  const inner = obj.content;
  if (inner && typeof inner === 'object') {
    x = videoUrlFromRecord(inner);
    if (x) return typeof x === 'string' ? x.trim() : x;
    const il = pickVideoUrlFromItemList(inner.item_list);
    if (il) return il;
    if (inner.video && typeof inner.video === 'object') {
      const v = videoUrlFromArkVideoNode(inner.video) || inner.video.url || inner.video.video_url;
      if (v && typeof v === 'string') return v.trim();
    }
  }
  return null;
}

/**
 * OpenAI/Veo/Sora 类中转 JSON 中解析直链（含各层 result_url）
 */
function pickProxyVideoUrl(data) {
  if (!data || typeof data !== 'object') return null;
  const topList = pickVideoUrlFromItemList(data.item_list);
  if (topList) return topList;
  if (data.video && typeof data.video === 'object') {
    const vu =
      videoUrlFromArkVideoNode(data.video) ||
      coerceHttpVideoUrl(data.video.url) ||
      coerceHttpVideoUrl(data.video.video_url);
    if (vu) return vu;
  }
  let u = videoUrlFromRecord(data);
  if (u) return u;
  const d = data.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const nestedList = pickVideoUrlFromItemList(d.item_list);
    if (nestedList) return nestedList;
    u = videoUrlFromRecord(d);
    if (u) return u;
    if (d.video && typeof d.video === 'object') {
      const dv =
        videoUrlFromArkVideoNode(d.video) ||
        coerceHttpVideoUrl(d.video.url) ||
        coerceHttpVideoUrl(d.video.video_url);
      if (dv) return dv;
    }
    if (d.result && typeof d.result === 'object') {
      const dr = pickVideoUrlFromResultShape(d.result);
      if (dr) return dr;
    }
  }
  const r = data.result;
  if (r && typeof r === 'object') {
    const pr = pickVideoUrlFromResultShape(r);
    if (pr) return pr;
  }
  const c = data.content;
  if (c && typeof c === 'object') {
    const cl = pickVideoUrlFromItemList(c.item_list);
    if (cl) return cl;
    u = videoUrlFromRecord(c);
    if (u) return u;
    if (c.video && typeof c.video === 'object') {
      const cv =
        videoUrlFromArkVideoNode(c.video) ||
        coerceHttpVideoUrl(c.video.url) ||
        coerceHttpVideoUrl(c.video.video_url);
      if (cv) return cv;
    }
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
  const ratio = normalizeAspectRatioForApi(aspect_ratio) || '16:9';

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
      aspect_ratio: ratio,
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
  const ratio = clampToGeminiImageAspectRatio(aspect_ratio || '16:9');

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

  const parameters = {
    aspectRatio: ratio,
    durationSeconds: durationSec,
    sampleCount: 1,
  };
  if (!isGeminiOfficialHost(base)) {
    parameters.aspect_ratio = ratio;
  }
  const body = {
    instances: [instance],
    parameters,
  };

  const url = `${base}/v1beta/models/${encodeURIComponent(modelName)}:predictLongRunning`;
  log.info('Gemini Video API request', {
    model: modelName,
    ratio,
    official_field: 'parameters.aspectRatio',
    durationSec,
    video_gen_id,
    has_image: !!instance.image,
  });

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

/** 解析 "16:9"、"21:9" 等为 宽/高 数值比 */
function parseViduAspectRatio(aspectStr) {
  const t = String(aspectStr || '').trim();
  const m = t.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!m || Number(m[2]) === 0) return null;
  return Number(m[1]) / Number(m[2]);
}

/** 参考图宽高比(宽/高) 与目标比例差异超过容差则视为不一致 */
function viduImageAspectMismatchesTarget(imgW, imgH, targetAspectStr, relTol = 0.06) {
  const tgt = parseViduAspectRatio(targetAspectStr);
  if (tgt == null || !imgW || !imgH || imgH <= 0) return false;
  const imgR = imgW / imgH;
  const diff = Math.abs(imgR - tgt) / Math.max(imgR, tgt, 0.01);
  return diff > relTol;
}

/** Vidu 常见比例 → 画布像素（宽×高），与 720p 量级一致，便于 img2video 画幅与目标一致 */
function viduLetterboxCanvasPixels(aspectStr) {
  const m = {
    '16:9': [1280, 720],
    '9:16': [720, 1280],
    '1:1': [720, 720],
    '4:3': [960, 720],
    '3:4': [720, 960],
    '21:9': [1680, 720],
  };
  return m[String(aspectStr || '').trim()] || null;
}

/**
 * 加载参考图为 Buffer（与 probe 同源）。不修改磁盘上的原文件。
 */
async function loadViduReferenceImageBuffer(rawImgUrl, publicImgUrl, storage_local_path, log, video_gen_id) {
  try {
    let buf = null;
    const raw = (rawImgUrl || '').trim();
    if (raw.startsWith('data:image')) {
      const i = raw.indexOf(',');
      const b64 = i >= 0 ? raw.slice(i + 1) : '';
      buf = Buffer.from(b64, 'base64');
    } else if (/localhost|127\.0\.0\.1/i.test(raw) && storage_local_path) {
      const afterStatic = raw.split('/static/')[1];
      if (afterStatic) {
        const localFile = path.join(storage_local_path, afterStatic.replace(/^\//, ''));
        if (fs.existsSync(localFile)) buf = fs.readFileSync(localFile);
      }
    }
    if (!buf) {
      const fetchUrl = (publicImgUrl || '').trim() || raw;
      if (!fetchUrl || fetchUrl.startsWith('data:')) return null;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 25000);
      try {
        const res = await fetch(fetchUrl, { signal: ac.signal });
        if (!res.ok) return null;
        buf = Buffer.from(await res.arrayBuffer());
      } finally {
        clearTimeout(timer);
      }
      if (buf.length > 25 * 1024 * 1024) return null;
    }
    return buf;
  } catch (e) {
    log.warn('[Vidu] load reference image buffer failed', { error: e.message, video_gen_id });
    return null;
  }
}

/** 将图 contain 到目标比例画布（黑边），使像素比例与 Vidu aspect_ratio 一致，供 img2video 跟随画幅 */
async function letterboxBufferToViduAspect(imageBuffer, aspectStr, log, video_gen_id) {
  if (!sharp || !imageBuffer) return null;
  const box = viduLetterboxCanvasPixels(aspectStr);
  if (!box) return null;
  const [cw, ch] = box;
  try {
    const out = await sharp(imageBuffer, { failOn: 'none' })
      .rotate()
      .resize(cw, ch, {
        fit: 'contain',
        position: 'centre',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    log.info('[Vidu] letterbox OK', { video_gen_id, target_aspect: aspectStr, canvas: `${cw}x${ch}`, out_kb: Math.round(out.length / 1024) });
    return out;
  } catch (e) {
    log.warn('[Vidu] letterbox failed', { video_gen_id, error: e.message });
    return null;
  }
}

/**
 * 读取参考图像素尺寸（用于与目标画幅对比）。不修改图片。
 * 优先读本地 static 文件；否则拉取 public URL。
 */
async function probeViduReferenceImageSize(rawImgUrl, publicImgUrl, storage_local_path, log, video_gen_id) {
  if (!sharp) {
    log.info('[Vidu] probe image: skipped (sharp unavailable)', { video_gen_id });
    return null;
  }
  try {
    let probeSource = '';
    const raw = (rawImgUrl || '').trim();
    if (raw.startsWith('data:image')) {
      probeSource = 'data_url';
    } else if (/localhost|127\.0\.0\.1/i.test(raw) && storage_local_path) {
      const afterStatic = raw.split('/static/')[1];
      if (afterStatic) {
        const localFile = path.join(storage_local_path, afterStatic.replace(/^\//, ''));
        if (fs.existsSync(localFile)) probeSource = 'local_static';
        else log.info('[Vidu] probe image: local path missing, will try fetch', { video_gen_id, localFile });
      }
    }
    if (!probeSource) {
      const fetchUrl = (publicImgUrl || '').trim() || raw;
      if (fetchUrl && !fetchUrl.startsWith('data:')) {
        probeSource = 'http_fetch';
        log.info('[Vidu] probe image: fetching', {
          video_gen_id,
          url_head: fetchUrl.length > 160 ? fetchUrl.slice(0, 160) + '…' : fetchUrl,
          url_len: fetchUrl.length,
        });
      }
    }
    const buf = await loadViduReferenceImageBuffer(rawImgUrl, publicImgUrl, storage_local_path, log, video_gen_id);
    if (!buf) {
      log.info('[Vidu] probe image: no buffer', { video_gen_id, has_public: !!publicImgUrl });
      return null;
    }
    if (probeSource === 'data_url') log.info('[Vidu] probe image: source=data URL', { video_gen_id, bytes: buf.length });
    if (probeSource === 'local_static') {
      const afterStatic = raw.split('/static/')[1];
      const localFile = path.join(storage_local_path, afterStatic.replace(/^\//, ''));
      log.info('[Vidu] probe image: source=local file', { video_gen_id, localFile, bytes: buf.length });
    }
    if (probeSource === 'http_fetch') log.info('[Vidu] probe image: fetch ok', { video_gen_id, bytes: buf.length });

    const meta = await sharp(buf, { failOn: 'none' }).rotate().metadata();
    const w = meta.width;
    const h = meta.height;
    if (!w || !h) {
      log.warn('[Vidu] probe image: no width/height in metadata', { video_gen_id, meta: { w, h, orientation: meta.orientation } });
      return null;
    }
    const whRatio = w / h;
    log.info('[Vidu] probe image: dimensions', {
      video_gen_id,
      source: probeSource || 'unknown',
      width: w,
      height: h,
      wh_ratio: Number(whRatio.toFixed(6)),
    });
    return { width: w, height: h };
  } catch (e) {
    log.warn('[Vidu] probe image dimensions failed', { error: e.message, video_gen_id });
    return null;
  }
}

/** 图生视频时参考图比例与目标不一致：强调参考图仅作内容参考，按目标画幅生成（不改原图） */
function viduMismatchAspectPromptSuffix(targetRatioLabel) {
  const r = targetRatioLabel || '16:9';
  return (
    `【画幅】参考图仅作角色、场景与风格参考，请勿沿用参考图的画幅比例；请按 ${r} 宽高比输出整段视频，构图与运镜可在该比例下自由发挥。` +
    ` The reference image is for subject/scene/style only; output the full video in aspect ratio ${r}, not the reference frame shape.`
  );
}

/**
 * ?? Vidu ???? API??? api.vidu.cn/ent/v2?
 * ???Authorization: Token {api_key}?? Bearer?
 * ???POST /ent/v2/tasks
 * ???GET /ent/v2/tasks/{id}/creations
 * ?????viduq2 / viduq2-pro / viduq2-turbo / viduq3-pro
 */
async function callViduVideoApi(config, log, opts) {
  const { prompt, model, duration, aspect_ratio, resolution: resolutionOpt, image_url, video_gen_id, files_base_url, storage_local_path } = opts;
  const apiKey = config.api_key || '';
  const base = (config.base_url || 'https://api.vidu.cn').replace(/\/$/, '');
  const modelName = model || 'viduq2';
  const dur = Math.min(10, Math.max(1, Math.round(Number(duration) || 5)));
  const ratio = clampToViduAspectRatio(aspect_ratio || '16:9');
  const hasImage = !!(image_url && image_url.trim());
  const resolutionBody = pickViduResolutionParam(resolutionOpt, modelName, hasImage);

  // ?? api.vidu.cn: Token ??????: Bearer ??
  const isOfficialVidu = /api\.vidu\.cn/i.test(base);
  const authHeader = (isOfficialVidu ? 'Token ' : 'Bearer ') + apiKey;

  // ????????? /ent/v2/img2video ?????????
  const defaultEp = hasImage ? '/ent/v2/img2video' : '/ent/v2/text2video';
  let ep = config.endpoint || defaultEp;
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  let effectivePrompt = (prompt || '').trim();

  log.info('[Vidu] task prepare', {
    video_gen_id,
    base_url: base,
    endpoint: ep,
    full_url: url,
    mode: hasImage ? 'img2video' : 'text2video',
    model: modelName,
    duration_sec: dur,
    aspect_ratio_effective: ratio,
    aspect_ratio_from_opts: aspect_ratio != null && aspect_ratio !== '' ? aspect_ratio : '(fallback 16:9)',
    resolution_body: resolutionBody,
    official_fields: 'aspect_ratio + resolution (Vidu ent/v2)',
    prompt_chars: effectivePrompt.length,
    has_image_url: hasImage,
    custom_endpoint: !!(config.endpoint && String(config.endpoint).trim()),
  });

  const body = {
    model: modelName,
    prompt: effectivePrompt,
    duration: dur,
    resolution: resolutionBody,
    aspect_ratio: ratio,
    movement_amplitude: 'auto',
    audio: false,
    off_peak: false,
    watermark: false,
  };
  if (!isOfficialVidu) {
    body.aspectRatio = ratio;
  }

  let publicImgUrl = null;
  // ????localhost ? ??????? URL
  if (hasImage) {
    const rawImgUrl = image_url.trim();
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
    if (publicImgUrl) {
      let imageUrlForVidu = publicImgUrl;
      const dims = await probeViduReferenceImageSize(rawImgUrl, publicImgUrl, storage_local_path, log, video_gen_id);
      const tgtNum = parseViduAspectRatio(ratio);
      const relTol = 0.06;
      const aspectMismatch = !!(dims && tgtNum != null && viduImageAspectMismatchesTarget(dims.width, dims.height, ratio, relTol));
      if (!dims) {
        log.info('[Vidu] aspect check: skipped (could not read image dimensions)', { video_gen_id, target_ratio: ratio });
      } else {
        const imgR = dims.width / dims.height;
        const relDiff = tgtNum != null ? Math.abs(imgR - tgtNum) / Math.max(imgR, tgtNum, 0.01) : null;
        log.info('[Vidu] aspect check', {
          video_gen_id,
          image_px: `${dims.width}x${dims.height}`,
          image_wh_ratio: Number(imgR.toFixed(6)),
          target_ratio_str: ratio,
          target_wh_ratio: tgtNum != null ? Number(tgtNum.toFixed(6)) : null,
          rel_diff: relDiff != null ? Number(relDiff.toFixed(6)) : null,
          tolerance_rel: relTol,
          mismatch: aspectMismatch,
        });
      }

      // img2video 实际画幅跟参考图像素比例走；仅靠 aspect_ratio 字段与 prompt 不可靠 → 比例不一致时生成留白图再上传（原图文件不改）
      let usedLetterbox = false;
      if (aspectMismatch && viduLetterboxCanvasPixels(ratio)) {
        const srcBuf = await loadViduReferenceImageBuffer(rawImgUrl, publicImgUrl, storage_local_path, log, video_gen_id);
        if (srcBuf) {
          const lbBuf = await letterboxBufferToViduAspect(srcBuf, ratio, log, video_gen_id);
          if (lbBuf) {
            const lbUrl = await uploadToImageProxy(lbBuf, 'image/jpeg', log, `vidu_vg${video_gen_id}_ar`);
            if (lbUrl) {
              imageUrlForVidu = lbUrl;
              usedLetterbox = true;
              log.info('[Vidu] img2video will use letterboxed reference (target aspect)', { video_gen_id, target_ratio: ratio });
            } else {
              log.warn('[Vidu] letterbox upload failed, falling back to original image + prompt hint', { video_gen_id });
            }
          }
        }
      }

      if (aspectMismatch && !usedLetterbox) {
        const suffix = viduMismatchAspectPromptSuffix(ratio);
        const sep = '\n\n';
        let combined = effectivePrompt ? `${effectivePrompt}${sep}${suffix}` : suffix;
        const maxLen = 5000;
        if (combined.length > maxLen) {
          const room = maxLen - suffix.length - sep.length;
          const head = room > 0 && effectivePrompt ? effectivePrompt.slice(0, room) : '';
          combined = head ? `${head}${sep}${suffix}` : suffix.slice(0, maxLen);
        }
        effectivePrompt = combined;
        body.prompt = effectivePrompt;
        log.info('[Vidu] appended framing hint to prompt (mismatch, no letterbox)', {
          video_gen_id,
          image: dims ? `${dims.width}x${dims.height}` : '?',
          target_ratio: ratio,
          prompt_chars_after: effectivePrompt.length,
          suffix_chars: suffix.length,
        });
      } else if (dims && !aspectMismatch) {
        log.info('[Vidu] no letterbox / prompt suffix (reference aspect within tolerance of target)', { video_gen_id });
      } else if (aspectMismatch && usedLetterbox) {
        log.info('[Vidu] letterbox applied; skipping long framing prompt suffix', { video_gen_id });
      }

      body.images = [imageUrlForVidu];
      try {
        const u = new URL(imageUrlForVidu);
        log.info('[Vidu] reference image URL (for API)', {
          video_gen_id,
          host: u.host,
          pathname: u.pathname,
          search: u.search ? '(has query)' : '',
          letterboxed: usedLetterbox,
        });
      } catch (_) {
        log.info('[Vidu] reference image URL (for API, non-URL string)', {
          video_gen_id,
          head: imageUrlForVidu.length > 120 ? imageUrlForVidu.slice(0, 120) + '…' : imageUrlForVidu,
          letterboxed: usedLetterbox,
        });
      }
    } else {
      log.info('[Vidu] no public image URL after resolve; img2video body may be invalid', { video_gen_id, raw_was_localhost: /localhost|127\.0\.0\.1/i.test(image_url.trim()) });
    }
  }

  log.info('[Vidu] Video API request', {
    url, model: modelName, auth: isOfficialVidu ? 'Token' : 'Bearer',
    dur, has_image: !!body.images, video_gen_id,
    aspect_ratio_in_json: body.aspect_ratio,
    prompt_chars_final: (body.prompt || '').length,
  });
  log.info('[Vidu] request body', { body: JSON.stringify({ ...body, images: body.images ? ['(url)'] : undefined }), video_gen_id });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  log.info('[Vidu] raw response', {
    status: res.status,
    body_chars: raw.length,
    body_preview: raw.slice(0, 1200),
    video_gen_id,
  });

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
  log.info('[Vidu] task created', {
    task_id: taskId,
    state: data?.state,
    video_gen_id,
    response_model: data?.model,
    response_aspect_ratio: data?.aspect_ratio,
    response_duration: data?.duration,
    response_resolution: data?.resolution,
    credits: data?.credits,
  });
  return { task_id: taskId, status: data?.state || 'created' };
}

/**
 * 单张参考图：公网 URL 优先（图床 / 已是图床链），失败再 data URL。Veo3 与 xAI 视频共用（与可灵 Omni 一致）。
 * @returns {Promise<{ kind: 'url'|'data', value: string }|null>}
 */
async function resolveVeo3ImageForApi(rawImgUrl, storage_local_path, log, video_gen_id) {
  const raw = (rawImgUrl || '').trim();
  if (!raw) return null;
  const tag = `videoref_${video_gen_id || '0'}`;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host.includes('imageproxy.zhongzhuan.chat')) {
      return { kind: 'url', value: raw };
    }
  } catch (_) {
    /* 非绝对 URL */
  }

  if (!raw.startsWith('data:') && storage_local_path) {
    const proxyUrl = await uploadLocalImageToProxy(storage_local_path, raw, log, tag);
    if (proxyUrl) return { kind: 'url', value: proxyUrl };
  }

  if (raw.startsWith('data:')) {
    const m = raw.match(/^data:([\w/+.-]+);base64,(.+)$/is);
    if (m) {
      try {
        const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
        const mt = (m[1] || 'image/jpeg').toLowerCase();
        const mime = mt.includes('png') ? 'image/png' : mt.includes('webp') ? 'image/webp' : 'image/jpeg';
        const proxyUrl = await uploadToImageProxy(buf, mime, log, tag);
        if (proxyUrl) return { kind: 'url', value: proxyUrl };
        log.warn('[视频参考图] data 图床失败，回退内联 data', { video_gen_id });
      } catch (e) {
        log.warn('[视频参考图] data 解析失败', { error: e.message, video_gen_id });
      }
    }
    return { kind: 'data', value: raw };
  }

  let relAfterStatic = '';
  if (raw.includes('/static/')) {
    relAfterStatic = (raw.split('/static/')[1] || '').split(/[?#]/)[0].replace(/^\/+/, '');
  }
  if (relAfterStatic && storage_local_path) {
    try {
      let safeRel = relAfterStatic;
      try {
        safeRel = decodeURIComponent(relAfterStatic);
      } catch (_) {
        /* keep */
      }
      const localFile = path.join(storage_local_path, safeRel);
      const resolved = path.resolve(localFile);
      const baseResolved = path.resolve(storage_local_path);
      if (resolved.startsWith(baseResolved) && fs.existsSync(localFile)) {
        const buf = fs.readFileSync(localFile);
        const ext = path.extname(localFile).toLowerCase();
        const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'image/jpeg';
        const proxyUrl = await uploadToImageProxy(buf, mime, log, tag);
        if (proxyUrl) return { kind: 'url', value: proxyUrl };
        log.warn('[视频参考图] 本地图床失败 → base64', { video_gen_id });
        return { kind: 'data', value: `data:${mime};base64,${buf.toString('base64')}` };
      }
    } catch (e) {
      log.warn('[视频参考图] 读本地文件失败', { error: e.message, video_gen_id });
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const dlRes = await fetch(raw);
      if (dlRes.ok) {
        const buf = Buffer.from(await dlRes.arrayBuffer());
        const ct = (dlRes.headers.get('content-type') || '').split(';')[0].trim() || 'image/jpeg';
        const mime = ct.startsWith('image/') ? ct : 'image/jpeg';
        const proxyUrl = await uploadToImageProxy(buf, mime, log, tag);
        if (proxyUrl) return { kind: 'url', value: proxyUrl };
        log.warn('[视频参考图] 拉取后图床失败 → base64', { video_gen_id });
        return { kind: 'data', value: `data:${mime};base64,${buf.toString('base64')}` };
      }
      log.warn('[视频参考图] fetch 非 2xx', { status: dlRes.status, url_head: raw.slice(0, 96), video_gen_id });
    } catch (e) {
      log.warn('[视频参考图] fetch 失败', { error: e.message, url_head: raw.slice(0, 96), video_gen_id });
    }
    return { kind: 'url', value: raw };
  }

  return { kind: 'url', value: raw };
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
    const resolved = await resolveVeo3ImageForApi(rawImgUrl, storage_local_path, log, video_gen_id);
    if (resolved && resolved.value) {
      body.images = [resolved.value];
      log.info('[视频参考图] Veo3 已解析', {
        transport: resolved.kind,
        value_head: String(resolved.value).slice(0, 80),
        video_gen_id,
      });
    }
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

function isJimengFreeApiSeedanceModel(model) {
  const m = String(model || '').toLowerCase();
  return m.includes('seedance');
}

/**
 * 参考图 URL → Buffer（multipart），供用户自托管的 Jimeng 免费 API 使用
 */
async function resolveJimengApiImageBuffer(rawUrl, files_base_url, storage_local_path, log, video_gen_id, index) {
  const raw = (rawUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    const m = /^data:([^;]+);base64,(.+)$/i.exec(raw.replace(/\s/g, ''));
    if (m) {
      const mime = (m[1] || '').toLowerCase();
      const buf = Buffer.from(m[2], 'base64');
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      return { buffer: buf, filename: 'ref_' + index + '.' + ext };
    }
    return null;
  }
  if (/localhost|127\.0\.0\.1/i.test(raw) && storage_local_path) {
    const baseUrl = (files_base_url || '').replace(/\/$/, '');
    const afterStatic = raw.split('/static/')[1] || (baseUrl ? raw.replace(baseUrl + '/', '').replace(baseUrl, '') : null);
    const relPath = afterStatic ? afterStatic.replace(/^\//, '') : null;
    if (relPath) {
      const filePath = path.join(storage_local_path, relPath);
      try {
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          return { buffer: buf, filename: path.basename(filePath) || 'ref_' + index + '.jpg' };
        }
      } catch (e) {
        log.warn('[JimengAI] 读本地参考图失败', { error: e.message, video_gen_id, index });
      }
    }
  }
  if (raw.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(raw)) {
    try {
      if (fs.existsSync(raw)) {
        const buf = fs.readFileSync(raw);
        return { buffer: buf, filename: path.basename(raw) || 'ref_' + index + '.jpg' };
      }
    } catch (_) {}
  }
  const isPublicHttp = /^https?:\/\//i.test(raw) && !/localhost|127\.0\.0\.1/i.test(raw);
  if (isPublicHttp) {
    const res = await fetch(raw);
    if (!res.ok) throw new Error('拉取参考图失败 HTTP ' + res.status);
    const ab = await res.arrayBuffer();
    return { buffer: Buffer.from(ab), filename: 'ref_' + index + '.jpg' };
  }
  if (storage_local_path) {
    const proxyUrl = await uploadLocalImageToProxy(storage_local_path, raw, log, 'jimeng_ai_vg' + video_gen_id + '_' + index);
    if (proxyUrl) {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('图床参考图拉取失败 HTTP ' + res.status);
      const ab = await res.arrayBuffer();
      return { buffer: Buffer.from(ab), filename: 'ref_' + index + '.jpg' };
    }
  }
  return null;
}

/**
 * 用户自托管 jimeng-free-api-all：POST /v1/videos/generations（multipart 或 JSON）
 * @returns {Promise<{ video_url?: string, error?: string }>}
 */
async function callJimengAiApiVideo(config, log, opts) {
  const base = (config.base_url || '').toString().replace(/\/$/, '').trim();
  if (!base) {
    return { error: 'Jimeng AI API 未配置 Base URL（请填写自建服务地址，如 http://127.0.0.1:8000）' };
  }
  let apiKey = (config.api_key || '').trim();
  if (/^bearer\s+/i.test(apiKey)) apiKey = apiKey.replace(/^bearer\s+/i, '').trim();
  if (!apiKey) {
    return { error: 'Jimeng AI API 未配置 Session（填入 API Key 字段，多个用英文逗号分隔）' };
  }

  const model = getModelFromConfig(config, opts.model);
  const seedance = isJimengFreeApiSeedanceModel(model);
  let ratio = (opts.aspect_ratio || '16:9').toString().trim().replace(/\uFF1A/g, ':');
  let dur = opts.duration != null ? Number(opts.duration) : seedance ? 4 : 5;
  if (!Number.isFinite(dur) || dur < 1) dur = seedance ? 4 : 5;
  if (seedance) {
    if (dur === 5) dur = 4;
    dur = Math.min(15, Math.max(4, Math.round(dur)));
    if (ratio === '1:1') ratio = '4:3';
  } else {
    dur = dur <= 7 ? 5 : 10;
  }

  const resolution = (opts.resolution || '720p').toString().trim() || '720p';
  const pathSuffix = (config.endpoint || '/v1/videos/generations').toString().trim();
  const apiPath = pathSuffix.startsWith('/') ? pathSuffix : '/' + pathSuffix;
  const url = base + apiPath;
  const video_gen_id = opts.video_gen_id;

  const urlList = [];
  const refs = Array.isArray(opts.reference_urls) ? opts.reference_urls.filter(Boolean) : [];
  for (const u of refs) urlList.push(String(u).trim());
  if (opts.image_url && String(opts.image_url).trim()) urlList.push(String(opts.image_url).trim());
  if (opts.first_frame_url && String(opts.first_frame_url).trim()) urlList.push(String(opts.first_frame_url).trim());
  if (opts.last_frame_url && String(opts.last_frame_url).trim()) urlList.push(String(opts.last_frame_url).trim());
  const seen = new Set();
  const orderedUrls = [];
  for (const u of urlList) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    orderedUrls.push(u);
  }

  const fileParts = [];
  for (let i = 0; i < orderedUrls.length; i++) {
    try {
      const part = await resolveJimengApiImageBuffer(
        orderedUrls[i],
        opts.files_base_url,
        opts.storage_local_path,
        log,
        video_gen_id,
        i
      );
      if (part && part.buffer && part.buffer.length) fileParts.push(part);
    } catch (e) {
      log.warn('[JimengAI] 解析参考图失败', { video_gen_id, index: i, message: e.message });
    }
  }

  if (seedance && fileParts.length === 0) {
    return { error: 'Jimeng Seedance 需要至少一张参考图（请设置分镜参考图或 image_url）' };
  }

  const prompt = (opts.prompt || '').toString();
  const headers = { Authorization: 'Bearer ' + apiKey };
  let fetchOpts = { method: 'POST', headers };

  const longWaitMs = 10 * 60 * 1000;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    fetchOpts.signal = AbortSignal.timeout(longWaitMs);
  }

  if (fileParts.length > 0) {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('ratio', ratio);
    form.append('duration', String(dur));
    form.append('resolution', resolution);
    for (const { buffer, filename } of fileParts) {
      const blob = new Blob([buffer]);
      form.append('files', blob, filename || 'image.jpg');
    }
    fetchOpts.body = form;
    log.info('[JimengAI] multipart 提交', {
      video_gen_id,
      url,
      model,
      ratio,
      duration: dur,
      resolution,
      file_count: fileParts.length,
    });
  } else {
    fetchOpts.headers = { ...headers, 'Content-Type': 'application/json' };
    fetchOpts.body = JSON.stringify({
      model,
      prompt,
      ratio,
      duration: dur,
      resolution,
    });
    log.info('[JimengAI] JSON 提交（无参考图）', { video_gen_id, url, model, ratio, duration: dur, resolution });
  }

  let res;
  try {
    res = await fetch(url, fetchOpts);
  } catch (e) {
    const msg = e.name === 'AbortError' || e.name === 'TimeoutError' ? '请求超时（视频生成较慢，可稍后重试）' : e.message;
    log.error('[JimengAI] 请求失败', { video_gen_id, message: e.message });
    return { error: 'Jimeng AI API 请求失败: ' + msg };
  }

  const raw = await res.text();
  log.info('[JimengAI] 响应', { video_gen_id, status: res.status, raw_head: raw.slice(0, 800) });
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return { error: 'Jimeng AI API 非 JSON 响应 (' + res.status + '): ' + raw.slice(0, 300) };
  }

  if (!res.ok) {
    const errMsg =
      data?.error?.message ||
      data?.error ||
      data?.errmsg ||
      data?.message ||
      raw.slice(0, 400);
    return { error: 'Jimeng AI API ' + res.status + ': ' + (typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)) };
  }

  const videoUrl = data?.data?.[0]?.url || data?.data?.[0]?.video_url;
  if (videoUrl) {
    log.info('[JimengAI] 得到视频地址', { video_gen_id, video_url_head: String(videoUrl).slice(0, 96) });
    return { video_url: String(videoUrl) };
  }

  return { error: 'Jimeng AI API 未返回 data[0].url: ' + JSON.stringify(data).slice(0, 400) };
}

function resolveXaiVideoResolution(resolution) {
  const s = String(resolution || '').toLowerCase();
  if (s.includes('480')) return '480p';
  if (s.includes('720')) return '720p';
  return '720p';
}

/** grok-video-3 等官方示例：size 为 "720P" / "480P"（大写 P） */
function formatGrokVideo3Size(resolution) {
  const s = resolveXaiVideoResolution(resolution);
  if (String(s).includes('480')) return '480P';
  return '720P';
}

function clampXaiDuration(d) {
  const n = Math.round(Number(d));
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.min(15, Math.max(1, n));
}

/** 模型名同时含 grok 与 video（不必相邻，如 grok-video-3、grok_imagine_1.0_video_apimart）→ images[] + size */
function isXaiGrokVideoStyleModel(modelName) {
  const m = String(modelName || '').toLowerCase();
  return /grok/.test(m) && /video/.test(m);
}

/** 主图 + reference_urls 去重合并为公网 URL 字符串数组 */
function mergeXaiVideoImageUrls(imageUrlForApi, resolvedRefStrings, max = 10) {
  const images = [];
  if (imageUrlForApi) images.push(imageUrlForApi);
  for (const s of resolvedRefStrings) {
    if (s && !images.includes(s)) images.push(s);
  }
  return images.slice(0, max);
}

/**
 * xAI 视频（官方两套）：
 * - grok + video 模型：images: string[]、size（720P）、aspect_ratio、duration（中转 grok-video-3 等同此）。
 * - 其余 grok-imagine：image.url、resolution、duration、reference_images（主图与额外参考图可同时存在）。
 */
async function callXaiVideoApi(config, log, opts) {
  const {
    prompt,
    model,
    duration,
    aspect_ratio,
    resolution,
    image_url,
    reference_urls,
    files_base_url,
    storage_local_path,
    video_gen_id,
  } = opts;

  const base = (config.base_url || 'https://api.x.ai').replace(/\/$/, '');
  let ep = config.endpoint || '/v1/videos/generations';
  if (!ep.startsWith('/')) ep = '/' + ep;
  const url = base + ep;

  const ratio = normalizeAspectRatioForApi(aspect_ratio) || '16:9';
  const dur = clampXaiDuration(duration != null ? duration : 8);
  const reso = resolveXaiVideoResolution(resolution);
  const modelName = model || 'grok-imagine-video';
  const useGrokVideoImages = isXaiGrokVideoStyleModel(modelName);

  let imageUrlForApi = '';
  const rawMain = (image_url || '').trim();
  if (rawMain) {
    const resolved = await resolveVeo3ImageForApi(rawMain, storage_local_path, log, String(video_gen_id || ''));
    if (resolved?.value) {
      imageUrlForApi = resolved.value;
      log.info('[xAI视频] 参考图已解析', {
        transport: resolved.kind,
        value_head: String(resolved.value).slice(0, 88),
        video_gen_id,
      });
    }
  }

  const resolvedRefStrings = [];
  if (Array.isArray(reference_urls) && reference_urls.length > 0) {
    for (let i = 0; i < reference_urls.length; i++) {
      const u = reference_urls[i] && String(reference_urls[i]).trim();
      if (!u) continue;
      const r = await resolveVeo3ImageForApi(u, storage_local_path, log, `${video_gen_id || 0}_r${i}`);
      if (r?.value) resolvedRefStrings.push(r.value);
    }
  }

  const mergedImages = mergeXaiVideoImageUrls(imageUrlForApi, resolvedRefStrings);

  let body;
  let logExtra = {};

  if (useGrokVideoImages) {
    body = {
      model: modelName,
      prompt: prompt || '',
      aspect_ratio: ratio,
      size: formatGrokVideo3Size(resolution),
      duration: dur,
    };
    if (mergedImages.length) body.images = mergedImages;
    logExtra = {
      body_shape: 'grok-video',
      images_count: body.images?.length || 0,
      size: body.size,
    };
  } else {
    body = {
      model: modelName,
      prompt: prompt || '',
      duration: dur,
      aspect_ratio: ratio,
      resolution: reso,
    };
    if (imageUrlForApi) {
      body.image = { url: imageUrlForApi };
      const extraRefs = mergedImages.filter((u) => u !== imageUrlForApi);
      if (extraRefs.length > 0) {
        body.reference_images = extraRefs.map((u) => ({ url: u }));
      }
    } else if (mergedImages.length > 0) {
      body.reference_images = mergedImages.map((u) => ({ url: u }));
    }
    logExtra = {
      body_shape: 'grok-imagine',
      has_image: !!body.image,
      ref_count: body.reference_images?.length || 0,
      total_unique_images: mergedImages.length,
    };
  }

  const first = mergedImages[0] || '';
  const mainTransport =
    first && String(first).startsWith('data:') ? 'data_url' : first ? 'http_url' : 'none';

  log.info('[xAI视频] 提交', {
    video_gen_id,
    url,
    model: body.model,
    aspect_ratio: ratio,
    duration: body.duration != null ? body.duration : dur,
    resolution: body.resolution != null ? body.resolution : undefined,
    image_transport: mainTransport,
    ...logExtra,
    images: body.images,
    image_url_head: body.image?.url ? String(body.image.url).slice(0, 100) : null,
    reference_images_heads: Array.isArray(body.reference_images)
      ? body.reference_images.map((r) => String(r?.url || '').slice(0, 100))
      : undefined,
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
  log.info('[xAI视频] 响应', { video_gen_id, status: res.status, head: raw.slice(0, 500) });

  if (!res.ok) {
    let errMsg = 'xAI 视频请求失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message || errJson.error;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 220);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: 'xAI 响应非 JSON: ' + raw.slice(0, 200) };
  }

  const direct = pickProxyVideoUrl(data);
  if (direct) {
    log.info('[xAI视频] 同步返回地址', { video_gen_id });
    return { video_url: direct };
  }

  const reqId = data.request_id || data.task_id || data.id;
  if (reqId) {
    log.info('[xAI视频] 异步任务', { video_gen_id, request_id: reqId });
    return { task_id: String(reqId), status: 'submitted' };
  }

  return { error: 'xAI 未返回 request_id 或视频地址: ' + JSON.stringify(data).slice(0, 300) };
}

const VIDEO_PROTOCOLS_SUPPORT_SD2_ASSET_SCHEME = new Set([
  'volcengine_omni',
  'volcengine',
  'dashscope',
  'kling_omni',
  'kling',
]);

function parseJsonColumnForVideo(v) {
  if (v == null || v === '') return null;
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch (_) {
    return null;
  }
}

function normalizeMaterialHubAssetUrlForVideo(assetUrlOrId) {
  const s = String(assetUrlOrId || '').trim();
  if (!s) return null;
  if (s.startsWith('asset://')) return s;
  if (s.startsWith('asset-')) return `asset://${s}`;
  return `asset://${s.replace(/^\/+/, '')}`;
}

function normalizeStorageRelativePath(p) {
  let s = String(p || '').trim().replace(/^[/\\]+/, '').split('?')[0];
  s = s.replace(/\\/g, '/').replace(/\/+$/, '');
  return s;
}

function storageRelativeFromPublicUrl(urlStr) {
  const s = String(urlStr || '').trim();
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    let p = u.pathname || '';
    const marker = '/static/';
    const idx = p.toLowerCase().indexOf(marker);
    if (idx >= 0) p = p.slice(idx + marker.length);
    else p = p.replace(/^\/+/, '');
    return normalizeStorageRelativePath(decodeURIComponent(p));
  } catch (_) {
    return '';
  }
}

function buildSd2ActiveAssetUrlLookup(db, dramaId) {
  const urlToAsset = new Map();
  const relPathToAsset = new Map();
  if (!db || !dramaId) return { urlToAsset, relPathToAsset };
  let rows = [];
  try {
    rows = db.prepare(
      'SELECT image_url, local_path, seedance2_asset FROM characters WHERE drama_id = ? AND deleted_at IS NULL'
    ).all(Number(dramaId));
  } catch (_) {
    return { urlToAsset, relPathToAsset };
  }
  for (const row of rows) {
    const asset = parseJsonColumnForVideo(row.seedance2_asset);
    if (!asset || String(asset.status || '').toLowerCase() !== 'active') continue;
    const uri = normalizeMaterialHubAssetUrlForVideo(asset.hub_asset_id || asset.asset_url);
    if (!uri) continue;
    const certImg = String(asset.certified_image_url || '').trim();
    const certLp = normalizeStorageRelativePath(asset.certified_local_path || '');
    if (certImg) {
      urlToAsset.set(certImg, uri);
      urlToAsset.set(certImg.split('?')[0], uri);
    }
    if (certLp) relPathToAsset.set(certLp, uri);
    const img = String(row.image_url || '').trim();
    if (img) {
      urlToAsset.set(img, uri);
      urlToAsset.set(img.split('?')[0], uri);
    }
    const lp = normalizeStorageRelativePath(row.local_path || '');
    if (lp) relPathToAsset.set(lp, uri);
  }
  return { urlToAsset, relPathToAsset };
}

function rewriteOneImageUrlForSd2(original, lookup) {
  const s = String(original || '').trim();
  if (!s || s.startsWith('asset://') || s.startsWith('data:')) return { next: s, changed: false };
  const tries = [s, s.split('?')[0]];
  for (const t of tries) {
    if (lookup.urlToAsset.has(t)) return { next: lookup.urlToAsset.get(t), changed: true };
  }
  const rel = storageRelativeFromPublicUrl(s);
  if (rel && lookup.relPathToAsset.has(rel)) {
    return { next: lookup.relPathToAsset.get(rel), changed: true };
  }
  return { next: s, changed: false };
}

/**
 * 收集剧中所有 active 状态的 Seedance 2.0 角色音色参考
 * @returns {Map<number, string>} charId -> publicUrl
 */
function collectActiveCharacterVoiceRefs(db, dramaId) {
  const map = new Map();
  if (!db || !dramaId) return map;
  try {
    const rows = db.prepare(
      'SELECT id, seedance2_voice_asset FROM characters WHERE drama_id = ? AND deleted_at IS NULL'
    ).all(Number(dramaId));
    for (const row of rows) {
      const asset = parseJsonColumnForVideo(row.seedance2_voice_asset);
      if (!asset || String(asset.status || '').toLowerCase() !== 'active') continue;
      const url = String(asset.url || '').trim();
      if (url) map.set(Number(row.id), url);
    }
  } catch (_) {}
  return map;
}

function applySeedance2CertifiedAssetUrlsToVideoOpts(db, log, opts) {
  const out = { ...opts };
  const lookup = buildSd2ActiveAssetUrlLookup(db, opts.drama_id);
  if (lookup.urlToAsset.size === 0 && lookup.relPathToAsset.size === 0) return out;
  const changes = [];
  const patch = (field, val) => {
    const r = rewriteOneImageUrlForSd2(val, lookup);
    if (r.changed) changes.push(field);
    return r.next;
  };
  if (opts.image_url != null) out.image_url = patch('image_url', opts.image_url);
  if (opts.first_frame_url != null) out.first_frame_url = patch('first_frame_url', opts.first_frame_url);
  if (opts.last_frame_url != null) out.last_frame_url = patch('last_frame_url', opts.last_frame_url);
  if (Array.isArray(opts.reference_urls)) {
    out.reference_urls = opts.reference_urls.map((u, i) => patch(`reference_urls[${i}]`, u));
  }
  if (changes.length && log?.info) {
    log.info('[视频][SD2] 已将认证图片替换为 asset 引用', {
      video_gen_id: opts.video_gen_id,
      drama_id: opts.drama_id,
      changed_fields: changes,
    });
  }
  return out;
}

/**
 * 火山经典 Seedance（非 omni）路径：本地图片转 base64（或直传公网 URL）。
 * 同时支持 first_frame / last_frame 专用字段，以及回退到 image_url。
 */
function resolveVolcClassicImage(rawUrl, files_base_url, storage_local_path, log, video_gen_id, roleHint) {
  let u = String(rawUrl || '').trim();
  if (!u) return null;
  if (u.startsWith('data:') || u.startsWith('asset://')) return u;

  // 已经是公网 https 且不含 localhost 的，直接返回
  if (/^https?:\/\//i.test(u) && !/localhost|127\.0\.0\.1/i.test(u)) return u;

  const fb = (files_base_url || '').replace(/\/$/, '');
  const baseIndicatesLocal = fb && /localhost|127\.0\.0\.1/i.test(fb);
  const urlIndicatesLocal = /localhost|127\.0\.0\.1/i.test(u);

  if ((baseIndicatesLocal || urlIndicatesLocal) && storage_local_path) {
    let rel = null;
    const marker = '/static/';
    const idx = u.toLowerCase().indexOf(marker);
    if (idx >= 0) {
      rel = u.slice(idx + marker.length).replace(/^\//, '').split('?')[0];
    } else if (fb) {
      rel = u.replace(fb + '/', '').replace(fb, '').replace(/^\//, '').split('?')[0];
    } else if (!/^https?:\/\//i.test(u)) {
      // 纯相对路径（来自 local_path 兜底）
      rel = u.replace(/^\//, '').split('?')[0];
    }
    if (rel) {
      const filePath = path.join(storage_local_path, rel);
      try {
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' }[ext] || 'image/png';
          const b64 = 'data:' + mime + ';base64,' + buf.toString('base64');
          if (log && log.info) {
            log.info('[Volc] 本地首/尾帧已转为 base64 提交', { video_gen_id, role: roleHint, rel: rel.slice(0, 80) });
          }
          return b64;
        }
      } catch (_) {}
    }
  }
  // 兜底返回原始值（中转或公网会处理）
  return u;
}

/**
 * ?????? API?ChatFire/?? ? ?????
 * @returns {Promise<{ task_id?: string, video_url?: string, error?: string }>}
 */
async function callVideoApi(db, log, opts) {
  const {
    prompt,
    model: preferredModel,
    duration,
    aspect_ratio,
    resolution,
    seed,
    camera_fixed,
    watermark,
    image_url,
    first_frame_url,
    last_frame_url,
    first_frame_local_path,
    last_frame_local_path,
    files_base_url,
    storage_local_path,
    video_gen_id
  } = opts;
  const config = getDefaultVideoConfig(db, preferredModel);
  if (!config) {
    throw new Error('???????????AI ?????? video ?????????');
  }
  const model = getModelFromConfig(config, preferredModel);
  const provider = (config.provider || '').toLowerCase();
  const protocol = resolveVideoProtocol(config, preferredModel);
  if (db && opts.drama_id && VIDEO_PROTOCOLS_SUPPORT_SD2_ASSET_SCHEME.has(protocol)) {
    opts = applySeedance2CertifiedAssetUrlsToVideoOpts(db, log, opts);
  }

  // Seedance 2.0 自动注入角色音色参考（仅当模型为 SD2 且未显式指定 voice_reference_url 时）
  const isSeedance2 = /seedance[-_]?2|seedance2|2[-_]0[-_]/.test(String(model || ''));
  if (isSeedance2 && db && opts.drama_id && !opts.voice_reference_url) {
    const voiceMap = collectActiveCharacterVoiceRefs(db, opts.drama_id);
    if (voiceMap.size > 0) {
      // 优先使用分镜显式指定的角色（如果有），否则取第一个
      let chosen = null;
      if (opts.storyboard_id) {
        try {
          const sbRow = db.prepare('SELECT characters FROM storyboards WHERE id = ?').get(opts.storyboard_id);
          if (sbRow && sbRow.characters) {
            const charList = typeof sbRow.characters === 'string' ? JSON.parse(sbRow.characters) : sbRow.characters;
            const ids = Array.isArray(charList) ? charList.map(c => Number(c?.id || c)).filter(Boolean) : [];
            for (const cid of ids) {
              if (voiceMap.has(cid)) { chosen = voiceMap.get(cid); break; }
            }
          }
        } catch (_) {}
      }
      if (!chosen) {
        // 取 Map 中的第一个
        chosen = voiceMap.values().next().value;
      }
      if (chosen) {
        opts.voice_reference_url = chosen;
        log.info('[视频][SD2][全能] 自动为 Seedance 2.0 注入角色音色参考（来自角色 seedance2_voice_asset）', {
          video_gen_id,
          storyboard_id: opts.storyboard_id,
          voice_ref_url: String(chosen).slice(0, 100)
        });
      } else {
        log.info('[视频][SD2][全能] 检测到活跃音色参考但未匹配到当前分镜角色', {
          video_gen_id,
          storyboard_id: opts.storyboard_id,
          available_voice_char_ids: Array.from(voiceMap.keys())
        });
      }
    } else {
      log.info('[视频][SD2][全能] Seedance 2.0 模型但本剧暂无 active 音色参考', { video_gen_id, drama_id: opts.drama_id });
    }
  }
  log.info('[视频] 路由协议', {
    video_gen_id,
    provider,
    api_protocol_raw: config.api_protocol || '(empty→auto)',
    protocol_used: protocol,
    model,
    endpoint: config.endpoint || '(auto)',
  });

  if (protocol === 'jimeng_ai_api') {
    return callJimengAiApiVideo(config, log, {
      prompt,
      model: preferredModel,
      duration: opts.duration,
      aspect_ratio,
      resolution: opts.resolution,
      image_url: opts.image_url,
      first_frame_url: opts.first_frame_url,
      last_frame_url: opts.last_frame_url,
      reference_urls: opts.reference_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

  if (protocol === 'xai') {
    return callXaiVideoApi(config, log, {
      prompt,
      model,
      duration: opts.duration,
      aspect_ratio,
      resolution: opts.resolution,
      image_url: opts.image_url,
      reference_urls: opts.reference_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
    });
  }

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
      resolution: opts.resolution,
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
      // 为将来可灵 Omni 也支持音色参考做准备（当前 Seedance 2.0 不走此分支）
      voice_reference_url: opts.voice_reference_url,
    });
  }

  if (protocol === 'volcengine_omni') {
    return callVolcengineOmniVideoApi(config, log, {
      prompt,
      model,
      duration: opts.duration,
      aspect_ratio,
      resolution: opts.resolution,
      seed: opts.seed,
      camera_fixed: opts.camera_fixed,
      watermark: opts.watermark,
      image_url: opts.image_url,
      reference_urls: opts.reference_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      video_gen_id: opts.video_gen_id,
      // 关键：把 callVideoApi 里自动注入的 Seedance 2.0 音色参考音频透传下去
      voice_reference_url: opts.voice_reference_url,
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

  // ========== 首尾帧支持（完善版） ==========
  // 优先使用显式传入的 first_frame_url / last_frame_url（首尾帧模式核心）
  // 其次回退到 image_url（经典单图模式保持兼容）
  const rawFirst = (first_frame_url || first_frame_local_path || image_url || '').toString().trim();
  const rawLast = (last_frame_url || last_frame_local_path || '').toString().trim();

  // 使用新 helper 解析（自动处理 localhost → base64、asset:// 直传、公网 URL）
  const firstForApi = resolveVolcClassicImage(rawFirst, files_base_url || opts.files_base_url, storage_local_path || opts.storage_local_path, log, video_gen_id, 'first_frame');
  let lastForApi = null;
  if (rawLast) {
    lastForApi = resolveVolcClassicImage(rawLast, files_base_url || opts.files_base_url, storage_local_path || opts.storage_local_path, log, video_gen_id, 'last_frame');
  }

  // 去重：如果 first 和 last 指向同一资源，只保留 first（极少见）
  if (firstForApi && lastForApi && firstForApi === lastForApi) {
    lastForApi = null;
  }

  const hasAnyFrame = !!(firstForApi || lastForApi);
  // 只要有首帧或尾帧就走 i2v；旧版单图行为完全保留
  const volcTaskType = isVolc ? (hasAnyFrame ? 'i2v' : 't2v') : null;

  // 火山 Seedance：按模型版本限制时长（1.5 Pro 支持 5–12 秒，非仅 5/10）
  let effectiveDuration = dur;
  if (isVolc) {
    const rounded = Math.round(dur);
    effectiveDuration = normalizeVolcengineDuration(finalModel, rounded);
    if (effectiveDuration !== rounded) {
      log.info('Adjusted duration for Volcengine', {
        original: dur,
        adjusted: effectiveDuration,
        model: finalModel,
        video_gen_id,
      });
    }
  }

  // ratio?duration ????????????????/ChatFire ???????
  const body = {
    model: finalModel,
    content: [{ type: 'text', text: prompt || '' }],
    ratio,
    aspect_ratio: ratio,
    duration: effectiveDuration,
    watermark: (watermark != null) ? Boolean(watermark) : false,
  };
  if (resolution) body.resolution = resolution;
  if (seed != null) body.seed = Number(seed);
  if (camera_fixed != null) body.camera_fixed = Boolean(camera_fixed);
  if (volcTaskType) body.task_type = volcTaskType;

  // 按官方要求：first_frame 必须在 last_frame 之前；role 严格区分
  if (firstForApi) {
    const p = { type: 'image_url', image_url: { url: firstForApi } };
    p.role = 'first_frame';
    body.content.push(p);
  }
  if (lastForApi) {
    const p = { type: 'image_url', image_url: { url: lastForApi } };
    p.role = 'last_frame';
    body.content.push(p);
  }

  // 向后兼容：没有任何 first/last 字段时，单张 image_url 仍按老逻辑作为 first_frame（i2v）
  if (!hasAnyFrame && image_url && image_url.trim()) {
    // 极少数兜底（正常流程不会走到这里，因为 rawFirst 已包含 image_url）
    const legacy = resolveVolcClassicImage(image_url, files_base_url || opts.files_base_url, storage_local_path || opts.storage_local_path, log, video_gen_id, 'image_url_fallback');
    if (legacy) {
      const p = { type: 'image_url', image_url: { url: legacy } };
      p.role = 'first_frame';
      body.content.push(p);
      if (!body.task_type) body.task_type = 'i2v';
    }
  }

  // Seedance 1.5 Pro（火山）480p 草稿模式：检测模型名含 seedance + 1-5 + pro 且分辨率为 480p 时自动添加 draft=true，降低成本并加速
  if (isVolc) {
    const m = (finalModel || '').toLowerCase();
    const resStr = resolution ? String(resolution).toLowerCase() : '';
    if (m.includes('seedance') && m.includes('1-5') && m.includes('pro') && resStr === '480p') {
      body.draft = true;
      log.info('启用 Seedance 1.5 Pro 草稿模式 (draft=true) 以降低成本并提升速度', { model: finalModel, resolution, video_gen_id });
    }
  }

  log.info('Video API request', {
    url,
    model,
    video_gen_id,
    task_type: body.task_type,
    has_first_frame: !!firstForApi,
    has_last_frame: !!lastForApi,
    frame_count: (firstForApi ? 1 : 0) + (lastForApi ? 1 : 0),
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
  const protocol = resolveVideoProtocol(config);
  const isDashScope = protocol === 'dashscope';
  const isGemini = protocol === 'gemini';
  const isVidu = protocol === 'vidu';
  const isSora = protocol === 'sora';
  const isKling = protocol === 'kling';
  const isKlingOmni = protocol === 'kling_omni' || (typeof taskId === 'string' && taskId.startsWith('omni:'));
  const isVeo3 = protocol === 'veo3';
  /** 轮询日志里响应体最大字符数（即梦/方舟等 JSON 可能较长）；0 表示不截断（慎用） */
  const pollLogBodyMax = (() => {
    const v = String(process.env.VIDEO_POLL_LOG_MAX || '16384').trim();
    if (v === '0' || v.toLowerCase() === 'full') return Infinity;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 512 * 1024) : 16384;
  })();
  const isVolcPoll =
    provider === 'volces' ||
    provider === 'volcengine' ||
    provider === 'volc' ||
    protocol === 'volcengine' ||
    protocol === 'volcengine_omni';
  if (protocol === 'jimeng_ai_api') {
    log.warn('[poll] Jimeng AI API 不应进入轮询', { video_gen_id: videoGenId, task_id: taskId });
    return { error: 'Jimeng AI API 为同步返回视频地址，不应进入轮询' };
  }
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
      const pollRound = attempt + 1;
      log.info('[poll] 发起查询', { video_gen_id: videoGenId, round: pollRound, url });
      const res = await fetch(url, { method: 'GET', headers });
      const raw = await res.text();
      const bodyLogged =
        pollLogBodyMax === Infinity
          ? raw
          : raw.length <= pollLogBodyMax
            ? raw
            : raw.slice(0, pollLogBodyMax) + `\n... [poll 响应已截断 前${pollLogBodyMax}字符 / 共${raw.length}字符，可设环境变量 VIDEO_POLL_LOG_MAX=0 输出全文]`;
      log.info('[poll] 查询 HTTP 结果', {
        video_gen_id: videoGenId,
        round: pollRound,
        http_status: res.status,
        bytes: raw.length,
        body: bodyLogged,
      });
      if (!res.ok) {
        log.warn('[poll] 查询非 2xx', {
          video_gen_id: videoGenId,
          round: pollRound,
          http_status: res.status,
          body: bodyLogged.slice(0, 4000),
        });
        continue;
      }
      let data;
      try {
        data = JSON.parse(raw);
      } catch (parseErr) {
        log.warn('[poll] 响应非 JSON', {
          video_gen_id: videoGenId,
          round: pollRound,
          error: parseErr.message,
          body_head: raw.slice(0, 800),
        });
        continue;
      }

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
        const status = extractPollTaskStatus(data);
        log.info('[Veo3 poll] task status', { video_gen_id: videoGenId, attempt, status, id: data.task_id || data.id });
        if (isPollTaskFailed(status)) {
          const msg = extractPollFailureMessage(data) || data.data?.error || 'Veo3 task failed';
          log.warn('[Veo3 poll] task failed', { video_gen_id: videoGenId, msg });
          return { error: String(msg).slice(0, 500) };
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
        const status = extractPollTaskStatus(data);
        log.info('[Sora poll] ????', { video_gen_id: videoGenId, attempt, status, progress: data.progress, id: data.id });
        if (isPollTaskFailed(status)) {
          const msg = extractPollFailureMessage(data) || 'Sora 任务失败';
          log.warn('[Sora poll] 任务失败', { video_gen_id: videoGenId, msg, data: JSON.stringify(data).slice(0, 300) });
          return { error: String(msg).slice(0, 500) };
        }
        // succeeded / completed / done ? ??? URL
        const videoUrl = pickProxyVideoUrl(data);
        if (videoUrl && isPlausibleHttpVideoUrl(videoUrl)) {
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
      const status = extractPollTaskStatus(data);
      const videoUrl = pickProxyVideoUrl(data);
      const failMsg = extractPollFailureMessage(data);
      const errMsg = data.error && (typeof data.error === 'string' ? data.error : data.error.message);
      if (isVolcPoll) {
        const summaryJson = JSON.stringify(data);
        const sum =
          pollLogBodyMax === Infinity
            ? summaryJson
            : summaryJson.length <= pollLogBodyMax
              ? summaryJson
              : summaryJson.slice(0, pollLogBodyMax) + `... [共${summaryJson.length}字符]`;
        log.info('[poll] 方舟/火山 解析摘要', {
          video_gen_id: videoGenId,
          round: pollRound,
          top_level_status: status,
          has_video_url: !!videoUrl,
          error_hint: failMsg || errMsg || data?.error?.code || data?.message || null,
          parsed_json: sum,
        });
      }
      if (isPollTaskFailed(status) || errMsg) {
        const msg = failMsg || errMsg || status || '任务失败';
        log.warn('[poll] 任务失败', { video_gen_id: videoGenId, round: pollRound, status, msg });
        return { error: String(msg).slice(0, 500) };
      }
      if (videoUrl && isPlausibleHttpVideoUrl(videoUrl)) return { video_url: videoUrl };
      if (failMsg) {
        log.warn('[poll] 上游返回失败文案', { video_gen_id: videoGenId, round: pollRound, msg: failMsg.slice(0, 200) });
        return { error: failMsg.slice(0, 500) };
      }
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
  normalizeAspectRatioForApi,
  isPlausibleHttpVideoUrl,
};
