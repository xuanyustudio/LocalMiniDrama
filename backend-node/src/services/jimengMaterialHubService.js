'use strict';

/**
 * 即梦2角色认证 — 业务侧「素材管理」HTTP API（与官方路径一致，如 /api/business/v1/assets）。
 * 网关 URL 与 Token 从 AI 配置（service_type = jimeng2_character_auth）读取；可选兼容旧版 config 中的 jimeng_material_hub / silvamux_hub。
 * 参考：https://83zi.com/sd2realperson.html
 */

function loadAiJimeng2AuthRow(db) {
  if (!db) return null;
  try {
    return db
      .prepare(
        `SELECT base_url, api_key FROM ai_service_configs
         WHERE deleted_at IS NULL AND service_type = ? AND is_active = 1
         ORDER BY is_default DESC, priority DESC, id ASC LIMIT 1`
      )
      .get('jimeng2_character_auth');
  } catch (_) {
    return null;
  }
}

function legacyYamlHubSection(cfg) {
  return cfg?.jimeng_material_hub || cfg?.silvamux_hub || {};
}

/**
 * 解析即梦2角色认证调用上下文（供素材注册 API 使用）
 * @param {object} cfg - 应用 config.yaml
 * @param {object|null} db - better-sqlite3（可选，用于读 AI 配置表）
 * @returns {{ baseUrl: string, token: string, poll_max_ms?: number, poll_interval_ms?: number }}
 */
function buildHubContext(cfg, db) {
  const row = loadAiJimeng2AuthRow(db);
  let base_url = (row?.base_url || '').toString().trim();
  let token = (row?.api_key || '').toString().trim();
  let poll_max_ms;
  let poll_interval_ms;

  if (!base_url || !token) {
    const y = legacyYamlHubSection(cfg);
    if (!base_url) base_url = (y.base_url || '').toString().trim();
    if (!token) token = (y.token || '').toString().trim();
    if (poll_max_ms == null && y.poll_max_ms != null) poll_max_ms = Number(y.poll_max_ms);
    if (poll_interval_ms == null && y.poll_interval_ms != null) poll_interval_ms = Number(y.poll_interval_ms);
  }

  const baseUrl = (
    process.env.JIMENG2_CHARACTER_AUTH_URL ||
    base_url ||
    process.env.JIMENG_MATERIAL_HUB_BASE_URL ||
    process.env.SILVAMUX_HUB_BASE_URL ||
    'https://silvamux.tingyutech.com'
  )
    .toString()
    .trim()
    .replace(/\/$/, '');

  const tok = (
    process.env.JIMENG2_CHARACTER_AUTH_TOKEN ||
    token ||
    process.env.JIMENG_MATERIAL_HUB_TOKEN ||
    process.env.SILVAMUX_HUB_TOKEN ||
    process.env.HUB_TOKEN ||
    ''
  )
    .toString()
    .trim();

  return { baseUrl, token: tok, poll_max_ms, poll_interval_ms };
}

async function hubJson(path, ctx, { method, body, log } = {}) {
  const base = ctx.baseUrl;
  const token = ctx.token;
  if (!token) {
    return {
      ok: false,
      error:
        '未配置即梦2角色认证：请在「AI 配置」中添加类型为「即梦2角色认证」的一条配置，填写网关 URL 与 Token（或设置环境变量 JIMENG2_CHARACTER_AUTH_*；兼容旧 config / SILVAMUX_*）',
    };
  }
  const url = `${base}/api/business/v1${path}`;
  const init = {
    method: method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  };
  if (body != null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  if (log && typeof log.info === 'function' && method === 'POST' && path === '/assets' && body?.url) {
    log.info('[JimengMaterialHub] POST /api/business/v1/assets', {
      hub_gateway: base,
      register_image_url: body.url,
      asset_name: body.name,
      asset_type: body.asset_type,
    });
  }
  if (log && typeof log.info === 'function' && method === 'GET' && String(path || '').startsWith('/assets')) {
    log.info('[JimengMaterialHub] GET /api/business/v1/assets', {
      hub_gateway: base,
      path_query: String(path).includes('?') ? String(path).split('?')[1]?.slice(0, 120) : '',
    });
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = { _raw: text };
  }
  if (!res.ok) {
    const detail = json?.detail || json?.title || json?.message || text || res.statusText;
    const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
    if (log && typeof log.warn === 'function') {
      log.warn('[JimengMaterialHub] HTTP 错误', {
        path,
        method: method || 'GET',
        httpStatus: res.status,
        hub_gateway: base,
        register_image_url: body && body.url ? body.url : undefined,
        response_preview: detailStr.slice(0, 2000),
      });
    }
    return { ok: false, status: res.status, error: detailStr };
  }
  return { ok: true, data: json };
}

async function createImageAsset(ctx, params, log) {
  const name = String(params.name || 'c').replace(/\s+/g, '').slice(0, 12) || 'c';
  return hubJson('/assets', ctx, {
    method: 'POST',
    body: { url: params.url, asset_type: 'Image', name },
    log,
  });
}

/**
 * 列出组织下素材（分页）
 * @see https://83zi.com/sd2realperson.html
 */
async function listAssets(ctx, opts = {}, log) {
  const limitRaw = opts.limit != null ? Number(opts.limit) : 20;
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));
  const q = new URLSearchParams();
  q.set('limit', String(limit));
  if (opts.cursor) q.set('cursor', String(opts.cursor));
  const path = `/assets?${q.toString()}`;
  return hubJson(path, ctx, { method: 'GET', log });
}

async function getAsset(ctx, assetId, log) {
  const id = encodeURIComponent(String(assetId || '').trim());
  if (!id) return { ok: false, error: '缺少 asset id' };
  return hubJson(`/assets/${id}`, ctx, { method: 'GET', log });
}

async function pollAssetUntilSettled(ctx, assetId, options = {}) {
  const maxMs = options.maxMs ?? 120000;
  const intervalMs = options.intervalMs ?? 2000;
  const log = options.log;
  const deadline = Date.now() + maxMs;
  let last;
  while (Date.now() < deadline) {
    const r = await getAsset(ctx, assetId, log);
    if (!r.ok) return { ok: false, error: r.error };
    last = r.data;
    const st = (last && last.status) || '';
    if (st === 'active' || st === 'failed') {
      return { ok: true, asset: last };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ok: true, asset: last, timedOut: true };
}

function hubToken(cfg, db) {
  return buildHubContext(cfg, db).token;
}

module.exports = {
  buildHubContext,
  hubToken,
  createImageAsset,
  listAssets,
  getAsset,
  pollAssetUntilSettled,
};
