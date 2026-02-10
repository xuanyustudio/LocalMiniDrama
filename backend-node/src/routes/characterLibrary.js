const response = require('../response');
const characterLibraryService = require('../services/characterLibraryService');

function routes(db, cfg, log) {
  return {
    list: (req, res) => {
      try {
        const query = { page: req.query.page, page_size: req.query.page_size, category: req.query.category, source_type: req.query.source_type, keyword: req.query.keyword };
        const { items, total, page, pageSize } = characterLibraryService.listLibraryItems(db, query);
        response.successWithPagination(res, items, total, page, pageSize);
      } catch (err) {
        log.error('character-library list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    create: (req, res) => {
      try {
        const item = characterLibraryService.createLibraryItem(db, log, req.body || {});
        response.created(res, item);
      } catch (err) {
        log.error('character-library create', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    get: (req, res) => {
      try {
        const item = characterLibraryService.getLibraryItem(db, req.params.id);
        if (!item) return response.notFound(res, '角色库项不存在');
        response.success(res, item);
      } catch (err) {
        log.error('character-library get', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const ok = characterLibraryService.deleteLibraryItem(db, log, req.params.id);
        if (!ok) return response.notFound(res, '角色库项不存在');
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('character-library delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
