/**
 * 分镜首帧/尾帧参考图与 storyboards、image_generations 的绑定。
 * frame_type: storyboard_first | storyboard_last | null（null 视为首帧/主图，兼容旧数据）
 */

function bindStoryboardFrameImage(db, storyboardId, frameType, imageGenId, imageUrl, localPath) {
  const sid = Number(storyboardId);
  if (!Number.isFinite(sid)) return;
  const now = new Date().toISOString();
  const url = imageUrl != null && String(imageUrl).trim() ? String(imageUrl).trim() : null;
  const lp = localPath != null && String(localPath).trim() ? String(localPath).trim() : null;
  const igId = imageGenId != null && Number.isFinite(Number(imageGenId)) ? Number(imageGenId) : null;
  let ft = frameType != null && String(frameType).trim() ? String(frameType).trim() : null;

  // 归一化常见别名，确保尾帧能正确路由
  if (ft === 'storyboard_last' || ft === 'tail' || ft === 'last_frame') ft = 'last';
  if (ft === 'storyboard_first' || ft === 'first_frame') ft = 'first';

  const isLast = ft === 'last';
  if (isLast) {
    db.prepare(
      `UPDATE storyboards SET last_frame_image_url = ?, last_frame_local_path = ?, last_frame_image_id = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`
    ).run(url, lp, igId, now, sid);
    try { require('../logger').info?.('[绑定] 尾帧图片已正确绑定到 storyboards.last_frame_*（不会污染主图或历史）', { storyboard_id: sid, image_gen_id: igId }); } catch (_) {}
    return;
  }
  // 首帧或普通分镜图：写入主图/首帧字段
  db.prepare(
    `UPDATE storyboards SET image_url = ?, local_path = ?, first_frame_image_id = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`
  ).run(url, lp, igId, now, sid);
}

module.exports = { bindStoryboardFrameImage };
