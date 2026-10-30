/**
 * 全能片段（Omni / Seedance 多图参考）用户消息构建：供「生成」与「润色」共用。
 * @param {import('better-sqlite3').Database} db
 * @param {number} sbId
 * @param {object} reqBody 可选 duration、force_without_reference_images（为 true 时不校验场景/角色/道具是否已上图，仍构建提示词）
 * @param {{ universalSegmentOverride?: string | undefined }} opts 若传入则覆盖库中的 universal 写入 CURRENT_UNIVERSAL_SEGMENT
 * @returns {{ ok:true, userPrompt:string, durationLabel:string, durationSec:number, sbId:number, episodeId:number, storyboardNumber:number } | { ok:false, code:'not_found'|'bad_request', message:string }}
 */
function buildUniversalSegmentUserPromptBundle(db, sbId, reqBody, opts = {}) {
  const bodyIn = reqBody && typeof reqBody === 'object' ? reqBody : {};
  const forceWithoutReferenceImages = !!bodyIn.force_without_reference_images;

  const sb = db.prepare(
    `SELECT id, episode_id, storyboard_number, scene_id, title, description, location, time,
      action, dialogue, narration, result, atmosphere,
      image_prompt, polished_prompt, video_prompt, universal_segment_text,
      shot_type, angle, angle_h, angle_v, angle_s, movement, lighting_style, depth_of_field,
      characters, local_path, duration, segment_index, segment_title
     FROM storyboards WHERE id = ? AND deleted_at IS NULL`
  ).get(sbId);
  if (!sb) return { ok: false, code: 'not_found', message: '分镜不存在' };

  let dramaId = null;
  let dramaRow = null;
  try {
    const epRow = db.prepare('SELECT drama_id FROM episodes WHERE id = ? AND deleted_at IS NULL').get(sb.episode_id);
    dramaId = epRow?.drama_id ?? null;
    if (dramaId) {
      dramaRow = db.prepare('SELECT title, genre, style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(dramaId);
    }
  } catch (_) {}

  let styleZh = '';
  let styleEn = '';
  try {
    const loadConfig = require('../config').loadConfig;
    const { mergeCfgStyleWithDrama } = require('../utils/dramaStyleMerge');
    let cfg = loadConfig();
    cfg = mergeCfgStyleWithDrama(cfg, dramaRow || {});
    styleEn = (cfg?.style?.default_style_en || cfg?.style?.default_style || '').trim();
    styleZh = (cfg?.style?.default_style_zh || '').trim();
  } catch (_) {}

  const chunk = (k, v) => {
    const s = v != null && String(v).trim() ? String(v).trim() : '';
    return s ? `${k}: ${s}` : null;
  };

  const universalForLine =
    opts.universalSegmentOverride !== undefined ? opts.universalSegmentOverride : sb.universal_segment_text;

  const lines = [
    chunk('TITLE', sb.title),
    chunk('DESCRIPTION', sb.description),
    chunk('LOCATION', sb.location),
    chunk('TIME', sb.time),
    chunk('ACTION', sb.action),
    chunk('DIALOGUE', sb.dialogue),
    chunk('NARRATION', sb.narration),
    chunk('RESULT', sb.result),
    chunk('ATMOSPHERE', sb.atmosphere),
    chunk('IMAGE_PROMPT', sb.image_prompt),
    chunk('POLISHED_IMAGE_PROMPT', sb.polished_prompt),
    chunk('VIDEO_PROMPT', sb.video_prompt),
    chunk('SHOT_TYPE', sb.shot_type),
    chunk('ANGLE', sb.angle),
    chunk('ANGLE_H', sb.angle_h),
    chunk('ANGLE_V', sb.angle_v),
    chunk('ANGLE_S', sb.angle_s),
    chunk('MOVEMENT', sb.movement),
    chunk('LIGHTING', sb.lighting_style),
    chunk('DEPTH_OF_FIELD', sb.depth_of_field),
    chunk('CURRENT_UNIVERSAL_SEGMENT', universalForLine),
  ].filter(Boolean);

  const hasMediaRef = (row) =>
    row && (String(row.local_path || '').trim() !== '' || String(row.image_url || '').trim() !== '');

  let sceneRow = null;
  let sceneBlock = '';
  if (sb.scene_id) {
    try {
      sceneRow = db
        .prepare('SELECT location, time, prompt, image_url, local_path FROM scenes WHERE id = ? AND deleted_at IS NULL')
        .get(sb.scene_id);
      if (sceneRow) {
        const scBits = [
          chunk('SCENE_LOCATION', sceneRow.location),
          chunk('SCENE_TIME', sceneRow.time),
          chunk('SCENE_PROMPT', sceneRow.prompt),
          hasMediaRef(sceneRow) ? 'SCENE_HAS_REFERENCE_IMAGE: yes' : 'SCENE_HAS_REFERENCE_IMAGE: no',
        ].filter(Boolean);
        sceneBlock = scBits.join('\n');
      }
    } catch (_) {}
  }

  const charOrderEntries = [];
  const charKeySeen = new Set();
  const pushCharEntry = (key, nameHint) => {
    if (!key || charKeySeen.has(key)) return;
    charKeySeen.add(key);
    charOrderEntries.push({
      key,
      nameHint: nameHint != null && String(nameHint).trim() ? String(nameHint).trim() : '',
    });
  };
  /** 与前端 collectSbOmniReferenceAbsoluteUrls / 视频 API 参考图顺序一致：仅以分镜 characters JSON 的本剧角色顺序为准，避免再追加 storyboard_characters 导致槽位与界面 @图片N 错位。 */
  let charOrderFromDramaJson = false;
  try {
    if (sb.characters) {
      const parsed = JSON.parse(sb.characters);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const cid = typeof item === 'object' && item != null ? item.id : item;
          const idNum = Number(cid);
          if (!Number.isFinite(idNum)) continue;
          const nm =
            typeof item === 'object' && item != null && item.name != null ? String(item.name).trim() : '';
          pushCharEntry(`drama:${idNum}`, nm);
        }
        if (charOrderEntries.length > 0) charOrderFromDramaJson = true;
      }
    }
    if (!charOrderFromDramaJson) {
      const libLinks = db
        .prepare('SELECT character_id FROM storyboard_characters WHERE storyboard_id = ? ORDER BY id ASC')
        .all(sbId);
      for (const link of libLinks) {
        const lid = Number(link.character_id);
        if (!Number.isFinite(lid)) continue;
        pushCharEntry(`lib:${lid}`, '');
      }
    }
  } catch (_) {}

  const charNamesOrdered = [];
  const nameSeen = new Set();
  for (const ent of charOrderEntries) {
    let row = null;
    if (ent.key.startsWith('drama:')) {
      row = db.prepare('SELECT name FROM characters WHERE id = ? AND deleted_at IS NULL').get(Number(ent.key.slice(6)));
    } else if (ent.key.startsWith('lib:')) {
      row = db.prepare('SELECT name FROM character_libraries WHERE id = ? AND deleted_at IS NULL').get(Number(ent.key.slice(4)));
    }
    const nm = (row?.name || ent.nameHint || '').trim();
    if (nm && !nameSeen.has(nm)) {
      nameSeen.add(nm);
      charNamesOrdered.push(nm);
    }
  }
  const charNames = charNamesOrdered.join(', ');

  let propRows = [];
  try {
    propRows =
      db
        .prepare(
          `SELECT p.id, p.name, p.local_path, p.image_url FROM storyboard_props sp
         JOIN props p ON p.id = sp.prop_id AND p.deleted_at IS NULL
         WHERE sp.storyboard_id = ?
         ORDER BY sp.prop_id ASC`
        )
        .all(sbId) || [];
  } catch (_) {
    propRows = [];
  }
  const propNamesOrdered = [];
  const propSeen = new Set();
  for (const r of propRows) {
    const n = r?.name != null && String(r.name).trim() ? String(r.name).trim() : '';
    if (n && !propSeen.has(n)) {
      propSeen.add(n);
      propNamesOrdered.push(n);
    }
  }
  const propNames = propNamesOrdered;

  let prevDesc = '(first shot)';
  let nextDesc = '(last shot)';
  if (sb.episode_id != null && sb.storyboard_number != null) {
    const prevShot = db
      .prepare(
        'SELECT action, location, time FROM storyboards WHERE episode_id = ? AND storyboard_number < ? AND deleted_at IS NULL ORDER BY storyboard_number DESC LIMIT 1'
      )
      .get(sb.episode_id, sb.storyboard_number);
    const nextShot = db
      .prepare(
        'SELECT action, location, time FROM storyboards WHERE episode_id = ? AND storyboard_number > ? AND deleted_at IS NULL ORDER BY storyboard_number ASC LIMIT 1'
      )
      .get(sb.episode_id, sb.storyboard_number);
    if (prevShot) {
      prevDesc =
        (prevShot.action || [prevShot.location, prevShot.time].filter(Boolean).join(' ')).slice(0, 160).trim() ||
        '(first shot)';
    }
    if (nextShot) {
      nextDesc =
        (nextShot.action || [nextShot.location, nextShot.time].filter(Boolean).join(' ')).slice(0, 160).trim() ||
        '(last shot)';
    }
  }

  const slots = [];
  const pushSlot = (kind, summary) => {
    const num = slots.length + 1;
    const brief = String(summary || '').trim() || kind;
    slots.push({ num, tag: `@图片${num}`, kind, summary: brief });
  };
  if (sceneRow && hasMediaRef(sceneRow)) {
    pushSlot('场景', String(sceneRow.location || '').trim() || '场景环境');
  }
  for (const ent of charOrderEntries) {
    let row = null;
    if (ent.key.startsWith('drama:')) {
      row = db
        .prepare('SELECT name, local_path, image_url FROM characters WHERE id = ? AND deleted_at IS NULL')
        .get(Number(ent.key.slice(6)));
    } else if (ent.key.startsWith('lib:')) {
      row = db
        .prepare('SELECT name, local_path, image_url FROM character_libraries WHERE id = ? AND deleted_at IS NULL')
        .get(Number(ent.key.slice(4)));
    }
    if (!hasMediaRef(row)) continue;
    const cn = String(row.name || ent.nameHint || '角色').trim();
    pushSlot('角色', cn);
  }
  for (const pr of propRows) {
    if (!hasMediaRef(pr)) continue;
    pushSlot('道具', String(pr.name || '道具').trim());
  }

  const charSlots = slots.filter((s) => s.kind === '角色');
  const sceneFirst = slots.length > 0 && slots[0].kind === '场景';
  const charBindingBlock =
    charSlots.length > 0
      ? [
          sceneFirst
            ? 'CHARACTER_IMAGE_BINDING（@图片1 仅为场景/环境；人物从 @图片2 起依次对应下列姓名，勿把人绑在 @图片1）:'
            : 'CHARACTER_IMAGE_BINDING（首张参考图非场景，以 IMAGE_SLOT_MAP 为准；人物与下列 @图片N 一一对应）:',
          ...charSlots.map((s) =>
            sceneFirst
              ? `「${s.summary}」→ ${s.tag}（外貌/动作绑定 ${s.tag} ，示例：${s.tag} 的侧脸；禁止「@图片1 中的${s.summary}」）`
              : `「${s.summary}」→ ${s.tag}（外貌/动作绑定 ${s.tag} ，示例：${s.tag} 的侧脸）`
          ),
        ].join('\n')
      : slots.length === 0 && forceWithoutReferenceImages
        ? [
            'CHARACTER_IMAGE_BINDING（无图强制模式）:',
            '- 尚无已解析的 @图片 槽位；ORDERED_CHARACTER_NAMES 仅用于剧情理解，禁止写成 @姓名 指代参考图。',
            '- 若输出中出现 @图片N，仅表示与将来补图顺序对齐的占位，勿将具体外貌绑定到错误序号。',
          ].join('\n')
        : [
            'CHARACTER_IMAGE_BINDING: 当前无「角色」参考槽位；若出现人物且 @图片1 为场景，勿将人物外貌写在 @图片1。',
          ].join('\n');

  if (slots.length === 0 && !forceWithoutReferenceImages) {
    return {
      ok: false,
      code: 'bad_request',
      message: '请至少为场景、角色或道具上传一张参考图后再生成，以便对应 @图片1、@图片2 与 API 参考顺序一致',
    };
  }

  let imageSlotMapBlock;
  let line3Required;
  if (slots.length === 0) {
    imageSlotMapBlock = [
      'IMAGE_SLOT_MAP（无图强制模式：尚无已上传场景/角色/道具参考图；视频 API 当前无实际参考图槽位。若正文仍写 @图片N，仅表示与将来补图顺序对齐的占位，出片前须核对）:',
      '（解析结果：无已绑定图像的槽位 — 优先依据剧本与分镜字段写清运镜、节奏与情绪；可不使用 @图片N，或自 @图片1 起预留占位，勿编造与剧本矛盾的细节。）',
    ].join('\n');
    line3Required =
      '当前尚未上传参考图；以剧本与分镜字段书写整段内的运镜与时间轴；若写 @图片N 仅为后续补图预留占位，勿将具体人脸绑定到尚未确定序号的图片；勿编造与剧本矛盾的情节。';
  } else {
    imageSlotMapBlock = [
      'IMAGE_SLOT_MAP（全能模式提交视频时参考图顺序；正文仅可使用下列占位符，与 API 一致）:',
      ...slots.map((s) => `${s.tag} = ${s.kind}「${s.summary}」`),
    ].join('\n');
    line3Required =
      slots[0].kind === '场景'
        ? '环境、光影与陈设定性参考 @图片1。若 @图片1 为宫格或多画面拼图，禁止成片复刻其分格或并列布局，仅提取统一的室内空间与光线语义；须单镜头完整连续画面。'
        : '本片段以首张参考图 @图片1 作为画面锚点展开。';
  }

  const charCount = charNamesOrdered.length;
  const propCount = propNames.length;

  let projectClipSec = 5;
  if (dramaRow?.metadata) {
    try {
      const m = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
      const v = Number(m?.video_clip_duration);
      if (Number.isFinite(v) && v > 0) projectClipSec = Math.min(120, Math.max(1, v));
    } catch (_) {}
  }
  const body = bodyIn;
  const bodyDurRaw = body.duration != null && body.duration !== '' ? Number(body.duration) : NaN;
  const sbDurRaw = sb.duration != null ? Number(sb.duration) : NaN;
  const durationSec = Number.isFinite(bodyDurRaw) && bodyDurRaw > 0
    ? Math.min(120, Math.max(1, bodyDurRaw))
    : Number.isFinite(sbDurRaw) && sbDurRaw > 0
      ? Math.min(120, Math.max(1, sbDurRaw))
      : projectClipSec;
  const durationLabel = Number.isInteger(durationSec) ? String(durationSec) : String(Math.round(durationSec * 10) / 10);

  const genreHint = (dramaRow?.genre && String(dramaRow.genre).trim()) || '';
  const dramaTitle = (dramaRow?.title && String(dramaRow.title).trim()) || '';
  const styleHintBlock = [
    `STYLE_HINT:`,
    chunk('DRAMA_TITLE', dramaTitle),
    chunk('DRAMA_GENRE', genreHint),
    chunk('STYLE_ZH', styleZh),
    chunk('STYLE_EN', styleEn),
  ]
    .filter(Boolean)
    .join('\n');

  const refContract = [
    'REFERENCE_RULE:',
    ...(slots.length === 0
      ? [
          '- 当前为无图强制模式：视频 API 尚无参考图；可不写 @图片N，若写则仅为补图前占位，出片前须与实际上传顺序一致。',
          '- 禁止用 @场景、@姓名、@道具名 等形式指代参考图；将来有图时须一律改为 @图片N（与 MAP 一致）。',
        ]
      : [
          '- 绑定到某张参考图时，只能写 IMAGE_SLOT_MAP 里列出的 @图片N（阿拉伯数字，如 @图片1、@图片2）。',
          '- 禁止用 @场景、@姓名、@林薇、@道具名 等形式指代参考图；需要指图时一律 @图片N。',
          '- 若 @图片1 为「场景」：只写环境/光影/陈设；人物外貌与动作按 CHARACTER_IMAGE_BINDING 从 @图片2 起。若首张参考图即角色，则以 MAP 为准。',
          '- 场景参考若为四宫格/九宫格等拼图：见 SCENE_REFERENCE_LAYOUT；成片须单镜头连续画面，禁止模仿拼图布局。',
        ]),
    '- 每个 @图片N 与后随的中/英文字之间保留一个半角空格（后处理也会修正，但模型应直接写对）。',
    '- ORDERED_CHARACTER_NAMES 仅供理解剧情，不得当作图占位符。',
    `有图参考槽位数: ${slots.length}；绑定角色数(含无图): ${charCount}；绑定道具数(含无图): ${propCount}`,
  ].join('\n');

  const assetLine = `ORDERED_CHARACTER_NAMES（仅剧情理解）: ${charNames || 'none'}\nORDERED_PROP_NAMES: ${propNames.join(', ') || 'none'}`;

  if (lines.length === 0 && !sceneBlock && !charNames && !propNames.length) {
    return { ok: false, code: 'bad_request', message: '分镜中暂无可用信息，请先填写动作、对白、视频提示词或绑定场景/角色等' };
  }

  const hasSceneSlot = slots.some((s) => s.kind === '场景');
  const sceneLayoutBlock = hasSceneSlot
    ? [
        'SCENE_REFERENCE_LAYOUT（场景参考图可能是多宫格/多视角拼图，仅作内容与空间参考，成片禁止模仿拼图）:',
        '- 场景槽位（通常为 @图片1）常见为四宫格、九宫格或带分割线的多视角场景图：只提取家具、装修、色调、空间关系与光影，不要在提示中引导模型生成「分屏、宫格、多画面并列、复刻参考图网格」。',
        '- 每一个「分镜k： Tk秒:」所在行的正文里都应点明：单镜头连续画幅、无成片宫格分屏；参考拼图仅用于理解空间与光线。',
      ].join('\n')
    : '';

  let episodeScript = '';
  let episodeTableTitle = '';
  try {
    const ep = db.prepare('SELECT script_content, title FROM episodes WHERE id = ? AND deleted_at IS NULL').get(sb.episode_id);
    if (ep) {
      episodeTableTitle = (ep.title && String(ep.title).trim()) || '';
      episodeScript = ep.script_content != null ? String(ep.script_content) : '';
    }
  } catch (_) {}
  const SCRIPT_CAP = 20000;
  if (episodeScript.length > SCRIPT_CAP) {
    episodeScript = `${episodeScript.slice(0, SCRIPT_CAP)}\n...[EPISODE_SCRIPT_TRUNCATED]`;
  }

  const mHeuristic = Math.min(8, Math.max(1, Math.round(durationSec / 5)));
  let shotPacingBlock = '';
  try {
    const all = db
      .prepare(
        'SELECT id, storyboard_number, segment_index, segment_title FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number ASC'
      )
      .all(sb.episode_id);
    const ix = all.findIndex((r) => Number(r.id) === Number(sb.id));
    const totalShots = all.length || 1;
    const posTag =
      ix <= 0 ? 'first_in_episode' : ix === all.length - 1 ? 'last_in_episode' : 'middle_of_episode';
    const prevSeg = ix > 0 ? String(all[ix - 1].segment_title || '').trim() : '';
    const nextSeg = ix >= 0 && ix < all.length - 1 ? String(all[ix + 1].segment_title || '').trim() : '';
    const currSeg = String(sb.segment_title || '').trim();
    const segChange = ix > 0 && currSeg && prevSeg && currSeg !== prevSeg;
    shotPacingBlock = [
      'SHOT_PACING_AND_POSITION:',
      `TOTAL_CLIP_SECONDS: ${durationLabel}（本条数据库分镜 = 一次成片 API 的整段时长；下文 M 个子分镜仅为同一时间轴内节拍拆分）`,
      `M_HEURISTIC_ONLY: 约 ${mHeuristic}（不得照抄为最终 M；须结合剧本高潮/对白密度/转场/机位与 movement 等自决 1～8 的整数 M）`,
      `SHOT_ORDER: ${ix >= 0 ? ix + 1 : '?'} / ${totalShots}`,
      `SHOT_POSITION_TAG: ${posTag}`,
      chunk('SEGMENT_TITLE_PREV', prevSeg || null),
      chunk('SEGMENT_TITLE_CURRENT', currSeg || null),
      chunk('SEGMENT_TITLE_NEXT', nextSeg || null),
      segChange
        ? 'BOUNDARY_HINT: 段落标题相对上一镜已变化 → 转场/新叙事块概率高 → 可提高 M 或前几秒侧重空间/情绪铺垫再入冲突。'
        : 'BOUNDARY_HINT: 同段落延续 → M 可保守；若 ACTION 内对白长、机位少，也可 M=1 但在单行内写满时间流动。',
    ].join('\n');
  } catch (_) {
    shotPacingBlock = [
      'SHOT_PACING_AND_POSITION:',
      `TOTAL_CLIP_SECONDS: ${durationLabel}`,
      `M_HEURISTIC_ONLY: 约 ${mHeuristic}`,
    ].join('\n');
  }

  let neighborDetailBlock = '';
  try {
    const prevFull = db
      .prepare(
        `SELECT storyboard_number, title, segment_title, action, dialogue, narration, shot_type, movement, atmosphere
         FROM storyboards WHERE episode_id = ? AND storyboard_number < ? AND deleted_at IS NULL ORDER BY storyboard_number DESC LIMIT 1`
      )
      .get(sb.episode_id, sb.storyboard_number);
    const nextFull = db
      .prepare(
        `SELECT storyboard_number, title, segment_title, action, dialogue, narration, shot_type, movement, atmosphere
         FROM storyboards WHERE episode_id = ? AND storyboard_number > ? AND deleted_at IS NULL ORDER BY storyboard_number ASC LIMIT 1`
      )
      .get(sb.episode_id, sb.storyboard_number);
    const fmtN = (row, tag) => {
      if (!row) return `${tag}: (none)`;
      const bits = [
        `${tag}:`,
        chunk('N_NUM', row.storyboard_number),
        chunk('N_TITLE', row.title),
        chunk('N_SEGMENT', row.segment_title),
        chunk('N_ACTION', row.action),
        chunk('N_DIALOGUE', row.dialogue),
        chunk('N_NARRATION', row.narration),
        chunk('N_SHOT_TYPE', row.shot_type),
        chunk('N_MOVEMENT', row.movement),
        chunk('N_ATMOSPHERE', row.atmosphere),
      ].filter(Boolean);
      return bits.join('\n');
    };
    neighborDetailBlock = [fmtN(prevFull, 'NEIGHBOR_PREV_DETAIL'), '', fmtN(nextFull, 'NEIGHBOR_NEXT_DETAIL')].join('\n');
  } catch (_) {}

  const multiBeatContract = [
    'MULTI_BEAT_OUTPUT（一条成片 API 内的多节拍文案）:',
    '- 总行数 = 3 + M。M 为你选择的子分镜条数（时间轴节拍），整数 1～8。',
    '- 第1行：「画面风格和类型:」…',
    `- 第2行：必须为「生成一个由以下M个分镜组成的视频。」（将 M 替换为你的整数；与下文实际「分镜1…分镜M」条数一致）。`,
    '- 第3行：必须逐字等于 LINE3_REQUIRED（见下）。',
    '- 第4行到第(3+M)行：依次为「分镜1： T1秒:」「分镜2： T2秒:」…「分镜M： TM秒:」；每行冒号后先写秒数再写该子时段内的动态影像与运镜描写。',
    `- 约束：T1+T2+…+TM 必须严格等于 TOTAL_CLIP_SECONDS（数值与 ${durationLabel} 一致）；每个 Tk>0；子分镜序号连续无跳号。`,
    '- 若 M=1：即仅一行「分镜1： TOTAL秒:」写满整段；若 M>1：每行只覆盖本子时段，前后行衔接成连续时间线，避免剧情跳跃或重复前一行已完成的动作。',
    '- 禁止额外说明行、markdown、英文小标题；禁止把「子分镜」写成多次独立成片 API。',
  ].join('\n');

  const userPrompt = [
    `TOTAL_CLIP_SECONDS: ${durationLabel}`,
    `DURATION_SECONDS: ${durationLabel}`,
    multiBeatContract,
    shotPacingBlock,
    neighborDetailBlock || null,
    'LINE3_REQUIRED（第3行必须与下面整句完全一致，含标点）:',
    line3Required,
    `EPISODE_SCRIPT:\n${episodeScript || '(本集剧本为空；仅凭分镜与邻镜推断节奏，勿编造大段新剧情)'}`,
    chunk('EPISODE_TABLE_TITLE', episodeTableTitle),
    imageSlotMapBlock,
    sceneLayoutBlock || null,
    charBindingBlock,
    styleHintBlock,
    refContract,
    assetLine,
    sceneBlock || null,
    `CONTEXT_PREV_SHORT: ${prevDesc}`,
    `CONTEXT_NEXT_SHORT: ${nextDesc}`,
    '--- STORYBOARD FIELDS ---',
    ...lines,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ok: true,
    userPrompt,
    durationLabel,
    durationSec,
    sbId,
    episodeId: Number(sb.episode_id) || 0,
    storyboardNumber: Number(sb.storyboard_number) || 0,
  };
}

module.exports = { buildUniversalSegmentUserPromptBundle };
