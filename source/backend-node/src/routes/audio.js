const response = require('../response');
const path = require('path');

function routes(db, log, cfg) {
  function getStoragePath() {
    const loadConfig = require('../config').loadConfig;
    const c = (cfg && cfg.storage) ? cfg : loadConfig();
    return path.isAbsolute(c.storage?.local_path)
      ? c.storage.local_path
      : path.join(process.cwd(), c.storage?.local_path || './data/storage');
  }

  return {
    /** 为单条分镜生成 TTS：对白 → audio_local_path；旁白 → narration_audio_local_path（body.tts_kind === 'narration'） */
    extract: async (req, res) => {
      const { storyboard_id, text, tts_kind } = req.body || {};
      if (!text && !storyboard_id) return response.badRequest(res, '请提供 storyboard_id 或 text');
      const kind = String(tts_kind || 'dialogue').toLowerCase() === 'narration' ? 'narration' : 'dialogue';
      let ttsText = text;
      if (kind === 'narration') {
        if ((!ttsText || !String(ttsText).trim()) && storyboard_id) {
          const row = db.prepare('SELECT narration FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(storyboard_id));
          ttsText = row?.narration;
        }
        if (!ttsText || !String(ttsText).trim()) {
          return response.badRequest(res, '分镜解说旁白为空，无法合成语音');
        }
      } else {
        if ((!ttsText || !String(ttsText).trim()) && storyboard_id) {
          const row = db.prepare('SELECT dialogue FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(storyboard_id));
          ttsText = row?.dialogue;
        }
        if (!ttsText || !String(ttsText).trim()) {
          return response.badRequest(res, '分镜对白为空，无法合成语音');
        }
      }
      try {
        const ttsService = require('../services/ttsService');
        const result = await ttsService.synthesize(db, log, {
          text: ttsText,
          storyboard_id: storyboard_id || null,
          storage_base: getStoragePath(),
        });
        if (storyboard_id && result.local_path) {
          const now = new Date().toISOString();
          try {
            if (kind === 'narration') {
              db.prepare('UPDATE storyboards SET narration_audio_local_path = ?, updated_at = ? WHERE id = ?').run(
                result.local_path, now, Number(storyboard_id)
              );
            } else {
              db.prepare('UPDATE storyboards SET audio_local_path = ?, updated_at = ? WHERE id = ?').run(
                result.local_path, now, Number(storyboard_id)
              );
            }
          } catch (_) {}
        }
        response.success(res, { local_path: result.local_path, url: result.local_path ? '/static/' + result.local_path : '', tts_kind: kind });
      } catch (err) {
        log.error('audio extract', { error: err.message });
        response.internalError(res, err.message);
      }
    },

    /** 批量为多条分镜生成 TTS */
    extractBatch: async (req, res) => {
      const { storyboard_ids } = req.body || {};
      if (!Array.isArray(storyboard_ids) || storyboard_ids.length === 0) {
        return response.badRequest(res, 'storyboard_ids 不能为空');
      }
      const results = [];
      const storagePath = getStoragePath();
      for (const sbId of storyboard_ids) {
        const row = db.prepare('SELECT id, dialogue FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(sbId));
        if (!row || !row.dialogue?.trim()) {
          results.push({ storyboard_id: sbId, error: '对白为空' });
          continue;
        }
        try {
          const ttsService = require('../services/ttsService');
          const result = await ttsService.synthesize(db, log, {
            text: row.dialogue,
            storyboard_id: row.id,
            storage_base: storagePath,
          });
          if (result.local_path) {
            const now = new Date().toISOString();
            try {
              db.prepare('UPDATE storyboards SET audio_local_path = ?, updated_at = ? WHERE id = ?').run(
                result.local_path, now, row.id
              );
            } catch (_) {}
          }
          results.push({ storyboard_id: sbId, local_path: result.local_path });
        } catch (err) {
          results.push({ storyboard_id: sbId, error: err.message });
        }
      }
      response.success(res, results);
    },
  };
}

module.exports = routes;
