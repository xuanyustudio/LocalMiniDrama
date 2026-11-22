const fs = require('fs');
const path = require('path');
const response = require('../response');
const { getCanvas, listCanvases, createCanvas, saveDocument, saveColumns } = require('../services/freeCanvas/store');
const { applyCommand } = require('../services/freeCanvas/commands');
const { summarize, findNode, runtimeIdFactory, clone } = require('../services/freeCanvas/document');
const { runNode, confirmRun: confirmCanvasRun } = require('../services/freeCanvas/run');
const aiClient = require('../services/aiClient');
const imageService = require('../services/imageService');
const videoService = require('../services/videoService');
const ttsService = require('../services/ttsService');

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

function getStorageRoot() {
  const loadConfig = require('../config').loadConfig;
  const cfg = loadConfig();
  const stored = cfg.storage?.local_path || './data/storage';
  return path.isAbsolute(stored) ? stored : path.join(process.cwd(), stored);
}

function sanitizeUploadFilename(filename) {
  if (filename == null || filename === '') return '';
  const base = path.basename(String(filename).replace(/\\/g, '/'));
  const cleaned = base.replace(/[\\/]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') return '';
  return cleaned;
}

function uploadInput(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const file = req.file && typeof req.file === 'object' ? req.file : {};
  const has = (key) => Object.prototype.hasOwnProperty.call(req, key);
  return {
    nodeId: has('node_id') ? req.node_id : body.node_id,
    revision: has('revision') ? req.revision : body.revision,
    filename: has('filename') ? req.filename : file.originalname,
    buffer: has('buffer') ? req.buffer : file.buffer,
  };
}

function defaultRunDeps(db, log) {
  return {
    hasTextModel() {
      return Boolean(aiClient.getDefaultConfig(db, 'text'));
    },
    hasImageModel() {
      return Boolean(aiClient.getDefaultConfig(db, 'image') || aiClient.getDefaultConfig(db, 'storyboard_image'));
    },
    hasVideoModel() {
      return Boolean(aiClient.getDefaultConfig(db, 'video'));
    },
    hasTts() {
      return Boolean(aiClient.getDefaultConfig(db, 'tts'));
    },
    completeText(prompt, options = {}) {
      return aiClient.generateText(
        db,
        log,
        'text',
        prompt,
        '你是短剧编剧。只输出正文或 JSON，不要解释。',
        { model: options.model || undefined }
      );
    },
    createImage(body) {
      return imageService.create(db, log, body);
    },
    createVideo(body) {
      return videoService.createGeneration(db, log, body);
    },
    synthesize(body) {
      return ttsService.synthesize(db, log, body);
    },
  };
}

async function executeCanvasRun(db, log, canvas, body, res, runDeps) {
  try {
    const applied = body.name === 'confirm_run'
      ? await confirmCanvasRun(canvas.document, body.approved === true, runDeps, { aspectRatio: canvas.aspect_ratio })
      : await runNode(canvas.document, body, runDeps);
    if (!applied.ok) return response.badRequest(res, applied.error);
    if (!applied.graph) return response.success(res, applied);
    const saved = saveDocument(db, canvas.id, canvas.revision, applied.graph);
    if (!saved.ok) return response.badRequest(res, saved.error);
    return response.success(res, {
      canvas: saved.canvas,
      pending: applied.pending === true,
      cancelled: applied.cancelled === true,
      nodeIds: applied.nodeIds || [],
      summary: applied.summary || '',
      revision: saved.canvas.revision,
      ...(applied.cancelled ? { agent_message: '用户取消了这次生成' } : {}),
    });
  } catch (err) {
    log.error('free canvas run', { error: err.message });
    return response.internalError(res, '画布运行失败');
  }
}

function routes(db, log, injectedDeps) {
  const runDeps = injectedDeps || defaultRunDeps(db, log);
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
        if (body.name === 'run_node') {
          if (Number(body.revision) !== canvas.revision) return response.badRequest(res, '画布已被更新');
          return executeCanvasRun(db, log, canvas, body, res, runDeps);
        }
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
    confirm(req, res) {
      try {
        const canvas = getCanvas(db, req.params && req.params.id);
        if (!canvas) return response.notFound(res, '画布不存在');
        const body = req.body || {};
        if (body.revision != null && body.revision !== '' && Number(body.revision) !== canvas.revision) {
          return response.badRequest(res, '画布已被更新');
        }
        return executeCanvasRun(db, log, canvas, { name: 'confirm_run', approved: body.approved === true }, res, runDeps);
      } catch (err) {
        log.error('free canvas confirm', { error: err.message });
        return response.internalError(res, '确认生成失败');
      }
    },
    async upload(req, res, deps) {
      const io = deps && typeof deps === 'object' ? deps : {};
      const writeFile = io.writeFile || fs.promises.writeFile;
      const mkdir = io.mkdir || fs.promises.mkdir;
      try {
        const canvas = getCanvas(db, req.params && req.params.id);
        if (!canvas) return response.notFound(res, '画布不存在');

        const { nodeId, revision, filename, buffer } = uploadInput(req);
        const safeName = sanitizeUploadFilename(filename);
        if (nodeId == null || nodeId === '') return response.badRequest(res, '缺少节点');
        if (buffer == null) return response.badRequest(res, '缺少文件');
        if (!safeName) return response.badRequest(res, '文件名无效');
        if (Number(revision) !== canvas.revision) return response.badRequest(res, '画布已被更新');

        const existing = findNode(canvas.document, nodeId);
        if (!existing || existing.type !== 'upload') {
          return response.badRequest(res, existing ? '只能写入上传节点' : '节点不存在');
        }

        const storageRoot = io.storageRoot || getStorageRoot();
        const relativePath = `free-canvases/${canvas.id}/uploads/${existing.id}-${safeName}`;
        const absPath = path.join(
          storageRoot,
          'free-canvases',
          String(canvas.id),
          'uploads',
          `${existing.id}-${safeName}`
        );
        await mkdir(path.dirname(absPath), { recursive: true });
        await writeFile(absPath, buffer);

        const graph = clone(canvas.document);
        const target = findNode(graph, existing.id);
        target.data = {
          ...(target.data || {}),
          local_path: relativePath,
          image_url: `/static/${relativePath}`,
          source_file_name: safeName,
        };
        target.status = 'succeeded';

        const saved = saveDocument(db, canvas.id, canvas.revision, graph);
        if (!saved.ok) return response.badRequest(res, saved.error);
        return response.success(res, { canvas: saved.canvas });
      } catch (err) {
        log.error('free canvas upload', { error: err.message });
        response.internalError(res, '上传文件失败');
      }
    },
  };
}

module.exports = routes;
