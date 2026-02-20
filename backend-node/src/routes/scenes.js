const response = require('../response');
const sceneService = require('../services/sceneService');
const sceneLibraryService = require('../services/sceneLibraryService');
const imageService = require('../services/imageService');

function routes(db, log) {
  return {
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
    generateImage: (req, res) => {
      try {
        const body = req.body || {};
        console.log("==c 生成图片请求body：",body);
        const sceneId = body.scene_id != null ? Number(body.scene_id) : null;
        if (sceneId == null) return response.badRequest(res, '缺少 scene_id');
        const scene = sceneService.getSceneById(db, sceneId);
        if (!scene) return response.notFound(res, '场景不存在');
        const prompt = (body.prompt && body.prompt.trim()) || (scene.prompt && scene.prompt.trim()) || `${scene.location || '场景'}，${scene.time || '白天'}`.trim();
        console.log("==c 生成图片提示词：",prompt);
        if (prompt.length < 5) return response.badRequest(res, '提示词过短或场景无描述');
        const imageGen = imageService.create(db, log, {
          scene_id: sceneId,
          drama_id: scene.drama_id,
          prompt,
          model: body.model || null,
          provider: body.provider || 'openai',
          style: body.style || undefined,
        });
        response.success(res, {
          message: 'Scene image generation started',
          image_generation: imageGen,
        });
      } catch (err) {
        log.error('scenes generateImage', { error: err.message });
        if (err.message && err.message.includes('insert failed')) return response.internalError(res, '创建记录失败，请确认已执行迁移 08（scene_id 列）');
        response.internalError(res, err.message);
      }
    },
    addToLibrary: (req, res) => {
      try {
        const category = (req.body || {}).category;
        const out = sceneLibraryService.addSceneToLibrary(db, log, req.params.scene_id, category);
        if (!out.ok) {
          if (out.error === 'scene not found') return response.notFound(res, '场景不存在');
          if (out.error === 'unauthorized') return response.forbidden(res, '无权限');
          return response.badRequest(res, out.error);
        }
        response.success(res, { message: '已加入场景库', item: out.item });
      } catch (err) {
        log.error('scenes add-to-library', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
