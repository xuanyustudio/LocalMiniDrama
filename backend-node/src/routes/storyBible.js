const response = require('../response');
const bibles = require('../services/storyBibleService');
const pipeline = require('../services/pipelineService');
const { AdaptationInputError } = require('../services/novelAdaptationService');

function registerStoryBible(r, db, log, adaptation) {
  function handle(action) {
    return async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1 || !db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(id)) {
        return response.notFound(res, '项目不存在。');
      }
      try { response.success(res, await action(id, req.body || {})); }
      catch (err) {
        if (err instanceof bibles.StoryBibleInputError || err instanceof AdaptationInputError) return response.badRequest(res, err.message);
        if (err.code === 'PRODUCTION_APPROVAL_REQUIRED') return response.forbidden(res, err.message);
        log.error('故事档案/剧本医生接口出错', { project_id: id, error: err.message });
        response.internalError(res, err.message || '处理失败，请重试。');
      }
    };
  }

  r.get('/dramas/:id/story-bible', handle((id) => bibles.getBible(db, id)));
  r.put('/dramas/:id/story-bible', handle((id, body) => bibles.saveBible(db, id, body.bible)));
  // 生成的是草稿，由创作者检查后再保存
  r.post('/dramas/:id/story-bible/generate', handle(async (id, body) => {
    const text = typeof body.text === 'string' && body.text.trim() ? body.text : adaptation.chapterText(id, body.chapter);
    return { draft: await bibles.generateBible(db, log, id, text) };
  }));
  // 免费：合并本剧角色库到草稿（body.bible 为当前编辑中的内容）
  r.post('/dramas/:id/story-bible/import-characters', handle((id, body) => bibles.importCharacters(db, id, body.bible)));
  // ai: false 只做免费规则体检；ai: true 额外请剧本医生审阅（计费）
  r.post('/dramas/:id/script-review', handle(async (id, body) => {
    const script = typeof body.script === 'string' ? body.script : '';
    if (!script.trim()) throw new bibles.StoryBibleInputError('请先提供剧本。');
    if (body.ai === true) return bibles.reviewScript(db, log, id, script, body.seconds);
    return { ...bibles.checkScriptRules(script, body.seconds, bibles.getBible(db, id).bible), ai: null };
  }));
  // 流水线体检（免费）：九个工位逐个亮灯，并给出可一键执行的免费修复
  r.get('/dramas/:id/pipeline', handle((id) => pipeline.report(db, id, adaptation)));
  // 放行闸门：本集每个镜头能否生成画面/视频，以及原因
  r.get('/episodes/:id/readiness', (req, res) => {
    try { response.success(res, require('../services/pipelineGate').episodeReadiness(db, Number(req.params.id))); }
    catch (err) { log.error('放行检查出错', { episode_id: req.params.id, error: err.message }); response.internalError(res, err.message); }
  });
  r.post('/dramas/:id/pipeline/fix',handle((id, body) => pipeline.applyFix(db, id, String(body.action || ''), adaptation)));
}

module.exports = { registerStoryBible };
