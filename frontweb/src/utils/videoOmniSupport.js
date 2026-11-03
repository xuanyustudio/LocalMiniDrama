/**
 * 全能分镜生视频的多图参考能力判定（前端侧，与后端 videoClient.shouldUseVolcOmniMultiReference 对齐）。
 * 从 views/FilmCreate.vue 抽离，便于 node --test 直接单测。
 */

export function videoModelNameFromAiConfig(cfg) {
  if (!cfg) return ''
  const dm = (cfg.default_model || '').toString().trim()
  if (dm) return dm
  const m = cfg.model
  if (Array.isArray(m) && m.length) return String(m[0]).trim()
  return String(m || '').trim()
}

/**
 * Seedance 2.x 家族模型名判定（与后端 videoClient.isSeedance2FamilyModel 对齐）。
 * 含官方 doubao-seedance-2-0-* / doubao-seedance-2.5-260628 / jimeng-video-seedance-2.0，
 * 以及中转别名 mingiz-sd2、*-sd2 等。
 */
export function isSeedance2VideoModel(modelName) {
  const m = String(modelName || '').toLowerCase().trim()
  if (!m) return false
  if (/seedance[-_]?2|seedance2/.test(m)) return true
  if (/2[-_]0[-_]/.test(m)) return true
  // 网关别名：mingiz-sd2、foo_sd2、sd2-bar
  if (/(^|[-_./])sd2($|[-_./])/.test(m)) return true
  return false
}

export function parseAiConfigSettings(cfg) {
  if (!cfg?.settings) return {}
  if (typeof cfg.settings === 'object') return cfg.settings
  try {
    const parsed = JSON.parse(cfg.settings)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (_) {
    return {}
  }
}

/**
 * 全能分镜 + 当前视频配置是否可走多图参考
 * （可灵 Omni、火山 Seedance 2.x / 全能、Agnes、低价 Seedance2、显式勾选等）。
 */
export function canUseUniversalOmniVideoApi(cfg) {
  if (!cfg) return false
  const proto = String(cfg.api_protocol || '').toLowerCase()
  const provider = String(cfg.provider || '').toLowerCase()
  const model = videoModelNameFromAiConfig(cfg).toLowerCase()
  if (proto === 'kling_omni') return true
  // 选了 volcengine_omni 即表示走多图参考；模型名可能是 996 等网关别名（如 mingiz-sd2），勿再按 seedance 字样拦截
  if (proto === 'volcengine_omni') return true
  if (proto === 'agnes' || provider === 'agnes' || /agnes-video/.test(model)) {
    return true
  }
  // 低价 Seedance2（ohmybb）：支持最多 9 张参考图
  if (provider === 'cheap_seedance2' || /^wb-seedance-2/.test(model) || /^yk-seedance/.test(model) || model === 'minimax-h3-1080p-15s') return true
  // Seedance 2.x 家族（含 doubao-seedance-2.5-260628 等新版本）本身支持多图参考，
  // 配置常走标准「火山引擎」协议，不能再误判为不支持而降级（issue #49）
  if (isSeedance2VideoModel(model)) return true
  // AI 配置中显式勾选「确认支持全能模式」
  const s = parseAiConfigSettings(cfg)
  if (s.supports_universal_omni === true || s.supports_universal_omni === 1 || s.supports_universal_omni === 'true') {
    return true
  }
  return false
}
