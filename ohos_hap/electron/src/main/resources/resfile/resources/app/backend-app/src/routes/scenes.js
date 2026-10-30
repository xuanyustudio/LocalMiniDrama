const response = require('../response');
const sceneService = require('../services/sceneService');
const sceneLibraryService = require('../services/sceneLibraryService');
const imageService = require('../services/imageService');

function routes(db, log, cfg) {
  return {
    getOne: (req, res) => {
      try {
        const scene = sceneService.getSceneById(db, Number(req.params.scene_id));
        if (!scene) return response.notFound(res, '场景不存在');
        response.success(res, { scene });
      } catch (err) {
        log.error('scenes getOne', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    generatePrompt: async (req, res) => {
      try {
        const body = req.body || {};
        const out = await sceneService.generateScenePromptOnly(
          db, log, cfg, req.params.scene_id, body.model || undefined, body.style || undefined
        );
        if (!out.ok) {
          if (out.error === 'scene not found') return response.notFound(res, '场景不存在');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '提示词已生成', polished_prompt: out.polished_prompt });
      } catch (err) {
        log.error('scenes generatePrompt', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    extractFromImage: async (req, res) => {
      try {
        const out = await sceneService.extractSceneFromImage(db, log, cfg, req.params.scene_id);
        if (!out.ok) {
          if (out.error === 'scene not found') return response.notFound(res, '场景不存在');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '场景描述已提取', prompt: out.prompt });
      } catch (err) {
        log.error('scenes extract-from-image', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    update: (req, res) => {
      try {
        const out = sceneService.updateScene(db, log, req.params.scene_id, req.body || {});
        if (!out.ok) return response.notFound(res, '场景不存在');
        response.success(res, { message: '保存成功' });
      } catch (err) {
        log.error('scenes update', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    updatePrompt: (req, res) => {
      try {
        const out = sceneService.updateScenePrompt(db, log, req.params.scene_id, req.body || {});
        if (!out.ok) return response.notFound(res, '场景不存在');
        response.success(res, { message: '场景提示词已更新' });
      } catch (err) {
        log.error('scenes updatePrompt', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const out = sceneService.deleteScene(db, log, req.params.scene_id);
        if (!out.ok) return response.notFound(res, '场景不存在');
        response.success(res, { message: '场景已删除' });
      } catch (err) {
        log.error('scenes delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    create: (req, res) => {
      try {
        const body = req.body || {};
        const dramaId = body.drama_id;
        if (dramaId == null) return response.badRequest(res, '缺少 drama_id');
        const scene = sceneService.createScene(db, log, dramaId, body);
        response.created(res, scene);
      } catch (err) {
        log.error('scenes create', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    generateImage: async (req, res) => {
      try {
        const body = req.body || {};
        const sceneId = body.scene_id != null ? Number(body.scene_id) : null;
        if (sceneId == null) return response.badRequest(res, '缺少 scene_id');
        const out = await sceneService.generateSceneFourViewImage(
          db, log, cfg, sceneId, body.model || undefined, body.style || undefined
        );
        if (!out.ok) {
          if (out.error === 'scene not found') return response.notFound(res, '场景不存在');
          if (out.error === 'unauthorized') return response.notFound(res, '剧集不存在或无权限');
          return response.badRequest(res, out.error);
        }
        response.success(res, {
          message: '场景四视图生成任务已提交',
          image_generation: out.image_generation,
        });
      } catch (err) {
        log.error('scenes generateImage', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    addToLibrary: (req, res) => {
      try {
        const out = sceneLibraryService.addSceneToLibrary(db, log, req.params.scene_id);
        if (!out.ok) {
          if (out.error === 'scene not found') return response.notFound(res, '场景不存在');
          if (out.error === 'unauthorized') return response.forbidden(res, '无权限');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '已加入本剧场景库', item: out.item });
      } catch (err) {
        log.error('scenes add-to-library', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    addToMaterialLibrary: (req, res) => {
      try {
        const out = sceneLibraryService.addSceneToMaterialLibrary(db, log, req.params.scene_id);
        if (!out.ok) {
          if (out.error === 'scene not found') return response.notFound(res, '场景不存在');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '已加入全局素材库', item: out.item });
      } catch (err) {
        log.error('scenes add-to-material-library', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    generateFourViewImage: async (req, res) => {
      try {
        const body = req.body || {};
        const modelName = body.model_name || body.model || undefined;
        const style = body.style || undefined;
        const out = await sceneService.generateSceneFourViewImage(db, log, cfg, req.params.scene_id, modelName, style);
        if (!out.ok) {
          if (out.error === 'scene not found') return response.notFound(res, '场景不存在');
          if (out.error === 'unauthorized') return response.notFound(res, '剧集不存在或无权限');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '场景四视图生成任务已提交', image_generation: out.image_generation });
      } catch (err) {
        log.error('scenes generate-four-view-image', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
