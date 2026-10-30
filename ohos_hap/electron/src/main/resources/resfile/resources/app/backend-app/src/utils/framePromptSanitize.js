/**
 * 首尾帧提示词后处理：禁止脑补外貌、剔除未勾选角色、清理场景中的人设描写
 */

const STEP_KEYS = {
  NORMALIZE: 'normalize_appearance',
  UNLISTED: 'unlisted_character',
  ORPHAN: 'orphan_position',
  SCENE: 'scene_appearance',
  MODERN_PROP_BOILERPLATE: 'modern_prop_boilerplate',
  PUNCT: 'cleanup_punctuation',
};

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 从角色锚点行解析角色名 */
function parseCharacterNameFromAnchorLine(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  const en = s.match(/^Character:\s*([^;]+)/i);
  if (en) return en[1].trim();
  const zh = s.match(/^([\u4e00-\u9fa5·]{1,10})/);
  if (zh) return zh[1].trim();
  return null;
}

function parseNamesFromAnchorLines(anchorLines) {
  const names = [];
  for (const line of anchorLines || []) {
    const n = parseCharacterNameFromAnchorLine(line);
    if (n && !names.includes(n)) names.push(n);
  }
  return names;
}

function isReferenceAppearanceParen(inner) {
  const t = String(inner || '').trim();
  return /参考图|reference\s*image/i.test(t);
}

/** 将允许出场角色的括号外貌描写统一为「参考图中的人物形象」 */
function normalizeAllowedCharacterAppearance(text, allowedNames) {
  const hits = [];
  let out = String(text || '');
  for (const name of allowedNames || []) {
    if (!name) continue;
    const esc = escapeRegExp(name);
    out = out.replace(new RegExp(`${esc}（([^）]*)）`, 'g'), (match, inner) => {
      if (isReferenceAppearanceParen(inner)) return match;
      hits.push({ name, removed_appearance: inner.slice(0, 120) });
      return `${name}（参考图中的人物形象）`;
    });
    out = out.replace(new RegExp(`${esc}\\(([^)]*)\\)`, 'g'), (match, inner) => {
      if (isReferenceAppearanceParen(inner)) return match;
      hits.push({ name, removed_appearance: inner.slice(0, 120) });
      return `${name}（参考图中的人物形象）`;
    });
    out = out.replace(
      new RegExp(`${esc}\\s*\\(\\s*use appearance from reference image\\s*\\)`, 'gi'),
      `${name}（参考图中的人物形象）`
    );
  }
  return { text: out, hits };
}

/** 剔除剧本中其他角色在本分镜 prompt 里的整段描述 */
function stripUnlistedCharacterClauses(text, allowedNames, allDramaNames) {
  const allowed = new Set(allowedNames || []);
  const candidates = [...new Set([...(allDramaNames || []), ...(allowedNames || [])])];
  const hits = [];
  let out = String(text || '');

  for (const name of candidates) {
    if (!name || allowed.has(name)) continue;
    const esc = escapeRegExp(name);
    const before = out;
    out = out.replace(new RegExp(`[，,]?${esc}（[^）]*）`, 'g'), '');
    out = out.replace(
      new RegExp(`[，,]?${esc}(?:位于|站在|坐在|表情|眼神|面向|背对)[^，,]+`, 'g'),
      ''
    );
    if (out !== before) hits.push({ name });
  }

  return { text: out, hits };
}

/** 场景/环境句中常见的外貌描写碎片（无角色名前缀时） */
const SCENE_APPEARANCE_FRAGMENTS = [
  /面容[\u4e00-\u9fa5a-zA-Z]{0,20}/g,
  /眉眼[\u4e00-\u9fa5a-zA-Z]{0,20}/g,
  /面部轮廓[\u4e00-\u9fa5a-zA-Z]{0,20}/g,
  /眉头微皱/g,
  /眼神[\u4e00-\u9fa5]{0,12}/g,
  /长发[\u4e00-\u9fa5]{0,16}/g,
  /短发[\u4e00-\u9fa5]{0,16}/g,
  /束发[\u4e00-\u9fa5]{0,12}/g,
  /马尾[\u4e00-\u9fa5]{0,12}/g,
  /发色[\u4e00-\u9fa5]{0,12}/g,
  /肤质[\u4e00-\u9fa5]{0,12}/g,
  /皮肤纹理[\u4e00-\u9fa5]{0,12}/g,
  /毛孔清晰可见/g,
  /hair\s+(style|color|length)[^,，.]*/gi,
  /facial\s+features[^,，.]*/gi,
  /face\s+shape[^,，.]*/gi,
];

function stripSceneAppearanceFragments(text) {
  const hits = [];
  let out = String(text || '');
  const sceneSegRe = /(场景为[^，,。]+|环境[^，,。]+|背景[^，,。]{0,80})/g;
  out = out.replace(sceneSegRe, (seg) => {
    let s = seg;
    let fragmentCount = 0;
    for (const re of SCENE_APPEARANCE_FRAGMENTS) {
      const reCopy = new RegExp(re.source, re.flags);
      s = s.replace(reCopy, (m) => {
        fragmentCount += 1;
        return '';
      });
    }
    const cleaned = s.replace(/[，,]{2,}/g, '，').replace(/^[，,\s]+|[，,\s]+$/g, '');
    if (fragmentCount > 0) {
      hits.push({ scene_segment_preview: seg.slice(0, 80), fragments_removed: fragmentCount });
    }
    return cleaned;
  });
  return { text: out, hits };
}

/** 未出场角色被删后可能遗留「，位于画面右侧」等无主语站位句 */
function stripOrphanPositionClauses(text) {
  const hits = [];
  const out = String(text || '').replace(/[，,](位于画面[^，,]+)/g, (full, clause, offset, str) => {
    const before = str.slice(Math.max(0, offset - 100), offset);
    if (/人物形象）|reference image\)/i.test(before)) return full;
    hits.push({ removed_clause: clause });
    return '';
  });
  return { text: out, hits };
}

/** 旧版首尾帧模板注入的现代室内道具尺度套话（与时代无关地 copy 进古代分镜，需剔除） */
const MODERN_PROP_BOILERPLATE_PATTERNS = [
  /所有道具严格真实物理比例[，,]?智能手机为正常[\d.\-–—]+英寸平放于茶几上[，,]?画面高度占比[\d.%\-–—]+[，,]?绝不可立起或夸大[，,]?茶几高度约[\d]+cm[，,]?书籍和遥控器均为真实家居小尺寸[，,]?所有道具均为次要环境元素/g,
  /智能手机为正常[\d.\-–—]+英寸平放于茶几上[，,]?画面高度占比[\d.%\-–—]+[，,]?绝不可立起或夸大/g,
  /智能手机(?:\/平板)?(?:为|是)?(?:真实|正常)[\d.\-–—]+英寸[^，,。]*/g,
  /书籍和遥控器均为真实家居小尺寸/g,
  /遥控器均为真实家居小尺寸/g,
  /A5\/A4(?:真实|家居)?尺寸/g,
  /画面高度占比(?:严格)?[\d.%\-–—]+(?:以内)?/g,
  /平放于茶几(?:表面|上)[^，,。]*/g,
  /茶几高度约[\d]+cm/g,
];

function stripModernPropBoilerplate(text) {
  const hits = [];
  let out = String(text || '');
  for (const re of MODERN_PROP_BOILERPLATE_PATTERNS) {
    const reCopy = new RegExp(re.source, re.flags);
    out = out.replace(reCopy, (match) => {
      hits.push({ removed: match.slice(0, 120) });
      return '';
    });
  }
  return { text: out, hits };
}

function cleanupPunctuation(text) {
  return String(text || '')
    .replace(/[，,]{2,}/g, '，')
    .replace(/，\s*，/g, '，')
    .replace(/^[，,\s]+|[，,\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function recordStep(report, stepKey, before, after, hits) {
  const changed = before !== after;
  const removedChars = Math.max(0, before.length - after.length);
  const entry = {
    step: stepKey,
    changed,
    hit_count: Array.isArray(hits) ? hits.length : 0,
    removed_chars: changed ? removedChars : 0,
    hits: Array.isArray(hits) && hits.length ? hits.slice(0, 8) : undefined,
  };
  report.steps.push(entry);
  if (changed) {
    report.changed_steps.push(stepKey);
    report.removed_chars_by_step[stepKey] = removedChars;
  }
  return entry;
}

function buildPrimaryIssue(report) {
  let primary = null;
  let bestScore = 0;
  for (const step of report.steps) {
    if (!step.changed) continue;
    // 等长替换（如外貌→参考图）时 removed_chars 可能为 0，用 hit_count 加权
    const score = step.removed_chars * 10 + step.hit_count;
    if (score > bestScore) {
      bestScore = score;
      primary = step.step;
    }
  }
  return primary;
}

function logSanitizeReport(log, report, ctx) {
  if (!log || typeof log.info !== 'function') return;

  const base = {
    ...ctx,
    allowed_characters: report.allowed_names,
    original_len: report.original_len,
    final_len: report.final_len,
    total_removed_chars: report.total_removed_chars,
    changed: report.changed,
    changed_steps: report.changed_steps,
    removed_chars_by_step: report.removed_chars_by_step,
    primary_issue_step: report.primary_issue_step,
  };

  for (const step of report.steps) {
    if (!step.changed) continue;
    log.info(`[帧提示词清洗] 步骤命中 · ${step.step}`, {
      ...base,
      hit_count: step.hit_count,
      removed_chars: step.removed_chars,
      hits: step.hits,
    });
  }

  if (report.changed) {
    log.info('[帧提示词清洗] 汇总（便于统计哪类问题最多）', {
      ...base,
      step_ranking: report.steps
        .filter((s) => s.changed)
        .map((s) => ({
          step: s.step,
          removed_chars: s.removed_chars,
          hit_count: s.hit_count,
          score: s.removed_chars * 10 + s.hit_count,
        }))
        .sort((a, b) => b.score - a.score),
      prompt_before_preview: report.prompt_before_preview,
      prompt_after_preview: report.prompt_after_preview,
    });
  } else {
    log.info('[帧提示词清洗] 无需修改', base);
  }
}

/**
 * @param {string} prompt
 * @param {string[]} allowedNames - 本分镜勾选角色
 * @param {string[]} allDramaNames - 本剧全部角色名（用于剔除未出场角色）
 * @param {object} [opts] - { log, source, storyboard_id, frame_kind, image_gen_id, returnReport }
 * @returns {string|{ prompt: string, report: object }}
 */
function sanitizeFramePrompt(prompt, allowedNames, allDramaNames, opts = {}) {
  if (!prompt || typeof prompt !== 'string') return prompt;

  const original = prompt;
  const report = {
    allowed_names: allowedNames || [],
    original_len: original.length,
    final_len: 0,
    total_removed_chars: 0,
    changed: false,
    changed_steps: [],
    removed_chars_by_step: {},
    steps: [],
    primary_issue_step: null,
    prompt_before_preview: original.slice(0, 200),
    prompt_after_preview: '',
  };

  let text = original;

  const n1 = normalizeAllowedCharacterAppearance(text, allowedNames);
  recordStep(report, STEP_KEYS.NORMALIZE, text, n1.text, n1.hits);
  text = n1.text;

  const n2 = stripUnlistedCharacterClauses(text, allowedNames, allDramaNames);
  recordStep(report, STEP_KEYS.UNLISTED, text, n2.text, n2.hits);
  text = n2.text;

  const n3 = stripOrphanPositionClauses(text);
  recordStep(report, STEP_KEYS.ORPHAN, text, n3.text, n3.hits);
  text = n3.text;

  const n4 = stripSceneAppearanceFragments(text);
  recordStep(report, STEP_KEYS.SCENE, text, n4.text, n4.hits);
  text = n4.text;

  const n5 = stripModernPropBoilerplate(text);
  recordStep(report, STEP_KEYS.MODERN_PROP_BOILERPLATE, text, n5.text, n5.hits);
  text = n5.text;

  const beforePunct = text;
  text = cleanupPunctuation(text);
  recordStep(report, STEP_KEYS.PUNCT, beforePunct, text, beforePunct !== text ? [{ punctuation_cleanup: true }] : []);

  report.final_len = text.length;
  report.total_removed_chars = Math.max(0, report.original_len - report.final_len);
  report.changed = text !== original;
  report.primary_issue_step = buildPrimaryIssue(report);
  report.prompt_after_preview = text.slice(0, 200);

  const ctx = {
    source: opts.source || 'unknown',
    storyboard_id: opts.storyboard_id,
    frame_kind: opts.frame_kind,
    image_gen_id: opts.image_gen_id,
  };
  logSanitizeReport(opts.log, report, ctx);

  if (opts.returnReport) {
    return { prompt: text, report };
  }
  return text;
}

module.exports = {
  parseCharacterNameFromAnchorLine,
  parseNamesFromAnchorLines,
  sanitizeFramePrompt,
  STEP_KEYS,
};
