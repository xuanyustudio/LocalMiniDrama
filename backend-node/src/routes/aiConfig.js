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

function create(db, log) {
  return (req, res) => {
    const body = req.body || {};
    if (!body.service_type || !body.name || !body.provider || !body.base_url || !body.api_key) {
      return response.badRequest(res, '缺少必填字段: service_type, name, provider, base_url, api_key');
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

function update(db, log) {
  return (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的配置ID');
    const config = aiConfigService.updateConfig(db, log, id, req.body || {});
    if (!config) return response.notFound(res, '配置不存在');
    response.success(res, config);
  };
}

function remove(db, log) {
  return (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的配置ID');
    const ok = aiConfigService.deleteConfig(db, log, id);
    if (!ok) return response.notFound(res, '配置不存在');
    response.success(res, { message: '删除成功' });
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
      });
      response.success(res, { message: '连接测试成功' });
    } catch (err) {
      log.error('AI config test connection failed', { error: err.message });
      response.badRequest(res, '连接测试失败: ' + (err.message || '未知错误'));
    }
  };
}

module.exports = function aiConfigRoutes(db, log) {
  return {
    list: list(db),
    get: get(db),
    create: create(db, log),
    update: update(db, log),
    delete: remove(db, log),
    testConnection: testConnection(log),
  };
};
