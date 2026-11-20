// 生产上下文：让“提取角色 / 提取场景 / 生成分镜”都读同一份事实来源——
// 故事档案 + 本集对应的原著章节。规范见 PIPELINE-SPEC.md 第 B 阶段。
const { bibleText, getBible } = require('./storyBibleService');

/** 每种步骤带多少原著原文（字）。人物外貌最依赖原文，分镜和场景只需参考。 */
const SOURCE_LIMITS = { characters: 8000, scenes: 4000, boards: 4000 };

const INSTRUCTIONS = {
  characters: [
    '只列出本集剧本里实际出场或说话的人物。',
    '档案里已有的人物：name 用档案里的正式姓名（不用别名、称呼），年龄、身份、外貌照档案写，不要另编。',
    '档案里没有的人物：年龄、身份、外貌依据原著原文；原文没写的按身份做朴素合理的设定，不得与原文矛盾。',
    'appearance 只写人本身（年龄、脸、身材、发型、服装），不写“超写实”“8K”“毛孔清晰”等画风、画质、镜头词。',
  ],
  scenes: [
    'location 优先沿用档案“主要地点”和“已有场景”里的写法；同一地点、同一时间只出一条。',
    'location 和 time 与剧本场次标题保持一致，方便分镜自动关联场景。',
    'prompt 只写环境本身，不写画风、画质词（画风由项目设置统一加）。',
  ],
  boards: [
    '台词里的称呼、别名，一律对应到人物列表里的编号，不要新增人物。',
    '人物身份、关系、事实以故事档案为准，不得与档案或原著矛盾。',
  ],
};

let reader = null;

/** 由路由层注册原著读取器（novelAdaptationService 实例，用到 chapterText / snapshot）。 */
function registerSourceReader(adaptation) {
  reader = adaptation || null;
}

function clip(text, limit) {
  const s = String(text || '').trim();
  if (s.length <= limit) return { text: s, clipped: false };
  return { text: s.slice(0, limit), clipped: true };
}

function episodeRow(db, episodeId) {
  try {
    return db.prepare('SELECT id, drama_id, source_chapter FROM episodes WHERE id = ? AND deleted_at IS NULL').get(Number(episodeId)) || null;
  } catch (_) {
    // 旧库或测试库没有 source_chapter 列
    return db.prepare('SELECT id, drama_id FROM episodes WHERE id = ? AND deleted_at IS NULL').get(Number(episodeId)) || null;
  }
}

/** 本集对应的原著章节原文（已清洗）；没有记录来源章节或原稿时返回 null。 */
function sourceChapter(dramaId, chapter, limit) {
  if (!reader || !chapter) return null;
  try {
    const raw = reader.chapterText(Number(dramaId), Number(chapter));
    let title = '';
    try {
      const list = reader.snapshot ? reader.snapshot(Number(dramaId))?.source?.chapters : null;
      title = list?.find((c) => c.index === Number(chapter))?.title || '';
    } catch (_) { /* 只是缺标题 */ }
    return { chapter: Number(chapter), title, ...clip(raw, limit) };
  } catch (_) {
    return null;
  }
}

function existingScenes(db, dramaId, episodeId) {
  try {
    return db.prepare(
      `SELECT DISTINCT location, time FROM scenes
       WHERE drama_id = ? AND deleted_at IS NULL AND (episode_id IS NULL OR episode_id != ?)
       ORDER BY location, time LIMIT 60`
    ).all(Number(dramaId), Number(episodeId));
  } catch (_) {
    try {
      return db.prepare('SELECT DISTINCT location, time FROM scenes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY location, time LIMIT 60').all(Number(dramaId));
    } catch (_) { return []; }
  }
}

/**
 * 某一步骤要附加到提示词里的上下文。
 * kind: 'characters' | 'scenes' | 'boards'
 * 返回 { text, bible: bool, chapter: number|null }，text 为空表示没有可用的事实来源。
 */
function contextFor(db, episodeId, kind, dramaIdHint) {
  const episode = episodeId ? episodeRow(db, episodeId) : null;
  const dramaId = Number(episode?.drama_id || dramaIdHint);
  if (!dramaId) return { text: '', bible: false, chapter: null };
  let bible = null;
  try { bible = getBible(db, dramaId).bible; } catch (_) { bible = null; }
  const archive = bible ? bibleText(bible) : '';
  const parts = [];
  if (archive) parts.push(`【故事档案（人物身份、外貌、地点以此为准）】\n${archive}`);
  if (kind === 'scenes') {
    const known = existingScenes(db, dramaId, episodeId).filter((s) => s.location);
    if (known.length) parts.push('【已有场景（同一地点请沿用这些写法）】\n' + known.map((s) => `- ${s.location}${s.time ? `｜${s.time}` : ''}`).join('\n'));
  }
  const source = sourceChapter(dramaId, episode?.source_chapter, SOURCE_LIMITS[kind] || 4000);
  if (source?.text) {
    const head = `【本集对应原著：第 ${source.chapter} 章${source.title ? ` ${source.title}` : ''}${source.clipped ? `（节选前 ${source.text.length} 字）` : ''}】`;
    parts.push(`${head}\n${source.text}`);
  }
  if (!parts.length) return { text: '', bible: false, chapter: null };
  const rules = INSTRUCTIONS[kind] || [];
  if (rules.length) parts.push('【依据档案与原著的要求】\n' + rules.map((r, i) => `${i + 1}. ${r}`).join('\n'));
  return { text: parts.join('\n\n'), bible: !!archive, chapter: source?.chapter || null };
}

/** 报价用：上下文会让输入多出多少字。 */
function contextLength(db, episodeId, kind, dramaIdHint) {
  try { return contextFor(db, episodeId, kind, dramaIdHint).text.length; } catch (_) { return 0; }
}

module.exports = { registerSourceReader, contextFor, contextLength, SOURCE_LIMITS };
