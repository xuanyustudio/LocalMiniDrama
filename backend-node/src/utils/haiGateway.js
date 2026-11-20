/**
 * HAI 私有网关客户端（MIGU 厂商底层实现，生图 MinimaxH3ImageEdit / 生视频 VideoMinimaxH3I2v 共用）。
 *
 * 契约（内化自 shuohao-skills/novel-images、novel-video 的 hai-gateway.md，含实测坑位）：
 *   ① 上传参考图/首帧  POST {base}/upload/image   multipart 字段 file → { filename }
 *   ② 提交任务        POST {base}/generate       { input: { request_id, modifier, modifications } }
 *   ③ 轮询            GET  {base}/result/{request_id} → { status, message, output: [{ media_type, download_url }] }
 *   ④ 下载产物        GET  {scheme://host:port}{download_url}，带 x-api-key
 *
 * 配置注入（不落盘，全部走环境变量；AI 配置里的 Key/BaseURL 作为兜底）：
 *   HAI_API_BASE                网关地址（默认内置 mv-director-ai 地址，换部署时覆盖）
 *   HAI_API_KEY                 鉴权 key（请求头 x-api-key）
 *   HAI_IMAGE_POLL_SECONDS      生图轮询间隔，默认 6
 *   HAI_IMAGE_TIMEOUT_SECONDS   生图超时，默认 600
 *   HAI_IMAGE_MEGAPIXELS        纯文生图画布，默认 4（≈4K）
 *   HAI_IMAGE_STEPS             采样步数，默认 6
 *   HAI_IMAGE_REF_PROMPT        有参考图时的一致性前缀；置空字符串关闭
 *   HAI_IMAGE_CROP_WATERMARK_PX 裁底部水印像素，默认 0（不裁）
 *   HAI_POLL_SECONDS            生视频轮询间隔，默认 8
 *   HAI_TIMEOUT_SECONDS         生视频超时下限，默认 1200
 *   HAI_ASPECT                  生视频画幅，默认 LANDSCAPE_16_9
 *   HAI_LIGHTNING_LORA          加速档，默认 1
 *   HAI_WATERMARK               视频水印，默认 0
 *   HAI_VIDEO_EST_BASE          视频耗时预估基数（秒），默认 105
 *   HAI_VIDEO_EST_PER_SECOND    视频耗时预估每秒增量，默认 68
 *   FFMPEG_PATH                 裁水印用（也可走内置查找逻辑）
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getFfmpegPath } = require('./ffmpegPath');

const DEFAULT_HAI_API_BASE = 'http://36.138.206.92:60788/mgpu-node3-prod/hai/api/v1';
const HAI_IMAGE_MODIFIER = 'MinimaxH3ImageEdit';
const HAI_VIDEO_MODIFIER = 'VideoMinimaxH3I2v';
const HAI_VIDEO_MODIFIER_R2V = 'VideoMinimaxH3R2v';

/** 参考图一致性前缀（与 novel-images 相同：设定图是多分区版式，必须禁止模型抄版式） */
const DEFAULT_IMAGE_REF_PROMPT =
  '输出必须是一张单一的电影剧照：整幅只允许一个画面，禁止拼版、多格、分屏、边框线条与细节小图；参考图只用于人物长相服饰、道具外观与环境色调，绝不复制参考图的分区版式、排版与文字；画面内不得出现字幕、水印或提示词文字，屏幕与纸张上只出现符合剧情的合理内容；';

function haiRootOf(base) {
  return String(base || '').split('/').slice(0, 3).join('/');
}

/** base：环境变量优先（换部署覆盖），其次 AI 配置里的 BaseURL，最后内置默认 */
function resolveHaiBase(config) {
  const fromEnv = String(process.env.HAI_API_BASE || '').trim();
  const fromCfg = String((config && config.base_url) || '').trim();
  return (fromEnv || fromCfg || DEFAULT_HAI_API_BASE).replace(/\/+$/, '');
}

/** key：环境变量优先（不落盘），其次 AI 配置里的 Key */
function resolveHaiApiKey(config) {
  const fromEnv = String(process.env.HAI_API_KEY || '').trim();
  const fromCfg = String((config && config.api_key) || '').trim();
  return fromEnv || fromCfg;
}

function numEnv(name, dft) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : dft;
}

function boolEnv(name, dft) {
  const v = process.env[name];
  if (v === undefined) return dft;
  return v === '1' || v === 'true';
}

/** 生图配置（minimaxH3ImageEdit） */
function haiImageConf(config) {
  return {
    base: resolveHaiBase(config),
    key: resolveHaiApiKey(config),
    modifier: String(process.env.HAI_IMAGE_MODIFIER || HAI_IMAGE_MODIFIER),
    megapixels: numEnv('HAI_IMAGE_MEGAPIXELS', 4),
    steps: numEnv('HAI_IMAGE_STEPS', 6),
    pollSeconds: numEnv('HAI_IMAGE_POLL_SECONDS', 6),
    timeoutSeconds: numEnv('HAI_IMAGE_TIMEOUT_SECONDS', 600),
    cropWatermarkPx: Math.max(0, Math.round(Number(process.env.HAI_IMAGE_CROP_WATERMARK_PX) || 0)),
    refPrefix: process.env.HAI_IMAGE_REF_PROMPT !== undefined
      ? String(process.env.HAI_IMAGE_REF_PROMPT)
      : DEFAULT_IMAGE_REF_PROMPT,
  };
}

/**
 * 组装视频生成的 modifier + modifications（含 I2V / R2V 路由）。
 * 路由规则：
 *   - 环境变量 HAI_VIDEO_MODIFIER 显式指定（VideoMinimaxH3R2v / VideoMinimaxH3I2v）时强制
 *   - 有参考图（分镜多模态参考）→ R2V：首帧并入 ref_images[0]（<Picture 1>），参考图从 <Picture 2> 起
 *   - 仅首帧 / 纯文生视频 → I2V（首帧精确控制、尾帧可选；无首帧即文生视频）
 * @returns {{ modifier: string, modifications: object }}
 */
function buildHaiVideoRequest({ prompt, duration, aspectRatio, firstFrame, lastFrame, refImages, refAudios, conf }) {
  const durationSeconds = normalizeHaiVideoDuration(duration);
  const aspect = haiVideoAspect(aspectRatio);
  const refs = (Array.isArray(refImages) ? refImages.filter(Boolean) : []).slice(0, 9);
  // H3 R2V 音频驱动：参考音色后模型直接生成口型同步的语音；I2V 不支持 ref_audios，有音频强制走 R2V
  const audios = (Array.isArray(refAudios) ? refAudios.filter(Boolean) : []).slice(0, 3);
  const envModifier = String(process.env.HAI_VIDEO_MODIFIER || process.env.HAI_MODIFIER || '').trim().toLowerCase();
  const forceR2v = envModifier === 'videominimaxh3r2v';
  const forceI2v = envModifier === 'videominimaxh3i2v';
  const useR2v = forceR2v || (!forceI2v && (refs.length > 0 || audios.length > 0));

  if (useR2v) {
    const lines = [];
    if (firstFrame) {
      lines.push('<Picture 1> 为视频首帧画面，整段视频必须从 <Picture 1> 这一帧开始运动，保持其中人物长相、服饰与场景光线一致。');
    }
    if (refs.length > 0) {
      const startNo = firstFrame ? 2 : 1;
      lines.push(`<Picture ${startNo}> 起为角色/场景一致性参考，只用于人物长相服饰、道具外观与环境色调，不复制参考图的版式、排版与文字。`);
    }
    if (audios.length > 0) {
      lines.push('<Audio 1> 为说话角色的音色参考：画面中角色以 <Audio 1> 的音色开口说出台词（提示词中「」内的对白），口型与语音严格同步，声音情绪贴合台词。');
    }
    return {
      modifier: HAI_VIDEO_MODIFIER_R2V,
      modifications: {
        prompt: (lines.join(' ') + ' ' + String(prompt || '')).trim(),
        ref_images: [firstFrame, ...refs].filter(Boolean).slice(0, 9),
        ref_audios: audios,
        duration_seconds: durationSeconds,
        aspect_ratio: aspect,
        megapixels: conf.megapixels,
        enable_lightning_lora: conf.lightning,
      },
    };
  }

  // I2V：first_frame/last_frame 单字符串，传空串合法（表示不用该帧）；无首帧即纯文生视频
  const modifications = {
    prompt: String(prompt || ''),
    duration_seconds: durationSeconds,
    aspect_ratio: aspect,
    megapixels: conf.megapixels,
    enable_lightning_lora: conf.lightning,
    watermark: conf.watermark,
  };
  if (firstFrame) modifications.first_frame = firstFrame;
  if (lastFrame) modifications.last_frame = lastFrame;
  return { modifier: HAI_VIDEO_MODIFIER, modifications };
}

/** 生视频耗时预估（秒）：机器时间随段长非线性增长，5s≈173s / 13s≈925s，宁大勿小 */
function haiVideoEstimateSeconds(durationSeconds) {
  const base = Number(process.env.HAI_VIDEO_EST_BASE);
  const per = Number(process.env.HAI_VIDEO_EST_PER_SECOND);
  const b = Number.isFinite(base) ? base : 105;
  const p = Number.isFinite(per) ? per : 68;
  return Math.round(b + p * Math.max(1, Number(durationSeconds) || 5));
}

/** 生视频配置（VideoMinimaxH3I2v / VideoMinimaxH3R2v） */
function haiVideoConf(config, durationSeconds) {
  const timeoutFloor = numEnv('HAI_TIMEOUT_SECONDS', 1200);
  const estimateSeconds = haiVideoEstimateSeconds(durationSeconds);
  return {
    base: resolveHaiBase(config),
    key: resolveHaiApiKey(config),
    modifier: String(process.env.HAI_MODIFIER || HAI_VIDEO_MODIFIER),
    aspect: String(process.env.HAI_ASPECT || ''),
    pollSeconds: numEnv('HAI_POLL_SECONDS', 8),
    // 耗时预估可能超过默认超时（13s 段实测 925s 机器时间），取两者较大值再加余量
    timeoutSeconds: Math.max(timeoutFloor, estimateSeconds + 120),
    estimateSeconds,
    lightning: boolEnv('HAI_LIGHTNING_LORA', true),
    watermark: boolEnv('HAI_WATERMARK', false),
    megapixels: numEnv('HAI_VIDEO_MEGAPIXELS', 1),
  };
}

/** 宽高向下取整到 32 的倍数（VAE 下采样要求，720 → 704） */
function floor32(v) {
  return Math.max(32, Math.floor(Number(v) / 32) * 32);
}

/** 解析 "WxH" 尺寸为 32 取整画布；非该格式返回 null（走 megapixels） */
function normalizeHaiImageSize(size) {
  const m = String(size || '').trim().match(/^(\d+)\s*[xX*×]\s*(\d+)$/);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!(w > 0 && h > 0)) return null;
  return { width: floor32(w), height: floor32(h) };
}

/** 纯文生图兜底画布：按 megapixels 算 16:9（32 的倍数） */
function haiMegapixelCanvas(megapixels) {
  const mp = Number(megapixels) > 0 ? Number(megapixels) : 4;
  const canvas = Math.sqrt(mp * 1000000 * 16 / 9);
  return { width: floor32(Math.round(canvas)), height: floor32(Math.round(canvas * 9 / 16)) };
}

/** 生视频时长：整数秒、宁长勿短，下限 5（太短被服务端拒），上限 15 */
function normalizeHaiVideoDuration(duration) {
  const n = Math.ceil(Number(duration));
  const safe = Number.isFinite(n) && n > 0 ? n : 5;
  return Math.min(15, Math.max(5, safe));
}

/** 画幅映射（只收网关枚举，大小写敏感）：1:1 / 2:3 / 3:4 / 9:16 / 3:2 / 4:3 / 16:9 */
function haiVideoAspect(aspectRatio) {
  if (process.env.HAI_ASPECT) return String(process.env.HAI_ASPECT);
  const map = {
    '1:1': 'SQUARE',
    '2:3': 'PORTRAIT_2_3',
    '3:4': 'PORTRAIT_3_4',
    '9:16': 'PORTRAIT_9_16',
    '3:2': 'LANDSCAPE_3_2',
    '4:3': 'LANDSCAPE_4_3',
    '16:9': 'LANDSCAPE_16_9',
  };
  return map[String(aspectRatio || '').trim()] || 'LANDSCAPE_16_9';
}

/**
 * 参考图/首帧解析为 Buffer：
 * data:URL → 解码；公网 URL → 下载；localhost URL / 相对路径 → 读本地 storage 文件
 * @returns {Promise<{ buffer: Buffer, mime: string } | null>}
 */
async function resolveRefToBuffer(value, filesBaseUrl, storageLocalPath) {
  const s = String(value || '').trim();
  if (!s) return null;
  if (s.startsWith('data:')) {
    const idx = s.indexOf(',');
    if (idx < 0) return null;
    const mime = (s.slice(5, idx).split(';')[0] || 'image/png').trim();
    try {
      return { buffer: Buffer.from(s.slice(idx + 1), 'base64'), mime: mime || 'image/png' };
    } catch (_) {
      return null;
    }
  }
  const isHttp = /^https?:\/\//i.test(s);
  const isLocalUrl = /localhost|127\.0\.0\.1/i.test(s);
  if (isHttp && !isLocalUrl) {
    const r = await fetch(s, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('参考图下载失败 HTTP ' + r.status);
    const mime = (r.headers.get('content-type') || 'image/png').split(';')[0];
    return { buffer: Buffer.from(await r.arrayBuffer()), mime: mime || 'image/png' };
  }
  // 本地：URL 取 /static/ 之后的相对路径（或去掉 filesBaseUrl 前缀），否则按相对路径
  let rel = null;
  if (isHttp) {
    rel = s.split('/static/')[1] || null;
    const baseUrl = String(filesBaseUrl || '').replace(/\/$/, '');
    if (!rel && baseUrl && s.startsWith(baseUrl + '/')) rel = s.slice(baseUrl.length + 1);
    if (!rel) return null;
  } else {
    rel = s.replace(/^\//, '');
  }
  if (storageLocalPath) {
    const fp = path.isAbsolute(rel) ? rel : path.join(storageLocalPath, rel);
    if (fs.existsSync(fp)) {
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' };
      const mime = mimeMap[path.extname(fp).toLowerCase()] || 'image/png';
      return { buffer: fs.readFileSync(fp), mime };
    }
  }
  return null;
}

/** 鉴权头：统一 x-api-key（key 来自环境变量 HAI_API_KEY 或 AI 配置） */
function haiAuthHeaders(conf) {
  return { 'x-api-key': (conf && conf.key) || '' };
}

/** ① 上传参考图/首帧 → filename */
async function uploadHaiImage(conf, buffer, filename, log) {
  const fd = new FormData();
  const mime = 'image/png';
  fd.append('file', new Blob([buffer], { type: mime }), filename || 'ref.png');
  const r = await fetch(conf.base + '/upload/image', {
    method: 'POST',
    headers: haiAuthHeaders(conf),
    body: fd,
  });
  const text = await r.text();
  if (r.status !== 200 && r.status !== 201) {
    throw new Error('上传失败 HTTP ' + r.status + ': ' + text.slice(0, 300));
  }
  let j;
  try {
    j = JSON.parse(text);
  } catch (_) {
    throw new Error('上传响应非 JSON: ' + text.slice(0, 300));
  }
  if (!j.filename) throw new Error('上传响应缺少 filename: ' + JSON.stringify(j).slice(0, 300));
  if (log) log.info('[HAI] 参考图已上传', { filename: j.filename, bytes: buffer.length });
  return j.filename;
}

/** 上传音频/视频素材（POST /upload/file）→ filename；ref_audios 等用 */
async function uploadHaiFile(conf, buffer, filename, log) {
  const ext = String(filename || '').match(/\.([a-z0-9]+)$/i);
  const mimeMap = {
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
    ogg: 'audio/ogg', flac: 'audio/flac', mp4: 'video/mp4', mov: 'video/quicktime',
  };
  const mime = (ext && mimeMap[ext[1].toLowerCase()]) || 'application/octet-stream';
  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: mime }), filename || 'audio.mp3');
  const r = await fetch(conf.base + '/upload/file', {
    method: 'POST',
    headers: haiAuthHeaders(conf),
    body: fd,
  });
  const text = await r.text();
  if (r.status !== 200 && r.status !== 201) {
    throw new Error('素材上传失败 HTTP ' + r.status + ': ' + text.slice(0, 300));
  }
  let j;
  try {
    j = JSON.parse(text);
  } catch (_) {
    throw new Error('素材上传响应非 JSON: ' + text.slice(0, 300));
  }
  if (!j.filename) throw new Error('素材上传响应缺少 filename: ' + JSON.stringify(j).slice(0, 300));
  if (log) log.info('[HAI] 音频素材已上传', { filename: j.filename, bytes: buffer.length });
  return j.filename;
}

/**
 * ②③ 提交任务并轮询到终态。
 * @returns {Promise<{ status: string, message?: string, output?: Array, request_id?: string }>}
 */
async function submitAndPollHaiTask(conf, { modifier, modifications, requestId, log, label, videoGenId }) {
  const id = requestId || ('hai-' + Date.now().toString(36) + '-' + Math.random().toString(16).slice(2, 12));
  const payload = {
    input: {
      request_id: id,
      modifier: modifier || HAI_IMAGE_MODIFIER,
      modifications,
      return_outputs_as_base64: false,
    },
  };
  const r = await fetch(conf.base + '/generate', {
    method: 'POST',
    headers: { ...haiAuthHeaders(conf), 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (r.status !== 200 && r.status !== 201 && r.status !== 202) {
    throw new Error('提交失败 HTTP ' + r.status + ': ' + text.slice(0, 300));
  }
  if (log) log.info('[HAI] 任务已提交', { request_id: id, label: label || '', video_gen_id: videoGenId });

  const deadline = Date.now() + conf.timeoutSeconds * 1000;
  let task = null;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, conf.pollSeconds * 1000));
    const tr = await fetch(conf.base + '/result/' + encodeURIComponent(id), {
      headers: haiAuthHeaders(conf),
    });
    if (!tr.ok) {
      if (log) log.warn('[HAI] 轮询非 2xx，继续', { request_id: id, status: tr.status, label: label || '' });
      continue;
    }
    task = await tr.json();
    if (log) {
      log.info('[HAI] 轮询状态', {
        request_id: id,
        label: label || '',
        video_gen_id: videoGenId,
        status: task && task.status,
        message: task && task.message ? String(task.message).slice(0, 200) : undefined,
      });
    }
    const st = String((task && task.status) || '').toLowerCase();
    // 终态：completed / failed / error / cancelled；generated 只是产物落盘，未到 completed
    if (st === 'completed' || st === 'failed' || st === 'error' || st === 'cancelled') break;
  }
  if (!task) throw new Error('任务轮询无响应 ' + id);
  const st = String(task.status || '').toLowerCase();
  if (st !== 'completed' && st !== 'failed' && st !== 'error' && st !== 'cancelled') {
    throw new Error('任务轮询超时 ' + id + '（超时 ' + conf.timeoutSeconds + 's，可用 HAI_TIMEOUT_SECONDS / HAI_IMAGE_TIMEOUT_SECONDS 调大）');
  }
  return { ...task, status: st, request_id: id };
}

/** 从终态响应里取第一个 image 输出的 download_url（相对路径原样返回） */
function extractHaiImageUrl(task) {
  const outputs = task && Array.isArray(task.output) ? task.output : [];
  const img = outputs.find((o) => String((o && o.media_type) || '').toLowerCase() === 'image' && o.download_url);
  return img ? String(img.download_url) : null;
}

/** 从终态响应里取第一个 video 输出的 download_url（相对路径原样返回） */
function extractHaiVideoUrl(task) {
  const outputs = task && Array.isArray(task.output) ? task.output : [];
  const vid = outputs.find((o) => String((o && o.media_type) || '').toLowerCase() === 'video' && o.download_url);
  return vid ? String(vid.download_url) : null;
}

/** 轮询（videoClient.pollVideoTask）响应解析：状态 */
function extractHaiPollStatus(data) {
  return String((data && data.status) || '').toLowerCase();
}

/** 轮询响应解析：download_url（相对路径拼网关源站） */
function extractHaiPollVideoUrl(data, base) {
  const rel = extractHaiVideoUrl(data);
  if (!rel) return null;
  if (/^https?:\/\//i.test(rel)) return rel;
  return haiRootOf(base) + rel;
}

/** ④ 下载产物（download_url 相对路径拼 scheme://host:port） */
async function downloadHaiFile(conf, downloadUrl) {
  const url = /^https?:\/\//i.test(downloadUrl) ? downloadUrl : haiRootOf(conf.base) + downloadUrl;
  const r = await fetch(url, { headers: haiAuthHeaders(conf), signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error('下载失败 HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

/** 用 ffmpeg 裁掉图片底部水印（失败返回 null，调用方保留原图） */
function cropImageBottomPx(buffer, cropPx, log) {
  const px = Math.max(1, Math.round(Number(cropPx) || 0));
  if (!px || !Buffer.isBuffer(buffer)) return null;
  const tmpIn = path.join(process.env.TEMP || process.env.TMP || '.', 'hai-crop-' + Date.now() + '-in.png');
  const tmpOut = tmpIn.replace('-in.png', '-out.png');
  try {
    fs.writeFileSync(tmpIn, buffer);
    const r = spawnSync(
      getFfmpegPath(),
      ['-y', '-i', tmpIn, '-vf', 'crop=iw:ih-' + px + ':0:0', '-frames:v', '1', '-q:v', '2', tmpOut],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    if (r.status !== 0) {
      if (log) log.warn('[HAI] 裁水印失败（保留原图）', { stderr: r.stderr ? r.stderr.toString().slice(0, 300) : 'exit ' + r.status });
      return null;
    }
    const out = fs.readFileSync(tmpOut);
    if (log) log.info('[HAI] 已裁底部水印', { crop_px: px, bytes_before: buffer.length, bytes_after: out.length });
    return out;
  } catch (e) {
    if (log) log.warn('[HAI] 裁水印异常（保留原图）', { error: e.message });
    return null;
  } finally {
    try { fs.unlinkSync(tmpIn); } catch (_) {}
    try { fs.unlinkSync(tmpOut); } catch (_) {}
  }
}

module.exports = {
  DEFAULT_HAI_API_BASE,
  HAI_IMAGE_MODIFIER,
  HAI_VIDEO_MODIFIER,
  haiRootOf,
  resolveHaiBase,
  resolveHaiApiKey,
  haiImageConf,
  haiVideoConf,
  uploadHaiFile,
  haiVideoEstimateSeconds,
  normalizeHaiImageSize,
  haiMegapixelCanvas,
  normalizeHaiVideoDuration,
  haiVideoAspect,
  buildHaiVideoRequest,
  resolveRefToBuffer,
  uploadHaiImage,
  submitAndPollHaiTask,
  extractHaiImageUrl,
  extractHaiVideoUrl,
  extractHaiPollStatus,
  extractHaiPollVideoUrl,
  downloadHaiFile,
  cropImageBottomPx,
};
