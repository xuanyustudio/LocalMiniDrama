// 与 Go pkg/image + ImageGenerationService 对齐：调用图片生成 API，更新 image_generations 与角色头像
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const aiConfigService = require('./aiConfigService');
const uploadService = require('./uploadService');
const taskService = require('./taskService');
const { loadConfig } = require('../config');

// 多参考图时注入到所有支持 negative_prompt 的模型，防止生成分割/拼贴布局；同时加入安全词以减少敏感拦截
const ANTI_SPLIT_NEGATIVE_PROMPT = 'nsfw, nudity, naked, violence, blood, gore, sensitive content, split panels, side-by-side layout, collage, diptych, triptych, grid layout, multiple panels, comparison view, composite image, two images in one frame';

// sharp 惰性加载（参考图压缩用，sharp 已在 package.json 中声明）
let _sharp = null;
function getSharp() {
  if (!_sharp) {
    try { _sharp = require('sharp'); } catch (_) {}
  }
  return _sharp;
}

/**
 * 压缩单张参考图 buffer，目标 ≤ targetKB（默认 2048KB=2MB）
 * 用 JPEG 递减质量压缩直到达标或质量降到最低阈值。
 * 若 sharp 不可用或压缩后更大，返回原始 buffer。
 */
async function compressImageBuffer(buffer, mimeType, targetKB = 2048, log = null) {
  const sharp = getSharp();
  if (!sharp) return { buffer, mimeType };
  const targetBytes = targetKB * 1024;
  if (buffer.length <= targetBytes) return { buffer, mimeType };
  try {
    let quality = 80;
    let compressed = await sharp(buffer).jpeg({ quality }).toBuffer();
    while (compressed.length > targetBytes && quality > 30) {
      quality -= 15;
      compressed = await sharp(buffer).jpeg({ quality }).toBuffer();
    }
    if (compressed.length < buffer.length) {
      if (log) log.info('[参考图压缩] 压缩完成', {
        original_kb: Math.round(buffer.length / 1024),
        compressed_kb: Math.round(compressed.length / 1024),
        quality,
      });
      return { buffer: compressed, mimeType: 'image/jpeg' };
    }
  } catch (e) {
    if (log) log.warn('[参考图压缩] sharp 压缩失败，使用原图', { error: e.message });
  }
  return { buffer, mimeType };
}

// 惰性加载配置，避免循环依赖与启动顺序问题
let _appConfig = null;
function getAppConfig() {
  if (!_appConfig) {
    try { _appConfig = loadConfig(); } catch (_) { _appConfig = {}; }
  }
  return _appConfig;
}

/** 从配置读取图床 URL 有效期（小时），默认 23h 留出余量 */
function getProxyExpireHours() {
  return Number(getAppConfig()?.image_proxy?.expire_hours ?? 23);
}

/**
 * 根据 provider 名推断接口规范（api_protocol 未设置时的兜底逻辑）
 * 已明确设置 api_protocol 的配置不会走此函数。
 */
function inferProtocol(provider, model) {
  const p = String(provider || '').toLowerCase();
  if (p === 'dashscope' || p === 'qwen_image') return 'dashscope';
  if (p === 'nano_banana') return 'nano_banana';
  if (p === 'gemini' || p === 'google') return 'gemini';
  if (p === 'volces' || p === 'volcengine' || p === 'volc') return 'volcengine';
  if (/seedream|doubao/i.test(model || '')) return 'volcengine';
  if (p === 'kling' || p === 'klingai') return 'kling';
  if (/^kling-/i.test(model || '')) return 'kling';
  return 'openai';
}

/**
 * 获取默认图片配置：优先使用前端勾选的「默认」配置（is_default），同类型内按优先级（priority）排序；
 * 可选按 preferredProvider / preferredModel 进一步筛选。
 * @param {object} db
 * @param {string} [preferredModel] - 指定模型名时，在匹配到的配置中选含该模型的
 * @param {string} [preferredProvider] - 指定供应商（如 openai / dashscope），只在该 provider 的配置中选
 * @param {string} [imageServiceType] - 'image' 文本生成图片（角色/场景/道具），'storyboard_image' 分镜图片生成（支持参考图）；缺省为 'image'
 */
function getDefaultImageConfig(db, preferredModel, preferredProvider, imageServiceType) {
  const serviceType = imageServiceType || 'image';
  let configs = aiConfigService.listConfigs(db, serviceType);
  if (configs.length === 0 && serviceType === 'storyboard_image') {
    configs = aiConfigService.listConfigs(db, 'image');
  }
  let active = configs.filter((c) => c.is_active);
  if (active.length === 0) return null;
  if (preferredProvider && String(preferredProvider).trim()) {
    const want = String(preferredProvider).trim().toLowerCase();
    const byProvider = active.filter((c) => (c.provider || '').toLowerCase() === want);
    if (byProvider.length > 0) active = byProvider;
  }
  if (preferredModel) {
    for (const c of active) {
      const models = Array.isArray(c.model) ? c.model : (c.model != null ? [c.model] : []);
      if (models.includes(preferredModel)) return c;
    }
  }
  // 显式使用前端设置的「默认」：优先 is_default，再按 priority 降序（listConfigs 已按 is_default DESC, priority DESC 排序，取第一个即可）
  const defaultOne = active.find((c) => c.is_default);
  if (defaultOne) return defaultOne;
  return active[0];
}

// 与 Go image_generation_service 一致：openai/chatfire 使用 "/images/generations"，base_url 通常已含 /v1
function buildImageUrl(config) {
  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/images/generations';
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

function getModelFromConfig(config, preferredModel) {
  const models = Array.isArray(config.model) ? config.model : (config.model != null ? [config.model] : []);
  if (preferredModel && models.includes(preferredModel)) return preferredModel;
  if (config.default_model && models.includes(config.default_model)) return config.default_model;
  return models[0] || 'dall-e-3';
}

// 通义万象 size：格式 "宽*高"，总像素须在 589824(768*768)～1638400(1280*1280) 之间
const DASHSCOPE_MIN_PIXELS = 589824;
const DASHSCOPE_MAX_PIXELS = 1638400;

// 火山引擎 Doubao-Seedream-4.5 最低像素要求 3,686,400 (1920*1920)
// 需要自动将低分辨率请求放大到该标准，保持长宽比
const SEEDREAM_MIN_PIXELS = 3686400;

function fixSeedreamSize(size) {
  if (!size || typeof size !== 'string') return '1920x1920'; // 默认使用最低要求 1920x1920
  // 支持 1024x1024 或 1024*1024 格式，统一解析
  const s = size.trim().toLowerCase().replace(/\*/g, 'x');
  const match = s.match(/^(\d+)\s*x\s*(\d+)$/);
  if (!match) return '1920x1920';
  
  let w = parseInt(match[1], 10);
  let h = parseInt(match[2], 10);
  if (!w || !h) return '1920x1920';
  
  const pixels = w * h;
  if (pixels >= SEEDREAM_MIN_PIXELS) return `${w}x${h}`; // 已达标，直接用
  
  // 需要放大
  const scale = Math.sqrt(SEEDREAM_MIN_PIXELS / pixels);
  // 向上取整到 64 的倍数（通常 AI 模型对 64/32/16 对齐有偏好，这里取 64 较稳妥）
  w = Math.ceil((w * scale) / 64) * 64;
  h = Math.ceil((h * scale) / 64) * 64;
  
  // 二次检查是否因为取整导致略小于标准（虽然 ceil 应该不会，但为了保险）
  if (w * h < SEEDREAM_MIN_PIXELS) {
    w += 64;
    h += 64;
  }
  
  return `${w}x${h}`;
}

function dashScopeSize(size) {
  if (!size || typeof size !== 'string') return '1280*1280';
  const s = String(size).trim().toLowerCase().replace(/x/g, '*');
  const match = s.match(/^(\d+)\s*\*\s*(\d+)$/);
  if (!match) return '1280*1280';
  let w = parseInt(match[1], 10);
  let h = parseInt(match[2], 10);
  if (!w || !h) return '1280*1280';
  let pixels = w * h;
  if (pixels <= DASHSCOPE_MAX_PIXELS && pixels >= DASHSCOPE_MIN_PIXELS) return `${w}*${h}`;
  if (pixels > DASHSCOPE_MAX_PIXELS) {
    const scale = Math.sqrt(DASHSCOPE_MAX_PIXELS / pixels);
    w = Math.max(16, Math.round((w * scale) / 16) * 16);
    h = Math.max(16, Math.round((h * scale) / 16) * 16);
    if (w * h > DASHSCOPE_MAX_PIXELS) {
      w = Math.min(w, 1280);
      h = Math.min(h, Math.floor(DASHSCOPE_MAX_PIXELS / w));
      h = Math.floor(h / 16) * 16;
    }
    return `${w}*${h}`;
  }
  const scale = Math.sqrt(DASHSCOPE_MIN_PIXELS / pixels);
  w = Math.max(384, Math.round((w * scale) / 16) * 16);
  h = Math.max(384, Math.round((h * scale) / 16) * 16);
  return `${w}*${h}`;
}

// 从 DashScope 返回的 output.choices 中取第一张图 URL（兼容 type 为 "image" 或 仅有 image 字段）
function parseDashScopeImageUrl(data) {
  const choices = data?.output?.choices;
  if (!Array.isArray(choices)) return null;
  for (const c of choices) {
    const content = c?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part) continue;
      if (part.image && (part.type === 'image' || !part.type)) return part.image;
    }
  }
  return null;
}

// Gemini 图片生成支持的比例：1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3 / 5:4 / 4:5 / 21:9
function geminiAspectRatio(size) {
  if (!size || typeof size !== 'string') return '16:9';
  const s = String(size).trim().toLowerCase().replace(/\s/g, '');
  const ratioSet = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']);
  if (ratioSet.has(s)) return s;
  const match = s.match(/^(\d+)[x*](\d+)$/);
  if (!match) return '1:1';
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  if (!w || !h) return '1:1';
  const r = w / h;
  if (r > 2) return '21:9';
  if (r >= 1.6) return '16:9';
  if (r >= 1.2) return '4:3';
  if (r >= 0.9) return '1:1';
  if (r >= 0.7) return '3:4';
  if (r >= 0.55) return '4:5';
  return '9:16';
}

// nano-banana size 转 aspectRatio（1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3 / 5:4 / 4:5 / 21:9 / auto）
function nanoBananaAspectRatio(size) {
  if (!size || typeof size !== 'string') return 'auto';
  const s = String(size).trim().toLowerCase().replace(/\s/g, '');
  const ratioSet = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']);
  if (ratioSet.has(s)) return s;
  const match = s.match(/^(\d+)[x*](\d+)$/);
  if (!match) return 'auto';
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  if (!w || !h) return 'auto';
  const r = w / h;
  if (r > 2) return '21:9';
  if (r >= 1.6) return '16:9';
  if (r >= 1.2) return '4:3';
  if (r >= 0.9) return '1:1';
  if (r >= 0.7) return '3:4';
  if (r >= 0.55) return '4:5';
  return '9:16';
}

// 可灵 aspect_ratio：16:9 / 9:16 / 1:1 / 4:3 / 3:4 / 3:2 / 2:3
function klingImageAspectRatio(size) {
  if (!size) return '16:9';
  const s = String(size).trim().toLowerCase().replace(/\s/g, '');
  const ratioSet = new Set(['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3']);
  if (ratioSet.has(s)) return s;
  const match = s.match(/^(\d+)[x*](\d+)$/);
  if (!match) return '1:1';
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  if (!w || !h) return '1:1';
  const r = w / h;
  if (r >= 1.6) return '16:9';
  if (r >= 1.2) return '4:3';
  if (r >= 0.9) return '1:1';
  if (r >= 0.7) return '3:4';
  return '9:16';
}

/**
 * 调用可灵（Kling AI）图片生成 API（异步任务轮询）
 * 支持模型：kling-image / kling-omni-image（以及其他 kling-* 模型）
 * 接口规范：POST /v1/images/generations → 轮询 GET /v1/images/generations/{taskId}
 * 认证：Authorization: Bearer {api_key}
 */
async function callKlingImageApi(config, log, opts) {
  const { prompt, model, size, image_gen_id, reference_image_urls, files_base_url, storage_local_path } = opts;
  const base = (config.base_url || 'https://api.klingai.com').replace(/\/$/, '');
  const apiKey = config.api_key || '';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey,
  };

  let ep = config.endpoint || '/v1/images/generations';
  if (!ep.startsWith('/')) ep = '/' + ep;
  const submitUrl = base + ep;

  const aspectRatio = klingImageAspectRatio(size);
  const m = model || 'kling-image';

  const rawRefs = Array.isArray(reference_image_urls) ? reference_image_urls.filter(Boolean) : [];
  const resolvedRefs = rawRefs.map((r) => resolveImageRef(r, files_base_url, storage_local_path)).filter(Boolean);

  const body = {
    model: m,
    prompt: prompt || '',
    aspect_ratio: aspectRatio,
    n: 1,
    callback_url: '',
  };

  if (resolvedRefs.length > 0) {
    // 可灵 image_reference 支持 subject（人物/主体）和 face（面部）类型
    body.image_reference = resolvedRefs.slice(0, 1).map((url) => ({ type: 'subject', url }));
    body.image_fidelity = 0.5;
  }

  const bodyForLog = { ...body };
  if (Array.isArray(bodyForLog.image_reference)) {
    bodyForLog.image_reference = bodyForLog.image_reference.map((r) =>
      r.url && r.url.startsWith('data:') ? { ...r, url: '(base64)' } : r
    );
  }
  log.info('[Kling图生] 发送请求', {
    url: submitUrl, model: m, image_gen_id,
    has_ref: resolvedRefs.length > 0,
    aspect_ratio: aspectRatio,
    body_preview: JSON.stringify(bodyForLog).slice(0, 300),
  });

  const submitRes = await fetch(submitUrl, { method: 'POST', headers, body: JSON.stringify(body) });
  const submitRaw = await submitRes.text();

  if (!submitRes.ok) {
    let errMsg = 'Kling 图片生成请求失败: ' + submitRes.status;
    try {
      const errJson = JSON.parse(submitRaw);
      const msg = errJson.message || errJson.msg || (errJson.error && (errJson.error.message || errJson.error));
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (submitRaw) errMsg += ' - ' + submitRaw.slice(0, 200);
    }
    log.error('[Kling图生] 请求失败', { status: submitRes.status, body: submitRaw.slice(0, 500), image_gen_id });
    return { error: errMsg };
  }

  let submitData;
  try {
    submitData = JSON.parse(submitRaw);
  } catch (e) {
    return { error: 'Kling 返回格式异常: ' + submitRaw.slice(0, 200) };
  }

  if (submitData.code !== undefined && submitData.code !== 0) {
    return { error: `Kling 错误(${submitData.code}): ${submitData.message || '未知错误'}` };
  }

  // 部分场景可能同步返回图片（兜底）
  const directUrl = submitData?.data?.task_result?.images?.[0]?.url;
  if (directUrl) {
    log.info('[Kling图生] 同步返回图片', { image_gen_id });
    return { image_url: directUrl };
  }

  const taskId = submitData?.data?.task_id;
  if (!taskId) {
    log.warn('[Kling图生] 未返回 task_id', { image_gen_id, raw_preview: submitRaw.slice(0, 300) });
    return { error: 'Kling 未返回 task_id: ' + submitRaw.slice(0, 200) };
  }

  // 构建轮询 URL
  const cfgQEp = config.query_endpoint
    ? (config.query_endpoint.startsWith('/') ? config.query_endpoint : '/' + config.query_endpoint)
    : '';
  function buildKlingQueryUrl(tid) {
    if (cfgQEp) return base + cfgQEp.replace(/\{taskId\}/gi, encodeURIComponent(tid)).replace(/\{task_id\}/gi, encodeURIComponent(tid)).replace(/\{id\}/gi, encodeURIComponent(tid));
    return base + ep + '/' + encodeURIComponent(tid);
  }

  log.info('[Kling图生] 任务已提交，开始轮询', { image_gen_id, task_id: taskId });
  const maxAttempts = 60;
  const intervalMs = 4000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const queryRes = await fetch(buildKlingQueryUrl(taskId), { method: 'GET', headers });
      if (!queryRes.ok) continue;
      const queryData = JSON.parse(await queryRes.text());
      const status = queryData?.data?.task_status;
      log.info('[Kling图生] 轮询状态', { image_gen_id, task_id: taskId, attempt, status });
      if (status === 'succeed') {
        const imgUrl = queryData?.data?.task_result?.images?.[0]?.url;
        if (imgUrl) {
          log.info('[Kling图生] 生成完成', { image_gen_id, task_id: taskId });
          return { image_url: imgUrl };
        }
        return { error: '可灵未返回图片地址' };
      }
      if (status === 'failed') {
        const errMsg = queryData?.data?.task_status_msg || '任务失败';
        log.warn('[Kling图生] 任务失败', { image_gen_id, task_id: taskId, error: errMsg });
        return { error: '可灵生成失败: ' + errMsg };
      }
    } catch (e) {
      log.warn('[Kling图生] 轮询请求失败', { attempt, error: e.message, image_gen_id });
    }
  }
  return { error: '可灵图片生成超时' };
}

/**
 * 调用 NanoBanana 图片生成 API（异步任务轮询）
 * 模型 → 端点：
 *   nano-banana-2   → POST /api/v1/nanobanana/generate-2
 *   nano-banana-pro → POST /api/v1/nanobanana/generate-pro
 *   nano-banana     → POST /api/v1/nanobanana/generate（需 callBackUrl，用占位符）
 * 结果轮询：GET /api/v1/nanobanana/record-info?taskId=xxx
 */
async function callNanoBananaImageApi(config, log, opts) {
  const { prompt, model, size, image_gen_id, reference_image_urls, files_base_url, storage_local_path } = opts;
  const base = (config.base_url || 'https://api.nanobananaapi.ai').replace(/\/$/, '');
  const apiKey = config.api_key || '';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey,
  };
  // 解析参考图：本地路径 / localhost URL → base64，确保外部 API 可访问
  const rawRefs = Array.isArray(reference_image_urls) ? reference_image_urls.filter(Boolean) : [];
  const refs = rawRefs.map((r) => resolveImageRef(r, files_base_url, storage_local_path)).filter(Boolean);
  const aspectRatio = nanoBananaAspectRatio(size);
  const m = (model || 'nano-banana-2').toLowerCase();

  // 标准 nano-banana 原生端点；若 config.endpoint 与这些不同，视为代理模式，直接使用配置的端点
  const NATIVE_ENDPOINTS = new Set([
    '/api/v1/nanobanana/generate-2',
    '/api/v1/nanobanana/generate-pro',
    '/api/v1/nanobanana/generate',
  ]);
  const cfgEp = config.endpoint ? (config.endpoint.startsWith('/') ? config.endpoint : '/' + config.endpoint) : '';
  const isProxyMode = cfgEp && !NATIVE_ENDPOINTS.has(cfgEp);

  let submitUrl;
  let body;
  if (isProxyMode) {
    submitUrl = base + cfgEp;
    const isNativeBananaModel = m.startsWith('nano-banana');
    if (isNativeBananaModel) {
      // FAL 代理等：转发 nano-banana 模型，使用 camelCase 字段
      body = {
        prompt: prompt || '',
        imageUrls: refs,
        aspectRatio: aspectRatio === 'auto' ? '16:9' : aspectRatio,
        resolution: '1K',
      };
    } else {
      // 通用代理（如 dmiapi）：模型名直接透传，使用 snake_case 字段
      body = {
        model: model || '',
        prompt: prompt || '',
        aspect_ratio: aspectRatio === 'auto' ? '16:9' : (aspectRatio || ''),
        image_size: '1K',
        ...(refs.length > 0 ? { imageUrls: refs } : {}),
      };
    }
  } else if (m === 'nano-banana-2') {
    submitUrl = base + '/api/v1/nanobanana/generate-2';
    body = {
      prompt: prompt || '',
      imageUrls: refs,
      aspectRatio,
      resolution: '1K',
      outputFormat: 'jpg',
    };
  } else if (m === 'nano-banana-pro') {
    submitUrl = base + '/api/v1/nanobanana/generate-pro';
    body = {
      prompt: prompt || '',
      imageUrls: refs,
      aspectRatio: aspectRatio === 'auto' ? '16:9' : aspectRatio,
      resolution: '2K',
    };
  } else {
    // nano-banana 基础模型：callBackUrl 为必填，提供占位 URL（服务端轮询结果）
    submitUrl = base + '/api/v1/nanobanana/generate';
    body = {
      prompt: prompt || '',
      type: refs.length > 0 ? 'IMAGETOIAMGE' : 'TEXTTOIAMGE',
      imageUrls: refs,
      image_size: (aspectRatio === 'auto' ? '16:9' : aspectRatio),
      numImages: 1,
      callBackUrl: 'https://placeholder.no-op/callback',
    };
  }

  const bodyForLog = { ...body };
  if (Array.isArray(bodyForLog.imageUrls)) {
    bodyForLog.imageUrls = bodyForLog.imageUrls.map((u) => (u && u.startsWith('data:') ? '(base64)' : u));
  }
  log.info('NanoBanana Image API request', {
    url: submitUrl,
    model: m,
    image_gen_id,
    proxy_mode: isProxyMode,
    auth_header_prefix: (headers.Authorization || '').slice(0, 20) + '…',
    body_keys: Object.keys(body),
    body_preview: JSON.stringify(bodyForLog).slice(0, 300),
  });
  const submitRes = await fetch(submitUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const submitRaw = await submitRes.text();
  if (!submitRes.ok) {
    let errMsg = 'NanoBanana 图片生成请求失败: ' + submitRes.status;
    try {
      const errJson = JSON.parse(submitRaw);
      const msg = errJson.msg || errJson.message || (errJson.error && (errJson.error.message || errJson.error));
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (submitRaw) errMsg += ' - ' + submitRaw.slice(0, 200);
    }
    log.error('NanoBanana submit failed', {
      status: submitRes.status,
      body: submitRaw.slice(0, 500),
      image_gen_id,
      submit_url: submitUrl,
      auth_header_prefix: (headers.Authorization || '').slice(0, 20) + '…',
    });
    return { error: errMsg };
  }
  let submitData;
  try {
    submitData = JSON.parse(submitRaw);
  } catch (e) {
    return { error: 'NanoBanana 返回格式异常' };
  }

  // 兼容同步代理响应：部分代理直接返回图片 URL，无需轮询
  // 也兼容提交即完成的响应（state=succeeded + data.data.images[0].url）
  const directImageUrl = submitData?.images?.[0]?.url
    || submitData?.image?.url
    || submitData?.image_url
    || submitData?.data?.url
    || submitData?.url
    || (submitData?.data?.state === 'succeeded' ? submitData?.data?.data?.images?.[0]?.url : null);
  if (directImageUrl) {
    log.info('NanoBanana image (synchronous proxy response)', { image_gen_id });
    return { image_url: directImageUrl };
  }

  // task_id 兼容驼峰（taskId）和下划线（task_id）两种格式
  const taskId = submitData?.data?.taskId || submitData?.data?.task_id || submitData?.request_id || submitData?.taskId;
  if (!taskId) {
    const msg = submitData?.msg || submitData?.message || '未返回任务ID';
    log.warn('NanoBanana no taskId in response', { image_gen_id, raw_preview: submitRaw.slice(0, 300) });
    return { error: 'NanoBanana 提交失败: ' + String(msg).slice(0, 200) };
  }

  // 构建轮询 URL：优先用配置的 query_endpoint，否则用默认
  // 支持占位符 {taskId} / {taskid} / {task_id} / {id}（大小写不敏感）
  const DEFAULT_QUERY_EP = '/api/v1/nanobanana/record-info';
  const cfgQEp = config.query_endpoint
    ? (config.query_endpoint.startsWith('/') ? config.query_endpoint : '/' + config.query_endpoint)
    : '';
  const useQueryEp = cfgQEp && cfgQEp !== DEFAULT_QUERY_EP ? cfgQEp : DEFAULT_QUERY_EP;
  function buildQueryUrl(tid) {
    // 大小写不敏感替换所有常见占位符：{taskId} / {taskid} / {task_id} / {id}
    if (/\{(taskId|taskid|task_id|id)\}/i.test(useQueryEp)) {
      return base + useQueryEp
        .replace(/\{taskId\}/gi, encodeURIComponent(tid))
        .replace(/\{task_id\}/gi, encodeURIComponent(tid))
        .replace(/\{id\}/gi, encodeURIComponent(tid));
    }
    return base + useQueryEp + '?taskId=' + encodeURIComponent(tid);
  }

  const firstQueryUrl = buildQueryUrl(taskId);
  log.info('NanoBanana task submitted, polling…', {
    image_gen_id, task_id: taskId,
    query_ep: useQueryEp,
    first_query_url: firstQueryUrl,
    config_query_endpoint: config.query_endpoint || '(not set)',
  });
  const maxAttempts = 60;
  const intervalMs = 3000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const pollUrl = buildQueryUrl(taskId);
    try {
      const queryRes = await fetch(pollUrl, {
        method: 'GET',
        headers,
      });
      const queryRaw = await queryRes.text();
      if (!queryRes.ok) {
        log.warn('NanoBanana poll HTTP error', {
          image_gen_id, task_id: taskId, attempt,
          poll_url: pollUrl,
          status: queryRes.status,
          body_preview: queryRaw.slice(0, 300),
        });
        continue;
      }
      let queryData;
      try {
        queryData = JSON.parse(queryRaw);
      } catch (parseErr) {
        log.warn('NanoBanana poll JSON parse error', {
          image_gen_id, task_id: taskId, attempt,
          poll_url: pollUrl,
          raw_preview: queryRaw.slice(0, 300),
        });
        continue;
      }
      const successFlag = queryData?.data?.successFlag;
      const state = queryData?.data?.state;
      const status = queryData?.data?.status;
      log.info('NanoBanana poll status', {
        image_gen_id, task_id: taskId, attempt,
        code: queryData?.code, successFlag, state, status,
      });
      if (successFlag === 1 || state === 'succeeded' || status === '3') {
        const imageUrl = queryData?.data?.response?.resultImageUrl
          || queryData?.data?.response?.originImageUrl
          || queryData?.data?.data?.images?.[0]?.url;
        if (imageUrl) {
          log.info('NanoBanana image completed', { image_gen_id, task_id: taskId, image_url: imageUrl.slice(0, 120) });
          return { image_url: imageUrl };
        }
        log.warn('NanoBanana succeeded but no image URL found', {
          image_gen_id, task_id: taskId,
          data_keys: queryData?.data ? Object.keys(queryData.data) : [],
          nested_data_keys: queryData?.data?.data ? Object.keys(queryData.data.data) : [],
          response_keys: queryData?.data?.response ? Object.keys(queryData.data.response) : [],
          raw_preview: queryRaw.slice(0, 500),
        });
        return { error: '未返回图片地址' };
      }
      if (successFlag === 2 || successFlag === 3 || state === 'failed') {
        const errMsg = queryData?.data?.errorMessage || queryData?.data?.msg || '任务失败';
        log.warn('NanoBanana task failed', { image_gen_id, task_id: taskId, successFlag, state, error_message: errMsg });
        return { error: 'NanoBanana 生成失败: ' + errMsg };
      }
    } catch (e) {
      log.warn('NanoBanana poll request failed', { attempt, error: e.message, image_gen_id, poll_url: pollUrl });
    }
  }
  return { error: 'NanoBanana 图片生成超时' };
}

// 通义千问 qwen-image 同步接口：仅支持单条 text，不支持参考图；parameters 仅 size/negative_prompt/prompt_extend/watermark
function isQwenImageProvider(config, model) {
  const p = (config.provider || '').toLowerCase();
  const m = (model || '').toLowerCase();
  return p === 'qwen_image' || /^qwen-image/.test(m);
}

// qwen-image 仅支持以下 size：1664*928(16:9), 1472*1104(4:3), 1328*1328(1:1), 1104*1472(3:4), 928*1664(9:16)
function qwenImageSize(size) {
  const allowed = ['1664*928', '1472*1104', '1328*1328', '1104*1472', '928*1664'];
  if (!size || typeof size !== 'string') return '1664*928';
  const s = String(size).trim().toLowerCase().replace(/x/g, '*');
  const match = s.match(/^(\d+)\s*\*\s*(\d+)$/);
  if (!match) return '1664*928';
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  if (!w || !h) return '1664*928';
  const ratio = w / h;
  if (ratio >= 1.7) return '1664*928';   // 16:9
  if (ratio >= 1.2) return '1472*1104';   // 4:3
  if (ratio >= 0.85) return '1328*1328';  // 1:1
  if (ratio >= 0.65) return '1104*1472';  // 3:4
  return '928*1664';                      // 9:16
}

/**
 * 将参考图值解析为适合传给外部 API 的形式：
 * - 本地相对路径（如 "characters/ig_xxx.jpg"）→ 读文件转 base64 data URL
 * - localhost URL → 从 storageLocalPath 读文件转 base64 data URL
 * - 公网 URL（非 localhost）→ 直接原样返回
 *
 * 调用方应优先传 local_path 而非 image_url，
 * 以避免外部存储链接过期或第三方 API 无法访问的问题。
 */
function resolveImageRef(value, filesBaseUrl, storageLocalPath) {
  if (!value || !String(value).trim()) return null;
  const s = String(value).trim();
  const baseUrl = (filesBaseUrl || '').replace(/\/$/, '');
  // isLocalhost: 只要 URL 本身或配置的 base_url 含 localhost/127，都视为本地
  const isLocalhostUrl = /localhost|127\.0\.0\.1/i.test(s);
  const isLocalhostBase = baseUrl && /localhost|127\.0\.0\.1/i.test(baseUrl);
  const isLocalhost = isLocalhostUrl || isLocalhostBase;

  function toPublicUrl(v) {
    if (!v || !String(v).trim()) return null;
    const sv = String(v).trim();
    if (sv.startsWith('http://') || sv.startsWith('https://')) return sv;
    if (baseUrl) return baseUrl + '/' + sv.replace(/^\//, '');
    return sv;
  }

  let relPath = null;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    if (!isLocalhost || !storageLocalPath) return s;
    // 从 URL 中提取 /static/ 之后的相对路径；或去掉 baseUrl 前缀
    const afterStatic = s.split('/static/')[1]
      || (baseUrl ? s.replace(baseUrl + '/', '').replace(baseUrl, '') : null)
      || s.replace(/^https?:\/\/[^/]+\//, '');
    if (afterStatic) relPath = afterStatic.replace(/^\//, '');
    else return s;
  } else if (storageLocalPath) {
    relPath = s.replace(/^\//, '');
  }
  if (!relPath) return toPublicUrl(s);
  const filePath = path.join(storageLocalPath, relPath);
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

// 通义万象：支持参考图（角色/场景），content 为 [text, image, image, ...]；本地调试时参考图可转 base64
// 通义千问 qwen-image：仅支持 content 中一个 text，用同步接口，parameters 不含 stream/enable_interleave
async function callDashScopeImageApi(config, log, opts) {
  const { prompt, model, size, image_gen_id, reference_image_urls, files_base_url, storage_local_path, negative_prompt } = opts;
  const base = (config.base_url || '').replace(/\/$/, '');
  const url = base + (config.endpoint || '/api/v1/services/aigc/multimodal-generation/generation');
  if (!url.includes('dashscope')) {
    return { error: '通义万象 base_url 需为 https://dashscope.aliyuncs.com' };
  }
  const isQwenImage = isQwenImageProvider(config, model);

  if (isQwenImage) {
    // 千问文生图：仅支持单条 text，长度不超过 800 字符；同步接口，无 stream/enable_interleave
    const text = (prompt || '').toString().trim().slice(0, 800);
    const body = {
      model: model || 'qwen-image-max',
      input: {
        messages: [{ role: 'user', content: [{ text }] }],
      },
      parameters: {
        prompt_extend: true,
        watermark: false,
        size: qwenImageSize(size),
      },
    };
    if (negative_prompt && String(negative_prompt).trim()) {
      body.parameters.negative_prompt = String(negative_prompt).trim().slice(0, 500);
    }
    log.info('Image API request (Qwen-Image sync)', { url: url.slice(0, 70), model: body.model, image_gen_id });
    const createRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (config.api_key || ''),
      },
      body: JSON.stringify(body),
    });
    const raw = await createRes.text();
    if (!createRes.ok) {
      let errMsg = '图片生成请求失败: ' + createRes.status;
      try {
        const errJson = JSON.parse(raw);
        if (errJson.message) errMsg += ' - ' + errJson.message;
        else if (errJson.code) errMsg += ' - ' + errJson.code;
      } catch (_) {
        if (raw && raw.length) errMsg += ' - ' + raw.slice(0, 200);
      }
      log.error('Qwen-Image create failed', { status: createRes.status, body: raw.slice(0, 300), image_gen_id });
      return { error: errMsg };
    }
    try {
      const data = JSON.parse(raw);
      if (data.code) {
        log.warn('Qwen-Image response error', { code: data.code, message: data.message, image_gen_id });
        return { error: data.message || data.code || '通义千问接口错误' };
      }
      const imageUrl = parseDashScopeImageUrl(data);
      if (imageUrl) {
        log.info('Qwen-Image image (sync)', { image_gen_id, has_image_url: true });
        return { image_url: imageUrl };
      }
      return { error: '未返回图片地址' };
    } catch (e) {
      log.warn('Qwen-Image parse error', { image_gen_id, error: e.message, raw_preview: raw.slice(0, 300) });
      return { error: '通义千问返回格式异常' };
    }
  }

  const refs = Array.isArray(reference_image_urls) ? reference_image_urls.filter(Boolean) : [];
  const content = [{ text: prompt || '' }];
  const resolvedRefs = [];
  for (const ref of refs.slice(0, 10)) {
    const img = resolveImageRef(ref, files_base_url, storage_local_path);
    if (img) {
      content.push({ image: img });
      resolvedRefs.push(img.startsWith('data:') ? '(base64)' : img);
    }
  }
  log.info('reference_image_urls 完整路径（imageClient 入参及解析后）', {
    image_gen_id,
    raw_reference_image_urls: reference_image_urls || [],
    resolved_for_api: resolvedRefs,
  });

  const hasRefs = content.length > 1;
  const stream = !hasRefs; // enable_interleave=false 时必须 stream=false
  const body = {
    model: model || 'wan2.6-image',
    input: {
      messages: [{ role: 'user', content }],
    },
    parameters: {
      prompt_extend: true,
      watermark: false,
      n: 1,
      enable_interleave: !hasRefs,
      size: dashScopeSize(size),
      stream,
      // 多张参考图时注入 negative_prompt，防止生成分割/拼贴布局
      ...(hasRefs ? { negative_prompt: negative_prompt || ANTI_SPLIT_NEGATIVE_PROMPT } : (negative_prompt ? { negative_prompt } : {})),
    },
  };
  const contentSummary = content.map((p) => (p.text != null ? 'text' : p.image && p.image.startsWith('data:') ? 'image(base64)' : 'image(url)'));
  log.info('Image API request (DashScope)', {
    url: url.slice(0, 70),
    model: body.model,
    image_gen_id,
    reference_count: refs.length,
    enable_interleave: body.parameters.enable_interleave,
    stream: body.parameters.stream,
    content_parts: contentSummary,
  });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + (config.api_key || ''),
  };
  if (stream) headers['X-DashScope-Sse'] = 'enable';
  const createRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = await createRes.text();
  if (!createRes.ok) {
    let errMsg = '图片生成请求失败: ' + createRes.status;
    try {
      const errJson = JSON.parse(raw);
      if (errJson.message) errMsg += ' - ' + errJson.message;
      else if (errJson.code) errMsg += ' - ' + errJson.code;
    } catch (_) {
      if (raw && raw.length) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('DashScope create failed', { status: createRes.status, body: raw.slice(0, 300), image_gen_id });
    return { error: errMsg };
  }

  if (!stream) {
    // 非流式：单次 JSON 响应
    try {
      const data = JSON.parse(raw);
      if (data.code) {
        log.warn('DashScope response error', { code: data.code, message: data.message, image_gen_id });
        return { error: data.message || data.code || '通义万象接口错误' };
      }
      const imageUrl = parseDashScopeImageUrl(data);
      if (imageUrl) {
        log.info('DashScope image (sync)', { image_gen_id, has_image_url: true });
        return { image_url: imageUrl };
      }
      log.warn('DashScope sync no image in response', {
        image_gen_id,
        output_keys: data.output ? Object.keys(data.output) : [],
        raw_preview: raw.slice(0, 500),
      });
      return { error: '未返回图片地址' };
    } catch (e) {
      log.warn('DashScope sync parse error', { image_gen_id, error: e.message, raw_preview: raw.slice(0, 300) });
      return { error: '通义万象返回格式异常' };
    }
  }

  // 流式响应：可能是纯 JSON 行，或 SSE 格式 "data: {...}\n"
  let lastImageUrl = null;
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  let firstChunkKeys = null;
  for (const line of lines) {
    let jsonStr = line;
    if (line.startsWith('data:')) {
      jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
    }
    try {
      const data = JSON.parse(jsonStr);
      if (data.code) {
        log.warn('DashScope stream chunk error', { code: data.code, message: data.message, image_gen_id });
        return { error: data.message || data.code || '通义万象接口错误' };
      }
      if (firstChunkKeys == null && data.output) {
        const oc = data.output.choices?.[0];
        firstChunkKeys = {
          output_keys: Object.keys(data.output),
          choice_message_keys: oc?.message ? Object.keys(oc.message) : [],
          content_types: Array.isArray(oc?.message?.content) ? oc.message.content.map((p) => p && p.type) : [],
        };
      }
      const urlFromChunk = parseDashScopeImageUrl(data);
      if (urlFromChunk) lastImageUrl = urlFromChunk;
    } catch (_) {
      // 忽略非 JSON 行
    }
  }
  if (lastImageUrl) {
    log.info('DashScope image (stream)', { image_gen_id, has_image_url: true });
    return { image_url: lastImageUrl };
  }
  if (lines.length > 0) {
    try {
      const firstLine = lines[0].startsWith('data:') ? lines[0].slice(5).trim() : lines[0];
      const first = JSON.parse(firstLine);
      if (first.code) return { error: first.message || first.code || '通义万象接口错误' };
    } catch (_) {}
  }
  log.warn('DashScope stream no image in response', {
    image_gen_id,
    line_count: lines.length,
    first_chunk: firstChunkKeys,
    raw_preview: raw.slice(0, 400),
  });
  return { error: '未返回图片地址' };
}

// 图床上传：复用 uploadService 的共享实现
const { uploadToImageProxy } = require('./uploadService');

/**
 * 从 image_proxy_cache 表查询已缓存的图床 URL。
 * cache_key 规则：本地相对路径 或 data URL 的 sha256 前 16 字符。
 * 若缓存已过期（超过 config.image_proxy.expire_hours），自动删除并返回 null，触发重新上传。
 */
function getProxyCache(db, cacheKey) {
  try {
    const row = db.prepare('SELECT proxy_url, created_at FROM image_proxy_cache WHERE cache_key = ?').get(cacheKey);
    if (!row?.proxy_url) return null;

    const expireMs = getProxyExpireHours() * 3600 * 1000;
    const createdAt = new Date(row.created_at).getTime();
    if (isNaN(createdAt) || Date.now() - createdAt > expireMs) {
      // 过期或时间无效：删除旧记录，返回 null 触发重新上传
      try { db.prepare('DELETE FROM image_proxy_cache WHERE cache_key = ?').run(cacheKey); } catch (_) {}
      return null;
    }

    return row.proxy_url;
  } catch (_) { return null; }
}

/** 写入 image_proxy_cache 缓存记录 */
function setProxyCache(db, cacheKey, proxyUrl) {
  try {
    db.prepare(
      'INSERT OR REPLACE INTO image_proxy_cache (cache_key, proxy_url, created_at) VALUES (?, ?, ?)'
    ).run(cacheKey, proxyUrl, new Date().toISOString());
  } catch (_) {}
}

/** 根据 ref 字符串计算缓存 key：本地路径直接使用；data URL 取 buffer sha256 前 16 字节的 hex */
function buildCacheKey(ref, imageBuffer) {
  if (!ref.startsWith('data:')) return ref;
  return 'sha256:' + crypto.createHash('sha256').update(imageBuffer).digest('hex').slice(0, 32);
}

/**
 * 调用 Google Gemini 图片生成 API（generateContent 接口，返回 base64 inlineData）
 * 支持模型：gemini-2.5-flash-image / gemini-2.5-flash-image-preview /
 *          gemini-3.1-flash-image-preview / gemini-3-pro-image-preview 等
 * 参考图先查本地缓存表，未命中则上传到中转图床并缓存，再通过 fileData.fileUri 传给 Gemini。
 * 避免 inlineData base64 大 payload 触发 503 memory overload。
 */
async function callGeminiImageApi(db, config, log, opts) {
  const { prompt, model, size, image_gen_id, reference_image_urls, files_base_url, storage_local_path, system_prompt } = opts;
  const apiKey = config.api_key || '';
  const base = (config.base_url || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const modelName = model || 'gemini-2.5-flash-image';
  const aspectRatio = geminiAspectRatio(size);
  const tStart = Date.now();
  const elapsed = () => `${Date.now() - tStart}ms`;

  log.info('[Gemini图生] ▶ 开始', {
    image_gen_id, model: modelName, aspect_ratio: aspectRatio,
    base_url: base.slice(0, 60),
    prompt_len: (prompt || '').length,
    raw_ref_count: Array.isArray(reference_image_urls) ? reference_image_urls.length : 0,
  });

  // 读取全局配置，判断参考图传输方式
  // image_proxy.use_for_gemini = false（默认）→ 直接 inlineData base64
  // image_proxy.use_for_gemini = true          → 上传图床后用 fileData.fileUri
  const globalCfg = (() => { try { return require('../config').loadConfig(); } catch (_) { return {}; } })();
  const useImageProxy = !!(globalCfg?.image_proxy?.use_for_gemini);
  log.info('[Gemini图生] 参考图传输方式', { image_gen_id, use_image_proxy: useImageProxy });

  const rawRefs = Array.isArray(reference_image_urls) ? reference_image_urls.filter(Boolean) : [];
  const MAX_GEMINI_REF_IMAGES = 4; // 场景1张 + 最多3个角色

  // 解析 system_prompt 中的每张参考图标签（格式: "Image N: description..."）
  // Gemini 多模态的正确输入结构：[文字说明] → [图片] → [文字说明] → [图片] → [生成指令]
  // 即：每张参考图紧跟其说明文字，最后才是生成任务
  const refLabelMap = {}; // index(0-based) → label text
  if (system_prompt) {
    system_prompt.split('\n').forEach(line => {
      const m = line.match(/^Image\s+(\d+):\s*(.+)/i);
      if (m) refLabelMap[parseInt(m[1], 10) - 1] = m[2].trim(); // 转为 0-based index
    });
  }

  // 读取所有参考图（buffer + mimeType）
  const refImageParts = []; // { label, imagePart }
  const TOTAL_REF_LIMIT_BYTES = 10 * 1024 * 1024; // inlineData 模式总大小上限 10MB
  let totalRefSizeBytes = 0;
  for (let i = 0; i < rawRefs.slice(0, MAX_GEMINI_REF_IMAGES).length; i++) {
    const ref = rawRefs[i];
    log.info('[Gemini图生] 参考图 读取中', { image_gen_id, ref_index: i, ref: String(ref).slice(0, 80), elapsed: elapsed() });
    const tRead = Date.now();

    const resolved = resolveImageRef(ref, files_base_url, storage_local_path);
    if (!resolved) {
      log.warn('[Gemini图生] 参考图 无法解析，跳过', { image_gen_id, ref_index: i, ref: String(ref).slice(0, 80) });
      continue;
    }

    let imageBuffer, mimeType;
    if (resolved.startsWith('data:')) {
      const m = resolved.match(/^data:([\w/]+);base64,(.+)$/);
      if (!m) { log.warn('[Gemini图生] 参考图 data URL 格式异常，跳过', { image_gen_id, ref_index: i }); continue; }
      mimeType = m[1];
      imageBuffer = Buffer.from(m[2], 'base64');
    } else {
      try {
        const imgRes = await fetch(resolved, { method: 'GET' });
        if (!imgRes.ok) {
          log.warn('[Gemini图生] 参考图 HTTP 读取失败，跳过', { image_gen_id, ref_index: i, status: imgRes.status, url: resolved.slice(0, 80) });
          continue;
        }
        imageBuffer = Buffer.from(await imgRes.arrayBuffer());
        mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      } catch (fetchErr) {
        log.warn('[Gemini图生] 参考图 读取异常，跳过', { image_gen_id, ref_index: i, err: fetchErr.message });
        continue;
      }
    }

    log.info('[Gemini图生] 参考图 读取完成', {
      image_gen_id, ref_index: i, mime: mimeType,
      size_kb: Math.round(imageBuffer.length / 1024),
      read_ms: Date.now() - tRead, elapsed: elapsed(),
    });

    // 超过 10MB 直接跳过（Gemini 硬限制）
    if (imageBuffer.length > 10 * 1024 * 1024) {
      log.warn('[Gemini图生] 参考图 超过10MB，跳过', { image_gen_id, ref_index: i, size_mb: (imageBuffer.length / 1024 / 1024).toFixed(1) });
      continue;
    }

    // ① 单张超过 2MB 时用 sharp 压缩到 2MB 以内
    if (imageBuffer.length > 2 * 1024 * 1024) {
      const compressed = await compressImageBuffer(imageBuffer, mimeType, 2048, log);
      imageBuffer = compressed.buffer;
      mimeType = compressed.mimeType;
    }

    // ② 总大小预算控制（inlineData 模式）：所有参考图合计不超过 10MB
    if (!useImageProxy) {
      const remaining = TOTAL_REF_LIMIT_BYTES - totalRefSizeBytes;
      if (imageBuffer.length > remaining) {
        const targetKB = Math.max(200, Math.floor(remaining / 1024));
        log.info('[Gemini图生] 参考图 总大小超预算，追加压缩', {
          image_gen_id, ref_index: i,
          current_kb: Math.round(imageBuffer.length / 1024),
          budget_kb: Math.round(remaining / 1024),
          target_kb: targetKB,
        });
        const compressed2 = await compressImageBuffer(imageBuffer, mimeType, targetKB, log);
        imageBuffer = compressed2.buffer;
        mimeType = compressed2.mimeType;
        if (imageBuffer.length > remaining) {
          log.warn('[Gemini图生] 参考图 追加压缩后仍超总预算，跳过', { image_gen_id, ref_index: i });
          continue;
        }
      }
      totalRefSizeBytes += imageBuffer.length;
    }

    let imagePart;
    if (useImageProxy) {
      const cacheKey = buildCacheKey(ref, imageBuffer);
      let fileUri = getProxyCache(db, cacheKey);
      if (fileUri) {
        log.info('[Gemini图生] 参考图 缓存命中（图床）', { image_gen_id, ref_index: i });
      } else {
        log.info('[Gemini图生] 参考图 缓存未命中，上传图床 →', { image_gen_id, ref_index: i, elapsed: elapsed() });
        fileUri = await uploadToImageProxy(imageBuffer, mimeType, log, image_gen_id);
        if (fileUri) {
          setProxyCache(db, cacheKey, fileUri);
        } else {
          log.warn('[Gemini图生] 参考图 上传图床失败，该参考图将跳过', { image_gen_id, ref_index: i, elapsed: elapsed() });
          continue;
        }
      }
      imagePart = { fileData: { fileUri, mimeType } };
    } else {
      imagePart = { inlineData: { mimeType, data: imageBuffer.toString('base64') } };
    }

    refImageParts.push({ label: refLabelMap[i] || null, imagePart });
    log.info('[Gemini图生] 参考图 已处理', { image_gen_id, ref_index: i, has_label: !!refLabelMap[i] });
  }

  // 构建 parts：正确的 Gemini 多模态输入顺序
  // [参考说明] → [参考图1] → [参考图2] → ... → [生成指令+主提示词]
  // 这与 Gemini 的 "文字描述紧接对应内容" 原则一致，避免模型混淆
  const parts = [];
  if (refImageParts.length > 0) {
    parts.push({ text: 'The following are visual reference images. Use them ONLY to maintain character appearance and scene environment consistency. Do NOT reproduce their layout or format.' });
    for (let i = 0; i < refImageParts.length; i++) {
      const { label, imagePart } = refImageParts[i];
      parts.push({ text: label ? `Reference ${i + 1}: ${label}` : `Reference ${i + 1}:` });
      parts.push(imagePart);
    }
    // 生成指令放在所有参考图之后，清晰分隔
    parts.push({ text: `Generate ONE single cinematic storyboard frame (do NOT create a grid or multi-panel layout):\n\n${prompt || ''}` });
  } else {
    // 无参考图：直接用 prompt
    parts.push({ text: prompt || '' });
  }

  log.info('[Gemini图生] 参考图处理完毕，准备请求 Gemini API', {
    image_gen_id, parts_count: parts.length, ref_parts: refImageParts.length, elapsed: elapsed(),
  });

  // 注意：aspectRatio / numberOfImages 必须直接放在 generationConfig 顶层，
  // 不能嵌套为 imageGenerationConfig（那是 Imagen 专属字段），
  // 嵌套会触发 MALFORMED_FUNCTION_CALL 导致模型内部 google:image_gen 工具调用失败。
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      numberOfImages: 1,
      aspectRatio,
    },
  };

  const url = `${base}/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  log.info('[Gemini图生] → 发送请求', { image_gen_id, model: modelName, url: url.replace(/key=[^&]+/, 'key=***').slice(0, 120), elapsed: elapsed() });

  const tReq = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  log.info('[Gemini图生] ← 收到响应', { image_gen_id, status: res.status, req_ms: Date.now() - tReq, elapsed: elapsed() });

  const raw = await res.text();
  if (!res.ok) {
    let errMsg = 'Gemini 图片生成请求失败: ' + res.status;
    try {
      const errJson = JSON.parse(raw);
      const msg = errJson.error?.message || errJson.message;
      if (msg) errMsg += ' - ' + String(msg).slice(0, 200);
    } catch (_) {
      if (raw) errMsg += ' - ' + raw.slice(0, 200);
    }
    log.error('[Gemini图生] ✗ API错误', { image_gen_id, status: res.status, body: raw.slice(0, 400), total_elapsed: elapsed() });
    return { error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    log.error('[Gemini图生] ✗ 响应 JSON 解析失败', { image_gen_id, raw_preview: raw.slice(0, 300), total_elapsed: elapsed() });
    return { error: 'Gemini 图片生成返回格式异常' };
  }

  // 从 candidates → content → parts 中找 inlineData（图片）
  const candidates = data?.candidates || [];
  for (const candidate of candidates) {
    for (const part of candidate?.content?.parts || []) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        log.info('[Gemini图生] ✓ 成功', { image_gen_id, model: modelName, mime: mimeType, total_elapsed: elapsed() });
        return { image_url: dataUrl };
      }
    }
  }

  log.warn('[Gemini图生] ✗ 响应中无图片内容', { image_gen_id, candidates_count: candidates.length, raw_preview: raw.slice(0, 500), total_elapsed: elapsed() });
  return { error: 'Gemini 未返回图片内容，请检查模型名称或 API Key 权限' };
}

/**
 * 调用提供商图片生成 API（OpenAI /images/generations 风格 或 通义万象 multimodal-generation）
 * @param {object} db - database
 * @param {object} log - logger
 * @param {object} opts - { prompt, model?, size?, quality?, drama_id, preferred_provider?, character_id?, image_type?, image_gen_id }
 * @returns {Promise<{ image_url?: string, error?: string }>}
 */
async function callImageApi(db, log, opts) {
  const {
    prompt,
    model: preferredModel,
    size,
    quality,
    drama_id,
    preferred_provider,
    character_id,
    image_type,
    image_gen_id,
    imageServiceType,
    reference_image_urls,
    files_base_url,
    storage_local_path,
    system_prompt,
  } = opts;
  const preferredProvider = preferred_provider ?? opts.preferredProvider;
  const config = getDefaultImageConfig(db, preferredModel, preferredProvider, imageServiceType);
  if (!config) {
    throw new Error('未配置图片模型，请在「AI 配置」中添加 image 类型且已启用的配置');
  }
  const model = getModelFromConfig(config, preferredModel);
  const provider = (config.provider || '').toLowerCase();
  // api_protocol 显式指定接口规范，优先级高于 provider 推断；未设置时按 provider 自动判断
  const protocol = (config.api_protocol || '').toLowerCase() || inferProtocol(provider, model);

  // ── 参考图标签注入：为所有非 Gemini 模型将标签注入 prompt 文本 ─────────────────────────────
  // Gemini 通过 parts 结构处理（interleaved text+image），不需要文字注入。
  // 其他所有模型（Doubao/DashScope/NanoBanana/OpenAI-compat 等）通过文字告知模型各参考图用途，
  // 避免模型模仿参考图的宫格/四视图布局，同时抑制生成分割画面。
  let effectivePrompt = prompt || '';
  if (
    protocol !== 'gemini' &&
    Array.isArray(reference_image_urls) && reference_image_urls.length > 0 &&
    system_prompt
  ) {
    const refLines = String(system_prompt).split('\n').filter(l => /^Image\s+\d+:/i.test(l));
    if (refLines.length > 0) {
      const refHeader = refLines
        .map(l => `[${l} — FOR REFERENCE ONLY, DO NOT copy its layout or framing]`)
        .join('\n');
      effectivePrompt = `${refHeader}\n\n[GENERATE THIS SCENE — single continuous image, no grid, no split panels]:\n${effectivePrompt}`;
    }
  }

  log.info('[图生] callImageApi 路由', {
    image_gen_id,
    protocol,
    api_protocol_raw: config.api_protocol || '(empty→auto)',
    provider,
    model,
    size,
    imageServiceType,
    ref_count: Array.isArray(opts.reference_image_urls) ? opts.reference_image_urls.length : 0,
    ref_label_injected: effectivePrompt !== (prompt || ''),
    effectivePrompt
  });

  // 多参考图时统一生成 negative_prompt（供各子函数使用）
  const refCountForNeg = Array.isArray(opts.reference_image_urls) ? opts.reference_image_urls.filter(Boolean).length : 0;
  // Seedream/Volcengine 模型强制启用安全词负面提示，其他模型仅在多参考图时启用
  const isVolcOrSeedream = (protocol === 'volcengine' || /seedream|doubao/i.test(model));
  const autoNegativePrompt = (refCountForNeg > 1 || isVolcOrSeedream) ? ANTI_SPLIT_NEGATIVE_PROMPT : '';

  if (protocol === 'dashscope') {
    return callDashScopeImageApi(config, log, {
      prompt: effectivePrompt, model, size, image_gen_id,
      reference_image_urls: opts.reference_image_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      negative_prompt: autoNegativePrompt,
    });
  }

  if (protocol === 'nano_banana') {
    return callNanoBananaImageApi(config, log, {
      prompt: effectivePrompt, model, size, image_gen_id,
      reference_image_urls: opts.reference_image_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
    });
  }

  if (protocol === 'kling') {
    return callKlingImageApi(config, log, {
      prompt: effectivePrompt, model, size, image_gen_id,
      reference_image_urls: opts.reference_image_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
    });
  }

  if (protocol === 'gemini') {
    return callGeminiImageApi(db, config, log, {
      prompt, model, size, image_gen_id,          // Gemini 用原始 prompt，不注入文字标签
      reference_image_urls: opts.reference_image_urls,
      files_base_url: opts.files_base_url,
      storage_local_path: opts.storage_local_path,
      system_prompt: opts.system_prompt,
    });
  }

  const url = buildImageUrl(config);
  const isVolc = protocol === 'volcengine';
  // doubao-seedream 系列模型（含通过自定义代理使用的场景）：使用 volcengine 图片 API 规范
  const isSeedream = isVolc || /seedream|doubao/i.test(model);
  // 解析参考图：本地路径/localhost URL → base64，公网 URL → 直接传
  const rawRefs = Array.isArray(reference_image_urls) ? reference_image_urls.filter(Boolean) : [];
  const resolvedRefs = rawRefs.map((r) => resolveImageRef(r, files_base_url, storage_local_path)).filter(Boolean);
  if (resolvedRefs.length > 0) {
    log.info('Image API request with reference images', {
      url: url.slice(0, 60), model, image_gen_id,
      ref_count: resolvedRefs.length,
      ref_types: resolvedRefs.map((r) => (r.startsWith('data:') ? 'base64' : 'url')),
    });
  }

  // doubao-seedream-4-5+ 要求最低 3686400 像素，不足时等比放大
  const effectiveSize = (isSeedream && size) ? fixSeedreamSize(size) : size;

  const body = {
    model,
    prompt: effectivePrompt,
    // doubao-seedream API 不使用 n，其他 OpenAI 兼容接口保留
    ...(!isSeedream ? { n: 1 } : {}),
    ...(effectiveSize ? { size: effectiveSize } : {}),
    ...(quality ? { quality } : {}),
    // volcengine 原生或 doubao-seedream 模型均需关闭水印（默认为 true）
    ...((isVolc || isSeedream) ? { watermark: false } : {}),
    // 多张参考图时加 negative_prompt，防止模型把参考图拼成左右分割的合图
    // Doubao/Seedream 原生支持；通用 OpenAI-compat 接口大多也会接受该字段（不支持的会忽略）
    ...(autoNegativePrompt ? { negative_prompt: autoNegativePrompt } : {}),
    // 参考图字段：volcengine doubao-seedream API 规范使用 image（数组），见官方文档
    ...(resolvedRefs.length > 0 ? { image: resolvedRefs } : {}),
  };
  log.info('Image API request', { url: url.slice(0, 60), model, image_gen_id, has_ref_images: resolvedRefs.length > 0, size: effectiveSize, original_size: size !== effectiveSize ? size : undefined });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (config.api_key || ''),
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    log.error('Image API failed', { status: res.status, body: raw.slice(0, 300) });
    let errMsg = '图片生成请求失败: ' + res.status;
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
    log.warn('Image API response parse error', { image_gen_id, raw_preview: raw.slice(0, 200) });
    return { error: '图片生成返回格式异常' };
  }
  // 兼容多种返回格式：OpenAI 风格 data[].url / b64_json，部分厂商 data[].image_url 或 data.output 等
  const item = data.data && data.data[0];
  const imageUrl = item && (item.url || item.image_url || item.b64_json);
  if (!imageUrl) {
    log.warn('Image API no image URL in response', {
      image_gen_id,
      model,
      response_keys: data ? Object.keys(data) : [],
      data_preview: data ? JSON.stringify(data).slice(0, 500) : '',
      has_data_array: !!(data.data && Array.isArray(data.data)),
      first_item_keys: (data.data && data.data[0]) ? Object.keys(data.data[0]) : [],
    });
    return { error: '未返回图片地址' };
  }
  return { image_url: imageUrl };
}

/**
 * 创建 image_generation 记录并异步调用 API，完成后更新记录与角色 image_url。
 * 与场景图一致：创建 task 并写入 task_id，便于前端轮询 /tasks/:task_id 获知完成或报错。
 */
function createAndGenerateImage(db, log, opts) {
  const {
    drama_id,
    character_id,
    scene_id,
    image_type,
    prompt,
    model,
    size,
    quality,
    provider,
  } = opts;
  const now = new Date().toISOString();
  const dramaIdNum = Number(drama_id) || 0;
  const charIdNum = character_id != null ? Number(character_id) : null;
  const sceneIdNum = scene_id != null ? Number(scene_id) : null;

  let resourceId;
  if (charIdNum != null) resourceId = `character_${charIdNum}`;
  else if (sceneIdNum != null) resourceId = `scene_${sceneIdNum}`;
  else resourceId = String(dramaIdNum);
  const task = taskService.createTask(db, log, 'image_generation', resourceId);
  const taskId = task.id;

  let imageGenId;
  try {
    const info = db.prepare(
      `INSERT INTO image_generations (drama_id, character_id, scene_id, provider, prompt, model, size, quality, status, task_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).run(
      dramaIdNum,
      charIdNum,
      sceneIdNum,
      provider || 'openai',
      prompt || '',
      model || null,
      size || null,
      quality || null,
      taskId,
      now,
      now
    );
    imageGenId = info.lastInsertRowid;
  } catch (e) {
    if ((e.message || '').includes('scene_id') || (e.message || '').includes('character_id')) {
      const info = db.prepare(
        `INSERT INTO image_generations (drama_id, provider, prompt, model, size, quality, status, task_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      ).run(dramaIdNum, provider || 'openai', prompt || '', model || null, size || null, quality || null, taskId, now, now);
      imageGenId = info.lastInsertRowid;
    } else {
      throw e;
    }
  }

  setImmediate(async () => {
    try {
      db.prepare('UPDATE image_generations SET status = ? WHERE id = ?').run('processing', imageGenId);
      const result = await callImageApi(db, log, {
        prompt,
        model,
        size,
        quality,
        drama_id: drama_id,
        character_id: character_id,
        image_type,
        image_gen_id: imageGenId,
      });
      const now2 = new Date().toISOString();
      if (result.error) {
        db.prepare(
          'UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?'
        ).run('failed', result.error, now2, imageGenId);
        taskService.updateTaskError(db, taskId, result.error);
        if (charIdNum != null) {
          try {
            db.prepare('UPDATE characters SET error_msg = ?, updated_at = ? WHERE id = ?').run(result.error, now2, charIdNum);
          } catch (_) {}
        }
        if (sceneIdNum != null) {
          try {
            db.prepare('UPDATE scenes SET error_msg = ?, updated_at = ? WHERE id = ?').run(result.error, now2, sceneIdNum);
          } catch (_) {}
        }
        log.error('Image generation failed', { image_gen_id: imageGenId, error: result.error });
        return;
      }
      let localPath = null;
      try {
        const loadConfig = require('../config').loadConfig;
        const cfg = loadConfig();
        const storagePath = path.isAbsolute(cfg.storage?.local_path)
          ? cfg.storage.local_path
          : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
        const category = sceneIdNum != null ? 'scenes' : (charIdNum != null ? 'characters' : 'images');
        localPath = await uploadService.downloadImageToLocal(storagePath, result.image_url, category, log, 'ig');
      } catch (_) {}
      // 兼容旧库无 completed_at：先试完整 UPDATE，失败则只更新必有列
      try {
        db.prepare(
          'UPDATE image_generations SET status = ?, image_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
        ).run('completed', result.image_url, localPath, now2, now2, imageGenId);
      } catch (e) {
        if ((e.message || '').includes('completed_at')) {
          db.prepare(
            'UPDATE image_generations SET status = ?, image_url = ?, local_path = ?, updated_at = ? WHERE id = ?'
          ).run('completed', result.image_url, localPath, now2, imageGenId);
        } else {
          throw e;
        }
      }
      taskService.updateTaskResult(db, taskId, { image_generation_id: imageGenId, image_url: result.image_url, local_path: localPath, status: 'completed' });
      if (charIdNum != null) {
        try {
          // 旧图追加到 extra_images，与上传逻辑保持一致
          const oldChar = db.prepare('SELECT local_path, image_url, extra_images FROM characters WHERE id = ?').get(charIdNum);
          const oldPath = oldChar?.local_path || oldChar?.image_url || '';
          let extras = [];
          try { extras = oldChar?.extra_images ? JSON.parse(oldChar.extra_images) : []; } catch (_) {}
          if (!Array.isArray(extras)) extras = [];
          if (oldPath && !extras.includes(oldPath)) extras.push(oldPath);
          const extraJson = extras.length ? JSON.stringify(extras) : null;
          db.prepare('UPDATE characters SET image_url = ?, local_path = ?, extra_images = ?, updated_at = ? WHERE id = ?').run(
            result.image_url,
            localPath,
            extraJson,
            now2,
            charIdNum
          );
        } catch (e) {
          if ((e.message || '').includes('local_path') || (e.message || '').includes('extra_images')) {
            db.prepare('UPDATE characters SET image_url = ?, updated_at = ? WHERE id = ?').run(result.image_url, now2, charIdNum);
          } else {
            throw e;
          }
        }
        log.info('Character image updated', { character_id: charIdNum, image_url: result.image_url, local_path: localPath });
      }
      if (sceneIdNum != null) {
        try {
          // 旧图追加到 extra_images，与上传逻辑保持一致
          const oldScene = db.prepare('SELECT local_path, image_url, extra_images FROM scenes WHERE id = ?').get(sceneIdNum);
          const oldPath = oldScene?.local_path || oldScene?.image_url || '';
          let extras = [];
          try { extras = oldScene?.extra_images ? JSON.parse(oldScene.extra_images) : []; } catch (_) {}
          if (!Array.isArray(extras)) extras = [];
          if (oldPath && !extras.includes(oldPath)) extras.push(oldPath);
          const extraJson = extras.length ? JSON.stringify(extras) : null;
          db.prepare('UPDATE scenes SET image_url = ?, local_path = ?, extra_images = ?, updated_at = ? WHERE id = ?').run(
            result.image_url,
            localPath,
            extraJson,
            now2,
            sceneIdNum
          );
        } catch (e) {
          if ((e.message || '').includes('local_path') || (e.message || '').includes('extra_images')) {
            db.prepare('UPDATE scenes SET image_url = ?, updated_at = ? WHERE id = ?').run(result.image_url, now2, sceneIdNum);
          } else {
            throw e;
          }
        }
        log.info('Scene image updated', { scene_id: sceneIdNum, image_url: result.image_url, local_path: localPath });
      }
      log.info('Image generation completed', { image_gen_id: imageGenId, local_path: localPath });
    } catch (err) {
      const now2 = new Date().toISOString();
      const errMsg = (err && err.message) ? String(err.message).slice(0, 500) : 'Unknown error';
      try {
        db.prepare(
          'UPDATE image_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?'
        ).run('failed', errMsg, now2, imageGenId);
      } catch (e) {
        log.error('Image generation: failed to update image_generations', { image_gen_id: imageGenId, error: e.message });
      }
      try {
        taskService.updateTaskError(db, taskId, errMsg);
      } catch (e) {
        log.error('Image generation: failed to update task status', { task_id: taskId, error: e.message });
      }
      if (charIdNum != null) {
        try {
          db.prepare('UPDATE characters SET error_msg = ?, updated_at = ? WHERE id = ?').run(errMsg, now2, charIdNum);
        } catch (_) {}
      }
      if (sceneIdNum != null) {
        try {
          db.prepare('UPDATE scenes SET error_msg = ?, updated_at = ? WHERE id = ?').run(errMsg, now2, sceneIdNum);
        } catch (_) {}
      }
      log.error('Image generation error', { image_gen_id: imageGenId, task_id: taskId, error: err.message });
    }
  });

  const row = db.prepare('SELECT * FROM image_generations WHERE id = ?').get(imageGenId);
  return row ? rowToItem(row) : { id: imageGenId, task_id: taskId, status: 'pending', drama_id: dramaIdNum, character_id: charIdNum, scene_id: sceneIdNum, prompt, model, size, quality, created_at: now, updated_at: now };
}

function rowToItem(r) {
  return {
    id: r.id,
    storyboard_id: r.storyboard_id,
    drama_id: r.drama_id,
    character_id: r.character_id,
    provider: r.provider,
    prompt: r.prompt,
    model: r.model,
    size: r.size,
    quality: r.quality,
    image_url: r.image_url,
    local_path: r.local_path,
    status: r.status,
    task_id: r.task_id,
    error_msg: r.error_msg,
    created_at: r.created_at,
    updated_at: r.updated_at,
    completed_at: r.completed_at,
  };
}

module.exports = {
  getDefaultImageConfig,
  callImageApi,
  createAndGenerateImage,
};
