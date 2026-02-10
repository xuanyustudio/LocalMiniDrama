const propService = require('../services/propService');
const response = require('../response');

function listProps(db) {
  return (req, res) => {
    const props = propService.listByDramaId(db, req.params.id);
    response.success(res, props);
  };
}

function createProp(db, log) {
  return (req, res) => {
    const body = req.body || {};
    if (!body.drama_id || !body.name) return response.badRequest(res, 'drama_id 和 name 必填');
    try {
      const prop = propService.create(db, log, body);
      response.created(res, prop);
    } catch (err) {
      log.errorw('Create prop failed', { error: err.message });
      response.internalError(res, '创建失败');
    }
  };
}

function updateProp(db, log) {
  return (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的ID');
    const prop = propService.update(db, log, id, req.body || {});
    if (!prop) return response.notFound(res, '道具不存在');
    response.success(res, prop);
  };
}

function deleteProp(db, log) {
  return (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的ID');
    const ok = propService.deleteById(db, log, id);
    if (!ok) return response.notFound(res, '道具不存在');
    response.success(res, { message: '删除成功' });
  };
}

function generateImage(db, log) {
  const propImageGenerationService = require('../services/propImageGenerationService');
  return (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return response.badRequest(res, '无效的ID');
    const model = req.body?.model != null ? String(req.body.model).trim() || null : null;
    try {
      const taskId = propImageGenerationService.generatePropImage(db, log, id, { model });
      response.success(res, { task_id: taskId });
    } catch (err) {
      if (err.message === '道具不存在') return response.notFound(res, err.message);
      if (err.message === '道具没有图片提示词') return response.badRequest(res, err.message);
      log.error('generatePropImage failed', { error: err.message });
      response.internalError(res, err.message || '生成失败');
    }
  };
}

function extractProps(db, log) {
  const propExtractionService = require('../services/propExtractionService');
  return (req, res) => {
    const episodeId = req.params.episode_id;
    if (!episodeId) return response.badRequest(res, '缺少 episode_id');
    try {
      const taskId = propExtractionService.extractPropsForEpisode(db, log, episodeId);
      response.success(res, { task_id: taskId });
    } catch (err) {
      if (err.message === 'episode not found' || err.message?.includes('剧本内容为空')) {
        return response.badRequest(res, err.message);
      }
      log.error('extractProps failed', { error: err.message });
      response.internalError(res, err.message || '提取失败');
    }
  };
}

function associateProps(db, log) {
  return (req, res) => {
    const storyboardId = parseInt(req.params.id, 10);
    const propIds = Array.isArray(req.body?.prop_ids) ? req.body.prop_ids : [];
    propService.associateWithStoryboard(db, log, storyboardId, propIds);
    response.success(res, { message: '关联成功' });
  };
}

module.exports = function propRoutes(db, log) {
  return {
    listProps: listProps(db),
    createProp: createProp(db, log),
    updateProp: updateProp(db, log),
    deleteProp: deleteProp(db, log),
    generateImage: generateImage(db, log),
    extractProps: extractProps(db, log),
    associateProps: associateProps(db, log),
  };
};
