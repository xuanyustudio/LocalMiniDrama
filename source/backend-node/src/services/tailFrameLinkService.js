const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getFfmpegPath, hasLocalFfmpeg } = require('../utils/ffmpegPath');

/**
 * 尾帧衔接服务：提取当前分镜视频的最后一帧，设为下一个分镜的首帧
 */
function routes(db, cfg, log) {
  return {
    linkTailFrame: async (req, res) => {
      try {
        const storyboardId = parseInt(req.params.id, 10);
        const body = req.body || {};
        const dramaId = body.drama_id;

        if (!storyboardId || !dramaId) {
          return res.status(400).json({ error: '缺少必要参数' });
        }

        // 1. 获取当前分镜的最新已完成视频
        const video = db.prepare(`
          SELECT id, local_path, video_url FROM video_generations
          WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 1
        `).get(storyboardId);

        if (!video || !video.local_path) {
          return res.status(400).json({ error: '当前分镜没有可用的本地视频文件' });
        }

        // 2. 找到下一个分镜
        const currentSb = db.prepare('SELECT episode_id, storyboard_number FROM storyboards WHERE id = ?').get(storyboardId);
        if (!currentSb) {
          return res.status(404).json({ error: '分镜不存在' });
        }

        const nextSb = db.prepare(`
          SELECT id, storyboard_number FROM storyboards
          WHERE episode_id = ? AND storyboard_number > ? AND deleted_at IS NULL
          ORDER BY storyboard_number ASC LIMIT 1
        `).get(currentSb.episode_id, currentSb.storyboard_number || 0);

        if (!nextSb) {
          return res.status(400).json({ error: '没有下一个分镜可供衔接' });
        }

        // 3. 检查 ffmpeg 是否可用
        if (!hasLocalFfmpeg()) {
          return res.status(500).json({ error: '服务器未安装 ffmpeg，无法提取视频帧' });
        }

        const ffmpeg = getFfmpegPath();

        // 4. 构建视频文件绝对路径
        // local_path 通常是相对路径，如 media/videos/xxx.mp4
        const rawStorage = cfg?.storage?.local_path || './data/storage';
        const storageBase = path.isAbsolute(rawStorage)
          ? rawStorage
          : path.join(process.cwd(), rawStorage);
        const videoAbsPath = path.isAbsolute(video.local_path)
          ? video.local_path
          : path.join(storageBase, video.local_path.replace(/^\/+/, ''));

        if (!fs.existsSync(videoAbsPath)) {
          return res.status(400).json({ error: '视频文件不存在: ' + video.local_path });
        }

        // 5. 准备输出图片路径
        const timestamp = Date.now();
        const outputFileName = `tailframe_${storyboardId}_to_${nextSb.id}_${timestamp}.jpg`;
        const imagesDir = path.join(storageBase, 'media', 'images');
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }
        const outputAbsPath = path.join(imagesDir, outputFileName);
        const outputRelPath = `media/images/${outputFileName}`;

        // 6. 使用 ffmpeg 提取最后一帧
        // 使用 -sseof -1 定位到最后一秒，然后取第一帧
        log.info('[尾帧衔接] 开始提取', { from: video.local_path, to: outputRelPath });

        const result = spawnSync(ffmpeg, [
          '-sseof', '-1',
          '-i', videoAbsPath,
          '-update', '1',
          '-q:v', '2',
          '-frames:v', '1',
          '-y',
          outputAbsPath
        ], { encoding: 'utf8', timeout: 60000 });

        if (result.error || result.status !== 0) {
          log.error('[尾帧衔接] ffmpeg 失败', { stderr: result.stderr?.slice(-500) });
          return res.status(500).json({ error: 'ffmpeg 提取帧失败: ' + (result.stderr || result.error?.message || '未知错误') });
        }

        if (!fs.existsSync(outputAbsPath)) {
          return res.status(500).json({ error: '提取帧后文件未生成' });
        }

        // 7. 获取图片尺寸（可选，用于记录）
        let width = null, height = null;
        try {
          const { getFfprobePath } = require('../utils/ffmpegPath');
          const ffprobe = getFfprobePath && getFfprobePath();
          if (ffprobe) {
            const probe = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', outputAbsPath], { encoding: 'utf8' });
            if (probe.stdout) {
              const [w, h] = probe.stdout.trim().split('x');
              width = w ? parseInt(w, 10) : null;
              height = h ? parseInt(h, 10) : null;
            }
          }
        } catch (_) { /* 忽略尺寸探测错误 */ }

        // 8. 在 image_generations 表创建记录
        const now = new Date().toISOString();
        const prompt = `尾帧衔接：从分镜 #${currentSb.storyboard_number ?? storyboardId} 视频提取的最后一帧`;

        const insert = db.prepare(`
          INSERT INTO image_generations (
            drama_id, episode_id, storyboard_id, prompt, provider, model, status,
            image_url, local_path, width, height,
            created_at, updated_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // 假设有 files_base_url 配置
        const filesBase = cfg?.files?.base_url || '';
        const imageUrl = filesBase ? `${filesBase.replace(/\/$/, '')}/${outputRelPath}` : null;

        const info = insert.run(
          dramaId,
          currentSb.episode_id,
          nextSb.id,  // 关联到下一个分镜
          prompt,
          'tail-frame',           // provider 不能为 NULL
          'tail-frame-extract',
          'completed',
          imageUrl,
          outputRelPath,
          width,
          height,
          now,
          now,
          now
        );

        const newImageId = info.lastInsertRowid;

        // 9. 更新下一个分镜的 first_frame_image_id
        // 先获取当前首帧（用于历史记录，如果需要）
        const nextSbCurrent = db.prepare('SELECT first_frame_image_id, image_url, local_path FROM storyboards WHERE id = ?').get(nextSb.id);

        db.prepare(`
          UPDATE storyboards
          SET first_frame_image_id = ?, image_url = ?, local_path = ?, updated_at = ?
          WHERE id = ?
        `).run(newImageId, imageUrl, outputRelPath, now, nextSb.id);

        log.info('[尾帧衔接] 完成', {
          from_storyboard: storyboardId,
          to_storyboard: nextSb.id,
          new_image_id: newImageId,
          prev_first_frame_id: nextSbCurrent?.first_frame_image_id
        });

        res.json({
          success: true,
          message: '尾帧衔接成功',
          next_storyboard_id: nextSb.id,
          new_first_frame_image_id: newImageId,
          image_url: imageUrl,
          local_path: outputRelPath
        });

      } catch (err) {
        log.error('storyboards link-tail-frame', { error: err.message, stack: err.stack });
        res.status(500).json({ error: err.message || '尾帧衔接失败' });
      }
    }
  };
}

module.exports = routes;