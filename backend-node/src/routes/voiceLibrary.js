// backend-node/src/routes/voiceLibrary.js
const response = require('../response');
const path = require('path');
const voiceLibraryService = require('../services/voiceLibraryService');

function routes(db, cfg, log) {
  function getStoragePath() {
    const loadConfig = require('../config').loadConfig;
    const c = (cfg && cfg.storage) ? cfg : loadConfig();
    return path.isAbsolute(c.storage?.local_path)
      ? c.storage.local_path
      : path.join(process.cwd(), c.storage?.local_path || './data/storage');
  }

  return {
    list: (req, res) => {
      try {
        const items = voiceLibraryService.listVoices(db, {
          gender: req.query.gender,
          source: req.query.source,
          tag: req.query.tag,
        });
        response.success(res, { items });
      } catch (err) {
        log.error('voice-library list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    importElevenLabs: async (req, res) => {
      try {
        const item = await voiceLibraryService.importFromElevenLabs(db, log, getStoragePath(), req.body || {});
        response.created(res, item);
      } catch (err) {
        log.error('voice-library import-elevenlabs', { error: err.message });
        response.badRequest(res, err.message);
      }
    },
    designPreview: async (req, res) => {
      try {
        const preview = await voiceLibraryService.previewDesign(db, log, getStoragePath(), req.body || {});
        response.success(res, preview);
      } catch (err) {
        log.error('voice-library design-preview', { error: err.message });
        response.badRequest(res, err.message);
      }
    },
    designSave: (req, res) => {
      try {
        const item = voiceLibraryService.saveDesign(db, log, getStoragePath(), req.body || {});
        response.created(res, item);
      } catch (err) {
        log.error('voice-library design-save', { error: err.message });
        response.badRequest(res, err.message);
      }
    },
    test: async (req, res) => {
      try {
        const result = await voiceLibraryService.testSynthesize(db, log, getStoragePath(), {
          voice_id: req.params.id,
          text: req.body?.text,
        });
        response.success(res, result);
      } catch (err) {
        log.error('voice-library test', { error: err.message });
        response.badRequest(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const force = req.query.force === '1' || req.query.force === 'true';
        const out = voiceLibraryService.deleteVoice(db, log, req.params.id, force);
        if (!out.ok) {
          if (out.error === 'not_found') return response.notFound(res, '语音不存在');
          if (out.error === 'in_use') {
            return response.error(res, 409, 'IN_USE', `该语音正被 ${out.usageCount} 个角色使用，确认要删除吗？`, { usage_count: out.usageCount });
          }
        }
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('voice-library delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
