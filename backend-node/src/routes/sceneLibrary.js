const response = require('../response');
const sceneLibraryService = require('../services/sceneLibraryService');

function routes(db, cfg, log) {
  return {
    list: (req, res) => {
      try {
        const query = { page: req.query.page, page_size: req.query.page_size, drama_id: req.query.drama_id, category: req.query.category, source_type: req.query.source_type, keyword: req.query.keyword };
        const { items, total, page, pageSize } = sceneLibraryService.listLibraryItems(db, query);
        response.successWithPagination(res, items, total, page, pageSize);
      } catch (err) {
        log.error('scene-library list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    create: (req, res) => {
      try {
        const item = sceneLibraryService.createLibraryItem(db, log, req.body || {});
        response.created(res, item);
      } catch (err) {
        log.error('scene-library create', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    get: (req, res) => {
      try {
        const item = sceneLibraryService.getLibraryItem(db, req.params.id);
        if (!item) return response.notFound(res, '场景库项不存在');
        response.success(res, item);
      } catch (err) {
        log.error('scene-library get', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    update: (req, res) => {
      try {
        const item = sceneLibraryService.updateLibraryItem(db, log, req.params.id, req.body || {});
        if (!item) return response.notFound(res, '场景库项不存在');
        response.success(res, item);
      } catch (err) {
        log.error('scene-library update', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const ok = sceneLibraryService.deleteLibraryItem(db, log, req.params.id);
        if (!ok) return response.notFound(res, '场景库项不存在');
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('scene-library delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
