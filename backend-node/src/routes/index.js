const express = require('express');
const response = require('../response');
const dramaRoutes = require('./drama');
const taskRoutes = require('./task');
const settingsRoutes = require('./settings');
const aiConfigRoutes = require('./aiConfig');
const propRoutes = require('./prop');
const stubRoutes = require('./stub');
const characterLibraryRoutes = require('./characterLibrary');
const sceneLibraryRoutes = require('./sceneLibrary');
const propLibraryRoutes = require('./propLibrary');
const characterRoutes = require('./characters');
const uploadModule = require('./upload');
const sceneRoutes = require('./scenes');
const storyboardRoutes = require('./storyboards');
const imageRoutes = require('./images');
const videoRoutes = require('./videos');
const videoMergeRoutes = require('./videoMerges');
const assetRoutes = require('./assets');
const audioRoutes = require('./audio');

function setupRouter(cfg, db, log) {
  const r = express.Router();
  const drama = dramaRoutes(db, cfg, log);
  const task = taskRoutes(db, log);
  const settings = settingsRoutes(cfg, log);
  const aiConfig = aiConfigRoutes(db, log);
  const prop = propRoutes(db, log);
  const stub = stubRoutes(db, cfg, log);

  const uploadService = require('../services/uploadService');
  const charLibrary = characterLibraryRoutes(db, cfg, log);
  const sceneLibrary = sceneLibraryRoutes(db, cfg, log);
  const propLibrary = propLibraryRoutes(db, cfg, log);
  const characters = characterRoutes(db, cfg, log, uploadService);
  const uploadHandlers = uploadModule.routes(cfg, log);
  const scenes = sceneRoutes(db, log);
  const storyboards = storyboardRoutes(db, log);
  const images = imageRoutes(db, cfg, log);
  const videos = videoRoutes(db, log);
  const videoMerges = videoMergeRoutes(db, log);
  const assets = assetRoutes(db, log);
  const audio = audioRoutes(db, log);

  // ---------- dramas ----------
  r.get('/dramas', drama.listDramas);
  r.post('/dramas', drama.createDrama);
  r.get('/dramas/stats', drama.getDramaStats);
  // 导出/导入（放在 :id 路由前，避免被 :id 捕获）
  r.get('/dramas/:id/export', drama.exportDrama);
  const multer = require('multer');
  const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
  r.post('/dramas/import', importUpload.single('file'), drama.importDrama);
  r.get('/dramas/examples', drama.listExamples);
  r.post('/dramas/import-example', drama.importExample);
  r.put('/dramas/:id/outline', drama.saveOutline);
  r.get('/dramas/:id/characters', drama.getCharacters);
  r.put('/dramas/:id/characters', drama.saveCharacters);
  r.put('/dramas/:id/episodes', drama.saveEpisodes);
  r.put('/dramas/:id/progress', drama.saveProgress);
  r.get('/dramas/:id/props', drama.listProps);
  r.get('/dramas/:id', drama.getDrama);
  r.put('/dramas/:id', drama.updateDrama);
  r.delete('/dramas/:id', drama.deleteDrama);

  // ---------- ai-configs ----------
  r.get('/ai-configs', aiConfig.list);
  r.post('/ai-configs', aiConfig.create);
  r.post('/ai-configs/test', aiConfig.testConnection);
  r.get('/ai-configs/:id', aiConfig.get);
  r.put('/ai-configs/:id', aiConfig.update);
  r.delete('/ai-configs/:id', aiConfig.delete);

  // ---------- generation (角色生成：AI + 入库 + 任务结果) ----------
  r.post('/generation/characters', (req, res) => {
    const characterGenerationService = require('../services/characterGenerationService');
    try {
      const body = req.body || {};
      if (!body.drama_id) {
        return response.badRequest(res, 'drama_id 必填');
      }
      const taskId = characterGenerationService.generateCharacters(db, cfg, log, body);
      response.success(res, { task_id: taskId, status: 'pending' });
    } catch (err) {
      log.error('generation/characters', { error: err.message });
      response.internalError(res, err.message || '创建任务失败');
    }
  });

  // 故事生成：根据梗概 + 风格/类型 生成扩展剧本正文（不创建项目）
  r.post('/generation/story', async (req, res) => {
    const storyGenerationService = require('../services/storyGenerationService');
    try {
      const body = req.body || {};
      const result = await storyGenerationService.generateStory(db, log, body);
      response.success(res, result);
    } catch (err) {
      log.error('generation/story', { error: err.message });
      if (err.message && err.message.includes('未配置')) {
        return response.badRequest(res, err.message);
      }
      response.internalError(res, err.message || '故事生成失败');
    }
  });

  // ---------- character-library ----------
  r.get('/character-library', charLibrary.list);
  r.post('/character-library', charLibrary.create);
  r.get('/character-library/:id', charLibrary.get);
  r.put('/character-library/:id', charLibrary.update);
  r.delete('/character-library/:id', charLibrary.delete);

  // ---------- scene-library ----------
  r.get('/scene-library', sceneLibrary.list);
  r.post('/scene-library', sceneLibrary.create);
  r.get('/scene-library/:id', sceneLibrary.get);
  r.put('/scene-library/:id', sceneLibrary.update);
  r.delete('/scene-library/:id', sceneLibrary.delete);

  // ---------- prop-library ----------
  r.get('/prop-library', propLibrary.list);
  r.post('/prop-library', propLibrary.create);
  r.get('/prop-library/:id', propLibrary.get);
  r.put('/prop-library/:id', propLibrary.update);
  r.delete('/prop-library/:id', propLibrary.delete);

  // ---------- characters ----------
  r.put('/characters/:id', characters.update);
  r.delete('/characters/:id', characters.delete);
  r.post('/characters/batch-generate-images', characters.batchGenerateImages);
  r.post('/characters/:id/generate-image', characters.generateImage);
  r.post('/characters/:id/upload-image', uploadModule.multerSingle, characters.uploadImage);
  r.put('/characters/:id/image', characters.putImage);
  r.put('/characters/:id/image-from-library', characters.imageFromLibrary);
  r.post('/characters/:id/add-to-library', characters.addToLibrary);
  r.post('/characters/:id/add-to-material-library', characters.addToMaterialLibrary);

  // ---------- props ----------
  r.post('/props', prop.createProp);
  r.put('/props/:id', prop.updateProp);
  r.delete('/props/:id', prop.deleteProp);
  r.post('/props/:id/generate', prop.generateImage);
  r.post('/props/:id/add-to-library', prop.addToLibrary);
  r.post('/props/:id/add-to-material-library', prop.addToMaterialLibrary);

  // ---------- upload ----------
  r.post('/upload/image', uploadModule.multerSingle, uploadHandlers.uploadImage);

  // ---------- episodes ----------
  // 注意：drama.generateStoryboard 已处理所有逻辑（包括参数解析），这里统一使用 drama 模块的实现
  // 之前可能有部分路由指向了 storyboards.episodeStoryboardsGenerate，这可能导致参数解析不一致
  r.post('/episodes/:episode_id/storyboards', drama.generateStoryboard);
  r.post('/episodes/:episode_id/props/extract', prop.extractProps);
  r.post('/episodes/:episode_id/characters/extract', stub.episodeCharactersExtract);
  r.get('/episodes/:episode_id/storyboards', storyboards.episodeStoryboardsGet);
  r.post('/episodes/:episode_id/finalize', drama.finalizeEpisode);
  r.get('/episodes/:episode_id/download', drama.downloadEpisodeVideo);

  // ---------- tasks ----------
  r.get('/tasks/:task_id', task.getTaskStatus);
  r.get('/tasks', task.getResourceTasks);

  // ---------- scenes ----------
  r.put('/scenes/:scene_id', scenes.update);
  r.put('/scenes/:scene_id/prompt', scenes.updatePrompt);
  r.delete('/scenes/:scene_id', scenes.delete);
  r.post('/scenes/generate-image', scenes.generateImage);
  r.post('/scenes', scenes.create);
  r.post('/scenes/:scene_id/add-to-library', scenes.addToLibrary);
  r.post('/scenes/:scene_id/add-to-material-library', scenes.addToMaterialLibrary);

  // ---------- images ----------
  r.get('/images', images.list);
  r.post('/images', images.create);
  r.get('/images/episode/:episode_id/backgrounds', images.episodeBackgrounds);
  r.post('/images/episode/:episode_id/backgrounds/extract', images.episodeBackgroundsExtract);
  r.post('/images/episode/:episode_id/batch', images.episodeBatch);
  r.post('/images/scene/:scene_id', images.scene);
  r.post('/images/upload', images.upload);
  r.get('/images/:id', images.get);
  r.delete('/images/:id', images.delete);

  // ---------- videos ----------
  r.get('/videos', videos.list);
  r.post('/videos', videos.create);
  r.post('/videos/image/:image_gen_id', videos.fromImage);
  r.post('/videos/episode/:episode_id/batch', videos.episodeBatch);
  r.get('/videos/:id', videos.get);
  r.delete('/videos/:id', videos.delete);

  // ---------- video-merges ----------
  r.get('/video-merges', videoMerges.list);
  r.post('/video-merges', videoMerges.create);
  r.get('/video-merges/:merge_id', videoMerges.get);
  r.delete('/video-merges/:merge_id', videoMerges.delete);

  // ---------- assets ----------
  r.get('/assets', assets.list);
  r.post('/assets', assets.create);
  r.post('/assets/import/image/:image_gen_id', assets.importImage);
  r.post('/assets/import/video/:video_gen_id', assets.importVideo);
  r.get('/assets/:id', assets.get);
  r.put('/assets/:id', assets.update);
  r.delete('/assets/:id', assets.delete);

  // ---------- storyboards ----------
  r.get('/storyboards/episode/:episode_id/generate', storyboards.episodeStoryboardsGenerate);
  r.post('/storyboards', storyboards.create);
  r.put('/storyboards/:id', storyboards.update);
  r.delete('/storyboards/:id', storyboards.delete);
  r.post('/storyboards/:id/props', prop.associateProps);
  r.post('/storyboards/:id/frame-prompt', storyboards.framePrompt);
  r.get('/storyboards/:id/frame-prompts', storyboards.framePromptsGet);

  // ---------- audio ----------
  r.post('/audio/extract', audio.extract);
  r.post('/audio/extract/batch', audio.extractBatch);

  // ---------- settings ----------
  r.get('/settings/language', settings.getLanguage);
  r.put('/settings/language', settings.updateLanguage);

  return r;
}

module.exports = { setupRouter };
