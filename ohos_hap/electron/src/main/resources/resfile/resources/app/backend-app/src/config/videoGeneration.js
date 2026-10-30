/**
 * 与 videoService 异步轮询一致：config.yaml 中 video.generation_timeout_minutes，缺省或非法时为 30。
 */
function resolveVideoGenerationTimeoutMinutes(cfg) {
  if (!cfg) return 30;
  const raw = Number(cfg.video?.generation_timeout_minutes);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

module.exports = { resolveVideoGenerationTimeoutMinutes };
