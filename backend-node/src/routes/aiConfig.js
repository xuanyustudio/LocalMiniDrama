const aiConfigService = require('../services/aiConfigService');
const response = require('../response');

function list(db) {
  return (req, res) => {
    const list = aiConfigService.listConfigs(db, req.query.service_type);
    response.success(res, list);
  };
}

function get(db) {
  return (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的配置ID');
    const config = aiConfigService.getConfig(db, id);
    if (!config) return response.notFound(res, '配置不存在');
    response.success(res, config);
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
      response.created(res, config);
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
    response.success(res, config);
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
      });
      response.success(res, { message: '连接测试成功' });
    } catch (err) {
      log.error('AI config test connection failed', { error: err.message });
      response.badRequest(res, '连接测试失败: ' + (err.message || '未知错误'));
    }
  };
}

/** 即梦2角色认证：代理 GET 素材列表（表单未保存也可用当前填写的网关与 Token） */
function listJimeng2MaterialAssets(log) {
  return async (req, res) => {
    const body = req.body || {};
    const base_url = (body.base_url || '').toString().trim().replace(/\/$/, '');
    let api_key = (body.api_key || '').toString().trim();
    if (/^bearer\s+/i.test(api_key)) api_key = api_key.replace(/^bearer\s+/i, '').trim();
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
    listJimeng2MaterialAssets: listJimeng2MaterialAssets(log),
    bulkUpdateKey: bulkUpdateKey(db, log, cfg),
  };
};
