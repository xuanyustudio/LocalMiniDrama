// 与 Go pkg/video + VideoGenerationService 对齐：调用视频生成 API，支持纯文本(无参考图)
const fs = require('fs');
const path = require('path');
const aiConfigService = require('./aiConfigService');

// 使用前端设置的「默认」与「优先级」：listConfigs 已按 is_default DESC, priority DESC 排序
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

// 火山引擎视频 API 路径固定为 /contents/generations/tasks，base 读用户配置（并去掉错误子路径）
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
  const isDashScope = p === 'dashscope';
  const isVolc = p === 'volces' || p === 'volcengine' || p === 'volc';
  if (isVolc) return getVolcVideoBase(config) + VOLC_VIDEO_QUERY_PATH + '/' + encodeURIComponent(taskId);
  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.query_endpoint || (isDashScope ? '/api/v1/tasks/{taskId}' : '/video/task/{taskId}');
  ep = String(ep).replace(/{taskId}/g, taskId).replace(/{task_id}/g, taskId);
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

// 火山引擎常见显示名 → API 端点 ID 映射（API 只认小写+日期后缀格式）
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

// 从 DashScope 任务查询响应中取视频 URL
function parseDashScopeVideoUrl(data) {
  const out = data?.output;
  if (!out) return null;
  if (out.video_url) return out.video_url;
  if (out.output && out.output.video_url) return out.output.video_url;
  const results = out.results || out.result;
  if (Array.isArray(results) && results[0]) {
    const r = results[0];
    if (r.video_url) return r.video_url;
    if (r.output && r.output.video_url) return r.output.video_url;
  }
  const choices = out.choices;
  if (Array.isArray(choices) && choices[0]) {
    const c = choices[0];
    const msg = c?.message?.content || c?.content;
    if (Array.isArray(msg)) {
      for (const m of msg) {
        if (m && (m.video_url || m.url)) return m.video_url || m.url;
      }
    }
  }
  return null;
}

const DASHSCOPE_VIDEO_GENERATION = '/api/v1/services/aigc/video-generation/video-synthesis';
const DASHSCOPE_IMAGE2VIDEO = '/api/v1/services/aigc/image2video/video-synthesis';

/**
 * 通义万相视频：按模型选择 endpoint 与请求体，异步轮询 /api/v1/tasks/{taskId}
 * - wan2.2-kf2v-flash: image2video, first_frame_url + last_frame_url
 * - wan2.6-t2v: video-generation, 仅 prompt（文生视频）
 * - wan2.6-i2v-flash: video-generation, prompt + img_url（首帧图生视频）
 * - wanx2.1-vace-plus: video-generation, function image_reference + ref_images_url（最多 3 张）
 * - wan2.6-r2v-flash: video-generation, reference_urls（最多 5 张）
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

  /** 本地调试：若 base_url 为 localhost，从本地磁盘读取图片并转为 base64，避免 DashScope 报 download image failed */
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
      return { error: 'wan2.2-kf2v-flash 需要首帧与尾帧图片' };
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
    if (!imgUrl) return { error: 'wan2.6-i2v-flash 需要首帧图片' };
    body = {
      model,
      input: { prompt: prompt || '', img_url: imgUrl },
      parameters: { resolution: '720P', prompt_extend: true, duration: dur, shot_type: 'multi' },
    };
  } else if (model === 'wanx2.1-vace-plus') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    const rawRefs = Array.isArray(reference_urls) ? reference_urls.filter(Boolean).slice(0, 3) : [];
    const refs = rawRefs.map(toImageInput).filter(Boolean);
    if (refs.length === 0) return { error: 'wanx2.1-vace-plus 需要参考图（最多 3 张）' };
    body = {
      model,
      input: { function: 'image_reference', prompt: prompt || '', ref_images_url: refs },
      parameters: { prompt_extend: true, obj_or_bg: ['obj', 'bg'], size: '1280*720' },
    };
  } else if (model === 'wan2.6-r2v-flash') {
    url = base + DASHSCOPE_VIDEO_GENERATION;
    const rawRefs = Array.isArray(reference_urls) ? reference_urls.filter(Boolean).slice(0, 5) : [];
    const refs = rawRefs.map(toImageInput).filter(Boolean);
    if (refs.length === 0) return { error: 'wan2.6-r2v-flash 需要参考图或视频（最多 5 个）' };
    body = {
      model,
      input: { prompt: prompt || '', reference_urls: refs },
      parameters: { prompt_extend: true },
    };
  } else {
    return { error: '不支持的通义万相视频模型: ' + model };
  }

  const shorten = (v) => (v && v.startsWith('data:') ? '(base64 本地图)' : v);
  const imageUrlsInBody = body.input
    ? {
        first_frame_url: shorten(body.input.first_frame_url),
        last_frame_url: shorten(body.input.last_frame_url),
        img_url: shorten(body.input.img_url),
        ref_images_url: Array.isArray(body.input.ref_images_url) ? body.input.ref_images_url.map(shorten) : body.input.ref_images_url,
        reference_urls: Array.isArray(body.input.reference_urls) ? body.input.reference_urls.map(shorten) : body.input.reference_urls,
      }
    : {};
  log.info('DashScope 请求中的图片（base64 本地图 = 本地调试已转 base64，避免 download image failed）', {
    model,
    video_gen_id,
    files_base_url: baseUrl || '(未配置)',
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
    let errMsg = '视频生成请求失败: ' + res.status;
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
    return { error: '视频生成返回格式异常' };
  }
  if (data.code) {
    return { error: data.message || data.code || '通义万相接口错误' };
  }
  const taskId = data?.output?.task_id;
  if (taskId) return { task_id: taskId, status: 'PENDING' };
  const videoUrl = parseDashScopeVideoUrl(data);
  if (videoUrl) return { video_url: videoUrl };
  return { error: '未返回 task_id 或 video_url' };
}

/**
 * 调用视频生成 API（ChatFire/豆包 或 通义万相）
 * @returns {Promise<{ task_id?: string, video_url?: string, error?: string }>}
 */
async function callVideoApi(db, log, opts) {
  const { prompt, model: preferredModel, duration, aspect_ratio, resolution, seed, camera_fixed, watermark, image_url, video_gen_id } = opts;
  const config = getDefaultVideoConfig(db, preferredModel);
  if (!config) {
    throw new Error('未配置视频模型，请在「AI 配置」中添加 video 类型且已启用的配置');
  }
  const model = getModelFromConfig(config, preferredModel);
  const provider = (config.provider || '').toLowerCase();

  if (provider === 'dashscope') {
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

  const url = buildVideoUrl(config);
  const dur = duration ? Number(duration) : 5;
  const ratio = aspect_ratio || '16:9';

  const isVolc = ['volces', 'volcengine', 'volc'].includes((config.provider || '').toLowerCase());
  // 火山引擎 model 名称标准化（把显示名转成 API 端点 ID）
  const finalModel = isVolc ? normalizeVolcModel(model) : model;
  const hasImage = !!(image_url && image_url.trim());
  // 火山引擎：doubao-seedance-1-5-pro 不支持 r2v，必须显式传 task_type；单图用 i2v 且不用 reference_image 避免被识别为 r2v
  const volcTaskType = isVolc ? (hasImage ? 'i2v' : 't2v') : null;

  // 若图片为 localhost URL，火山服务器无法下载，转为 base64（与 DashScope 一致）
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

  // ratio、duration 等作为独立顶层字段传入（火山引擎/ChatFire 官方接口格式）
  const body = {
    model: finalModel,
    content: [{ type: 'text', text: prompt || '' }],
    ratio,
    duration: dur,
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

  log.info('Video API request', { url: url.slice(0, 60), model, video_gen_id, task_type: body.task_type });
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
    log.error('Video API failed', { status: res.status, body: raw.slice(0, 300) });
    let errMsg = '视频生成请求失败: ' + res.status;
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
    return { error: '视频生成返回格式异常' };
  }
  const taskId = data.id || data.task_id || (data.data && data.data.id);
  const status = data.status || (data.data && data.data.status);
  const videoUrl = data.video_url || (data.data && data.data.video_url) || (data.content && data.content.video_url);
  if (videoUrl) {
    return { video_url: videoUrl };
  }
  if (taskId) {
    return { task_id: taskId, status: status || 'processing' };
  }
  return { error: '未返回 task_id 或 video_url' };
}

/**
 * 轮询任务状态直到完成或失败（兼容豆包/ChatFire 与 通义万相 DashScope）
 */
async function pollVideoTask(db, log, videoGenId, taskId, config, maxAttempts = 300, intervalMs = 10000) {
  const isDashScope = (config.provider || '').toLowerCase() === 'dashscope';
  const queryUrl = () => buildQueryUrl(config, taskId);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const url = queryUrl();
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + (config.api_key || '') },
      });
      const raw = await res.text();
      if (!res.ok) continue;
      const data = JSON.parse(raw);
      if (isDashScope) {
        const taskStatus = data?.output?.task_status;
        const videoUrl = parseDashScopeVideoUrl(data);
        if (videoUrl) return { video_url: videoUrl };
        if (taskStatus === 'FAILED' || taskStatus === 'CANCELED') {
          const msg = data?.message || data?.output?.message || taskStatus;
          log.warn('DashScope 视频任务失败（若为 download image failed，多为图片 URL 非外网可访问，如 localhost）', {
            video_gen_id: videoGenId,
            task_id: taskId,
            task_status: taskStatus,
            message: msg,
            output: data?.output,
          });
          return { error: msg || '通义万相任务失败' };
        }
        continue;
      }
      const status = data.status || (data.data && data.data.status);
      const videoUrl = data.video_url || (data.data && data.data.video_url) || (data.content && data.content.video_url);
      const errMsg = data.error && (typeof data.error === 'string' ? data.error : data.error.message);
      if (videoUrl) return { video_url: videoUrl };
      if (status === 'failed' || status === 'error' || errMsg) return { error: errMsg || status || '任务失败' };
    } catch (e) {
      log.warn('Video poll request failed', { attempt, error: e.message });
    }
  }
  return { error: '视频生成超时' };
}

module.exports = {
  getDefaultVideoConfig,
  callVideoApi,
  pollVideoTask,
};
