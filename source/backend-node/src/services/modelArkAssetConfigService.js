'use strict';

const { callModelArkAsset } = require('./modelArkAssetProxyService');

function loadModelArkAssetRow(db) {
  if (!db) return null;
  try {
    return db
      .prepare(
        `SELECT id, name, base_url, api_key, settings FROM ai_service_configs
         WHERE deleted_at IS NULL AND service_type = ? AND is_active = 1
         ORDER BY is_default DESC, priority DESC, id ASC LIMIT 1`
      )
      .get('model_ark_asset');
  } catch (_) {
    return null;
  }
}

function parseSettingsJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

/**
 * @returns {{ ready: boolean, row?: object, settings?: object, callOpts?: object, assetGroupId?: string, diag?: object }}
 */
function buildModelArkContext(db, log) {
  const row = loadModelArkAssetRow(db);
  if (!row) {
    return { ready: false, diag: { db_model_ark_row_found: false } };
  }
  const settings = parseSettingsJson(row.settings);
  const authMode = (settings.auth_mode || 'volc_sign').toString();
  const baseUrl = (row.base_url || '').toString().trim();
  const assetGroupId = (settings.asset_group_id || '').toString().trim();

  const callOpts = {
    base_url: baseUrl,
    path_mode: settings.path_mode || 'open_api_query',
    api_version: settings.api_version || '2024-01-01',
    auth_mode: authMode,
    project_name: settings.project_name || undefined,
  };

  if (authMode === 'bearer') {
    callOpts.api_key = (row.api_key || '').toString().trim();
    if (!baseUrl || !callOpts.api_key) {
      return {
        ready: false,
        row,
        settings,
        diag: { db_model_ark_row_found: true, missing: 'base_url 或 api_key' },
      };
    }
  } else {
    callOpts.access_key_id = (settings.access_key_id || '').toString().trim();
    callOpts.secret_access_key = (settings.secret_access_key || '').toString().trim();
    if (settings.sign_region) callOpts.sign_region = settings.sign_region;
    if (!baseUrl || !callOpts.access_key_id || !callOpts.secret_access_key) {
      return {
        ready: false,
        row,
        settings,
        diag: { db_model_ark_row_found: true, missing: 'base_url 或 AK/SK' },
      };
    }
  }

  if (!assetGroupId) {
    return {
      ready: false,
      row,
      settings,
      callOpts,
      diag: { db_model_ark_row_found: true, missing: 'asset_group_id（默认资产组 Id）' },
    };
  }

  const diag = {
    db_model_ark_row_found: true,
    db_config_id: row.id,
    db_config_name: row.name,
    auth_mode: authMode,
    asset_group_id: assetGroupId,
  };
  if (log && typeof log.info === 'function') {
    log.info('[ModelArkAsset] buildModelArkContext', diag);
  }

  return {
    ready: true,
    row,
    settings,
    callOpts,
    assetGroupId,
    billingModel: (settings.billing_model || '').toString().trim(),
    diag,
  };
}

function pickId(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const id = obj.Id ?? obj.id ?? obj.AssetId ?? obj.asset_id;
  return id != null ? String(id).trim() : '';
}

function looksLikeAsset(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return !!pickId(obj);
}

/** 解析 CreateAsset / GetAsset 响应中的资产对象 */
function unwrapModelArkAssetView(payload, depth = 0) {
  if (depth > 6 || payload == null || typeof payload !== 'object') return null;
  if (looksLikeAsset(payload)) {
    const id = pickId(payload);
    const statusRaw = payload.Status ?? payload.status ?? payload.State ?? payload.state;
    const assetUrl = payload.AssetUrl ?? payload.asset_url ?? payload.Url ?? payload.url ?? null;
    return {
      id,
      name: payload.Name ?? payload.name ?? null,
      status: normalizeModelArkAssetStatus(statusRaw),
      asset_url: assetUrl,
      raw_status: statusRaw != null ? String(statusRaw) : null,
    };
  }
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = unwrapModelArkAssetView(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of ['Result', 'result', 'Asset', 'asset', 'Data', 'data', 'Item', 'item']) {
    if (payload[key] != null) {
      const found = unwrapModelArkAssetView(payload[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function normalizeModelArkAssetStatus(raw) {
  const st = String(raw || '').trim().toLowerCase();
  if (!st) return 'processing';
  if (['active', 'available', 'success', 'succeeded', 'ready', 'completed', 'complete', 'done'].includes(st)) {
    return 'active';
  }
  if (['failed', 'error', 'fail', 'invalid'].includes(st)) return 'failed';
  return 'processing';
}

function assetUrlForVideo(asset) {
  if (!asset) return null;
  const direct = String(asset.asset_url || '').trim();
  if (direct.startsWith('asset://')) return direct;
  if (direct.startsWith('asset-')) return `asset://${direct}`;
  const id = pickId(asset);
  if (!id) return null;
  if (id.startsWith('asset://')) return id;
  if (id.startsWith('asset-')) return `asset://${id}`;
  return `asset://${id.replace(/^\/+/, '')}`;
}

async function createImageAsset(ctx, params, log) {
  const { callOpts, assetGroupId, billingModel } = ctx;
  const name = String(params.name || 'role').replace(/\s+/g, '').slice(0, 32) || 'role';
  const payload = {
    GroupId: assetGroupId,
    Name: name,
    AssetType: 'Image',
    URL: params.url,
  };
  if (billingModel) payload.model = billingModel;

  let data;
  try {
    data = await callModelArkAsset({ ...callOpts, action: 'CreateAsset', body: payload }, log);
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 2000) };
  }

  const asset = unwrapModelArkAssetView(data);
  if (!asset?.id) {
    const keys = data && typeof data === 'object' ? Object.keys(data).join(', ') : typeof data;
    return { ok: false, error: `ModelArk 未返回资产 Id（响应字段：${keys || '空'}）` };
  }
  if (!asset.asset_url) asset.asset_url = assetUrlForVideo(asset);
  return { ok: true, data: asset };
}

async function getAsset(ctx, assetId, log) {
  const id = String(assetId || '').trim();
  if (!id) return { ok: false, error: '缺少 asset id' };
  let data;
  try {
    data = await callModelArkAsset({ ...ctx.callOpts, action: 'GetAsset', body: { Id: id } }, log);
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 2000) };
  }
  const asset = unwrapModelArkAssetView(data);
  if (asset?.id) {
    if (!asset.asset_url) asset.asset_url = assetUrlForVideo(asset);
    return { ok: true, data: asset };
  }
  return { ok: true, data: { id, status: 'processing', asset_url: assetUrlForVideo({ id }) } };
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
    const st = String(last?.status || '').toLowerCase();
    if (st === 'active' || st === 'failed') {
      return { ok: true, asset: last };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ok: true, asset: last, timedOut: true };
}

module.exports = {
  loadModelArkAssetRow,
  buildModelArkContext,
  parseSettingsJson,
  unwrapModelArkAssetView,
  normalizeModelArkAssetStatus,
  assetUrlForVideo,
  createImageAsset,
  getAsset,
  pollAssetUntilSettled,
};
