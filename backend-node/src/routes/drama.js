const dramaService = require('../services/dramaService');
const propService = require('../services/propService');
const response = require('../response');

function createDrama(db, log) {
  return (req, res) => {
    const body = req.body || {};
    if (!body.title || String(body.title).trim() === '') {
      return response.badRequest(res, '标题不能为空');
    }
    try {
      const drama = dramaService.createDrama(db, log, body);
      response.created(res, drama);
    } catch (err) {
      log.error('Create drama failed', { error: err.message, stack: err.stack });
      response.internalError(res, err.message || '创建失败');
    }
  };
}

function getDrama(db, cfg) {
  return (req, res) => {
    const drama = dramaService.getDrama(db, req.params.id, cfg?.storage?.base_url);
    if (!drama) return response.notFound(res, '剧本不存在');
    response.success(res, drama);
  };
}

function listDramas(db, log) {
  return (req, res) => {
    const page = req.query.page || 1;
    const page_size = req.query.page_size || 20;
    const status = req.query.status || '';
    const genre = req.query.genre || '';
    const keyword = req.query.keyword || '';
    try {
      const { dramas, total, page: p, pageSize: ps } = dramaService.listDramas(db, {
        page,
        page_size,
        status,
        genre,
        keyword,
      });
      response.successWithPagination(res, dramas, total, p, ps);
    } catch (err) {
      log.errorw('List dramas failed', { error: err.message });
      response.internalError(res, '获取列表失败');
    }
  };
}

function updateDrama(db, log) {
  return (req, res) => {
    const drama = dramaService.updateDrama(db, log, req.params.id, req.body || {});
    if (!drama) return response.notFound(res, '剧本不存在');
    response.success(res, drama);
  };
}

function deleteDrama(db, log) {
  return (req, res) => {
    const ok = dramaService.deleteDrama(db, log, req.params.id);
    if (!ok) return response.notFound(res, '剧本不存在');
    response.success(res, { message: '删除成功' });
  };
}

function getDramaStats(db, log) {
  return (req, res) => {
    try {
      const stats = dramaService.getDramaStats(db);
      response.success(res, stats);
    } catch (err) {
      log.errorw('Get drama stats failed', { error: err.message });
      response.internalError(res, '获取统计失败');
    }
  };
}

function saveOutline(db, log) {
  return (req, res) => {
    const ok = dramaService.saveOutline(db, log, req.params.id, req.body || {});
    if (!ok) return response.notFound(res, '剧本不存在');
    response.success(res, { message: '保存成功' });
  };
}

function getCharacters(db) {
  return (req, res) => {
    const characters = dramaService.getCharacters(db, req.params.id, req.query.episode_id);
    if (characters === null) return response.notFound(res, '剧本或章节不存在');
    response.success(res, characters);
  };
}

function saveCharacters(db, log) {
  return (req, res) => {
    const body = req.body || {};
    if (!Array.isArray(body.characters)) return response.badRequest(res, 'characters 必填且为数组');
    const ok = dramaService.saveCharacters(db, log, req.params.id, body);
    if (!ok) return response.notFound(res, '剧本或章节不存在');
    response.success(res, { message: '保存成功' });
  };
}

function saveEpisodes(db, log) {
  return (req, res) => {
    const body = req.body || {};
    if (!Array.isArray(body.episodes)) return response.badRequest(res, 'episodes 必填且为数组');
    const ok = dramaService.saveEpisodes(db, log, req.params.id, body);
    if (!ok) return response.notFound(res, '剧本不存在');
    response.success(res, { message: '保存成功' });
  };
}

function saveProgress(db, log) {
  return (req, res) => {
    const body = req.body || {};
    if (!body.current_step) return response.badRequest(res, 'current_step 必填');
    const ok = dramaService.saveProgress(db, log, req.params.id, body);
    if (!ok) return response.notFound(res, '剧本不存在');
    response.success(res, { message: '保存成功' });
  };
}

function listProps(db) {
  return (req, res) => {
    const props = propService.listByDramaId(db, req.params.id);
    response.success(res, props);
  };
}

function finalizeEpisode(db, log, cfg) {
  return (req, res) => {
    const episodeId = req.params.episode_id;
    if (!episodeId) return response.badRequest(res, 'episode_id不能为空');
    const baseUrl = cfg?.storage?.base_url || '';
    const result = dramaService.finalizeEpisode(db, log, episodeId, baseUrl);
    if (!result) return response.notFound(res, '剧集不存在');
    response.success(res, result);
  };
}

function downloadEpisodeVideo(db) {
  return (req, res) => {
    const episodeId = req.params.episode_id;
    if (!episodeId) return response.badRequest(res, 'episode_id不能为空');
    const result = dramaService.downloadEpisodeVideo(db, episodeId);
    if (!result) return response.notFound(res, '剧集不存在');
    if (result.error) return response.badRequest(res, result.error);
    response.success(res, result);
  };
}

function generateStoryboard(db, log) {
  return async (req, res) => {
    const body = req.body || {};
    try {
      // 显式处理 model 为空的情况，转为 undefined 以便 service 层触发默认逻辑
      const model = (body.model && String(body.model).trim()) ? body.model : undefined;
      console.log('==c generateStoryboard body:', JSON.stringify(body));
      const resData = await dramaService.generateStoryboard(db, log, req.params.episode_id, {
        model: model,
        style: body.style,
        storyboard_count: body.storyboard_count,
        video_duration: body.video_duration,
        aspect_ratio: body.aspect_ratio
      });
      response.success(res, resData);
    } catch (err) {
      log.error('Generate storyboard failed', { error: err.message });
      response.internalError(res, err.message || '生成分镜失败');
    }
  };
}

module.exports = function dramaRoutes(db, cfg, log) {
  return {
    createDrama: createDrama(db, log),
    getDrama: getDrama(db, cfg),
    listDramas: listDramas(db, log),
    updateDrama: updateDrama(db, log),
    deleteDrama: deleteDrama(db, log),
    getDramaStats: getDramaStats(db, log),
    saveOutline: saveOutline(db, log),
    getCharacters: getCharacters(db),
    saveCharacters: saveCharacters(db, log),
    saveEpisodes: saveEpisodes(db, log),
    saveProgress: saveProgress(db, log),
    listProps: listProps(db),
    finalizeEpisode: finalizeEpisode(db, log, cfg),
    downloadEpisodeVideo: downloadEpisodeVideo(db),
    generateStoryboard: generateStoryboard(db, log),
  };
};
