const response = require('../response');

function list(db, log) {
  return (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM ai_model_map ORDER BY key').all();
      response.success(res, rows);
    } catch (err) {
      log.error('List scene model map failed', { error: err.message });
      response.internalError(res, '获取场景模型映射失败');
    }
  };
}

function get(db, log) {
  return (req, res) => {
    const { key } = req.params;
    try {
      const row = db.prepare('SELECT * FROM ai_model_map WHERE key = ?').get(key);
      if (!row) {
        return response.notFound(res, '场景模型映射不存在');
      }
      response.success(res, row);
    } catch (err) {
      log.error('Get scene model map failed', { error: err.message, key });
      response.internalError(res, '获取场景模型映射失败');
    }
  };
}

function create(db, log) {
  return (req, res) => {
    const body = req.body || {};
    const { key, service_type = 'text', config_id, model_override, description } = body;
    
    if (!key) {
      return response.badRequest(res, '缺少必填字段: key');
    }
    
    const now = new Date().toISOString();
    try {
      // 检查 key 是否已存在
      const existing = db.prepare('SELECT id FROM ai_model_map WHERE key = ?').get(key);
      if (existing) {
        return response.badRequest(res, '场景键已存在');
      }
      
      const result = db.prepare(`
        INSERT INTO ai_model_map (key, service_type, config_id, model_override, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(key, service_type, config_id || null, model_override || null, description || '', now, now);
      
      const row = db.prepare('SELECT * FROM ai_model_map WHERE id = ?').get(result.lastInsertRowid);
      response.created(res, row);
    } catch (err) {
      log.error('Create scene model map failed', { error: err.message, key });
      response.internalError(res, '创建场景模型映射失败');
    }
  };
}

function update(db, log) {
  return (req, res) => {
    const { key } = req.params;
    const body = req.body || {};
    const { service_type, config_id, model_override, description } = body;
    
    const now = new Date().toISOString();
    try {
      const existing = db.prepare('SELECT id FROM ai_model_map WHERE key = ?').get(key);
      if (!existing) {
        return response.notFound(res, '场景模型映射不存在');
      }
      
      db.prepare(`
        UPDATE ai_model_map 
        SET service_type = ?, config_id = ?, model_override = ?, description = ?, updated_at = ?
        WHERE key = ?
      `).run(
        service_type || 'text',
        config_id !== undefined ? config_id : null,
        model_override !== undefined ? model_override : null,
        description !== undefined ? description : '',
        now,
        key
      );
      
      const row = db.prepare('SELECT * FROM ai_model_map WHERE key = ?').get(key);
      response.success(res, row);
    } catch (err) {
      log.error('Update scene model map failed', { error: err.message, key });
      response.internalError(res, '更新场景模型映射失败');
    }
  };
}

function remove(db, log) {
  return (req, res) => {
    const { key } = req.params;
    try {
      const existing = db.prepare('SELECT id FROM ai_model_map WHERE key = ?').get(key);
      if (!existing) {
        return response.notFound(res, '场景模型映射不存在');
      }
      
      db.prepare('DELETE FROM ai_model_map WHERE key = ?').run(key);
      response.success(res, { message: '删除成功' });
    } catch (err) {
      log.error('Delete scene model map failed', { error: err.message, key });
      response.internalError(res, '删除场景模型映射失败');
    }
  };
}

module.exports = function sceneModelMapRoutes(db, log) {
  return {
    list: list(db, log),
    get: get(db, log),
    create: create(db, log),
    update: update(db, log),
    delete: remove(db, log)
  };
};
