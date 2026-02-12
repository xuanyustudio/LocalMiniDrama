/** 将 video_generations 标为失败；若无 error_msg 列则只更新 status/updated_at */
function setVideoGenFailed(db, videoGenId, errorMsg, now) {
  try {
    db.prepare('UPDATE video_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?').run(
      'failed', (errorMsg || '').slice(0, 500), now, videoGenId
    );
  } catch (e) {
    if ((e.message || '').includes('error_msg')) {
      db.prepare('UPDATE video_generations SET status = ?, updated_at = ? WHERE id = ?').run('failed', now, videoGenId);
    } else throw e;
  }
}

function list(db, query) {
  let sql = 'FROM video_generations WHERE deleted_at IS NULL';
  const params = [];
  if (query.drama_id) {
    sql += ' AND drama_id = ?';
    params.push(query.drama_id);
  }
  if (query.storyboard_id) {
    sql += ' AND storyboard_id = ?';
    params.push(query.storyboard_id);
  }
  // 与 Go 前端行为对齐：请求 status=processing 时，同时包含“刚结束”的记录（5 分钟内变为 completed/failed），
  // 这样轮询刷新后任务不会从列表消失，无需改 Vue
  if (query.status === 'processing') {
    sql += " AND (status = 'processing' OR (status IN ('completed','failed') AND updated_at >= datetime('now', '-5 minutes')))";
  } else if (query.status) {
    sql += ' AND status = ?';
    params.push(query.status);
  }
  const countRow = db.prepare('SELECT COUNT(*) as total ' + sql).get(...params);
  const total = countRow.total || 0;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.page_size, 10) || 20));
  const offset = (page - 1) * pageSize;
  const rows = db.prepare('SELECT * ' + sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, pageSize, offset);
  return { items: rows.map(rowToItem), total, page, pageSize };
}

function rowToItem(r) {
  return {
    id: r.id,
    storyboard_id: r.storyboard_id,
    drama_id: r.drama_id,
    provider: r.provider,
    prompt: r.prompt,
    model: r.model,
    image_gen_id: r.image_gen_id,
    image_url: r.image_url,
    video_url: r.video_url,
    local_path: r.local_path,
    status: r.status,
    task_id: r.task_id,
    error_msg: r.error_msg,
    created_at: r.created_at,
    updated_at: r.updated_at,
    completed_at: r.completed_at,
  };
}

function getById(db, id) {
  const r = db.prepare('SELECT * FROM video_generations WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return r ? rowToItem(r) : null;
}

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const videoClient = require('./videoClient');
const taskService = require('./taskService');

/** 将远程 video_url 下载到本地 storage/videos，返回相对路径（如 videos/xxx.mp4），失败返回 null */
async function downloadVideoToLocal(storagePath, videoUrl, videoGenId, log) {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  const dir = path.join(storagePath, 'videos');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = (videoUrl.split('?')[0].match(/\.(mp4|webm|mov)$/i) || [])[1] || 'mp4';
    const name = `vg_${videoGenId}_${randomUUID().slice(0, 8)}.${ext}`;
    const filePath = path.join(dir, name);
    const res = await fetch(videoUrl, { method: 'GET' });
    if (!res.ok) {
      log.warn('Download video failed', { status: res.status, videoGenId });
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buf);
    const relativePath = `videos/${name}`;
    log.info('Video saved to local', { videoGenId, local_path: relativePath });
    return relativePath;
  } catch (e) {
    log.warn('Download video error', { videoGenId, error: e.message });
    return null;
  }
}

async function processVideoGeneration(db, log, videoGenId) {
  log.info('processVideoGeneration started', { videoGenId });
  const row = db.prepare('SELECT * FROM video_generations WHERE id = ? AND deleted_at IS NULL').get(Number(videoGenId));
  if (!row) {
    log.error('Video generation not found', { id: videoGenId });
    return;
  }
  const now = new Date().toISOString();
  try {
    db.prepare('UPDATE video_generations SET status = ?, updated_at = ? WHERE id = ?').run('processing', now, videoGenId);
    const loadConfig = require('../config').loadConfig;
    const cfg = loadConfig();
    const filesBaseUrl = (cfg.storage && cfg.storage.base_url) ? String(cfg.storage.base_url).replace(/\/$/, '') : '';
    const storageLocalPath = path.isAbsolute(cfg.storage?.local_path)
      ? cfg.storage.local_path
      : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
    const config = videoClient.getDefaultVideoConfig(db, row.model);
    if (!config) {
      setVideoGenFailed(db, videoGenId, '未配置视频模型', now);
      if (row.task_id) taskService.updateTaskError(db, row.task_id, '未配置视频模型');
      return;
    }
    let reference_urls = null;
    if (row.reference_image_urls) {
      try {
        reference_urls = JSON.parse(row.reference_image_urls);
        if (!Array.isArray(reference_urls)) reference_urls = null;
      } catch (_) {}
    }
    const result = await videoClient.callVideoApi(db, log, {
      prompt: row.prompt,
      model: row.model,
      duration: row.duration,
      aspect_ratio: row.aspect_ratio,
      provider: row.provider,
      image_url: row.image_url,
      first_frame_url: row.first_frame_url,
      last_frame_url: row.last_frame_url,
      reference_urls,
      files_base_url: filesBaseUrl,
      storage_local_path: storageLocalPath,
      video_gen_id: videoGenId,
    });
    const now2 = new Date().toISOString();
    if (result.error) {
      setVideoGenFailed(db, videoGenId, result.error, now2);
      if (row.task_id) taskService.updateTaskError(db, row.task_id, result.error);
      log.error('Video generation failed', { id: videoGenId, error: result.error });
      return;
    }
    if (result.video_url) {
      let localPath = null;
      try {
        const loadConfig = require('../config').loadConfig;
        const cfg = loadConfig();
        const storagePath = path.isAbsolute(cfg.storage?.local_path)
          ? cfg.storage.local_path
          : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
        localPath = await downloadVideoToLocal(storagePath, result.video_url, videoGenId, log);
      } catch (_) {}
      try {
        db.prepare(
          'UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
        ).run('completed', result.video_url, localPath, now2, now2, videoGenId);
      } catch (e) {
        if ((e.message || '').includes('completed_at')) {
          db.prepare(
            'UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, updated_at = ? WHERE id = ?'
          ).run('completed', result.video_url, localPath, now2, videoGenId);
        } else throw e;
      }
      if (row.task_id) taskService.updateTaskResult(db, row.task_id, { video_generation_id: videoGenId, video_url: result.video_url, status: 'completed' });
      log.info('Video generation completed', { id: videoGenId, video_url: result.video_url, local_path: localPath });
      return;
    }
    if (result.task_id) {
      db.prepare('UPDATE video_generations SET status = ?, updated_at = ? WHERE id = ?').run(
        'processing',
        now2,
        videoGenId
      );
      const pollResult = await videoClient.pollVideoTask(db, log, videoGenId, result.task_id, config);
      const now3 = new Date().toISOString();
      if (pollResult.video_url) {
        let localPath = null;
        try {
          const loadConfig = require('../config').loadConfig;
          const cfg = loadConfig();
          const storagePath = path.isAbsolute(cfg.storage?.local_path)
            ? cfg.storage.local_path
            : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
          localPath = await downloadVideoToLocal(storagePath, pollResult.video_url, videoGenId, log);
        } catch (_) {}
        try {
          db.prepare(
            'UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
          ).run('completed', pollResult.video_url, localPath, now3, now3, videoGenId);
        } catch (e) {
          if ((e.message || '').includes('completed_at')) {
            db.prepare(
              'UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, updated_at = ? WHERE id = ?'
            ).run('completed', pollResult.video_url, localPath, now3, videoGenId);
          } else throw e;
        }
        if (row.task_id) taskService.updateTaskResult(db, row.task_id, { video_generation_id: videoGenId, video_url: pollResult.video_url, status: 'completed' });
        log.info('Video generation completed (after poll)', { id: videoGenId, local_path: localPath });
      } else {
        setVideoGenFailed(db, videoGenId, pollResult.error || '超时或失败', now3);
        if (row.task_id) taskService.updateTaskError(db, row.task_id, pollResult.error);
      }
      return;
    }
    setVideoGenFailed(db, videoGenId, '未返回 task_id 或 video_url', now2);
    if (row.task_id) taskService.updateTaskError(db, row.task_id, '未返回 task_id 或 video_url');
  } catch (err) {
    const now2 = new Date().toISOString();
    setVideoGenFailed(db, videoGenId, err.message, now2);
    if (row && row.task_id) taskService.updateTaskError(db, row.task_id, err.message);
    log.error('Video generation error', { id: videoGenId, error: err.message });
  }
}

function deleteById(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE video_generations SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  return result.changes > 0;
}

module.exports = {
  list,
  getById,
  deleteById,
  processVideoGeneration,
};
