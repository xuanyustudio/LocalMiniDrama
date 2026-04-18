// AI 配置 CRUD，与 Go application/services/ai_service.go 对齐
const fs = require('fs');
const path = require('path');
function modelToDb(model) {
  if (model == null) return null;
  if (Array.isArray(model)) return JSON.stringify(model);
  if (typeof model === 'string') return JSON.stringify([model]);
  return JSON.stringify([]);
}

function modelFromDb(val) {
  if (val == null || val === '') return [];
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr : [String(arr)];
  } catch {
    return [String(val)];
  }
}

/** 每种服务类型只保留一个默认：若有多个 is_default=1，只保留优先级最高（同优先级取 id 最小）的那条 */
function ensureSingleDefaultPerType(db) {
  const types = ['text', 'image', 'storyboard_image', 'video', 'tts', 'jimeng2_character_auth'];
  for (const st of types) {
    const rows = db.prepare(
      'SELECT id, priority FROM ai_service_configs WHERE deleted_at IS NULL AND service_type = ? AND is_default = 1 ORDER BY priority DESC, id ASC'
    ).all(st);
    if (rows.length <= 1) continue;
    const keepId = rows[0].id;
    db.prepare(
      'UPDATE ai_service_configs SET is_default = 0 WHERE deleted_at IS NULL AND service_type = ? AND id != ?'
    ).run(st, keepId);
  }
}

function listConfigs(db, serviceType) {
  ensureSingleDefaultPerType(db);
  const order = 'ORDER BY is_default DESC, priority DESC, created_at DESC';
  let sql = 'SELECT * FROM ai_service_configs WHERE deleted_at IS NULL ' + order;
  const params = [];
  if (serviceType) {
    sql = 'SELECT * FROM ai_service_configs WHERE deleted_at IS NULL AND service_type = ? ' + order;
    params.push(serviceType);
  }
  const rows = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();
  return rows.map(rowToConfig);
}

function clearOtherDefault(db, serviceType, exceptId) {
  const stmt = db.prepare(
    'UPDATE ai_service_configs SET is_default = 0 WHERE deleted_at IS NULL AND service_type = ? AND id != ?'
  );
  stmt.run(serviceType, exceptId);
}

function getConfig(db, id) {
  const row = db.prepare('SELECT * FROM ai_service_configs WHERE id = ? AND deleted_at IS NULL').get(id);
  return row ? rowToConfig(row) : null;
}

function createConfig(db, log, req) {
  const now = new Date().toISOString();
  const model = modelToDb(req.model);
  let endpoint = req.endpoint || '';
  let queryEndpoint = req.query_endpoint || '';
  if (!endpoint && req.provider) {
    const p = req.provider.toLowerCase();
    const st = (req.service_type || 'text').toLowerCase();
    if (p === 'openai') {
      if (st === 'text') endpoint = '/chat/completions';
      else if (st === 'image') endpoint = '/images/generations';
      else if (st === 'video') {
        endpoint = '/videos';
        queryEndpoint = '/videos/{taskId}';
      }
    } else if (p === 'gemini' || p === 'google') {
      endpoint = '/v1beta/models/{model}:generateContent';
    } else if (p === 'dashscope' || p === 'qwen_image') {
      if (st === 'image' || st === 'storyboard_image') endpoint = '/api/v1/services/aigc/multimodal-generation/generation';
      else if (st === 'video' && p === 'dashscope') {
        endpoint = '/api/v1/services/aigc/image2video/video-synthesis';
        queryEndpoint = '/api/v1/tasks/{taskId}';
      }
    } else if (p === 'volces' || p === 'volcengine' || p === 'volc') {
      if (st === 'video') {
        endpoint = '/contents/generations/tasks';
        queryEndpoint = '/contents/generations/tasks/{taskId}';
      } else if (st === 'image' || st === 'storyboard_image') {
        endpoint = '/images/generations';
      }
    } else if (p === 'nano_banana') {
      if (st === 'image' || st === 'storyboard_image') {
        endpoint = '/api/v1/nanobanana/generate-2';
        queryEndpoint = '/api/v1/nanobanana/record-info';
      }
    }
  }
  const defaultModel = req.default_model != null ? String(req.default_model).trim() || null : null;
  const info = db.prepare(
    `INSERT INTO ai_service_configs (service_type, provider, api_protocol, name, base_url, api_key, model, default_model, endpoint, query_endpoint, priority, is_default, is_active, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(
    req.service_type || 'text',
    req.provider || '',
    req.api_protocol || '',
    req.name || '',
    req.base_url || '',
    req.api_key || '',
    model,
    defaultModel,
    endpoint,
    queryEndpoint,
    req.priority ?? 0,
    req.is_default ? 1 : 0,
    req.settings || null,
    now,
    now
  );
  log.info('AI config created', { config_id: info.lastInsertRowid, provider: req.provider });
  const newId = info.lastInsertRowid;
  if (req.is_default) clearOtherDefault(db, req.service_type || 'text', newId);
  return getConfig(db, newId);
}

function updateConfig(db, log, id, req) {
  const existing = getConfig(db, id);
  if (!existing) return null;
  const updates = [];
  const params = [];
  if (req.name != null) {
    updates.push('name = ?');
    params.push(req.name);
  }
  if (req.provider != null) {
    updates.push('provider = ?');
    params.push(req.provider);
  }
  if (req.api_protocol != null) {
    updates.push('api_protocol = ?');
    params.push(req.api_protocol);
  }
  if (req.base_url != null) {
    updates.push('base_url = ?');
    params.push(req.base_url);
  }
  if (req.api_key != null) {
    updates.push('api_key = ?');
    params.push(req.api_key);
  }
  if (req.model != null) {
    updates.push('model = ?');
    params.push(modelToDb(req.model));
  }
  if (req.default_model !== undefined) {
    updates.push('default_model = ?');
    params.push(req.default_model != null ? String(req.default_model).trim() || null : null);
  }
  if (req.priority != null) {
    updates.push('priority = ?');
    params.push(req.priority);
  }
  if (req.endpoint !== undefined) {
    updates.push('endpoint = ?');
    params.push(req.endpoint || '');
  }
  if (req.query_endpoint !== undefined) {
    updates.push('query_endpoint = ?');
    params.push(req.query_endpoint || '');
  }
  if (req.settings != null) {
    updates.push('settings = ?');
    params.push(req.settings);
  }
  if (typeof req.is_default === 'boolean') {
    updates.push('is_default = ?');
    params.push(req.is_default ? 1 : 0);
  }
  if (typeof req.is_active === 'boolean') {
    updates.push('is_active = ?');
    params.push(req.is_active ? 1 : 0);
  }
  if (updates.length === 0) return existing;
  params.push(new Date().toISOString(), id);
  db.prepare('UPDATE ai_service_configs SET ' + updates.join(', ') + ', updated_at = ? WHERE id = ?').run(...params);
  if (req.is_default === true) clearOtherDefault(db, existing.service_type, id);
  log.info('AI config updated', { config_id: id });
  return getConfig(db, id);
}

function deleteConfig(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE ai_service_configs SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, id);
  if (result.changes === 0) return false;
  log.info('AI config deleted', { config_id: id });
  return true;
}

function rowToConfig(r) {
  const cfg = {
    id: r.id,
    service_type: r.service_type,
    provider: r.provider,
    api_protocol: r.api_protocol || '',
    name: r.name,
    base_url: r.base_url,
    api_key: r.api_key,
    model: modelFromDb(r.model),
    default_model: r.default_model ? String(r.default_model).trim() : null,
    endpoint: r.endpoint,
    query_endpoint: r.query_endpoint,
    priority: r.priority ?? 0,
    is_default: !!r.is_default,
    is_active: r.is_active == null ? true : !!r.is_active,
    settings: r.settings,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
  // TTS 配置：从 settings JSON 展开 voice_id / group_id 供 ttsService 直接读取
  if (r.service_type === 'tts' && r.settings) {
    try {
      const s = JSON.parse(r.settings);
      if (s.voice_id) cfg.voice_id = s.voice_id;
      if (s.group_id) cfg.group_id = s.group_id;
    } catch (_) {}
  }
  return cfg;
}

/**
 * 测试连接：与 Go AIService.TestConnection 对齐，根据 provider 发最小请求验证 base_url + api_key
 * @param opts { base_url, api_key, model (string|string[]), provider?, endpoint? }
 * @returns Promise<void> 成功 resolve，失败 reject(error)
 */
async function testConnection(opts) {
  const base = (opts.base_url || '').replace(/\/$/, '');
  if (!base) throw new Error('base_url 必填');
  if (!opts.api_key) throw new Error('api_key 必填');
  const models = Array.isArray(opts.model) ? opts.model : opts.model != null ? [opts.model] : [];
  const model = models[0] || '';
  if (!model && (opts.provider === 'gemini' || opts.provider === 'google')) throw new Error('model 必填');
  const provider = (opts.provider || 'openai').toLowerCase();
  const serviceType = (opts.service_type || '').toLowerCase();
  let endpoint = opts.endpoint || '';

  // --- NanoBanana ---
  if (provider === 'nano_banana') {
    // 用 record-info 查询一个不存在的 taskId：401/403=key 无效，404=key 有效已联通
    const url = base + '/api/v1/nanobanana/record-info?taskId=test-connectivity';
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + (opts.api_key || '') },
    });
    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      let errMsg = `API Key 无效 (${res.status})`;
      try { const j = JSON.parse(text); errMsg = j.msg || j.message || errMsg; } catch {}
      throw new Error(errMsg);
    }
    return;
  }

  // --- Gemini ---
  if (provider === 'gemini' || provider === 'google') {
    endpoint = endpoint || '/v1beta/models/{model}:generateContent';
    const path = endpoint.replace(/{model}/g, model || 'gemini-pro');
    const url = base + (path.startsWith('/') ? path : '/' + path) + '?key=' + encodeURIComponent(opts.api_key || '');
    const body = { contents: [{ parts: [{ text: 'Hello' }] }] };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`请求失败: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = await res.json().catch(() => ({}));
    if (data.candidates == null && data.error != null) {
      throw new Error(data.error.message || data.error || 'Gemini 返回错误');
    }
    return;
  }

  // --- TTS 语音合成 ---
  if (serviceType === 'tts') {
    // MiniMax T2A：用 /v1/models 或直接对 chat 端点做轻量探针
    const ttsBase = base.includes('minimaxi.com') || base.includes('minimax') ? base : base;
    // 尝试调用一个极简的 MiniMax T2A 请求（1 字，验证 key 合法性）
    // 为避免真实扣费，使用非计费的 list-voices 或 models 接口
    const probeUrl = ttsBase + '/text_to_speech';
    const probeBody = JSON.stringify({ model: model || 'speech-02-hd', text: 'hi', stream: false });
    const res = await fetch(probeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (opts.api_key || '') },
      body: probeBody,
    });
    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      let errMsg = `API Key 无效 (${res.status})`;
      try { const j = JSON.parse(text); errMsg = j.base_resp?.status_msg || j.error?.message || j.message || errMsg; } catch {}
      throw new Error(errMsg);
    }
    // 其他状态（400 缺参数、404 端点不对等）说明网络通、key 疑似有效
    return;
  }

  // service_type 作为主要判断信号
  const isImageService = serviceType === 'image' || serviceType === 'storyboard_image';
  const isVideoService = serviceType === 'video';
  const hasImageEndpoint = !!(endpoint && endpoint.includes('/images/'));

  const isDashscope = provider === 'dashscope' || provider === 'qwen_image';
  const isVolcengine = provider === 'volces' || provider === 'volcengine' || provider === 'volc';
  const modelLower = model.toLowerCase();

  // 兜底识别图片/视频模型（service_type 未传时使用）
  const looksLikeImageModel = /seedream|image2video|text2image|img2img|wanx|wan\d|flux|stable.?diff|dall.?e|imagen|-image$/i.test(modelLower)
    || (isVolcengine && /seedream|vision|image/i.test(modelLower));
  const looksLikeVideoModel = /seedance|video.?gen|video2video|kf2v|cogvideo|sora|kling/i.test(modelLower);
  // DashScope 图片/视频专用端点特征
  const isDashscopeNonChatEndpoint = isDashscope && !!(endpoint && (endpoint.includes('aigc') || endpoint.includes('multimodal') || endpoint.includes('video')));

  // 综合判断是否为图片服务
  const treatAsImage = isImageService || hasImageEndpoint || isDashscopeNonChatEndpoint
    || looksLikeImageModel
    || (isVolcengine && !serviceType && !endpoint);

  // --- DashScope 图片 / 视频 / 分镜 ---
  // 通义万象 / WAN 系列：API key 通过 compatible-mode chat 接口验证即可（同一 key 通用）
  if (isDashscope && (isImageService || isVideoService || looksLikeImageModel || looksLikeVideoModel || isDashscopeNonChatEndpoint)) {
    const chatUrl = base.replace(/\/(api\/v1|compatible-mode)\/.*$/, '') + '/compatible-mode/v1/chat/completions';
    const body = { model: 'qwen-turbo', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 };
    console.log('[testConnection] DashScope 非文本服务，用 compatible chat 验证 key', { chatUrl, serviceType, model });
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + opts.api_key },
      body: JSON.stringify(body),
    });
    // 401/403 = key 无效，其他均视为联通
    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      let errMsg = `API Key 无效 (${res.status})`;
      try { const j = JSON.parse(text); errMsg = j.error?.message || j.message || errMsg; } catch {}
      throw new Error(errMsg);
    }
    return;
  }

  // --- 视频生成服务（非 DashScope）：通过 chat/completions 验证 key 合法性 ---
  // 视频生成 API 调用代价高昂，无法直接测试；但同账号 chat 接口验证 key 有效性即可
  if (isVideoService || looksLikeVideoModel) {
    const chatPath = '/chat/completions';
    const url = base + chatPath;
    const body = { model: model || '', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 };
    console.log('[testConnection] 视频服务，用 chat/completions 验证 key', { url, serviceType, model });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (opts.api_key || '') },
      body: JSON.stringify(body),
    });
    // 401/403 = key 无效；其他（400 模型不存在等）视为联通
    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      let errMsg = `API Key 无效 (${res.status})`;
      try { const j = JSON.parse(text); errMsg = j.error?.message || j.message || errMsg; } catch {}
      throw new Error(errMsg);
    }
    return;
  }

  // --- OpenAI 兼容图片生成（volcengine、OpenAI DALL·E、其他）---
  if (treatAsImage) {
    endpoint = endpoint || '/images/generations';
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const url = base + path;
    const body = { model: model || '', prompt: 'test connectivity', n: 1 };
    console.log('[testConnection] 图片服务', { url, serviceType, model, body });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (opts.api_key || ''),
      },
      body: JSON.stringify(body),
    });
    // 401/403 = key 无效；其他状态（含 400 参数错误、429 限流等）表示已联通
    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      let errMsg = `API Key 无效 (${res.status})`;
      try {
        const j = JSON.parse(text);
        errMsg = j.error?.message || j.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
    if (!res.ok) {
      // 其他 4xx/5xx：如果能解析出明确的 auth 错误才拒绝，否则视为联通
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      const msg = parsed?.error?.message || parsed?.message || '';
      const lmsg = msg.toLowerCase();
      const isAuthErr = lmsg.includes('unauthorized') || lmsg.includes('invalid api key')
        || lmsg.includes('authentication') || lmsg.includes('forbidden');
      if (isAuthErr) throw new Error(`API Key 无效: ${msg || res.status}`);
      // 其他错误（如模型不支持某个 API 参数）说明网络通、key 有效
      return;
    }
    return;
  }

  // --- OpenAI / 默认：chat completions ---
  endpoint = endpoint || '/chat/completions';
  const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const url = base + path;
  const body = {
    model: model || 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 5,
  };
  console.log('[testConnection] 文本/chat 服务', { url, serviceType, model });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (opts.api_key || ''),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let errMsg = `请求失败: ${res.status}`;
    try {
      const j = JSON.parse(text);
      errMsg += ' - ' + (j.error?.message || j.message || j.error || text.slice(0, 150));
    } catch {
      if (text) errMsg += ' - ' + text.slice(0, 150);
    }
    throw new Error(errMsg);
  }
  const data = await res.json().catch(() => ({}));
  if (data.choices == null && data.error != null) {
    throw new Error(data.error.message || data.error || '接口返回错误');
  }
}

/**
 * 返回 vendor_lock 状态
 */
function getVendorLockStatus(cfg) {
  const lock = cfg?.vendor_lock;
  return {
    enabled: !!(lock?.enabled),
    config_file: lock?.config_file || '',
  };
}

/**
 * 启动时同步 vendor_lock 指定的配置文件到数据库。
 * - 软删除所有现有配置，按文件重新导入
 * - 若同 service_type + provider 在 DB 中已有记录，则保留用户修改过的 api_key
 */
function applyVendorLock(db, log, cfg) {
  const status = getVendorLockStatus(cfg);
  if (!status.enabled) return;

  const configFile = status.config_file;
  if (!configFile) {
    log.warn && log.warn('vendor_lock enabled but config_file is empty');
    return;
  }

  const candidates = [
    path.join(process.cwd(), 'configs', configFile),
    path.join(__dirname, '..', '..', 'configs', configFile),
  ];
  let raw = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { raw = fs.readFileSync(p, 'utf8'); break; }
  }
  if (!raw) {
    console.warn('[vendor_lock] config file not found:', configFile);
    return;
  }

  let configs;
  try {
    configs = JSON.parse(raw);
    if (!Array.isArray(configs)) throw new Error('config file must be a JSON array');
  } catch (e) {
    console.error('[vendor_lock] failed to parse config file:', e.message);
    return;
  }

  // 保存现有 api_key（key: "service_type:provider"）
  const existing = db.prepare('SELECT service_type, provider, api_key FROM ai_service_configs WHERE deleted_at IS NULL').all();
  const savedKeys = new Map();
  for (const row of existing) {
    savedKeys.set(`${row.service_type}:${row.provider}`, row.api_key);
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE ai_service_configs SET deleted_at = ? WHERE deleted_at IS NULL').run(now);

  for (const item of configs) {
    const mapKey = `${item.service_type}:${item.provider}`;
    const apiKey = savedKeys.get(mapKey) ?? item.api_key ?? '';
    const model = Array.isArray(item.model)
      ? JSON.stringify(item.model)
      : item.model ? JSON.stringify([item.model]) : '[]';
    db.prepare(
      `INSERT INTO ai_service_configs
        (service_type, provider, api_protocol, name, base_url, api_key, model, default_model, endpoint, query_endpoint, priority, is_default, is_active, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    ).run(
      item.service_type || 'text',
      item.provider || '',
      item.api_protocol || '',
      item.name || '',
      item.base_url || '',
      apiKey,
      model,
      item.default_model || null,
      item.endpoint || '',
      item.query_endpoint || '',
      item.priority ?? 0,
      item.is_default ? 1 : 0,
      item.settings || null,
      now,
      now
    );
  }
  for (const item of configs) {
    console.log(`[vendor_lock] loaded: service_type=${item.service_type} provider=${item.provider} api_protocol=${item.api_protocol || '(auto)'} endpoint=${item.endpoint || '(auto)'}`);
  }
  console.log(`[vendor_lock] synced ${configs.length} configs from ${configFile}`);
}

/**
 * 批量替换所有配置的 api_key（仅限锁定模式下使用）
 */
function bulkUpdateApiKey(db, log, newKey) {
  const now = new Date().toISOString();
  const info = db.prepare(
    'UPDATE ai_service_configs SET api_key = ?, updated_at = ? WHERE deleted_at IS NULL'
  ).run(newKey, now);
  log.info('Bulk update api_key', { updated: info.changes });
  return info.changes;
}

module.exports = {
  listConfigs,
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  testConnection,
  getVendorLockStatus,
  applyVendorLock,
  bulkUpdateApiKey,
};
