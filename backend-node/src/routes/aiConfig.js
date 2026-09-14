const aiConfigService = require('../services/aiConfigService');
const response = require('../response');

function publicConfig(config) {
  return aiConfigService.toPublicConfig(config);
}

function savedConfigContext(db, rawId) {
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) return { config: null, settings: {} };
  const config = aiConfigService.getConfig(db, id);
  return { config, settings: aiConfigService.parseSettingsObject(config?.settings) };
}

function list(db) {
  return (req, res) => {
    const list = aiConfigService.listConfigs(db, req.query.service_type);
    response.success(res, list.map(publicConfig));
  };
}

function get(db) {
  return (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的配置ID');
    const config = aiConfigService.getConfig(db, id);
    if (!config) return response.notFound(res, '配置不存在');
    response.success(res, publicConfig(config));
  };
}

function vendorLock(cfg) {
  return (req, res) => {
    const status = aiConfigService.getVendorLockStatus(cfg);
    response.success(res, status);
  };
}

function create(db, log, cfg) {
  return (req, res) => {
    if (aiConfigService.getVendorLockStatus(cfg).enabled) {
      return response.badRequest(res, '当前为厂商锁定模式，不允许添加配置');
    }
    const body = req.body || {};
    if (!body.service_type || !body.name || !body.provider || !body.base_url) {
      return response.badRequest(res, '缺少必填字段: service_type, name, provider, base_url');
    }
    if (body.api_key === undefined || body.api_key === null) {
      return response.badRequest(res, '缺少必填字段: api_key');
    }
    try {
      const config = aiConfigService.createConfig(db, log, {
        ...body,
        model: body.model ?? [],
      });
      response.created(res, publicConfig(config));
    } catch (err) {
      log.errorw('Create AI config failed', { error: err.message });
      response.internalError(res, '创建失败');
    }
  };
}

function update(db, log, cfg) {
  return (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的配置ID');

    let body = req.body || {};
    // 锁定模式下只允许修改 api_key、default_model、is_default
    if (aiConfigService.getVendorLockStatus(cfg).enabled) {
      const allowed = {};
      if (body.api_key !== undefined) allowed.api_key = body.api_key;
      if (body.default_model !== undefined) allowed.default_model = body.default_model;
      if (body.is_default !== undefined) allowed.is_default = body.is_default;
      body = allowed;
    }

    const config = aiConfigService.updateConfig(db, log, id, body);
    if (!config) return response.notFound(res, '配置不存在');
    response.success(res, publicConfig(config));
  };
}

function remove(db, log, cfg) {
  return (req, res) => {
    if (aiConfigService.getVendorLockStatus(cfg).enabled) {
      return response.badRequest(res, '当前为厂商锁定模式，不允许删除配置');
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的配置ID');
    const ok = aiConfigService.deleteConfig(db, log, id);
    if (!ok) return response.notFound(res, '配置不存在');
    response.success(res, { message: '删除成功' });
  };
}

function bulkUpdateKey(db, log, cfg) {
  return (req, res) => {
    if (!aiConfigService.getVendorLockStatus(cfg).enabled) {
      return response.badRequest(res, '批量换Key仅在厂商锁定模式下可用');
    }
    const { api_key } = req.body || {};
    if (!api_key || !api_key.trim()) {
      return response.badRequest(res, '请提供新的 API Key');
    }
    try {
      const count = aiConfigService.bulkUpdateApiKey(db, log, api_key.trim());
      response.success(res, { updated: count, message: `已更新 ${count} 条配置的 API Key` });
    } catch (err) {
      log.error('Bulk update api_key failed', { error: err.message });
      response.internalError(res, '批量换Key失败');
    }
  };
}

function testConnection(log) {
  return async (req, res) => {
    const body = req.body || {};
    if (!body.base_url || !body.api_key) {
      return response.badRequest(res, '缺少 base_url 或 api_key');
    }
    try {
      await aiConfigService.testConnection({
        base_url: body.base_url,
        api_key: body.api_key,
        model: body.model,
        provider: body.provider,
        endpoint: body.endpoint,
        service_type: body.service_type,
        settings: body.settings,
      });
      response.success(res, { message: '连接测试成功' });
    } catch (err) {
      log.error('AI config test connection failed', { error: err.message });
      response.badRequest(res, '连接测试失败: ' + (err.message || '未知错误'));
    }
  };
}

function testSavedConnection(db, log) {
  return async (req, res) => {
    const config = aiConfigService.getConfig(db, Number(req.params.id));
    if (!config) return response.notFound(res, '配置不存在');
    try {
      await aiConfigService.testConnection(config);
      response.success(res, { message: '连接测试成功' });
    } catch (err) {
      log.error('Saved AI config test connection failed', { id: req.params.id, error: err.message });
      response.badRequest(res, '连接测试失败: ' + (err.message || '未知错误'));
    }
  };
}

function refreshModels(db, log) {
  return async (req, res) => {
    try {
      const config = await aiConfigService.refreshRemoteModels(db, log, Number(req.params.id));
      response.success(res, publicConfig(config));
    } catch (err) {
      log.error('AI config refresh models failed', { id: req.params.id, error: err.message });
      response.badRequest(res, err.message || '读取模型列表失败');
    }
  };
}

/** ModelArk / 方舟私有资产库：代理调用 CreateAssetGroup、ListAssets 等（与官方 Action 名一致） */
function modelArkAsset(db, log) {
  return async (req, res) => {
    const body = req.body || {};
    const action = (body.action || '').toString().trim();
    const { config, settings } = savedConfigContext(db, body.config_id);
    try {
      const modelArkAssetProxyService = require('../services/modelArkAssetProxyService');
      const data = await modelArkAssetProxyService.callModelArkAsset(
        {
          base_url: body.base_url || config?.base_url,
          api_key: body.api_key || config?.api_key,
          action,
          body: body.payload,
          path_mode: body.path_mode || settings.path_mode,
          http_method: body.http_method,
          api_version: body.api_version || settings.api_version,
          auth_mode: body.auth_mode || settings.auth_mode,
          access_key_id: body.access_key_id || settings.access_key_id,
          secret_access_key: body.secret_access_key || settings.secret_access_key,
          sign_region: body.sign_region || settings.sign_region,
          sign_service: body.sign_service || settings.sign_service,
          session_token: body.session_token || settings.session_token,
          project_name: body.project_name || settings.project_name,
        },
        log
      );
      response.success(res, data);
    } catch (err) {
      log.error('model-ark-asset proxy failed', { error: err.message, action });
      const status = err.status >= 400 && err.status < 600 ? err.status : 400;
      return response.error(res, status, 'MODEL_ARK_ASSET', err.message || '请求失败', err.payload);
    }
  };
}

/** 即梦2角色认证：代理 GET 素材列表（表单未保存也可用当前填写的网关与 Token） */
function listJimeng2MaterialAssets(db, log) {
  return async (req, res) => {
    const body = req.body || {};
    const { config } = savedConfigContext(db, body.config_id);
    const base_url = (body.base_url || config?.base_url || '').toString().trim().replace(/\/$/, '');
    const { normalizeMaterialHubToken } = require('../services/jimengMaterialHubService');
    let api_key = normalizeMaterialHubToken(body.api_key || config?.api_key || '');
    if (!base_url || !api_key) {
      return response.badRequest(res, '请先填写网关 URL 与 Token');
    }
    const jimengMaterialHubService = require('../services/jimengMaterialHubService');
    const ctx = { baseUrl: base_url, token: api_key };
    const r = await jimengMaterialHubService.listAssets(ctx, { limit: body.limit, cursor: body.cursor }, log);
    if (!r.ok) {
      return response.badRequest(res, String(r.error || '列出素材失败').slice(0, 800));
    }
    response.success(res, r.data);
  };
}

module.exports = function aiConfigRoutes(db, log, cfg) {
  return {
    list: list(db),
    get: get(db),
    vendorLock: vendorLock(cfg),
    create: create(db, log, cfg),
    update: update(db, log, cfg),
    delete: remove(db, log, cfg),
    testConnection: testConnection(log),
    testSavedConnection: testSavedConnection(db, log),
    refreshModels: refreshModels(db, log),
    listJimeng2MaterialAssets: listJimeng2MaterialAssets(db, log),
    modelArkAsset: modelArkAsset(db, log),
    bulkUpdateKey: bulkUpdateKey(db, log, cfg),
  };
};
