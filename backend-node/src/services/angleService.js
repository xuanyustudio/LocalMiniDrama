/**
 * angleService.js
 * 结构化视角服务：8方向 × 4俯仰 × 3景别 = 96种视角组合
 * 每种组合生成精确的英文镜头描述片段，供图片生成 prompt 使用。
 *
 * 字段说明（storyboards 表扩展字段）：
 *   angle_h  TEXT  水平方向（front/front_left/left/back_left/back/back_right/right/front_right）
 *   angle_v  TEXT  俯仰角度（worm/low/eye_level/high）
 *   angle_s  TEXT  景别（close_up/medium/wide）
 */

// ─── 枚举定义 ────────────────────────────────────────────────────────────────

/** 水平方向：8方向 */
const HORIZONTAL = {
  front:       'front',        // 正面
  front_left:  'front_left',   // 前左斜（45°）
  left:        'left',         // 正侧面
  back_left:   'back_left',    // 后左斜（135°）
  back:        'back',         // 正背面
  back_right:  'back_right',   // 后右斜
  right:       'right',        // 正右侧
  front_right: 'front_right',  // 前右斜
};

/** 俯仰角度：4等级 */
const ELEVATION = {
  worm:      'worm',      // 极低角度仰拍（虫眼视角）
  low:       'low',       // 低角度仰拍
  eye_level: 'eye_level', // 平视
  high:      'high',      // 高角度俯拍（鸟瞰）
};

/** 景别：3等级 */
const SHOT_SIZE = {
  close_up: 'close_up', // 近景/特写
  medium:   'medium',   // 中景
  wide:     'wide',     // 远景/全景
};

// ─── 英文 prompt 片段生成 ─────────────────────────────────────────────────────

/**
 * 水平方向描述
 */
const HORIZONTAL_DESC = {
  front:       'shooting from the front',
  front_left:  'shooting from front-left at 45-degree angle',
  left:        'shooting from the left side, profile view',
  back_left:   'shooting from back-left at 135-degree angle',
  back:        'shooting from behind, character\'s back to camera',
  back_right:  'shooting from back-right at 135-degree angle',
  right:       'shooting from the right side, profile view',
  front_right: 'shooting from front-right at 45-degree angle',
};

/**
 * 俯仰角度描述
 */
const ELEVATION_DESC = {
  worm:      'extreme low-angle worm\'s eye view, camera near ground pointing sharply upward, strong upward perspective distortion, background shows sky/ceiling',
  low:       'low-angle upward shot, camera below eye-line, slight upward tilt, empowering perspective',
  eye_level: 'eye-level shot, neutral perspective, natural horizontal framing',
  high:      'high-angle bird\'s eye view, camera above looking down, background shows floor/ground with downward perspective distortion',
};

/**
 * 景别描述（含构图建议）
 */
const SHOT_SIZE_DESC = {
  close_up: 'close-up shot (face/bust framing), subject fills most of frame, shallow depth of field, background softly blurred',
  medium:   'medium shot (waist-up to full body), character and immediate surroundings visible, moderate depth of field',
  wide:     'wide shot (full body with environment), subject small relative to scene, deep depth of field, environment context prominent',
};

/**
 * 生成完整的镜头描述英文片段
 * @param {string} h - 水平方向（HORIZONTAL 枚举值）
 * @param {string} v - 俯仰角度（ELEVATION 枚举值）
 * @param {string} s - 景别（SHOT_SIZE 枚举值）
 * @returns {string} 英文 prompt 片段
 */
function toPromptFragment(h, v, s) {
  const hDesc = HORIZONTAL_DESC[h] || HORIZONTAL_DESC.front;
  const vDesc = ELEVATION_DESC[v] || ELEVATION_DESC.eye_level;
  const sDesc = SHOT_SIZE_DESC[s] || SHOT_SIZE_DESC.medium;
  return `${sDesc}, ${vDesc}, ${hDesc}`;
}

// ─── 旧文本解析（向后兼容） ────────────────────────────────────────────────────

/**
 * 中文关键字 → 枚举值映射（宽松匹配）
 */
const ZH_H_MAP = [
  { keys: ['背后', '背面', '从背', 'back'],                          val: 'back' },
  { keys: ['前左', '左前', 'front-left', 'front_left'],              val: 'front_left' },
  { keys: ['前右', '右前', 'front-right', 'front_right'],            val: 'front_right' },
  { keys: ['左侧', '正侧', '侧面', 'side', 'left'],                  val: 'left' },
  { keys: ['右侧', 'right'],                                          val: 'right' },
  { keys: ['后左', '左后', 'back-left', 'back_left'],                val: 'back_left' },
  { keys: ['后右', '右后', 'back-right', 'back_right'],              val: 'back_right' },
  { keys: ['正面', '前方', '面向', 'front'],                         val: 'front' },
];

const ZH_V_MAP = [
  { keys: ['虫眼', '极低', 'worm'],               val: 'worm' },
  { keys: ['仰', 'low angle', 'low-angle'],       val: 'low' },
  { keys: ['俯', 'high angle', 'bird'],            val: 'high' },
  { keys: ['平视', 'eye-level', 'eye level'],     val: 'eye_level' },
];

const ZH_S_MAP = [
  { keys: ['特写', '近景', 'close'],              val: 'close_up' },
  { keys: ['全景', '远景', '大全', 'wide', 'long shot', 'establishing'], val: 'wide' },
  { keys: ['中景', '半身', 'medium'],             val: 'medium' },
];

function matchMap(text, map) {
  const t = text.toLowerCase();
  for (const entry of map) {
    if (entry.keys.some(k => t.includes(k.toLowerCase()))) {
      return entry.val;
    }
  }
  return null;
}

/**
 * 从旧版自由文本的 angle 字段解析出结构化三元组
 * @param {string} angleText - 旧 angle 字段值（如 "俯拍中景"、"side low"）
 * @param {string} shotType  - 旧 shot_type 字段值（可辅助景别判断）
 * @returns {{ h: string, v: string, s: string }}
 */
function parseFromLegacyText(angleText, shotType = '') {
  const combined = `${angleText || ''} ${shotType || ''}`;

  const h = matchMap(combined, ZH_H_MAP) || 'front';
  const v = matchMap(combined, ZH_V_MAP) || 'eye_level';
  const s = matchMap(combined, ZH_S_MAP) || 'medium';

  return { h, v, s };
}

/**
 * 从旧版 angle 文本直接生成完整英文 prompt 片段（快捷方法）
 * @param {string} angleText
 * @param {string} shotType
 * @returns {string}
 */
function fromLegacyText(angleText, shotType = '') {
  const { h, v, s } = parseFromLegacyText(angleText, shotType);
  return toPromptFragment(h, v, s);
}

/**
 * 将结构化 angle 三元组转换为简短中文标签（用于前端展示）
 * @param {string} h
 * @param {string} v
 * @param {string} s
 * @returns {string}
 */
function toChineseLabel(h, v, s) {
  const hLabel = { front:'正面', front_left:'前左', left:'左侧', back_left:'后左', back:'背面', back_right:'后右', right:'右侧', front_right:'前右' }[h] || '正面';
  const vLabel = { worm:'虫眼仰', low:'仰拍', eye_level:'平视', high:'俯拍' }[v] || '平视';
  const sLabel = { close_up:'特写', medium:'中景', wide:'远景' }[s] || '中景';
  return `${sLabel}·${vLabel}·${hLabel}`;
}

/**
 * 列出所有 96 种视角组合（用于管理后台展示）
 * @returns {Array<{ h, v, s, label, prompt_fragment }>}
 */
function listAllAngles() {
  const result = [];
  for (const h of Object.values(HORIZONTAL)) {
    for (const v of Object.values(ELEVATION)) {
      for (const s of Object.values(SHOT_SIZE)) {
        result.push({
          h, v, s,
          label: toChineseLabel(h, v, s),
          prompt_fragment: toPromptFragment(h, v, s),
        });
      }
    }
  }
  return result;
}

module.exports = {
  HORIZONTAL,
  ELEVATION,
  SHOT_SIZE,
  toPromptFragment,
  parseFromLegacyText,
  fromLegacyText,
  toChineseLabel,
  listAllAngles,
};
