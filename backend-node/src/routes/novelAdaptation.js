const multer = require('multer');
const response = require('../response');
const { createNovelAdaptation, AdaptationInputError, MAX_SOURCE_BYTES } = require('../services/novelAdaptationService');

function uploadName(name) {
  if (!name || !/^[\u0000-\u00ff]+$/.test(name)) return name;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(name, 'latin1')); }
  catch (_) { return name; }
}

function registerNovelAdaptation(r, db, log, cfg) {
  const service = createNovelAdaptation(db, log, cfg);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SOURCE_BYTES, files: 1 } }).single('file');
  const root = '/dramas/:id/adaptation';

  function handle(action) {
    return (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1 || !db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(id)) {
        return response.notFound(res, '项目不存在。');
      }
      try { response.success(res, action(id, req)); }
      catch (err) {
        if (err instanceof AdaptationInputError) return response.badRequest(res, err.message);
        log.error('小说改编接口出错', { project_id: id, error: err.message });
        response.internalError(res, '无法读写小说改编项目。');
      }
    };
  }

  r.get(root, handle((id) => service.snapshot(id)));
  r.post(`${root}/source`, (req, res, next) => upload(req, res, (err) => {
    if (err) return response.badRequest(res, '请选择不超过 16 MiB 的 TXT 文件。');
    next();
  }), handle((id, req) => service.upload(id, uploadName(req.file?.originalname), req.file?.buffer)));
  r.post(`${root}/rewrite`, handle((id, req) => service.rewrite(id, req.body || {})));
  r.post(`${root}/script`, handle((id, req) => service.script(id, req.body || {})));
  r.post(`${root}/episode`, handle((id, req) => service.appendEpisode(id, req.body || {})));
  return service;
}

module.exports = { registerNovelAdaptation };
