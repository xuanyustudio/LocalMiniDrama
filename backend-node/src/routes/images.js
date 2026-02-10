const response = require('../response');
const imageService = require('../services/imageService');
const taskService = require('../services/taskService');
const backgroundExtractionService = require('../services/backgroundExtractionService');

function routes(db, cfg, log) {
  return {
    list: (req, res) => {
      try {
        const query = { ...req.query };
        const { items, total, page, pageSize } = imageService.list(db, query);
        response.successWithPagination(res, items, total, page, pageSize);
      } catch (err) {
        log.error('images list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    create: (req, res) => {
      try {
        const body = req.body || {};
        const rec = imageService.create(db, log, body);
        response.created(res, rec);
      } catch (err) {
        log.error('images create', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    get: (req, res) => {
      try {
        const item = imageService.getById(db, req.params.id);
        if (!item) return response.notFound(res, '记录不存在');
        response.success(res, item);
      } catch (err) {
        log.error('images get', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const ok = imageService.deleteById(db, log, req.params.id);
        if (!ok) return response.notFound(res, '记录不存在');
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('images delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    scene: (req, res) => {
      try {
        const task = taskService.createTask(db, log, 'image_generation', req.params.scene_id);
        setTimeout(() => taskService.updateTaskResult(db, task.id, []), 100);
        response.success(res, { task_id: task.id });
      } catch (err) {
        log.error('images scene', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    episodeBackgrounds: (req, res) => {
      try {
        const list = imageService.getBackgroundsForEpisode(db, req.params.episode_id);
        response.success(res, list);
      } catch (err) {
        log.error('images episode backgrounds', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    episodeBackgroundsExtract: (req, res) => {
      try {
        const body = req.body || {};
        const taskId = backgroundExtractionService.extractBackgroundsForEpisode(
          db,
          cfg,
          log,
          req.params.episode_id,
          body.model,
          body.style
        );
        response.success(res, { task_id: taskId, status: 'pending', message: '场景提取任务已创建，正在后台处理...' });
      } catch (err) {
        log.error('images episode backgrounds extract', { error: err.message });
        if (err.message && (err.message.includes('script content') || err.message.includes('not found'))) {
          return response.badRequest(res, err.message);
        }
        response.internalError(res, err.message || '任务创建失败');
      }
    },
    episodeBatch: (req, res) => {
      try {
        response.success(res, []);
      } catch (err) {
        log.error('images episode batch', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    upload: (req, res) => {
      try {
        const body = req.body || {};
        const item = imageService.upload(db, log, body);
        response.created(res, item);
      } catch (err) {
        log.error('images upload', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
