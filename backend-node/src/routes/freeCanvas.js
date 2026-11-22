const response = require('../response');
const { getCanvas, listCanvases, createCanvas, saveDocument, saveColumns } = require('../services/freeCanvas/store');
const { applyCommand } = require('../services/freeCanvas/commands');
const { summarize, findNode, runtimeIdFactory } = require('../services/freeCanvas/document');

const ASPECT_RATIOS = new Set(['9:16', '16:9', '1:1']);

function updateCanvas(db, canvas, body, res) {
  if (Number(body.revision) !== canvas.revision) {
    return response.badRequest(res, '画布已被更新');
  }
  if (body.aspect_ratio !== undefined && !ASPECT_RATIOS.has(body.aspect_ratio)) {
    return response.badRequest(res, '画幅只允许 9:16、16:9、1:1');
  }
  const columns = {};
  if (body.title !== undefined) columns.title = body.title;
  if (body.aspect_ratio !== undefined) columns.aspect_ratio = body.aspect_ratio;
  const saved = saveColumns(db, canvas.id, canvas.revision, columns);
  if (!saved.ok) return response.badRequest(res, saved.error);
  return response.success(res, { canvas: saved.canvas });
}

function routes(db, log) {
  return {
    list(req, res) {
      try {
        response.success(res, listCanvases(db));
      } catch (err) {
        log.error('free canvas list', { error: err.message });
        response.internalError(res, '获取画布列表失败');
      }
    },
    create(req, res) {
      try {
        const canvas = createCanvas(db, req.body && req.body.title);
        response.success(res, canvas);
      } catch (err) {
        log.error('free canvas create', { error: err.message });
        response.internalError(res, '创建画布失败');
      }
    },
    get(req, res) {
      try {
        const canvas = getCanvas(db, req.params.id);
        if (!canvas) return response.notFound(res, '画布不存在');
        response.success(res, canvas);
      } catch (err) {
        log.error('free canvas get', { error: err.message });
        response.internalError(res, '获取画布失败');
      }
    },
    command(req, res) {
      try {
        const canvas = getCanvas(db, req.params.id);
        if (!canvas) return response.notFound(res, '画布不存在');
        const body = req.body || {};
        if (body.name === 'get_canvas') {
          return response.success(res, summarize(canvas));
        }
        if (body.name === 'get_node') {
          const node = findNode(canvas.document, body.node_id);
          if (!node) return response.notFound(res, '节点不存在');
          return response.success(res, node);
        }
        if (body.name === 'update_canvas') return updateCanvas(db, canvas, body, res);
        if (body.name !== 'select_nodes' && Number(body.revision) !== canvas.revision) {
          return response.badRequest(res, '画布已被更新');
        }
        const applied = applyCommand(canvas.document, body, runtimeIdFactory());
        if (!applied.ok) return response.badRequest(res, applied.error);
        if (!applied.graph) return response.success(res, applied);
        const saved = saveDocument(db, canvas.id, canvas.revision, applied.graph);
        if (!saved.ok) return response.badRequest(res, saved.error);
        return response.success(res, {
          canvas: saved.canvas,
          receipt: { ...applied.receipt, revision: saved.canvas.revision },
        });
      } catch (err) {
        log.error('free canvas command', { error: err.message });
        response.internalError(res, '画布命令失败');
      }
    },
  };
}

module.exports = routes;
