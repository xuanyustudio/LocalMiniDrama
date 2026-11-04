const path = require('path');
const response = require('../response');
const videoService = require('../services/videoService');
const taskService = require('../services/taskService');
const uploadService = require('../services/uploadService');
const storageLayout = require('../services/storageLayout');
const extensionAuth = require('../services/extensionAuth');
const { loadConfig } = require('../config');
const { normalizeAspectRatioForApi } = require('../services/videoClient');

function routes(db, log) {
  /** 把视频 Buffer 落盘 → 写入 video_generations(completed) → 回写分镜主视频 */
  const storeVideoForStoryboard = (storyboardId, file, { provider, prompt }) => {
    const sbRow = db.prepare('SELECT id, episode_id FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(storyboardId);
    if (!sbRow) {
      const err = new Error('分镜不存在');
      err.status = 404;
      throw err;
    }
    // storyboards 没有 drama_id，需通过 episode 关联获取
    let dramaId = 0;
    try {
      const ep = db.prepare('SELECT drama_id FROM episodes WHERE id = ? AND deleted_at IS NULL').get(sbRow.episode_id);
      dramaId = ep?.drama_id || 0;
    } catch (_) {}
    const cfg = loadConfig();
    const rawStorage = cfg?.storage?.local_path || './data/storage';
    const storagePath = path.isAbsolute(rawStorage) ? rawStorage : path.join(process.cwd(), rawStorage);
    const baseUrl = (cfg?.storage?.base_url || '').replace(/\/$/, '');
    const projectSubdir = dramaId ? storageLayout.getProjectStorageSubdir(db, dramaId) : null;
    const result = uploadService.uploadFile(
      storagePath,
      baseUrl,
      log,
      file.buffer,
      file.originalname || 'video.mp4',
      file.mimetype,
      'videos',
      projectSubdir
    );
    const now = new Date().toISOString();
    // 写入一条已完成的 video_generations 记录，便于前端「历史视频」切换
    db.prepare(
      `INSERT INTO video_generations
        (drama_id, storyboard_id, provider, prompt, video_url, local_path, status, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`
    ).run(dramaId, storyboardId, provider, prompt, result.url || null, result.local_path, now, now, now);
    const videoGenId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    // 回写分镜主视频地址，合成视频时直接采用
    try {
      db.prepare('UPDATE storyboards SET video_url = ?, local_path = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
        .run(result.url || null, result.local_path, now, storyboardId);
    } catch (_) {}
    const item = videoService.getById(db, videoGenId);
    log.info('Video stored for storyboard', { provider, storyboard_id: storyboardId, video_gen_id: videoGenId, local_path: result.local_path });
    return item || { id: videoGenId, status: 'completed', video_url: result.url, local_path: result.local_path };
  };

  const respondStoreError = (res, err, fallback) => {
    if (err && err.status === 404) return response.notFound(res, err.message);
    return response.internalError(res, (err && err.message) || fallback);
  };

  /** 手动/插件上传视频 */
  const persistUploadedVideo = (req, res, { provider, prompt }) => {
    try {
      if (!req.file || !req.file.buffer) {
        return response.badRequest(res, '请选择视频文件');
      }
      // 签名中间件已解析并校验 storyboard_id，优先使用其结果
      const storyboardId = Number(req.extensionUpload?.storyboardId || req.body?.storyboard_id || 0);
      if (!storyboardId || storyboardId <= 0) {
        return response.badRequest(res, 'storyboard_id 必填');
      }
      const item = storeVideoForStoryboard(storyboardId, req.file, { provider, prompt });
      response.created(res, item);
    } catch (err) {
      log.error('videos persistUploadedVideo', { provider, error: err.message });
      respondStoreError(res, err, '上传失败');
    }
  };

  return {
    list: (req, res) => {
      try {
        const query = { ...req.query };
        const { items, total, page, pageSize } = videoService.list(db, query);
        response.successWithPagination(res, items, total, page, pageSize);
      } catch (err) {
        log.error('videos list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    create: (req, res) => {
      try {
        const body = req.body || {};
        const task = taskService.createTask(db, log, 'video_generation', String(body.drama_id || ''));
        const now = new Date().toISOString();
        const dramaId = Number(body.drama_id) || 0;
        const storyboardId = body.storyboard_id != null ? Number(body.storyboard_id) : null;
        const provider = body.provider || 'chatfire';
        let prompt = body.prompt || '';
        const style = (body.style || '').toString().trim();
        if (style) {
          const baseLower = String(prompt || '').toLowerCase();
          const styleLower = style.toLowerCase();
          if (!baseLower.includes(styleLower)) {
            prompt = prompt ? `${prompt}. Style: ${style}` : `Style: ${style}`;
          }
        }
        const model = body.model ?? null;
        const duration = body.duration ?? null;
        // 画幅：请求体归一化（全角冒号等）后写入 DB；未传则从 drama.metadata 读取并同样归一化
        let aspectRatio = null;
        if (body.aspect_ratio != null && String(body.aspect_ratio).trim() !== '') {
          aspectRatio = normalizeAspectRatioForApi(body.aspect_ratio);
        }
        if (!aspectRatio && dramaId) {
          try {
            const dramaRow = db.prepare('SELECT metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(dramaId);
            if (dramaRow && dramaRow.metadata) {
              const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
              if (meta && meta.aspect_ratio) aspectRatio = normalizeAspectRatioForApi(meta.aspect_ratio);
            }
          } catch (_) {}
        }
        const resolution = body.resolution ?? null;
        const seed = body.seed != null ? Number(body.seed) : null;
        const cameraFixed = body.camera_fixed != null ? (body.camera_fixed ? 1 : 0) : null;
        const watermark = body.watermark != null ? (body.watermark ? 1 : 0) : 0;
        const imageUrl = body.image_url ?? null;
        // 首尾帧：支持 URL 或本地路径（sxy，存到 first_frame_url / last_frame_url）
        const firstFrameUrl = body.first_frame_url ?? body.first_frame_local_path ?? null;
        const lastFrameUrl = body.last_frame_url ?? body.last_frame_local_path ?? null;
        // 多图模式：sxy，存 JSON 数组到 reference_image_urls
        const refImagesJson =
          body.reference_image_urls && Array.isArray(body.reference_image_urls)
            ? JSON.stringify(body.reference_image_urls.slice(0, 10))
            : null;
        db.prepare(
          `INSERT INTO video_generations (drama_id, storyboard_id, provider, prompt, model, duration, aspect_ratio, resolution, seed, camera_fixed, watermark, image_url, first_frame_url, last_frame_url, reference_image_urls, status, task_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)`
        ).run(dramaId, storyboardId, provider, prompt, model, duration, aspectRatio, resolution, seed, cameraFixed, watermark, imageUrl, firstFrameUrl, lastFrameUrl, refImagesJson, task.id, now, now);
        const videoGenId = db.prepare('SELECT last_insert_rowid() as id').get().id;
        setImmediate(() => {
          videoService.processVideoGeneration(db, log, videoGenId);
        });
        const item = videoService.getById(db, videoGenId);
        response.created(res, item || { id: videoGenId, task_id: task.id, status: 'processing' });
      } catch (err) {
        log.error('videos create', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    get: (req, res) => {
      try {
        const item = videoService.getById(db, req.params.id);
        if (!item) return response.notFound(res, '记录不存在');
        response.success(res, item);
      } catch (err) {
        log.error('videos get', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const ok = videoService.deleteById(db, log, req.params.id);
        if (!ok) return response.notFound(res, '记录不存在');
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('videos delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    /** 失败后复用 provider_task_id 继续轮询上游，避免浪费已提交任务 */
    resumePoll: (req, res) => {
      try {
        const result = videoService.resumeFailedVideoPoll(db, log, req.params.id);
        if (!result.ok) {
          if (result.status === 404) return response.notFound(res, result.error);
          return response.badRequest(res, result.error);
        }
        response.success(res, result.item);
      } catch (err) {
        log.error('videos resumePoll', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    fromImage: (req, res) => {
      try {
        const task = taskService.createTask(db, log, 'video_generation', req.params.image_gen_id);
        response.success(res, { task_id: task.id });
      } catch (err) {
        log.error('videos fromImage', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    /** 手动上传视频替换分镜视频 */
    uploadManual: (req, res) => persistUploadedVideo(req, res, { provider: 'manual', prompt: req.body?.prompt || '手动上传视频' }),
    /** 粘贴远程链接：服务端直接下载视频并替换分镜视频 */
    fetchRemote: async (req, res) => {
      const storyboardId = Number(req.body?.storyboard_id || 0);
      if (!storyboardId || storyboardId <= 0) {
        return response.badRequest(res, 'storyboard_id 必填');
      }
      const rawUrl = String(req.body?.url || '').trim();
      let parsed;
      try {
        parsed = new URL(rawUrl);
      } catch (_) {
        return response.badRequest(res, '请输入合法的视频链接');
      }
      if (!/^https?:$/.test(parsed.protocol)) {
        return response.badRequest(res, '仅支持 http/https 链接');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
      try {
        const dl = await fetch(rawUrl, { method: 'GET', redirect: 'follow', signal: controller.signal });
        if (!dl.ok) {
          return response.badRequest(res, `下载失败（HTTP ${dl.status}）`);
        }
        const contentType = String(dl.headers.get('content-type') || '');
        if (/^text\/|json|html/i.test(contentType)) {
          return response.badRequest(res, '该链接返回的不是视频文件');
        }
        const buffer = Buffer.from(await dl.arrayBuffer());
        if (!buffer.length) {
          return response.badRequest(res, '下载到的文件为空');
        }
        const base = path.basename(parsed.pathname) || 'remote_video';
        const originalname = /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.mp4`;
        const item = storeVideoForStoryboard(
          storyboardId,
          { buffer, originalname, mimetype: contentType || 'video/mp4' },
          { provider: 'remote_url', prompt: req.body?.prompt || '远程链接下载' }
        );
        response.created(res, item);
      } catch (err) {
        if (err && err.name === 'AbortError') {
          return response.badRequest(res, '下载超时，请检查链接是否可访问');
        }
        log.error('videos fetchRemote', { error: err.message });
        respondStoreError(res, err, '下载失败');
      }
    },
    /** 签发插件上传凭证：{ storyboard_id } → { storyboard_id, ts, nonce, sign, expires_in } */
    extensionCredential: (req, res) => {
      try {
        const storyboardId = req.body?.storyboard_id != null ? Number(req.body.storyboard_id) : 0;
        if (!storyboardId || storyboardId <= 0) {
          return response.badRequest(res, 'storyboard_id 必填');
        }
        const sbRow = db.prepare('SELECT id FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(storyboardId);
        if (!sbRow) {
          return response.notFound(res, '分镜不存在');
        }
        const cred = extensionAuth.issueCredential(loadConfig(), storyboardId);
        if (!cred.ok) {
          return response.internalError(res, cred.reason || '凭证签发失败');
        }
        response.success(res, {
          storyboard_id: storyboardId,
          ts: cred.ts,
          nonce: cred.nonce,
          sign: cred.sign,
          expires_in: cred.expires_in,
        });
      } catch (err) {
        log.error('videos extensionCredential', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    /** 插件上传签名校验（须在 multer 之前执行，避免非法请求占用内存/落盘） */
    verifyExtensionUpload: (req, res, next) => {
      try {
        const h = req.headers || {};
        const q = req.query || {};
        const storyboardId = h['x-lmd-storyboard-id'] ?? q.storyboard_id;
        const ts = h['x-lmd-ts'] ?? q.ts;
        const nonce = h['x-lmd-nonce'] ?? q.nonce;
        const sign = h['x-lmd-sign'] ?? q.sign;
        const result = extensionAuth.verifyCredential(loadConfig(), { storyboardId, ts, nonce, sign });
        if (!result.ok) {
          log.warn('extension upload rejected', { storyboard_id: storyboardId, reason: result.reason });
          return response.forbidden(res, `签名校验失败：${result.reason}`);
        }
        req.extensionUpload = { storyboardId: Number(storyboardId) };
        next();
      } catch (err) {
        log.error('videos verifyExtensionUpload', { error: err.message });
        response.forbidden(res, '签名校验异常');
      }
    },
    /** 插件生成视频上传：签名校验通过后保存并关联分镜主视频 */
    uploadExtension: (req, res) => persistUploadedVideo(req, res, { provider: 'extension', prompt: '插件生成视频' }),
    episodeBatch: (req, res) => {
      try {
        response.success(res, []);
      } catch (err) {
        log.error('videos episode batch', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
