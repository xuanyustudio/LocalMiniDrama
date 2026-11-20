const express = require('express');
const response = require('../response');
const { profileStatus, activateProfiles } = require('../services/productionProviders');
const { quoteProduction } = require('../services/productionCostService');
const { offerApproval, confirmApproval } = require('../services/productionApproval');
const { AdaptationInputError } = require('../services/novelAdaptationService');

async function agentApprovalItems(db, data) {
  const { getHistory } = await import('../mastra/index.mjs');
  const { resolveEpisode } = await import('../mastra/context.mjs');
  const dramaId = Number(data?.dramaId);
  const episodeId = data?.episodeId == null ? null : Number(data.episodeId);
  if (!db.prepare('SELECT id FROM dramas WHERE id = ? AND deleted_at IS NULL').get(dramaId)) throw new AdaptationInputError('项目不存在。');
  const { pendingApprovals } = await getHistory(dramaId);
  const pending = pendingApprovals.find(item => item.runId === data.runId && item.toolCallId === data.toolCallId);
  if (!pending) throw new AdaptationInputError('找不到这次确认。');
  const items = [{ kind: 'agent' }];
  const kinds = { generate_story: 'story', generate_characters: 'characters', generate_scenes: 'scenes', generate_storyboards: 'boards' };
  if (Object.hasOwn(kinds, pending.toolName)) {
    const kind = kinds[pending.toolName];
    const episode = kind === 'story' ? null : resolveEpisode(db, dramaId, episodeId);
    if (episode && !episode.ok) throw new AdaptationInputError(episode.error);
    items.push({ kind, id: episode?.episodeId });
  } else if (pending.toolName === 'generate_image') {
    if (pending.type === 'storyboard') items.push({ kind: 'storyboard_image', data: { storyboard_id: pending.id } });
    if (pending.type === 'character') items.push({ kind: 'character_image', id: pending.id });
    if (pending.type === 'scene') items.push({ kind: 'scene_image', id: pending.id, quad: pending.quad });
  }
  return items;
}

module.exports = function productionProfile(db, log, adaptation) {
  const router = express.Router();
  router.get('/', (_req, res) => {
    try { response.success(res, profileStatus(db)); }
    catch (error) { response.internalError(res, error.message); }
  });
  router.post('/activate', (req, res) => {
    try { response.success(res, activateProfiles(db, log, req.body || {})); }
    catch (error) { response.badRequest(res, error.message); }
  });
  router.post('/quote', async (req, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || !items.length || items.length > 500 ||
      items.some(item => typeof item?.kind !== 'string' || (item.data !== undefined && (!item.data || typeof item.data !== 'object')))) {
      return response.badRequest(res, '请提供本次要估算的制作项目。');
    }
    try {
      const scopes = new Set();
      const planned = [];
      for (const item of items) {
        if (item.kind === 'agent_approval') planned.push(...await agentApprovalItems(db, item.data));
        else planned.push(item);
      }
      const quote = quoteProduction(db, adaptation, planned, scopes);
      const offer = req.body.prepare_confirmation === true ? offerApproval(scopes, items.length) : null;
      response.success(res, { ...quote, offer });
    }
    catch (error) {
      if (error instanceof AdaptationInputError) return response.badRequest(res, error.message);
      log.warn('制作费用估算失败', { error: error.message });
      response.internalError(res, '暂时无法计算本次费用。');
    }
  });
  router.post('/quote/confirm', (req, res) => {
    const receipt = confirmApproval(req.body?.offer);
    if (!receipt) return response.badRequest(res, '此报价已过期或已确认，请重新查看报价。');
    response.success(res, { receipt });
  });
  return router;
};
