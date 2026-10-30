'use strict';

const querystring = require('querystring');
const { Signer } = require('@volcengine/openapi');

const ALLOWED_ACTIONS = new Set([
  'CreateAssetGroup',
  'CreateAsset',
  'ListAssetGroups',
  'ListAssets',
  'GetAsset',
  'GetAssetGroup',
  'UpdateAssetGroup',
  'UpdateAsset',
  'DeleteAsset',
  'DeleteAssetGroup',
]);

function normalizeBaseUrl(raw) {
  let s = String(raw || '').trim().replace(/\/$/, '');
  if (!s) throw new Error('缺少 base_url');
  if (!/^https?:\/\//i.test(s)) throw new Error('base_url 须以 http:// 或 https:// 开头');
  return s;
}

/**
 * 仅主机、无路径时补全 /api/v3，与控制台 OpenAPI 一致；否则 IAM/路由可能不按预期解析 ProjectName。
 */
function ensureArkOpenApiBasePath(raw) {
  const s0 = String(raw || '').trim();
  if (!s0) return s0;
  let u;
  try {
    u = new URL(s0.replace(/\/+$/, ''));
  } catch {
    return s0;
  }
  const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
  const host = (u.host || '').toLowerCase();
  const looksArk =
    /(^|\.)ark\./.test(host) ||
    host.includes('byteplus') ||
    host.includes('volces.com');
  if (looksArk && (path === '' || path === '/')) {
    u.pathname = '/api/v3';
    return u.toString().replace(/\/+$/, '');
  }
  return s0.replace(/\/+$/, '');
}

function normalizeBearerToken(raw) {
  let k = String(raw || '').trim();
  if (!k) return '';
  if (/^bearer\s+/i.test(k)) k = k.replace(/^bearer\s+/i, '').trim();
  return k;
}

function inferSignRegion(host, explicit) {
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  const h = String(host || '').toLowerCase();
  if (h.includes('bytepluses') || h.includes('byteplus')) return 'ap-southeast-1';
  if (h.includes('ap-southeast')) return 'ap-southeast-1';
  if (h.includes('cn-beijing') || h.includes('volces.com')) return 'cn-beijing';
  return 'cn-beijing';
}

/**
 * 转发 ModelArk / 方舟「私有资产库」请求。
 *
 * - open_api_query：POST {base}?Action=…&Version=…，JSON body。
 *   控制面接口须使用 **auth_mode: volc_sign**（Access Key 签名），推理用的 ARK API Key + Bearer 会报 Invalid Authorization。
 * - asset_subpath / flat：部分中转仍可用 Bearer。
 */
function buildRequestUrl(base, pathMode, act, apiVersion, projectName) {
  const ver = (apiVersion || '2024-01-01').toString().trim() || '2024-01-01';
  if (pathMode === 'flat') {
    return `${base}/${encodeURIComponent(act)}`;
  }
  if (pathMode === 'asset_subpath') {
    return `${base}/asset/${encodeURIComponent(act)}`;
  }
  let u;
  try {
    u = new URL(base);
  } catch (e) {
    throw new Error('base_url 不是合法 URL');
  }
  u.searchParams.set('Action', act);
  u.searchParams.set('Version', ver);
  const pn = (projectName || '').toString().trim();
  if (pn) u.searchParams.set('ProjectName', pn);
  return u.toString();
}

function extractUpstreamMessage(data, text) {
  const m =
    data &&
    data.ResponseMetadata &&
    data.ResponseMetadata.Error &&
    data.ResponseMetadata.Error.Message;
  if (m) return String(m);
  if (data && data.message) return String(data.message);
  if (data && data.Message) return String(data.Message);
  return `HTTP 错误: ${text ? text.slice(0, 500) : ''}`;
}

function parseSignedOpenApiUrl(base) {
  const u = new URL(base);
  const protocol = u.protocol || 'https:';
  const host = u.host;
  let pathname = u.pathname || '/';
  if (!pathname || pathname === '') pathname = '/';
  return { protocol, host, pathname };
}

async function fetchSignedOpenApi({
  base,
  action,
  apiVersion,
  bodyObj,
  accessKeyId,
  secretKey,
  sessionToken,
  signRegion,
  signService,
  projectName,
}) {
  const ver = (apiVersion || '2024-01-01').toString().trim() || '2024-01-01';
  const { protocol, host, pathname } = parseSignedOpenApiUrl(base);
  const bodyStr = JSON.stringify(bodyObj && typeof bodyObj === 'object' ? bodyObj : {});

  const params = { Action: action, Version: ver };
  const pn = (projectName || '').toString().trim();
  if (pn) params.ProjectName = pn;

  const request = {
    region: inferSignRegion(host, signRegion),
    method: 'POST',
    pathname,
    params,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: bodyStr,
  };

  const signer = new Signer(request, (signService || 'ark').toString().trim() || 'ark');
  signer.addAuthorization({
    accessKeyId: accessKeyId.trim(),
    secretKey: secretKey.trim(),
    sessionToken: (sessionToken || '').trim(),
  });

  const qs = querystring.stringify(request.params);
  const url = `${protocol}//${host}${pathname}?${qs}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: request.headers,
    body: bodyStr,
    redirect: 'manual',
  });
  return res;
}

async function fetchBearer(url, method, token, bodyObj) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const init = {
    method: String(method || 'POST').toUpperCase(),
    headers,
    redirect: 'manual',
  };
  if (init.method !== 'GET' && init.method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(bodyObj && typeof bodyObj === 'object' ? bodyObj : {});
  }
  return fetch(url, init);
}

async function callModelArkAsset(opts, log) {
  const {
    base_url,
    api_key,
    action,
    body,
    path_mode,
    http_method,
    api_version,
    auth_mode,
    access_key_id,
    secret_access_key,
    sign_region,
    sign_service,
    session_token,
    project_name,
  } = opts;

  if (!action || typeof action !== 'string') throw new Error('缺少 action');
  const act = action.trim();
  if (!ALLOWED_ACTIONS.has(act)) throw new Error('不支持的 action: ' + act);

  const base = normalizeBaseUrl(ensureArkOpenApiBasePath(base_url));
  const pathMode = (path_mode || 'open_api_query').toString();
  const modeAuth = (auth_mode || 'bearer').toString();

  const method = String(http_method || 'POST').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    throw new Error('不支持的 http_method');
  }

  const pnScope = (project_name || '').toString().trim();
  let bodyObj = body && typeof body === 'object' ? { ...body } : {};
  if (pnScope && (bodyObj.ProjectName === undefined || bodyObj.ProjectName === null)) {
    bodyObj.ProjectName = pnScope;
  }
  let res;

  if (modeAuth === 'volc_sign') {
    const ak = String(access_key_id || '').trim();
    const sk = String(secret_access_key || '').trim();
    if (!ak || !sk) {
      throw new Error('控制面 OpenAPI 须填写 Access Key ID 与 Secret Access Key（控制台 IAM 密钥，非推理 API Key）');
    }
    if (pathMode !== 'open_api_query') {
      throw new Error('AK/SK 签名仅支持与「官方 OpenAPI」路径模式（Query 中带 Action）一起使用');
    }
    res = await fetchSignedOpenApi({
      base,
      action: act,
      apiVersion: api_version,
      bodyObj,
      accessKeyId: ak,
      secretKey: sk,
      sessionToken: session_token,
      signRegion: sign_region,
      signService: sign_service,
      projectName: pnScope,
    });
  } else {
    const token = normalizeBearerToken(api_key);
    if (!token) throw new Error('缺少 api_key');
    const url = buildRequestUrl(base, pathMode, act, api_version, pnScope);
    res = await fetchBearer(url, method, token, bodyObj);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { _raw: text };
  }
  if (!res.ok) {
    const msg = extractUpstreamMessage(data, text) || `HTTP ${res.status}`;
    const err = new Error(String(msg).slice(0, 2000));
    err.status = res.status;
    err.payload = data;
    if (log) log.warn('modelArkAsset proxy upstream error', { action: act, status: res.status });
    throw err;
  }
  return data;
}

module.exports = {
  callModelArkAsset,
  ALLOWED_ACTIONS,
};
