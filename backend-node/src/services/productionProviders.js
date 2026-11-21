const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const ARK = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const MINIMAX = 'https://api.minimax.io/v1';
const BAILIAN = 'https://dashscope-intl.aliyuncs.com';
const BAILIAN_SPEECH = 'wss://dashscope-intl.aliyuncs.com';
const BYTEPLUS_REF = 'env:BYTEPLUS_ARK_API_KEY';
const MINIMAX_REF = 'env:MINIMAX_API_KEY';
const BAILIAN_REF = 'env:DASHSCOPE_API_KEY';
const BAILIAN_IMAGE_ENDPOINT = '/api/v1/services/aigc/multimodal-generation/generation';
const BAILIAN_VIDEO_ENDPOINT = '/api/v1/services/aigc/video-generation/video-synthesis';
const PROFILES = {
  text: { name: 'BytePlus · Seed 2.1 Turbo', provider: 'openai', base_url: ARK, endpoint: '/chat/completions', model: 'dola-seed-2-1-turbo-260628' },
  image: { name: 'BytePlus · Seedream 5 Pro', provider: 'volcengine', base_url: ARK, endpoint: '/images/generations', model: 'dola-seedream-5-0-pro-260628' },
  storyboard_image: { name: 'BytePlus · Seedream 分镜图', provider: 'volcengine', base_url: ARK, endpoint: '/images/generations', model: 'dola-seedream-5-0-pro-260628' },
  video: { name: 'BytePlus · Seedance 2 Fast', provider: 'volcengine', base_url: ARK, endpoint: '/contents/generations/tasks', model: 'dreamina-seedance-2-0-fast-260128' },
  tts: { name: 'MiniMax · 中文配音', provider: 'minimax_intl', base_url: MINIMAX, endpoint: '/t2a_v2', model: 'speech-2.8-turbo' },
};
const bailianImage = { name: '百炼 · 万相 2.7 生图', provider: 'dashscope', base_url: BAILIAN, endpoint: BAILIAN_IMAGE_ENDPOINT, model: 'wan2.7-image' };
const BAILIAN_PROFILES = {
  text: { name: '百炼 · 通义千问 3.7 Plus', provider: 'openai', base_url: BAILIAN + '/compatible-mode/v1', endpoint: '/chat/completions', model: 'qwen3.7-plus', models: ['qwen3.7-plus', 'qwen3.7-flash'] },
  image: bailianImage,
  storyboard_image: { ...bailianImage, name: '百炼 · 万相 2.7 分镜首帧' },
  video: { name: '百炼 · 万相 2.6 Flash 无声', provider: 'dashscope', base_url: BAILIAN, endpoint: BAILIAN_VIDEO_ENDPOINT, query_endpoint: '/api/v1/tasks/{taskId}', model: 'wan2.6-i2v-flash' },
  tts: { name: '百炼 · CosyVoice 中文配音', provider: 'cosyvoice', base_url: BAILIAN_SPEECH, endpoint: '/api-ws/v1/inference', model: 'cosyvoice-v3-flash' },
};

function videoDurationLimits(config) {
  if (config?.api_key === BAILIAN_REF) return { minSeconds: 2, maxSeconds: 15, defaultSeconds: 10 };
  if (config?.api_key === BYTEPLUS_REF) return { minSeconds: 4, maxSeconds: 15, defaultSeconds: 5 };
  return null;
}
const KEY_ENDPOINTS = {
  [BYTEPLUS_REF]: /^https:\/\/ark\.ap-southeast\.bytepluses\.com\/api\/v3\/(?:chat\/completions|images\/generations|contents\/generations\/tasks(?:\/[A-Za-z0-9_-]+)?)$/,
  [MINIMAX_REF]: /^https:\/\/api\.minimax\.io\/v1\/t2a_v2$/,
  [BAILIAN_REF]: /^(?:https:\/\/dashscope-intl\.aliyuncs\.com\/(?:compatible-mode\/v1\/chat\/completions|api\/v1\/(?:services\/aigc\/(?:multimodal-generation\/generation|video-generation\/video-synthesis)|tasks\/[A-Za-z0-9_-]+))|wss:\/\/dashscope-intl\.aliyuncs\.com\/api-ws\/v1\/inference)$/,
};

function readKeys() {
  try {
    return parseEnv(fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error('无法读取本地 .env，请检查文件权限');
  }
}

function isManaged(config) {
  return Object.hasOwn(KEY_ENDPOINTS, config?.api_key);
}

function resolveKey(config, url) {
  if (!isManaged(config)) return config.api_key || '';
  const ref = config.api_key;
  if (!KEY_ENDPOINTS[ref].test(String(url))) throw new Error('本机密钥仅可用于所选服务的官方接口');
  const envName = ref.slice(4);
  const key = String(readKeys()[envName] || '').trim();
  if (!key) throw new Error(`请先在 backend-node/.env 中填入 ${envName}`);
  return key;
}

function generationKey(config, url, scope) {
  if (isManaged(config)) require('./productionApproval').requireApproval(scope);
  return resolveKey(config, url);
}

async function submitBailian(config, url, body, asynchronous = false) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + generationKey(config, url, asynchronous ? 'video' : 'image'),
      'Content-Type': 'application/json',
      ...(asynchronous ? { 'X-DashScope-Async': 'enable' } : {}),
    },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.code) {
    const code = /^[A-Za-z0-9._-]{1,80}$/.test(data?.code || '') ? ' · ' + data.code : '';
    throw new Error(`百炼请求失败（HTTP ${response.status}${code}）。请检查模型权限、额度和输入素材。`);
  }
  return data;
}

function resolveReference(value, storageRoot) {
  const ref = String(value || '').trim();
  if (!ref) return null;
  if (/^asset:\/\/[\w-]+$/.test(ref) || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ref)) return ref;
  let relative = ref;
  if (/^https?:\/\//i.test(ref)) {
    const url = new URL(ref);
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('参考图需使用无登录信息的 HTTPS 地址');
      return url.href;
    }
    if (!url.pathname.startsWith('/static/')) throw new Error('请选择工作台素材库中的参考图');
    relative = decodeURIComponent(url.pathname.slice(8));
  } else {
    relative = ref.replace(/^\/?static\//i, '');
  }
  if (!storageRoot) throw new Error('缺少本机素材目录');
  const root = fs.realpathSync(storageRoot);
  const candidate = path.resolve(root, relative);
  const isInside = (name) => {
    const rel = path.relative(root, name);
    return rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
  };
  if (!isInside(candidate)) throw new Error('参考图须位于此项目素材目录');
  const file = fs.realpathSync(candidate);
  const type = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' }[path.extname(file).toLowerCase()];
  if (!isInside(file) || !type || !fs.statSync(file).isFile()) throw new Error('请选用 PNG、JPEG 或 WebP 参考图');
  return `data:image/${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

function profileStatus(db) {
  const { listConfigs } = require('./aiConfigService');
  const keys = readKeys();
  const configs = listConfigs(db);
  const videoConfig = require('./videoClient').getDefaultVideoConfig(db);
  const isActive = (type, p, key) => configs.some(c => c.service_type === type &&
    c.base_url === p.base_url && (p.models || [p.model]).includes(c.default_model) &&
    c.api_key === key && c.is_default && c.is_active);
  return {
    byteplus_key: Boolean(keys.BYTEPLUS_ARK_API_KEY?.trim()),
    minimax_key: Boolean(keys.MINIMAX_API_KEY?.trim()),
    bailian_key: Boolean(keys.DASHSCOPE_API_KEY?.trim()),
    active: Object.fromEntries(Object.entries(PROFILES).map(([type, p]) =>
      [type, isActive(type, p, type === 'tts' ? MINIMAX_REF : BYTEPLUS_REF)])),
    bailian_active: Object.fromEntries(Object.entries(BAILIAN_PROFILES).map(([type, p]) => [type, isActive(type, p, BAILIAN_REF)])),
    video_duration_limits: videoDurationLimits(videoConfig),
  };
}

function activateProfiles(db, log, selection) {
  const bailian = selection.provider === 'bailian';
  const { listConfigs, createConfig, updateConfig } = require('./aiConfigService');
  const types = ['text', 'image', 'video', 'tts'].filter(type => selection[type] === true);
  if (!types.length) throw new Error('请选择要接入的服务');
  if (types.includes('image')) types.push('storyboard_image');
  const configs = listConfigs(db);
  const wanted = types.map(type => {
    const p = (bailian ? BAILIAN_PROFILES : PROFILES)[type];
    const config = {
      ...p, service_type: type, model: p.models || [p.model], default_model: p.model,
      api_key: bailian ? BAILIAN_REF : type === 'tts' ? MINIMAX_REF : BYTEPLUS_REF, is_default: true, is_active: true,
    };
    resolveKey(config, p.base_url + p.endpoint);
    return config;
  });
  db.transaction(() => {
    for (const config of wanted) {
      const previous = configs.find(c => c.service_type === config.service_type && c.api_key === config.api_key && c.base_url === config.base_url);
      if (previous) updateConfig(db, log, previous.id, config);
      else createConfig(db, log, config);
    }
  })();
  return profileStatus(db);
}

module.exports = { ARK, BYTEPLUS_REF, MINIMAX_REF, BAILIAN_REF, PROFILES, BAILIAN_PROFILES,
  isManaged, resolveKey, generationKey, resolveReference, submitBailian, profileStatus, activateProfiles, videoDurationLimits };
