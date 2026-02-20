const response = require('../response');
const storyboardService = require('../services/storyboardService');
const episodeStoryboardService = require('../services/episodeStoryboardService');
const framePromptService = require('../services/framePromptService');

function routes(db, log) {
  return {
    create: (req, res) => {
      try {
        const sb = storyboardService.createStoryboard(db, log, req.body || {});
        response.created(res, sb);
      } catch (err) {
        log.error('storyboards create', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    update: (req, res) => {
      try {
        const sb = storyboardService.updateStoryboard(db, log, req.params.id, req.body || {});
        if (!sb) return response.notFound(res, '分镜不存在');
        response.success(res, sb);
      } catch (err) {
        log.error('storyboards update', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const ok = storyboardService.deleteStoryboard(db, log, req.params.id);
        if (!ok) return response.notFound(res, '分镜不存在');
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('storyboards delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    framePrompt: (req, res) => {
      try {
        const body = req.body || {};
        const frameType = body.frame_type || 'first';
        const panelCount = body.panel_count || 3;
        const model = body.model || '';
        const taskId = framePromptService.generateFramePrompt(db, log, req.params.id, frameType, panelCount, model);
        response.success(res, {
          task_id: taskId,
          status: 'pending',
          message: '帧提示词生成任务已创建，正在后台处理...',
        });
      } catch (err) {
        log.error('storyboards frame-prompt', { error: err.message });
        if (err.message && (err.message.includes('分镜不存在') || err.message.includes('不支持的'))) {
          return response.badRequest(res, err.message);
        }
        response.internalError(res, err.message);
      }
    },
    framePromptsGet: (req, res) => {
      try {
        const list = framePromptService.getFramePrompts(db, req.params.id);
        response.success(res, { frame_prompts: list });
      } catch (err) {
        log.error('storyboards frame-prompts', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    episodeStoryboardsGenerate: (req, res) => {
      try {
        const taskId = episodeStoryboardService.generateStoryboard(
          db,
          log,
          req.params.episode_id,
          req.query.model,
          req.query.style
        );
        response.success(res, { task_id: taskId, status: 'pending', message: '分镜头生成任务已创建，正在后台处理...' });
      } catch (err) {
        log.error('episode storyboards generate', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    episodeStoryboardsGet: (req, res) => {
      try {
        const list = episodeStoryboardService.getStoryboardsForEpisode(db, req.params.episode_id);
        response.success(res, { storyboards: list, total: list.length });
      } catch (err) {
        log.error('episode storyboards get', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
