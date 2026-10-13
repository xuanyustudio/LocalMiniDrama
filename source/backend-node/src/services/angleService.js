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

// ─── 镜头运动 ────────────────────────────────────────────────────────────────

/** 镜头运动枚举值 */
const MOVEMENT = {
  static:    'static',    // 固定
  push:      'push',      // 推镜
  pull:      'pull',      // 拉镜
  pan:       'pan',       // 横摇
  tilt:      'tilt',      // 纵摇（上下摇）
  tracking:  'tracking',  // 跟镜
  crane_up:  'crane_up',  // 升镜
  crane_dn:  'crane_dn',  // 降镜
  orbit:     'orbit',     // 环绕
  handheld:  'handheld',  // 手持
};

/** 镜头运动 → 英文 prompt */
const MOVEMENT_DESC = {
  static:   'static locked shot, no camera movement, tripod-mounted',
  push:     'slow push-in dolly shot, camera gradually moves closer to subject',
  pull:     'pull-back dolly shot, camera gradually moves away from subject',
  pan:      'horizontal pan shot, camera sweeps laterally from side to side',
  tilt:     'vertical tilt shot, camera pivots up or down',
  tracking: 'tracking shot, camera follows subject movement, smooth motion',
  crane_up: 'crane up shot, camera rises vertically, revealing wider scene',
  crane_dn: 'crane down shot, camera descends vertically',
  orbit:    'orbiting arc shot, camera circles around subject',
  handheld: 'handheld shot, subtle natural camera shake, documentary feel',
};

/** 中文关键字 → movement 枚举 */
const ZH_MOVEMENT_MAP = [
  { keys: ['固定', '不动', 'static', 'locked'],                      val: 'static'   },
  { keys: ['推镜', '推进', '推', 'push in', 'dolly in', 'push'],    val: 'push'     },
  { keys: ['拉镜', '拉出', '拉', 'pull back', 'dolly out', 'pull'], val: 'pull'     },
  { keys: ['横移', '横摇', '摇镜', '摇', 'pan'],                    val: 'pan'      },
  { keys: ['纵摇', '上摇', '下摇', 'tilt'],                         val: 'tilt'     },
  { keys: ['跟镜', '跟拍', '跟随', 'track'],                        val: 'tracking' },
  { keys: ['升镜', '向上', 'crane up'],                              val: 'crane_up' },
  { keys: ['降镜', '向下', 'crane down'],                            val: 'crane_dn' },
  { keys: ['环绕', '绕', 'orbit', 'arc'],                           val: 'orbit'    },
  { keys: ['手持', 'handheld'],                                      val: 'handheld' },
];

/**
 * 将中文运动描述或枚举值转换为英文 prompt 片段
 * @param {string} movement - 中文或枚举值
 * @returns {string|null}
 */
function movementToPrompt(movement) {
  if (!movement) return null;
  const m = String(movement).trim();
  // 先尝试直接枚举匹配
  if (MOVEMENT_DESC[m]) return MOVEMENT_DESC[m];
  // 再尝试中文关键字匹配
  const lower = m.toLowerCase();
  for (const entry of ZH_MOVEMENT_MAP) {
    if (entry.keys.some(k => lower.includes(k.toLowerCase()))) {
      return MOVEMENT_DESC[entry.val] || null;
    }
  }
  return null;
}

// ─── 灯光风格 ────────────────────────────────────────────────────────────────

/** 灯光风格枚举值 */
const LIGHTING = {
  natural:      'natural',       // 自然光
  front:        'front',         // 顺光
  side:         'side',          // 侧光
  backlit:      'backlit',       // 逆光
  top:          'top',           // 顶光
  under:        'under',         // 底光
  soft:         'soft',          // 柔光
  dramatic:     'dramatic',      // 戏剧光（明暗对比）
  golden_hour:  'golden_hour',   // 黄金时段
  blue_hour:    'blue_hour',     // 蓝调时刻
  night:        'night',         // 夜景/低调光
  neon:         'neon',          // 霓虹/赛博朋克
};

/** 灯光风格 → 英文 prompt */
const LIGHTING_DESC = {
  natural:     'natural ambient lighting, soft and even illumination',
  front:       'flat front lighting, even illumination, minimal shadows',
  side:        'dramatic side lighting, strong contrast between light and shadow',
  backlit:     'backlit, rim lighting, subject silhouetted with halo edge light',
  top:         'harsh overhead top lighting, strong downward shadows',
  under:       'unsettling underlighting, upward low-key light source',
  soft:        'soft diffused lighting, gentle shadows, flattering luminosity',
  dramatic:    'high contrast chiaroscuro lighting, deep shadows, cinematic noir',
  golden_hour: 'warm golden hour sunlight, long low shadows, amber glow',
  blue_hour:   'cool blue hour twilight, moody atmospheric dusk light',
  night:       'low key night lighting, isolated artificial light sources, deep shadows',
  neon:        'vivid neon lighting, colored artificial lights, cyberpunk atmosphere',
};

/** 灯光中文 → 枚举 */
const ZH_LIGHTING_MAP = [
  { keys: ['自然光', '日光', 'natural'],          val: 'natural'     },
  { keys: ['顺光', '正面光', 'front light'],      val: 'front'       },
  { keys: ['侧光', 'side light'],                 val: 'side'        },
  { keys: ['逆光', '背光', 'backlit', 'back light'], val: 'backlit'  },
  { keys: ['顶光', '头顶光', 'top light'],        val: 'top'         },
  { keys: ['底光', '脚灯', 'under light'],        val: 'under'       },
  { keys: ['柔光', '散射', 'soft light'],         val: 'soft'        },
  { keys: ['戏剧', '明暗', '强对比', 'dramatic', 'chiaroscuro'], val: 'dramatic' },
  { keys: ['黄金时段', '黄昏', '金色光', 'golden hour'], val: 'golden_hour' },
  { keys: ['蓝调', '傍晚', 'blue hour'],          val: 'blue_hour'   },
  { keys: ['夜景', '夜晚', '低调', 'night'],      val: 'night'       },
  { keys: ['霓虹', '赛博', 'neon', 'cyberpunk'],  val: 'neon'        },
];

function lightingToPrompt(lighting) {
  if (!lighting) return null;
  const l = String(lighting).trim();
  if (LIGHTING_DESC[l]) return LIGHTING_DESC[l];
  const lower = l.toLowerCase();
  for (const entry of ZH_LIGHTING_MAP) {
    if (entry.keys.some(k => lower.includes(k.toLowerCase()))) {
      return LIGHTING_DESC[entry.val] || null;
    }
  }
  return null;
}

// ─── 景深 ─────────────────────────────────────────────────────────────────────

/** 景深枚举值 */
const DEPTH_OF_FIELD = {
  extreme_shallow: 'extreme_shallow', // 极浅景深
  shallow:         'shallow',         // 浅景深
  medium:          'medium',          // 中景深
  deep:            'deep',            // 深景深（全焦）
};

/** 景深 → 英文 prompt */
const DOF_DESC = {
  extreme_shallow: 'extreme shallow depth of field, razor-thin focus plane, heavy creamy bokeh background',
  shallow:         'shallow depth of field, subject in sharp focus, background softly blurred with bokeh',
  medium:          'moderate depth of field, subject and near surroundings in focus',
  deep:            'deep focus, everything sharp from foreground to background, wide depth of field',
};

/** 景深中文 → 枚举 */
const ZH_DOF_MAP = [
  { keys: ['极浅', '大光圈', 'extreme shallow', 'razor thin'],   val: 'extreme_shallow' },
  { keys: ['浅景深', '浅', 'shallow', 'bokeh'],                  val: 'shallow'         },
  { keys: ['中景深', '适中', 'medium dof'],                      val: 'medium'          },
  { keys: ['深景深', '全焦', '超焦', 'deep focus', 'deep dof'],  val: 'deep'            },
];

function dofToPrompt(dof) {
  if (!dof) return null;
  const d = String(dof).trim();
  if (DOF_DESC[d]) return DOF_DESC[d];
  const lower = d.toLowerCase();
  for (const entry of ZH_DOF_MAP) {
    if (entry.keys.some(k => lower.includes(k.toLowerCase()))) {
      return DOF_DESC[entry.val] || null;
    }
  }
  return null;
}

/**
 * 生成完整摄影参数描述（景别/俯仰/方向 + 运动 + 灯光 + 景深）
 */
function toCinematicFragment(h, v, s, movement, lighting, dof) {
  const parts = [toPromptFragment(h, v, s)];
  const mvDesc  = movementToPrompt(movement);
  const ltDesc  = lightingToPrompt(lighting);
  const dofDesc = dofToPrompt(dof);
  if (mvDesc)  parts.push(mvDesc);
  if (ltDesc)  parts.push(ltDesc);
  if (dofDesc) parts.push(dofDesc);
  return parts.join(', ');
}

// ─── 快速推断（无 AI，基于现有字段关键字匹配）────────────────────────────────

/**
 * 从分镜已有字段快速推断 movement / lighting_style / depth_of_field
 * 用于老分镜批量补全，以及新分镜 AI 未输出该字段时的兜底。
 * @param {object} sb - 分镜对象（含 atmosphere, time, angle_s, shot_type, movement 等）
 * @returns {{ movement: string|null, lighting_style: string|null, depth_of_field: string|null }}
 */
function inferPhotographyParams(sb) {
  const atm  = (sb.atmosphere || '').toLowerCase();
  const time = (sb.time || '').toLowerCase();
  const desc = (sb.description || '').toLowerCase();
  const action = (sb.action || '').toLowerCase();
  const combined = `${atm} ${time} ${desc} ${action}`;

  // ── 灯光推断（按优先级排列）──
  let lighting = null;
  if (/霓虹|赛博|neon|cyberpunk/.test(combined))                              lighting = 'neon';
  else if (/逆光|背光|backlit|轮廓光|rim light/.test(combined))               lighting = 'backlit';
  else if (/戏剧|明暗|强对比|chiaroscuro|dramatic|noir/.test(combined))       lighting = 'dramatic';
  else if (/黄金时段|黄昏|金色光|夕阳|落日|golden/.test(combined))            lighting = 'golden_hour';
  else if (/蓝调|蓝光|暮色|blue hour|twilight/.test(combined))                lighting = 'blue_hour';
  else if (/夜晚|夜景|深夜|午夜|night/.test(combined))                        lighting = 'night';
  else if (/顶光|头顶|top light/.test(combined))                              lighting = 'top';
  else if (/底光|脚灯|underlight/.test(combined))                             lighting = 'under';
  else if (/侧光|side light|侧面光/.test(combined))                           lighting = 'side';
  else if (/柔光|散射|soft light|soft/.test(combined))                        lighting = 'soft';
  else if (/顺光|正面光|front light/.test(combined))                          lighting = 'front';
  else if (/自然光|日光|阳光|natural light|sunlight/.test(combined))          lighting = 'natural';
  else if (/白天|清晨|午后|daytime|morning|afternoon/.test(combined))         lighting = 'natural';

  // ── 景深推断（依据景别）──
  let dof = null;
  const angleS = sb.angle_s || '';
  const shotType = (sb.shot_type || '').toLowerCase();
  if (angleS === 'close_up' || /特写|close.?up|extreme close/.test(shotType)) {
    dof = 'shallow';
  } else if (angleS === 'wide' || /大远景|远景|long shot|wide shot/.test(shotType)) {
    dof = 'deep';
  } else if (angleS === 'medium' || /中景|medium shot/.test(shotType)) {
    dof = 'medium';
  }

  // ── 运镜推断（从 movement 中文兜底到枚举）──
  let movement = null;
  const rawMovement = (sb.movement || '').trim();
  if (rawMovement) {
    // 已经是枚举值直接用，否则尝试中文映射
    movement = MOVEMENT_DESC[rawMovement] ? rawMovement : null;
    if (!movement) {
      const lower = rawMovement.toLowerCase();
      for (const entry of ZH_MOVEMENT_MAP) {
        if (entry.keys.some(k => lower.includes(k.toLowerCase()))) {
          movement = entry.val;
          break;
        }
      }
    }
    if (!movement) movement = rawMovement; // 保留原始中文，生图时动态翻译
  }

  return { movement: movement || null, lighting_style: lighting, depth_of_field: dof };
}

module.exports = {
  HORIZONTAL,
  ELEVATION,
  SHOT_SIZE,
  MOVEMENT,
  LIGHTING,
  DEPTH_OF_FIELD,
  toPromptFragment,
  toCinematicFragment,
  movementToPrompt,
  lightingToPrompt,
  dofToPrompt,
  inferPhotographyParams,
  parseFromLegacyText,
  fromLegacyText,
  toChineseLabel,
  listAllAngles,
};
