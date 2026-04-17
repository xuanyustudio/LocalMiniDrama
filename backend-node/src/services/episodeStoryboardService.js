// 与 Go StoryboardService.GenerateStoryboard + processStoryboardGeneration 对齐
const taskService = require('./taskService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const { syncStoryboardCharacters } = require('./imageService');
const safeJson = require('../utils/safeJson');
const { safeParseAIJSON, extractJsonCandidate, repairTruncatedJsonArray, extractFirstArray } = safeJson;
const loadConfig = require('../config').loadConfig;
const angleService = require('./angleService');

/**
 * 分镜专用 generateText 包装：
 * 1. 默认携带 max_tokens:16384，让模型输出更长，减少截断续写次数。
 * 2. 若 API 立即返回参数错误（HTTP 4xx，且错误体提到 max_tokens/length/token），
 *    自动降级为不传 max_tokens 重试一次。
 * 3. 所有尝试均记录日志。
 */
const DEFAULT_STORYBOARD_MAX_TOKENS = 16384;

function isMaxTokensParamError(errMsg) {
  const m = (errMsg || '').toLowerCase();
  return (
    m.includes('max_tokens') ||
    m.includes('max_completion_tokens') ||
    m.includes('maximum_context_length') ||
    m.includes('context_length_exceeded') ||
    m.includes('maximum length') ||
    m.includes('token limit') ||
    (m.includes('http 4') && (m.includes('token') || m.includes('length') || m.includes('parameter')))
  );
}

async function generateTextForStoryboard(db, log, userPrompt, systemPrompt, options = {}) {
  const { model, streamCallback, temperature = 0.7 } = options;

  // 第一次尝试：带 max_tokens:16384
  log.info('Storyboard generateText attempt 1', { model: model || '(default)', max_tokens: DEFAULT_STORYBOARD_MAX_TOKENS });
  try {
    const text = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'storyboard_extraction',
      model: model || undefined,
      temperature,
      max_tokens: DEFAULT_STORYBOARD_MAX_TOKENS,
      streamCallback,
    });
    return text;
  } catch (e) {
    if (isMaxTokensParamError(e.message)) {
      log.warn('Storyboard generateText: max_tokens rejected by model, retrying without it', {
        model: model || '(default)',
        error: e.message.slice(0, 200),
      });
      // 第二次尝试：不传 max_tokens，让模型用自己默认值
      log.info('Storyboard generateText attempt 2 (no max_tokens)', { model: model || '(default)' });
      const text = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
        scene_key: 'storyboard_extraction',
        model: model || undefined,
        temperature,
        streamCallback,
      });
      log.info('Storyboard generateText attempt 2 succeeded');
      return text;
    }
    // 其他错误直接抛出
    throw e;
  }
}

function rowToScene(r) {
  if (!r) return null;
  return {
    id: r.id,
    drama_id: r.drama_id,
    location: r.location,
    time: r.time,
    prompt: r.prompt,
    storyboard_count: r.storyboard_count ?? 1,
    image_url: r.image_url,
    local_path: r.local_path,
    status: r.status || 'pending',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** 规范为数字秒：前端左侧用 {{ shot.duration }}s，右侧用 Math.round(duration)；避免 "5s" 导致 5ss，或非数字导致 NaN */
function normalizeDuration(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const s = String(v).trim().replace(/s$/i, '');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

const _SB_PROMPT_LOG_CHUNK = 14000;

/**
 * 调试：完整打印分镜 system / user 提示词（可能很长，按块写入日志）。
 * 启动后端前设置环境变量：DEBUG_STORYBOARD_PROMPTS=1
 */
function logDebugStoryboardPrompts(log, tag, userPrompt, systemPrompt) {
  const on = String(process.env.DEBUG_STORYBOARD_PROMPTS || '').trim();
  if (on !== '1' && on.toLowerCase() !== 'true') return;
  const sp = systemPrompt != null ? String(systemPrompt) : '';
  const up = userPrompt != null ? String(userPrompt) : '';
  log.info(`[StoryboardPrompt:${tag}] system_prompt_bytes=${sp.length} user_prompt_bytes=${up.length}`);
  for (let i = 0; i < sp.length; i += _SB_PROMPT_LOG_CHUNK) {
    log.info(`[StoryboardPrompt:${tag}] system_part_${Math.floor(i / _SB_PROMPT_LOG_CHUNK) + 1}\n${sp.slice(i, i + _SB_PROMPT_LOG_CHUNK)}`);
  }
  for (let i = 0; i < up.length; i += _SB_PROMPT_LOG_CHUNK) {
    log.info(`[StoryboardPrompt:${tag}] user_part_${Math.floor(i / _SB_PROMPT_LOG_CHUNK) + 1}\n${up.slice(i, i + _SB_PROMPT_LOG_CHUNK)}`);
  }
}

/** 将 lighting_style 枚举转为中文布光提示（兜底用） */
function lightingStyleHintZh(code) {
  const m = {
    natural: '自然窗光或环境散射光',
    front: '正面柔光面部受光均匀',
    side: '侧光约45°勾勒轮廓',
    backlit: '逆光轮廓光发丝边缘发亮',
    top: '顶光压暗眼窝',
    under: '底光或脚光非常规氛围',
    soft: '软光低反差过渡柔和',
    dramatic: '戏剧高反差主辅分明',
    golden_hour: '金色时刻暖斜阳',
    blue_hour: '蓝调时刻冷环境光',
    night: '夜景人工点光源',
    neon: '霓虹混合色温',
  };
  return m[String(code || '').trim()] || '主光方向明确侧光或窗光';
}

/** 按时长与已有运镜字段拼灵境式「运镜链」（至少两步，强调摄影机在动） */
function buildCameraMotionChain(movement, shotType, durationSec) {
  const dur = Math.max(1, Number(durationSec) || 5);
  const mv = String(movement || '').trim();
  const st = String(shotType || '').trim();
  const parts = [];
  if (dur >= 12) {
    parts.push('定镜约1秒建立空间');
    if (/跟|追随|尾随/.test(mv)) parts.push('侧后方跟拍主体位移');
    else if (/摇/.test(mv)) parts.push(`${mv || '轻摇'}拓展画幅信息`);
    else parts.push('缓推轨贴近动作核心');
    parts.push('横移从前景遮挡或门框一侧滑出拓宽视野带出纵深与环境细节');
  } else if (dur >= 8) {
    parts.push('定镜');
    parts.push(mv && !/^固定|^定镜/.test(mv) ? mv : '缓推轨由远及近');
    parts.push('微横移或轻摇让背景纵深与环境细节可读');
  } else if (dur >= 5) {
    parts.push('定镜起幅');
    parts.push(mv || '缓推轨或短跟拍强化动线');
  } else {
    parts.push(mv || '短跟拍或微推');
  }
  if ((st.includes('远') || st.includes('全景')) && !parts.some((p) => /推|移|跟|摇/.test(p))) {
    parts.push('缓推轨向事件中心');
  }
  const chain = [...new Set(parts)].filter(Boolean).join('，');
  return chain || '定镜，缓推轨';
}

/** 全能分镜：模型未返回 universal_segment_text 时的灵境式高密度单行（视频时间轴 + 运镜链） */
function buildFallbackUniversalSeedanceLine(sb, d, styleHint) {
  const act = (d.action || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const res = (d.result || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const emo = (d.emotion || sb.emotion || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const atm = (sb.atmosphere || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const shotBits = [d.shotType, d.angle].filter(Boolean).join('，').trim();
  const loc = [sb.location, sb.time].filter(Boolean).join('，').trim() || '叙事空间';
  const dur = Math.max(1, Number(d.durationSec) || normalizeDuration(sb.duration) || 5);
  const lightZh = lightingStyleHintZh(d.lightingStyle);
  const dof = d.depthOfField === 'extreme_shallow' ? '浅景深前景虚化明显' : d.depthOfField === 'shallow' ? '浅景深背景柔化' : d.depthOfField === 'deep' ? '深焦前后景均清晰' : d.depthOfField === 'medium' ? '景深适中' : '景深随景别可感';
  const shotNum = Math.max(1, Number(d.shotNumber) || 1);
  const link = shotNum <= 1 ? '开篇情绪奠基' : '延续上一镜动势与视线';
  const motionCore =
    act ||
    '在镜内时长里完成一段可感知的动作阶段变化，含走位或身体重心的转移，避免单姿势摆拍';
  const emoParen = emo ? `（${emo}）` : '（专注投入）';
  const fg = atm ? `${atm.slice(0, 42)}与主体相关的虚化层次` : '与动作相关的近景细节或桌面器物';
  const mg = act ? '主体动作与表情核心区' : '主体占据画面叙事中心';
  const bg = loc ? `${loc}的环境延展与氛围层次` : '环境纵深与空间气氛';
  const lightBlock = `[${lightZh}；结合${loc}，建议色温具象化如4500K-5600K区间择一；明暗比约2:1至3:1；${dof}]`;
  const camChain = buildCameraMotionChain(d.movement, d.shotType, dur);
  const narrDyn = `约${dur}秒内——在${loc}，@人物1${act ? `先后：${act}` : '持续推进戏内动作'}，${res ? `阶段收束为：${res}` : '动作与视线随时间有阶段推进'}；镜头以「${camChain}」配合人物动线，读出空间纵深与时间流逝`;
  const lensBlock = `运镜链：${camChain}；景别机位：${shotBits || '中景，平视'}，三分法或对角线择一（结尾动势：[${res || '视线或身体动线指向下一个节拍，动势渐收可衔接下镜'}]）`;
  const sfx = `环境层-[与${loc}一致的环境声底与远处细节] 动作层-[与动作同步的物理接触声] 情绪层-[无旋律仅以空间混响与材质细微声烘托情绪张力]`;
  const styleTail = (styleHint && String(styleHint).trim()) || '电影感叙事光色';
  const dia = (d.dialogue || '').trim().replace(/"/g, "'");
  let line = `主体：@人物1${emoParen}[朝向：依轴线面向戏中对象或画左/画右择一并保持统一] 正在 ${motionCore}（与上镜衔接：${link}） 叙事动态：${narrDyn} 空间：前景-[${fg}] 中景-[${mg}] 背景-[${bg}] 光影：${lightBlock} 镜头：${lensBlock}`;
  if (dia) line += ` 台词：第1秒 @人物1："${dia.slice(0, 120)}"`;
  line += ` 音效：${sfx} ${styleTail} [禁BGM][禁字幕]`;
  return line.replace(/\r?\n/g, ' ');
}

function getStoryboardsForEpisode(db, episodeId) {
  const rows = db.prepare(
    'SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number ASC'
  ).all(episodeId);
  return rows.map((r) => {
    let background = null;
    if (r.scene_id != null) {
      const sceneRow = db.prepare('SELECT * FROM scenes WHERE id = ? AND deleted_at IS NULL').get(r.scene_id);
      if (sceneRow) background = rowToScene(sceneRow);
    }
    return {
      id: r.id,
      episode_id: r.episode_id,
      scene_id: r.scene_id,
      storyboard_number: r.storyboard_number,
      title: r.title,
      description: r.description,
      location: r.location,
      time: r.time,
      duration: normalizeDuration(r.duration),
      dialogue: r.dialogue,
      narration: r.narration ?? null,
      action: r.action,
      result: r.result,
      atmosphere: r.atmosphere,
      image_prompt: r.image_prompt,
      video_prompt: r.video_prompt,
      shot_type: r.shot_type,
      angle: r.angle,
      angle_h: r.angle_h ?? null,
      angle_v: r.angle_v ?? null,
      angle_s: r.angle_s ?? null,
      movement: r.movement,
      segment_index: r.segment_index ?? 0,
      segment_title: r.segment_title ?? null,
      creation_mode: r.creation_mode === 'universal' ? 'universal' : 'classic',
      universal_segment_text: r.universal_segment_text ?? null,
      characters: (() => {
        if (!r.characters) return [];
        if (typeof r.characters !== 'string') return Array.isArray(r.characters) ? r.characters : [];
        try { return JSON.parse(r.characters); } catch (_) { return []; }
      })(),
      composed_image: r.composed_image,
      video_url: r.video_url,
      audio_local_path: r.audio_local_path ?? null,
      narration_audio_local_path: r.narration_audio_local_path ?? null,
      status: r.status || 'pending',
      created_at: r.created_at,
      updated_at: r.updated_at,
      background,
    };
  });
}

function extractInitialPose(action) {
  if (!action || typeof action !== 'string') return '';
  const processWords = [
    '然后', '接着', '接下来', '随后', '紧接着',
    '向下', '向上', '向前', '向后', '向左', '向右',
    '开始', '继续', '逐渐', '慢慢', '快速', '突然', '猛然',
  ];
  let result = action;
  for (const word of processWords) {
    const idx = result.indexOf(word);
    if (idx > 0) {
      result = result.slice(0, idx);
      break;
    }
  }
  return result.replace(/[，。,.]\s*$/, '').trim();
}

function generateImagePrompt(sb, style) {
  const parts = [];
  // 场景位置与时间
  if (sb.location) {
    let locationDesc = sb.location;
    if (sb.time) locationDesc += '，' + sb.time;
    parts.push(locationDesc);
  }
  // 镜头视角：优先结构化三元组（中文标签），降级到旧文本
  if (sb.angle_h && sb.angle_v && sb.angle_s) {
    parts.push(angleService.toChineseLabel(sb.angle_h, sb.angle_v, sb.angle_s));
  } else if (sb.angle || sb.shot_type) {
    const { h, v, s } = angleService.parseFromLegacyText(sb.angle || '', sb.shot_type || '');
    parts.push(angleService.toChineseLabel(h, v, s));
  }
  // 画面动作（取动作的起始状态）
  if (sb.action) {
    const initialPose = extractInitialPose(sb.action);
    if (initialPose) parts.push(initialPose);
  }
  // 情绪
  if (sb.emotion) parts.push(sb.emotion);
  // 风格（英文 prompt token，保持英文以兼容图片 AI）
  const styleText = style && String(style).trim();
  if (styleText) parts.push(styleText);
  parts.push('首帧静止画面');
  return parts.join('，');
}

function generateVideoPrompt(sb, style, videoRatio) {
  const parts = [];
  // 场景与标题
  if (sb.scene_description) {
    parts.push('场景：' + sb.scene_description);
  } else if (sb.location) {
    const scene = sb.time ? sb.location + '，' + sb.time : sb.location;
    parts.push('场景：' + scene);
  }
  if (sb.title) parts.push('镜头标题：' + sb.title);
  // 动作与对白（核心叙事）
  if (sb.action) parts.push('动作：' + sb.action);
  if (sb.dialogue) parts.push('对话：' + sb.dialogue);
  if (sb.narration) parts.push('解说旁白：' + sb.narration);
  if (sb.result) parts.push('结果：' + sb.result);
  // 镜头与运镜
  const shotType = sb.shot_type || sb.camera_shot_type;
  if (shotType) parts.push('景别：' + shotType);
  // 结构化视角：中文标签 + 英文描述（兼顾中英文视频模型）
  if (sb.angle_h && sb.angle_v && sb.angle_s) {
    const chLabel = angleService.toChineseLabel(sb.angle_h, sb.angle_v, sb.angle_s);
    const angleFragment = angleService.toPromptFragment(sb.angle_h, sb.angle_v, sb.angle_s);
    parts.push(`镜头角度：${chLabel}（${angleFragment}）`);
  } else {
    const angle = sb.angle ?? sb.camera_angle;
    if (angle) parts.push('镜头角度：' + angle);
  }
  const movement = sb.movement ?? sb.camera_movement;
  if (movement) parts.push('运镜：' + movement);
  // 氛围与情绪
  if (sb.atmosphere) parts.push('氛围：' + sb.atmosphere);
  if (sb.emotion) parts.push('情绪：' + sb.emotion);
  if (sb.emotion_intensity != null && sb.emotion_intensity !== '') {
    parts.push('情绪强度：' + String(sb.emotion_intensity));
  }
  // 声音
  if (sb.bgm_prompt) parts.push('配乐：' + sb.bgm_prompt);
  if (sb.sound_effect) parts.push('音效：' + sb.sound_effect);
  // 时长
  const durationSec = normalizeDuration(sb.duration) || 5;
  parts.push('时长：' + durationSec + '秒');
  // 风格（英文 token 保持英文以兼容视频 AI）与画面比例
  if (style) parts.push('风格：' + style);
  if (videoRatio) parts.push('=VideoRatio: ' + videoRatio);
  return parts.length ? parts.join('。') : '视频场景';
}

/**
 * 从 AI 输出的单个分镜对象计算入库字段（INSERT/UPDATE 共用）。
 * 会就地写入 sb.location / sb.time（由 scene_description 拆分）。
 */
function deriveStoryboardFieldsFromAi(sb, style, videoRatio, opts = {}) {
  const universalOmni = !!opts.universalOmni;
  const angleValFn = (x) => x.angle ?? x.camera_angle ?? null;
  const shotNumber = sb.shot_number ?? sb.storyboard_number ?? 0;
  const title = sb.title ?? '';
  const shotType = sb.shot_type ?? '';
  const movement = sb.movement ?? sb.camera_movement ?? '';
  const angle = angleValFn(sb);
  const action = sb.action ?? '';
  const dialogue = sb.dialogue ?? '';
  const narration = sb.narration ?? '';
  const result = sb.result ?? '';
  const emotion = sb.emotion ?? '';
  const segmentIndex = sb.segment_index != null ? Number(sb.segment_index) : 0;
  const segmentTitle = sb.segment_title ?? null;
  const lightingStyle = sb.lighting_style ?? null;
  const depthOfField = sb.depth_of_field ?? null;
  let durationSec = normalizeDuration(sb.duration) || 5;
  const targetClip = opts.targetClipDuration != null ? Number(opts.targetClipDuration) : 0;
  if (Number.isFinite(targetClip) && targetClip > 0) {
    durationSec = Math.max(durationSec, Math.round(targetClip));
  }
  durationSec = Math.min(120, Math.max(1, Math.round(durationSec)));
  sb.duration = durationSec;
  if (!sb.location && sb.scene_description) {
    const sceneDesc = String(sb.scene_description).trim();
    const sepIdx = sceneDesc.search(/[，,、]/);
    if (sepIdx > 0) {
      sb.location = sceneDesc.slice(0, sepIdx).trim();
      if (!sb.time) sb.time = sceneDesc.slice(sepIdx + 1).trim();
    } else {
      sb.location = sceneDesc;
    }
  }
  const { h: angleH, v: angleV, s: angleS } = (angle || shotType)
    ? angleService.parseFromLegacyText(angle || '', shotType || '')
    : { h: null, v: null, s: null };
  const description = `【镜头类型】${shotType}\n【运镜】${movement}\n【动作】${action}\n【对话】${dialogue}\n【解说】${narration}\n【结果】${result}\n【情绪】${emotion}`;
  const sbWithAngles = { ...sb, angle_h: angleH, angle_v: angleV, angle_s: angleS };
  const imagePrompt = generateImagePrompt(sbWithAngles, style);
  const videoPrompt = generateVideoPrompt(sbWithAngles, style, videoRatio);
  const sceneId = sb.scene_id != null ? Number(sb.scene_id) : null;
  const charactersJson = Array.isArray(sb.characters) ? JSON.stringify(sb.characters) : (sb.characters ? JSON.stringify([].concat(sb.characters)) : '[]');
  const propIds = Array.isArray(sb.props) ? sb.props.map(Number).filter(Number.isFinite) : [];
  let universalSegmentText = '';
  if (sb.universal_segment_text != null && String(sb.universal_segment_text).trim()) {
    universalSegmentText = String(sb.universal_segment_text).trim().replace(/\r?\n/g, ' ');
  }
  if (universalOmni && !universalSegmentText) {
    universalSegmentText = buildFallbackUniversalSeedanceLine(
      sb,
      {
        shotNumber,
        durationSec,
        shotType,
        movement,
        angle,
        action,
        dialogue,
        result,
        emotion,
        lightingStyle,
        depthOfField,
      },
      style
    );
  }
  const creationMode = universalOmni ? 'universal' : 'classic';
  if (!universalOmni) universalSegmentText = null;
  return {
    shotNumber,
    title,
    shotType,
    movement,
    angle,
    action,
    dialogue,
    narration,
    result,
    emotion,
    segmentIndex,
    segmentTitle,
    lightingStyle,
    depthOfField,
    description,
    imagePrompt,
    videoPrompt,
    sceneId,
    charactersJson,
    angleH,
    angleV,
    angleS,
    propIds,
    creationMode,
    universalSegmentText,
  };
}

/** 用最终解析的分镜对象覆盖已存在的行（修正流式增量先入库时缺 narration 等字段的问题） */
function updateStoryboardRowFromDerived(db, existingId, episodeIdNum, d, sb, now) {
  db.prepare(
    `UPDATE storyboards SET
      scene_id = ?, title = ?, description = ?, location = ?, time = ?, duration = ?,
      dialogue = ?, narration = ?, action = ?, result = ?, atmosphere = ?,
      image_prompt = ?, video_prompt = ?, characters = ?,
      shot_type = ?, angle = ?, angle_h = ?, angle_v = ?, angle_s = ?, movement = ?,
      lighting_style = ?, depth_of_field = ?, segment_index = ?, segment_title = ?,
      creation_mode = ?, universal_segment_text = ?,
      updated_at = ?
     WHERE id = ? AND episode_id = ? AND deleted_at IS NULL`
  ).run(
    d.sceneId,
    d.title || null,
    d.description,
    sb.location ?? null,
    sb.time ?? null,
    sb.duration ?? 5,
    d.dialogue || null,
    d.narration || null,
    d.action || null,
    d.result || null,
    sb.atmosphere ?? null,
    d.imagePrompt,
    d.videoPrompt,
    d.charactersJson,
    d.shotType || null,
    d.angle,
    d.angleH,
    d.angleV,
    d.angleS,
    d.movement || null,
    d.lightingStyle,
    d.depthOfField,
    d.segmentIndex,
    d.segmentTitle,
    d.creationMode || 'classic',
    d.universalSegmentText != null ? d.universalSegmentText : null,
    now,
    existingId,
    episodeIdNum
  );
  try {
    db.prepare('DELETE FROM storyboard_props WHERE storyboard_id = ?').run(existingId);
    if (d.propIds.length > 0) {
      const insProp = db.prepare('INSERT OR IGNORE INTO storyboard_props (storyboard_id, prop_id) VALUES (?, ?)');
      for (const pid of d.propIds) insProp.run(existingId, pid);
    }
  } catch (_) {}
}

/**
 * 将单个分镜对象插入 DB，供增量流式保存使用。
 * 返回插入后的 id，出错则返回 null（不抛异常）。
 */
function insertOneStoryboard(db, episodeIdNum, sb, style, videoRatio, now, deriveOpts = {}) {
  const d = deriveStoryboardFieldsFromAi(sb, style, videoRatio, deriveOpts);
  const shotNumber = d.shotNumber;
  try {
    db.prepare(
      `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, narration, action, result, atmosphere, image_prompt, video_prompt, characters, shot_type, angle, angle_h, angle_v, angle_s, movement, lighting_style, depth_of_field, segment_index, segment_title, creation_mode, universal_segment_text, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      episodeIdNum, d.sceneId, shotNumber, d.title || null, d.description,
      sb.location ?? null, sb.time ?? null, sb.duration ?? 5,
      d.dialogue || null, d.narration || null, d.action || null, d.result || null, sb.atmosphere ?? null,
      d.imagePrompt, d.videoPrompt, d.charactersJson,
      d.shotType || null, d.angle, d.angleH, d.angleV, d.angleS,
      d.movement || null, d.lightingStyle, d.depthOfField, d.segmentIndex, d.segmentTitle,
      d.creationMode || 'classic',
      d.universalSegmentText != null ? d.universalSegmentText : null,
      now, now
    );
    const newId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    if (d.propIds.length > 0) {
      try {
        const insProp = db.prepare('INSERT OR IGNORE INTO storyboard_props (storyboard_id, prop_id) VALUES (?, ?)');
        for (const pid of d.propIds) insProp.run(newId, pid);
      } catch (_) {}
    }
    return newId;
  } catch (_) {
    return null;
  }
}

/**
 * 在流式输出过程中，从已积累的文本尝试解析并保存尚未保存的分镜。
 * savedNums：已保存的 storyboard_number Set，用于去重。
 */
function tryIncrementalSave(db, log, episodeIdNum, accumulated, savedNums, style, videoRatio, deriveOpts = {}) {
  try {
    let cleaned = accumulated.trim()
      .replace(/^```json\s*/gm, '').replace(/^```\s*/gm, '').replace(/```\s*$/gm, '').trim();
    // 转义字符串字段里的原始换行符，防止 JSON.parse 报 "Unterminated string"
    cleaned = safeJson.escapeNewlinesInStrings(cleaned);
    let candidate = extractJsonCandidate(cleaned);
    if (!candidate) return;

    // 如果 AI 将数组包在对象里（如 doubao 的 {"storyboards":[...]}），提取内部数组
    const innerArray = safeJson.extractWrappedArrayStr(candidate);
    const arrayCandidate = innerArray || candidate;

    // 策略A：截断修复（找到已完整闭合的顶层元素）
    let parsed = null;
    const repaired = repairTruncatedJsonArray(arrayCandidate);
    if (repaired) {
      try { parsed = JSON.parse(repaired); } catch (_) {}
      // 策略B：截断修复 + jsonrepair
      if (!parsed && safeJson._jsonrepair) {
        try { parsed = JSON.parse(safeJson._jsonrepair(repaired)); } catch (_) {}
      }
    }
    // 策略C：直接 jsonrepair 整体修复
    if (!parsed && safeJson._jsonrepair) {
      try { parsed = JSON.parse(safeJson._jsonrepair(arrayCandidate)); } catch (_) {}
    }
    if (!parsed) return;
    const items = Array.isArray(parsed) ? parsed : extractFirstArray(parsed);
    if (!items || items.length === 0) return;
    const now = new Date().toISOString();
    let newCount = 0;
    for (const sb of items) {
      const shotNumber = sb.shot_number ?? sb.storyboard_number ?? 0;
      if (savedNums.has(shotNumber)) continue;
      const id = insertOneStoryboard(db, episodeIdNum, sb, style, videoRatio, now, deriveOpts);
      if (id !== null) {
        savedNums.add(shotNumber);
        newCount++;
      }
    }
    if (newCount > 0) {
      log.info('Storyboard incremental save', { episode_id: episodeIdNum, new_count: newCount, total_saved: savedNums.size });
    }
  } catch (_) { /* 流式解析错误静默忽略，等待最终完整解析 */ }
}

/**
 * @param {Set|null} skipShotNumbers - 已通过增量流式保存的 storyboard_number 集合，跳过重复插入
 */
function saveStoryboards(db, log, episodeId, storyboards, cfg, styleOverride, skipShotNumbers = null, deriveOpts = {}) {
  const episodeIdNum = Number(episodeId);
  if (storyboards.length === 0) {
    throw new Error('AI生成分镜失败：返回的分镜数量为0');
  }
  const style = (styleOverride && String(styleOverride).trim()) || cfg?.style?.default_style || '';
  const videoRatio = cfg?.style?.default_video_ratio || '16:9';
  const now = new Date().toISOString();

  // 仅在非增量模式下才删除旧数据（增量模式时已在流式开始前删除）
  if (skipShotNumbers === null) {
    const existing = db.prepare('SELECT id FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL').all(episodeIdNum);
    if (existing.length > 0) {
      db.prepare('UPDATE storyboards SET deleted_at = ? WHERE episode_id = ?').run(now, episodeIdNum);
    }
  }

  const saved = [];
  for (const sb of storyboards) {
    const shotNumber = sb.shot_number ?? sb.storyboard_number ?? 0;

    // 已由增量流式保存过的分镜：必须用**最终完整 JSON** 再 UPDATE 一行（否则首镜常在流式阶段缺 narration 等字段且永不修正）
    if (skipShotNumbers && skipShotNumbers.has(shotNumber)) {
      const existing = db.prepare(
        'SELECT * FROM storyboards WHERE episode_id = ? AND storyboard_number = ? AND deleted_at IS NULL'
      ).get(episodeIdNum, shotNumber);
      if (existing) {
        const d = deriveStoryboardFieldsFromAi(sb, style, videoRatio, deriveOpts);
        updateStoryboardRowFromDerived(db, existing.id, episodeIdNum, d, sb, now);
        log.info('Storyboard merged from final parse after incremental save', {
          episode_id: episodeIdNum,
          storyboard_id: existing.id,
          storyboard_number: shotNumber,
        });
        const refreshed = db.prepare(
          'SELECT * FROM storyboards WHERE id = ? AND deleted_at IS NULL'
        ).get(existing.id);
        let propIds = [];
        try {
          const propLinks = db.prepare('SELECT prop_id FROM storyboard_props WHERE storyboard_id = ?').all(refreshed.id);
          propIds = propLinks.map((p) => p.prop_id);
        } catch (_) {}
        saved.push({
          id: refreshed.id,
          episode_id: episodeIdNum,
          scene_id: refreshed.scene_id,
          storyboard_number: shotNumber,
          title: refreshed.title,
          description: refreshed.description,
          location: refreshed.location,
          time: refreshed.time,
          duration: refreshed.duration,
          dialogue: refreshed.dialogue,
          narration: refreshed.narration ?? null,
          action: refreshed.action,
          result: refreshed.result,
          atmosphere: refreshed.atmosphere,
          image_prompt: refreshed.image_prompt,
          video_prompt: refreshed.video_prompt,
          shot_type: refreshed.shot_type,
          angle: refreshed.angle,
          movement: refreshed.movement,
          segment_index: refreshed.segment_index ?? 0,
          segment_title: refreshed.segment_title ?? null,
          creation_mode: refreshed.creation_mode === 'universal' ? 'universal' : 'classic',
          universal_segment_text: refreshed.universal_segment_text ?? null,
          characters: (() => { try { return JSON.parse(refreshed.characters || '[]'); } catch (_) { return []; } })(),
          prop_ids: propIds,
          status: refreshed.status,
          created_at: refreshed.created_at,
          updated_at: refreshed.updated_at,
        });
        continue;
      }
      // 若 DB 中找不到（极少情况），fallthrough 正常 INSERT
    }

    const d = deriveStoryboardFieldsFromAi(sb, style, videoRatio, deriveOpts);

    try {
      db.prepare(
        `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, narration, action, result, atmosphere, image_prompt, video_prompt, characters, shot_type, angle, angle_h, angle_v, angle_s, movement, lighting_style, depth_of_field, segment_index, segment_title, creation_mode, universal_segment_text, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).run(
        episodeIdNum, d.sceneId, shotNumber, d.title || null, d.description,
        sb.location ?? null, sb.time ?? null, sb.duration ?? 5,
        d.dialogue || null, d.narration || null, d.action || null, d.result || null, sb.atmosphere ?? null,
        d.imagePrompt, d.videoPrompt, d.charactersJson,
        d.shotType || null, d.angle, d.angleH, d.angleV, d.angleS,
        d.movement || null, d.lightingStyle, d.depthOfField, d.segmentIndex, d.segmentTitle,
        d.creationMode || 'classic',
        d.universalSegmentText != null ? d.universalSegmentText : null,
        now, now
      );
    } catch (e) {
      if ((e.message || '').includes('shot_type') || (e.message || '').includes('angle') || (e.message || '').includes('movement') || (e.message || '').includes('result') || (e.message || '').includes('segment') || (e.message || '').includes('narration')) {
        db.prepare(
          `INSERT INTO storyboards (episode_id, scene_id, storyboard_number, title, description, location, time, duration, dialogue, action, atmosphere, image_prompt, video_prompt, characters, creation_mode, universal_segment_text, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        ).run(
          episodeIdNum, d.sceneId, shotNumber, d.title || null, d.description,
          sb.location ?? null, sb.time ?? null, sb.duration ?? 5,
          d.dialogue || null, d.action || null, sb.atmosphere ?? null,
          d.imagePrompt, d.videoPrompt, d.charactersJson,
          d.creationMode || 'classic',
          d.universalSegmentText != null ? d.universalSegmentText : null,
          now, now
        );
      } else {
        throw e;
      }
    }
    const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
    if (d.propIds.length > 0) {
      try {
        const insProp = db.prepare('INSERT OR IGNORE INTO storyboard_props (storyboard_id, prop_id) VALUES (?, ?)');
        for (const pid of d.propIds) insProp.run(id, pid);
      } catch (_) {}
    }
    saved.push({
      id,
      episode_id: episodeIdNum,
      scene_id: d.sceneId,
      storyboard_number: shotNumber,
      title: d.title || null,
      description: d.description,
      location: sb.location ?? null,
      time: sb.time ?? null,
      duration: sb.duration ?? 5,
      dialogue: d.dialogue || null,
      narration: d.narration || null,
      action: d.action || null,
      result: d.result || null,
      atmosphere: sb.atmosphere ?? null,
      image_prompt: d.imagePrompt,
      video_prompt: d.videoPrompt,
      shot_type: d.shotType || null,
      angle: d.angle,
      movement: d.movement || null,
      segment_index: d.segmentIndex,
      segment_title: d.segmentTitle,
      creation_mode: d.creationMode || 'classic',
      universal_segment_text: d.universalSegmentText != null ? d.universalSegmentText : null,
      characters: Array.isArray(sb.characters) ? sb.characters : [],
      prop_ids: d.propIds,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
  }
  log.info('Storyboards saved', { episode_id: episodeId, count: saved.length });
  return saved;
}

/**
 * 构建续写 prompt：当首次响应被截断时，携带已生成分镜完整列表 + 末尾详情作为上下文，
 * 请求 AI 从 lastShotNum+1 继续生成剩余分镜。
 * 关键：必须把所有已生成分镜的 shot_number + segment_title + title 全部列出，
 * 防止 AI 因不知道哪些情节已覆盖而重复生成相同内容。
 */
function buildContinuationPrompt(originalUserPrompt, alreadySaved, lastShotNum, attempt, includeNarration, universalOmni = false) {
  const narrLine = includeNarration
    ? '\n- 每条新增分镜必须含非空字符串 narration（至少一句解说，与首次任务一致；禁止留空）'
    : '';
  const uniLine = universalOmni
    ? '\n- 每条新增分镜必须含 creation_mode:"universal" 与非空 universal_segment_text（单行：须含「叙事动态」时间线+「镜头」运镜链至少两步如定镜/缓推轨/横移从遮挡后滑出；按 duration 秒写视频动势，禁止静帧式描写；与首轮要求一致）'
    : '';
  // 全量已生成分镜摘要（每行一个，仅 shot_number + segment + title）
  const allSummary = alreadySaved.map((sb) => {
    const num = sb.shot_number ?? sb.storyboard_number ?? 0;
    const seg = (sb.segment_title || '').replace(/"/g, '\\"');
    const title = (sb.title || '').replace(/"/g, '\\"');
    return `  ${num}. [${seg}] ${title}`;
  }).join('\n');

  // 末尾 5 个分镜的详细内容（供衔接用）
  const lastCtx = alreadySaved.slice(-5).map((sb) => {
    const num = sb.shot_number ?? sb.storyboard_number ?? 0;
    const title = (sb.title || '').replace(/"/g, '\\"');
    const loc = (sb.location || '').replace(/"/g, '\\"');
    const action = (sb.action || '').slice(0, 120).replace(/"/g, '\\"');
    return `  {"shot_number": ${num}, "title": "${title}", "location": "${loc}", "action": "${action}"}`;
  }).join(',\n');

  return `[续写指令 - 第${attempt}次续写]
之前的分镜生成因长度限制在 shot_number ${lastShotNum} 处中断，已生成 ${alreadySaved.length} 个分镜。

━━━ 已生成分镜完整列表（绝对不能重复以下内容）━━━
${allSummary}
━━━ 列表结束 ━━━

以上所有情节均已覆盖，请勿重复。末尾几个分镜详情供衔接参考：
[
${lastCtx}
]

请从 shot_number ${lastShotNum + 1} 继续生成剩余分镜，直至剧本全部场景覆盖完毕。
要求：
- 仅返回新增分镜（JSON数组），shot_number 从 ${lastShotNum + 1} 开始递增
- 格式与之前完全相同，字段保持一致${narrLine}${uniLine}
- 严禁重复已生成列表中的任何情节或场景
- 不要输出任何解释文字，直接输出 JSON

原始剧本与任务说明：
${originalUserPrompt}`;
}

async function processStoryboardGeneration(db, log, cfg, taskId, episodeId, model, style, userPrompt, systemPrompt, includeNarration, universalOmni, targetClipDurationSec = null) {
  // 增量保存状态放在 try 外，catch 里可用于部分恢复
  const episodeIdNum = Number(episodeId);
  const streamSavedNums = new Set();
  const streamStyle = (style && String(style).trim()) || cfg?.style?.default_style || '';
  const streamVideoRatio = cfg?.style?.default_video_ratio || '16:9';
  const deriveOpts = {
    universalOmni: !!universalOmni,
    targetClipDuration: targetClipDurationSec != null && Number(targetClipDurationSec) > 0 ? Number(targetClipDurationSec) : null,
  };
  let streamThrottle = 0;

  try {
    taskService.updateTaskStatus(db, taskId, 'processing', 10, '开始生成分镜头...');
    log.info('Processing storyboard generation', { task_id: taskId, episode_id: episodeId });
    log.info('Storyboard prompt preview', {
      user_prompt_len: userPrompt ? userPrompt.length : 0,
      system_prompt_len: systemPrompt ? systemPrompt.length : 0,
      user_prompt_head: userPrompt ? userPrompt.slice(0, 200) : '',
    });
    logDebugStoryboardPrompts(log, `task-${taskId}-initial`, userPrompt, systemPrompt);

    // 提前删除旧分镜，为增量流式保存腾出位置
    const deleteNow = new Date().toISOString();
    db.prepare('UPDATE storyboards SET deleted_at = ? WHERE episode_id = ? AND deleted_at IS NULL').run(deleteNow, episodeIdNum);

    // 不使用 json_mode：response_format:json_object 要求返回 JSON 对象而非数组，会导致模型包装成
    // {"storyboards":[...]} 或产生乱码 key，改由 extractFirstArray 统一处理任意包装格式。
    const text = await generateTextForStoryboard(db, log, userPrompt, systemPrompt, {
      model: model || undefined,
      // 每积累约 400 字符触发一次增量解析，尝试提前保存已完成的分镜
      streamCallback: (accumulated) => {
        if (accumulated.length - streamThrottle < 400) return;
        streamThrottle = accumulated.length;
        tryIncrementalSave(db, log, episodeIdNum, accumulated, streamSavedNums, streamStyle, streamVideoRatio, deriveOpts);
        // 同步更新任务进度（根据已保存分镜数量）
        if (streamSavedNums.size > 0) {
          taskService.updateTaskStatus(db, taskId, 'processing', 30,
            `已解析 ${streamSavedNums.size} 个分镜，生成中...`);
        }
      },
    });

    taskService.updateTaskStatus(db, taskId, 'processing', 50, '分镜头生成完成，正在解析结果...');

    log.info('AI raw response received', {
      task_id: taskId,
      text_type: typeof text,
      text_length: text ? String(text).length : 0,
      text_preview: text ? String(text).slice(0, 2000) : '(empty)',
    });

    let storyboards = [];
    const parseMeta = {};
    try {
      const parsed = safeParseAIJSON(text, null, log, parseMeta);
      storyboards = extractFirstArray(parsed) || [];
    } catch (e) {
      log.error('Parse storyboard JSON failed', {
        error: e.message,
        task_id: taskId,
        text_type: typeof text,
        text_length: text ? String(text).length : 0,
        raw_text: text ? String(text).slice(0, 2000) : '(empty)',
      });

      // 解析失败时，若流式增量保存已有部分分镜，视为截断的部分成功
      if (streamSavedNums.size > 0) {
        const partialBoards = getStoryboardsForEpisode(db, episodeIdNum);
        if (partialBoards.length > 0) {
          const totalDuration = partialBoards.reduce((s, sb) => s + (Number(sb.duration) || 0), 0);
          log.warn('Parse failed but partial storyboards already saved incrementally, treating as truncated success', {
            task_id: taskId, recovered_count: partialBoards.length, parse_error: e.message,
          });
          taskService.updateTaskResult(db, taskId, {
            storyboards: partialBoards,
            total: partialBoards.length,
            total_duration: totalDuration,
            duration_minutes: Math.ceil((totalDuration + 59) / 60),
            truncated: true,
            error_message: `AI输出含JSON格式缺陷（${e.message}），已恢复 ${partialBoards.length} 个分镜`,
          });
          return;
        }
      }

      taskService.updateTaskError(db, taskId, '解析分镜头结果失败: ' + (e.message || ''));
      return;
    }

    if (storyboards.length === 0) {
      // 最终解析为空，但流式已保存了内容，同样回退使用增量结果
      if (streamSavedNums.size > 0) {
        const partialBoards = getStoryboardsForEpisode(db, episodeIdNum);
        if (partialBoards.length > 0) {
          const totalDuration = partialBoards.reduce((s, sb) => s + (Number(sb.duration) || 0), 0);
          log.warn('Final parse returned 0 items but incremental saves exist, using those', {
            task_id: taskId, recovered_count: partialBoards.length,
          });
          taskService.updateTaskResult(db, taskId, {
            storyboards: partialBoards,
            total: partialBoards.length,
            total_duration: totalDuration,
            duration_minutes: Math.ceil((totalDuration + 59) / 60),
            truncated: true,
          });
          return;
        }
      }
      log.error('AI returned 0 storyboards', { task_id: taskId });
      taskService.updateTaskError(db, taskId, 'AI生成分镜失败：返回的分镜数量为0');
      return;
    }

    if (parseMeta.truncated) {
      log.warn('Storyboard JSON was truncated by AI (max_tokens limit), will attempt continuation', {
        task_id: taskId, episode_id: episodeId,
        rescued_count: storyboards.length,
        raw_text_length: text ? String(text).length : 0,
      });
    }
    log.info('Storyboard initial parse', { task_id: taskId, episode_id: episodeId, count: storyboards.length, truncated: parseMeta.truncated || false });

    // ── 自动续写：若 AI 输出被截断，最多续写 3 次直到完整 ──────────────────
    const MAX_CONTINUATION = 3;
    let contAttempt = 0;
    while (parseMeta.truncated && storyboards.length > 0 && contAttempt < MAX_CONTINUATION) {
      contAttempt++;
      const lastShot = Math.max(...storyboards.map(s => Number(s.shot_number ?? s.storyboard_number) || 0));
      log.info('Storyboard continuation start', { task_id: taskId, attempt: contAttempt, last_shot: lastShot, current_count: storyboards.length });
      taskService.updateTaskStatus(db, taskId, 'processing', 50 + contAttempt * 5,
        `已生成 ${storyboards.length} 个分镜，正在续写剩余部分（第${contAttempt}次）...`);

      const contPrompt = buildContinuationPrompt(userPrompt, storyboards, lastShot, contAttempt, !!includeNarration, !!universalOmni);
      logDebugStoryboardPrompts(log, `task-${taskId}-continuation-${contAttempt}`, contPrompt, systemPrompt);
      streamThrottle = 0; // 重置节流，让续写段落也能增量保存

      // 等待 3 秒后再发续写请求：避免流式请求刚结束服务端连接未释放导致 "socket hang up"
      await new Promise(r => setTimeout(r, 3000));

      let contText;
      try {
        contText = await generateTextForStoryboard(db, log, contPrompt, systemPrompt, {
          model: model || undefined,
          streamCallback: (accumulated) => {
            if (accumulated.length - streamThrottle < 400) return;
            streamThrottle = accumulated.length;
            tryIncrementalSave(db, log, episodeIdNum, accumulated, streamSavedNums, streamStyle, streamVideoRatio, deriveOpts);
          },
        });
      } catch (e) {
        log.warn('Continuation request failed', { task_id: taskId, attempt: contAttempt, error: e.message });
        break;
      }

      const contMeta = {};
      let contItems = [];
      try {
        const contParsed = safeParseAIJSON(contText, null, log, contMeta);
        contItems = extractFirstArray(contParsed) || [];
      } catch (e) {
        log.warn('Continuation parse failed', { task_id: taskId, attempt: contAttempt, error: e.message });
        break;
      }

      if (contItems.length === 0) {
        log.warn('Continuation returned 0 items', { task_id: taskId, attempt: contAttempt });
        break;
      }

      // 按 shot_number 去重，防止 AI 重复已生成的分镜
      const existingNums = new Set(storyboards.map(s => Number(s.shot_number ?? s.storyboard_number) || 0));
      const newItems = contItems.filter(s => !existingNums.has(Number(s.shot_number ?? s.storyboard_number) || 0));
      if (newItems.length === 0) {
        log.warn('Continuation returned only duplicate items', { task_id: taskId, attempt: contAttempt });
        break;
      }

      storyboards = [...storyboards, ...newItems];
      parseMeta.truncated = contMeta.truncated || false;
      log.info('Storyboard continuation done', {
        task_id: taskId, attempt: contAttempt,
        new_items: newItems.length, total_count: storyboards.length, still_truncated: parseMeta.truncated,
      });
    }
    // ── 续写结束 ────────────────────────────────────────────────────────────

    const totalDuration = storyboards.reduce((sum, sb) => sum + (Number(sb.duration) || 0), 0);
    if (parseMeta.truncated) {
      log.warn('Storyboard still truncated after max continuations', {
        task_id: taskId, final_count: storyboards.length, continuation_attempts: contAttempt,
      });
    }
    log.info('Storyboard generated', { task_id: taskId, episode_id: episodeId, count: storyboards.length, total_duration_seconds: totalDuration, truncated: parseMeta.truncated || false, continuation_attempts: contAttempt });

    taskService.updateTaskStatus(db, taskId, 'processing', 70, '正在保存分镜头...');

    // 传入 streamSavedNums：已增量保存的项目直接从 DB 读取，跳过重复 INSERT
    const saved = saveStoryboards(db, log, episodeId, storyboards, cfg, style, streamSavedNums, deriveOpts);

    // ── 分镜角色补全（字符串匹配，无 AI，极快）──────────────────────────────────
    taskService.updateTaskStatus(db, taskId, 'processing', 75, '正在校验分镜角色关联...');
    let totalCharAdded = 0;
    for (const sb of saved) {
      if (!sb?.id) continue;
      const { added } = syncStoryboardCharacters(db, log, sb.id);
      totalCharAdded += added.length;
    }
    if (totalCharAdded > 0) {
      log.info('[分镜] 角色补全完成', { episode_id: episodeId, total_added: totalCharAdded });
    }

    taskService.updateTaskStatus(db, taskId, 'processing', 90, '正在更新剧集时长...');

    const durationMinutes = Math.ceil((totalDuration + 59) / 60);
    db.prepare('UPDATE episodes SET duration = ?, updated_at = ? WHERE id = ?').run(durationMinutes, new Date().toISOString(), Number(episodeId));
    log.info('Episode duration updated', { episode_id: episodeId, duration_seconds: totalDuration, duration_minutes: durationMinutes });

    const resultData = {
      storyboards: saved,
      total: saved.length,
      total_duration: totalDuration,
      duration_minutes: durationMinutes,
      truncated: parseMeta.truncated || false,
    };
    taskService.updateTaskResult(db, taskId, resultData);
    log.info('Storyboard generation completed', { task_id: taskId, episode_id: episodeId });
  } catch (err) {
    log.error('Storyboard generation failed', { error: err.message, task_id: taskId });

    // 若连接中断（ECONNRESET 等）但已通过增量流式保存了部分分镜，视为部分成功而非彻底失败
    if (streamSavedNums.size > 0) {
      try {
        const partialBoards = getStoryboardsForEpisode(db, episodeIdNum);
        if (partialBoards.length > 0) {
          const totalDuration = partialBoards.reduce((s, sb) => s + (Number(sb.duration) || 0), 0);
          log.warn('Partial storyboards recovered after error, treating as truncated success', {
            task_id: taskId, recovered_count: partialBoards.length, error: err.message,
          });
          taskService.updateTaskResult(db, taskId, {
            storyboards: partialBoards,
            total: partialBoards.length,
            total_duration: totalDuration,
            duration_minutes: Math.ceil((totalDuration + 59) / 60),
            truncated: true,
            error_message: `连接中断（${err.message}），已恢复 ${partialBoards.length} 个分镜`,
          });
          return;
        }
      } catch (_) {}
    }

    taskService.updateTaskError(db, taskId, (err.message || '生成分镜头失败'));
  }
}

function generateStoryboard(db, log, episodeId, model, style, storyboardCount, videoDuration, aspectRatio, includeNarration, universalOmni) {
  const cfg = loadConfig();
  const episode = db.prepare(
    'SELECT id, script_content, description, drama_id FROM episodes WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(episodeId));
  if (!episode) {
    throw new Error('剧集不存在或无权限访问');
  }

  // 获取剧集风格和比例（如果未指定，则从 drama metadata / style 中获取完整提示词）
  const drama = db.prepare('SELECT style, metadata FROM dramas WHERE id = ?').get(episode.drama_id);
  const { resolvedStreamStyleFromDrama } = require('../utils/dramaStyleMerge');
  const finalStyle = resolvedStreamStyleFromDrama(style, drama);

  // 图片比例 + 每镜时长：优先用传入值，再从 drama.metadata 读，最后兜底全局配置
  let dramaAspectRatio = null;
  let videoClipDuration = null;
  try {
    if (drama && drama.metadata) {
      const meta = typeof drama.metadata === 'string' ? JSON.parse(drama.metadata) : drama.metadata;
      if (meta && meta.aspect_ratio) dramaAspectRatio = meta.aspect_ratio;
      if (meta && meta.video_clip_duration) videoClipDuration = Number(meta.video_clip_duration) || null;
    }
  } catch (_) {}
  const imageRatio = aspectRatio || dramaAspectRatio || cfg?.style?.default_video_ratio || '16:9';

  // 计算单镜建议时长（秒）：
  // 项目 metadata 中的 video_clip_duration（如 15 秒/段）优先于「总时长÷镜数」，
  // 否则前端同时传总时长+镜数时会把每镜压成过短（与「每段秒数」配置矛盾）。
  // 无项目配置时再使用总时长÷镜数；再否则 null。
  let effectiveShotDuration = null;
  const impliedFromTotal =
    videoDuration && storyboardCount
      ? Math.round(Number(videoDuration) / Number(storyboardCount))
      : null;
  if (videoClipDuration && Number(videoClipDuration) > 0) {
    effectiveShotDuration = Number(videoClipDuration);
  } else if (impliedFromTotal && impliedFromTotal > 0) {
    effectiveShotDuration = impliedFromTotal;
  } else {
    effectiveShotDuration = null;
  }

  let scriptContent = (episode.script_content && String(episode.script_content).trim())
    ? String(episode.script_content)
    : (episode.description && String(episode.description).trim())
      ? String(episode.description)
      : '';
  if (!scriptContent) {
    throw new Error('剧本内容为空，请先生成剧集内容');
  }

  const characters = db.prepare(
    'SELECT id, name FROM characters WHERE drama_id = ? AND deleted_at IS NULL ORDER BY name ASC'
  ).all(episode.drama_id);
  let characterList = '无角色';
  if (characters.length > 0) {
    characterList = '[' + characters.map((c) => `{"id": ${c.id}, "name": "${(c.name || '').replace(/"/g, '\\"')}"}`).join(', ') + ']';
  }

  const scenes = db.prepare(
    'SELECT id, location, time FROM scenes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY location ASC, time ASC'
  ).all(episode.drama_id);
  let sceneList = '无场景';
  if (scenes.length > 0) {
    sceneList = '[' + scenes.map((s) => `{"id": ${s.id}, "location": "${(s.location || '').replace(/"/g, '\\"')}", "time": "${(s.time || '').replace(/"/g, '\\"')}"}`).join(', ') + ']';
  }

  const props = db.prepare(
    'SELECT id, name, type FROM props WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id ASC'
  ).all(episode.drama_id);
  let propList = '无道具';
  if (props.length > 0) {
    propList = '[' + props.map((p) => `{"id": ${p.id}, "name": "${(p.name || '').replace(/"/g, '\\"')}"${p.type ? `, "type": "${p.type.replace(/"/g, '\\"')}"` : ''}}`).join(', ') + ']';
  }

  const scriptLabel = promptI18n.formatUserPrompt(cfg, 'script_content_label');
  const taskLabel = promptI18n.formatUserPrompt(cfg, 'task_label');
  const taskInstruction = promptI18n.formatUserPrompt(cfg, 'task_instruction');
  
  // 处理分镜数量和时长约束
  let extraConstraint = '';
  // 宽松判断：只要有值（包括字符串形式的数字），就尝试转换并添加约束
  if (storyboardCount) {
    const countVal = Number(storyboardCount);
    if (Number.isFinite(countVal) && countVal > 0) {
      const countLabel = promptI18n.formatUserPrompt(cfg, 'storyboard_count_constraint', countVal);
      if (countLabel) extraConstraint += `\n${countLabel}`;
    }
  }
  if (videoDuration) {
    const durationVal = Number(videoDuration);
    if (Number.isFinite(durationVal) && durationVal > 0) {
      const durationLabel = promptI18n.formatUserPrompt(cfg, 'video_duration_constraint', durationVal);
      if (durationLabel) extraConstraint += `\n${durationLabel}`;
    }
  }
  // 当同时指定总时长和数量时，补充单镜 duration 说明（与项目「每段秒数」一致时勿用总÷镜压短）
  if (storyboardCount && videoDuration && effectiveShotDuration) {
    const isEn = promptI18n.isEnglish(cfg);
    const clipFromProject = videoClipDuration && Number(videoClipDuration) > 0;
    const implied =
      impliedFromTotal && impliedFromTotal > 0 ? impliedFromTotal : Math.round(Number(videoDuration) / Number(storyboardCount));
    if (clipFromProject) {
      const clip = Number(videoClipDuration);
      if (isEn) {
        extraConstraint += `\nEach shot "duration" field: prioritize **~${clip}s per shot** (project clip-length setting); ±1s OK. Total ~${Number(videoDuration)}s and ~${Number(storyboardCount)} shots are overall planning hints—do NOT force every shot to ~${implied}s (total÷count) when it conflicts with the project clip length.`;
      } else {
        extraConstraint += `\n每个镜头的 **duration** 请优先按项目「每段约 **${clip} 秒**」填写（可 ±1 秒微调）。全片总时长约 ${Number(videoDuration)} 秒、镜头数约 ${Number(storyboardCount)} 为整体规划参考，**禁止**为机械凑「总时长÷镜数」（约 ${implied}s）而把每镜普遍写成过短镜头；除非该镜对白与动作为实需的极短镜头。`;
      }
    } else if (isEn) {
      extraConstraint += `\nEach shot target duration: approximately ${effectiveShotDuration}s (= total ${Number(videoDuration)}s ÷ ${Number(storyboardCount)} shots). Set each shot's duration field to this value, adjusting ±1s for dialogue/action length.`;
    } else {
      extraConstraint += `\n每镜头目标时长：约 ${effectiveShotDuration} 秒（= 总时长 ${Number(videoDuration)}s ÷ ${Number(storyboardCount)} 个镜头）。每个镜头的 duration 字段请设为此值，可根据对话/动作长短适当调整 ±1 秒。`;
    }
  }

  log.info('Storyboard generation params', {
    storyboard_count: storyboardCount,
    video_duration: videoDuration,
    video_clip_duration: videoClipDuration,
    effective_shot_duration: effectiveShotDuration,
  });

  const charListLabel = promptI18n.formatUserPrompt(cfg, 'character_list_label');
  const charConstraint = promptI18n.formatUserPrompt(cfg, 'character_constraint');
  const sceneListLabel = promptI18n.formatUserPrompt(cfg, 'scene_list_label');
  const sceneConstraint = promptI18n.formatUserPrompt(cfg, 'scene_constraint');
  const propListLabel = promptI18n.formatUserPrompt(cfg, 'prop_list_label');
  const propConstraint = promptI18n.formatUserPrompt(cfg, 'prop_constraint');
  const suffix = promptI18n.getStoryboardUserPromptSuffix(cfg, effectiveShotDuration);

  let userPrompt =
    `${scriptLabel}\n${scriptContent}\n\n${taskLabel}\n${taskInstruction}${extraConstraint}\n\n${charListLabel}\n${characterList}\n\n${charConstraint}\n\n${sceneListLabel}\n${sceneList}\n\n${sceneConstraint}\n\n${propListLabel}\n${propList}\n\n${propConstraint}\n\n${suffix}`;

  const wantNarration = includeNarration === true || includeNarration === 1 || String(includeNarration).toLowerCase() === 'true';
  if (wantNarration) {
    userPrompt += promptI18n.getStoryboardNarrationExtraInstructions(cfg);
  }

  let systemPrompt = promptI18n.getStoryboardSystemPrompt(cfg);

  // 当用户指定了分镜数量时，在系统提示词后追加最高优先级覆盖指令，
  // 使"目标数量"优先于默认的"一动作一镜头、禁止合并"原则
  if (storyboardCount && Number(storyboardCount) > 0) {
    const targetCount = Number(storyboardCount);
    const isEn = systemPrompt.includes('[Role]');
    if (isEn) {
      systemPrompt += `\n\n[HIGHEST PRIORITY — USER SPECIFIED COUNT]
The user requires exactly ${targetCount} shots (±10% tolerance is acceptable).
This requirement OVERRIDES the "one action = one shot, no merging" rule above.
You MUST merge related consecutive actions into fewer shots OR split key moments into more shots to reach this target.
Do NOT produce a shot count far from ${targetCount} under any circumstance.`;
    } else {
      systemPrompt += `\n\n【最高优先级——用户指定分镜数量】
用户要求生成恰好 ${targetCount} 个分镜（允许 ±10% 的偏差，即 ${Math.floor(targetCount * 0.9)}~${Math.ceil(targetCount * 1.1)} 个均可接受）。
此要求优先级高于上述所有原则，包括"一动作一镜头、禁止合并"的规则。
- 若动作较多、自然拆分超过目标数量，请将相关联的连续小动作合并为一个镜头
- 若动作较少、自然拆分不足目标数量，请将重要场景或情绪转折拆分为多个镜头
- 严禁生成数量与 ${targetCount} 相差悬殊的分镜方案`;
    }
  }

  if (wantNarration) {
    const isEn = systemPrompt.includes('[Role]');
    if (isEn) {
      systemPrompt += `\n\n[HIGHEST PRIORITY — NARRATION / VO MODE]
The user enabled narrator voice-over for the whole episode. Every shot object MUST include non-empty "narration" (≥1 sentence). Shot 1 MUST have an opening VO hook (time/place/mood). Shots 1 and 2 MUST NOT both have empty narration. Empty "narration" is NOT allowed in this mode.`;
    } else {
      systemPrompt += `\n\n【最高优先级——解说旁白已开启】
用户已开启全片解说：每个分镜的 narration 必须为非空字符串（至少一句）。第 1 镜必须有开场解说。第 1、2 镜禁止同时留空 narration。本模式下不允许 narration 为空。`;
    }
  }

  const wantUniversalOmni =
    universalOmni === true ||
    universalOmni === 1 ||
    String(universalOmni || '').toLowerCase() === 'true';
  if (wantUniversalOmni) {
    systemPrompt += promptI18n.getStoryboardUniversalOmniModeSuffix(cfg);
  }

  const task = taskService.createTask(db, log, 'storyboard_generation', String(episodeId));
  log.info('Generating storyboard asynchronously', {
    task_id: task.id,
    episode_id: episodeId,
    drama_id: episode.drama_id,
    script_length: scriptContent.length,
    character_count: characters.length,
    scene_count: scenes.length,
    storyboard_count: storyboardCount,
    video_duration: videoDuration,
    universal_omni_storyboard: wantUniversalOmni,
  });

  setImmediate(() => {
    // 传入 imageRatio 同时覆盖 default_video_ratio 和 default_image_ratio，
    // 确保分镜图/视频提示词、场景提取提示词都使用项目设定的比例
    const runCfg = { ...cfg, style: { ...(cfg?.style || {}), default_video_ratio: imageRatio, default_image_ratio: imageRatio } };
    // 如果 model 为 null，则传 undefined，让 generateText 内部去兜底找默认配置
    const clipSec =
      videoClipDuration && Number(videoClipDuration) > 0 ? Number(videoClipDuration) : null;
    processStoryboardGeneration(
      db,
      log,
      runCfg,
      task.id,
      String(episodeId),
      model || undefined,
      finalStyle,
      userPrompt,
      systemPrompt,
      wantNarration,
      wantUniversalOmni,
      clipSec
    );
  });

  return { task_id: task.id, status: 'pending', message: '分镜生成任务已创建，正在后台处理...' };
}

module.exports = {
  getStoryboardsForEpisode,
  generateStoryboard,
};
