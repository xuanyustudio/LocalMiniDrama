// 生产链底层规则（见 PIPELINE-SPEC.md）：原著清洗、画风词剔除、分镜人物/场景统一成编号。
// 都是纯函数，不访问数据库，便于各个工位共用和测试。

// ---------- 原著清洗 ----------

// 作者附言：括号里“短署名 + 冒号”开头、并且是对读者说话的段落，例如“（妖少：本书开始强推……）”
const READER_TALK = /兄弟们|朋友们|大家|读者|书友|见谅|支持|推荐票|月票|投票|票不要少|更新|[一二三四]更|强推|收藏|打赏|存稿|码字|请假|写书/;
const NOTE = /[（(]\s*([^（()）\n:：]{1,6})\s*[:：]([^（()）]*?)(?:[）)]|(?=\n)|$)/g;
// 单独一行的“作者：xxx”、带卷章号和作者署名的页眉
const BYLINE = /^[^\n]{0,40}作者\s*[:：][^\n]{0,20}$/;

function cleanNovelText(text) {
  if (typeof text !== 'string' || !text) return { text: text || '', removed: 0 };
  let removed = 0;
  let out = text.replace(NOTE, (whole, who, body) => {
    if (!READER_TALK.test(body) && !/作者|妖少|笔者/.test(who)) return whole;
    removed += 1;
    return '';
  });
  out = out.split('\n').filter((line) => {
    if (BYLINE.test(line.trim())) { removed += 1; return false; }
    return true;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: out, removed };
}

// ---------- 画风词 ----------

// 画风只放在项目设置里；人物外貌、场景描述里出现的这些词会被剔除
const STYLE_PHRASES = [
  /(?:在)?超写实(?:摄影)?(?:风格)?(?:下|中)?/g, /(?:在)?(?:超高清|超清|高清)?镜头下/g, /细节纹理清晰(?:自然)?/g, /写实风格/g, /照片级(?:真实)?/g, /电影级(?:质感|画质)?/g, /电影感/g,
  /\d+\s*[Kk](?:超清|超高清|高清|分辨率)?(?:细节|画质)?/g, /超高清(?:画质|细节|镜头下)?/g, /超清(?:细节)?/g, /高清(?:画质|细节)?/g,
  /毛孔清晰可见/g, /毛孔清晰/g, /(?:真实)?皮肤纹理(?:真实|清晰)?/g, /质感真实/g, /真实质感/g,
  /RAW原片质感/gi, /原片质感/g, /锐度/g, /专业摄影(?:机拍摄)?/g, /(?:精准)?自然光照/g,
  /photorealistic/gi, /ultra[- ]?detailed/gi, /\b8k\b/gi, /\buhd\b/gi, /masterpiece/gi, /best quality/gi,
];

function stripStyleWords(text) {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : '';
  let out = text;
  for (const re of STYLE_PHRASES) out = out.replace(re, '');
  return out
    .replace(/[，,、]\s*(?=[，,、。；;])/g, '')     // 删词后留下的连续标点
    .replace(/(^|[。；;])\s*[，,、]+/g, '$1')
    .replace(/[，,、]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[，,、。；;\s]+/, '')
    .trim();
}

function hasStyleWords(text) {
  return typeof text === 'string' && stripStyleWords(text) !== text.trim();
}

/** 档案人物 → 人物表外貌文本：固定外貌 + 服装。档案没写外貌时返回空串。 */
function composeAppearance(bibleCharacter) {
  const look = stripStyleWords(bibleCharacter?.appearance || '');
  if (!look) return '';
  const costume = stripStyleWords(bibleCharacter?.costume || '');
  return costume ? `${look}；服装：${costume}` : look;
}

/** 按姓名或别名在档案里找人物。 */
function findBibleCharacter(bible, name) {
  const key = String(name || '').trim();
  if (!key) return null;
  const list = bible?.characters || [];
  return list.find((c) => c.name === key)
    || list.find((c) => String(c.aliases || '').split(/[、,，/\s]+/).map((x) => x.trim()).filter(Boolean).includes(key))
    || null;
}

// ---------- 分镜人物：统一成本剧人物 id 数组 ----------

/**
 * raw 可以是 JSON 字符串、数字、名字、{id,name} 对象或它们的混合数组。
 * 返回 { ids, unknown }：ids 只含本剧存在的人物，unknown 是认不出的名字/编号。
 */
function normalizeCharacterRefs(raw, characters) {
  let list = raw;
  if (typeof list === 'string') {
    const s = list.trim();
    if (!s) list = [];
    else { try { list = JSON.parse(s); } catch (_) { list = s.split(/[,，、]/); } }
  }
  if (list == null) list = [];
  if (!Array.isArray(list)) list = [list];
  const byId = new Map((characters || []).map((c) => [Number(c.id), c]));
  const byName = new Map();
  for (const c of characters || []) {
    if (c.name) byName.set(String(c.name).trim(), Number(c.id));
  }
  const ids = [];
  const unknown = [];
  for (const item of list) {
    let id = null;
    let label = '';
    if (item != null && typeof item === 'object') {
      if (item.id != null && byId.has(Number(item.id))) id = Number(item.id);
      else if (item.name && byName.has(String(item.name).trim())) id = byName.get(String(item.name).trim());
      label = item.name || (item.id != null ? `#${item.id}` : '');
    } else if (typeof item === 'number' || (typeof item === 'string' && /^\s*\d+\s*$/.test(item))) {
      if (byId.has(Number(item))) id = Number(item);
      label = `#${String(item).trim()}`;
    } else if (typeof item === 'string' && item.trim()) {
      id = byName.get(item.trim()) ?? null;
      label = item.trim();
    }
    if (id != null) { if (!ids.includes(id)) ids.push(id); }
    else if (label) unknown.push(label);
  }
  return { ids, unknown };
}

/** 已经是“纯数字 id 数组”的就算规范；空值和 [] 也算。 */
function isCanonicalCharacterJson(value) {
  if (value == null || String(value).trim() === '') return true;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((x) => Number.isInteger(x) && x > 0);
  } catch (_) { return false; }
}

// ---------- 镜头台词 ----------

const SPEAKER = /^\s*([\p{L}\p{N}·]{1,12}?)\s*([［\[（(【][^］\]）)】]{0,12}[］\]）)】])?\s*[：:]/u;
const OFFSCREEN = /画外|OS|VO|V\.O|旁白|内心|独白|电话|广播|对讲/i;

/** 镜头台词里的说话人；offscreen 为画外音、旁白、电话里的声音等不在画面里的人。 */
function shotSpeakers(dialogue) {
  const onscreen = [];
  const offscreen = [];
  for (const line of String(dialogue || '').split(/\r?\n/)) {
    const m = line.match(SPEAKER);
    if (!m) continue;
    const list = m[2] && OFFSCREEN.test(m[2]) ? offscreen : onscreen;
    if (!list.includes(m[1])) list.push(m[1]);
  }
  return { onscreen, offscreen };
}

/** 台词实际要念的字数：去掉说话人前缀、括号提示和标点。 */
function spokenLength(dialogue) {
  return String(dialogue || '').split(/\r?\n/)
    .map((line) => line.replace(SPEAKER, '').replace(/[（(【\[［][^）)】\]］]*[）)】\]］]/g, ''))
    .join('').replace(/[^\p{L}\p{N}]/gu, '').length;
}

// ---------- 场景匹配 ----------

function bigrams(s) {
  const chars = Array.from(String(s || '').replace(/[\s，,、。·\-—_()（）]/g, ''));
  if (chars.length < 2) return chars.length ? [chars[0]] : [];
  const out = [];
  for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
  return out;
}

function similarity(a, b) {
  const x = bigrams(a);
  const y = bigrams(b);
  if (!x.length || !y.length) return 0;
  const pool = [...y];
  let hit = 0;
  for (const g of x) {
    const at = pool.indexOf(g);
    if (at >= 0) { hit += 1; pool.splice(at, 1); }
  }
  return (2 * hit) / (x.length + y.length);
}

/**
 * 按分镜的地点和时间找本剧场景：地点完全一致优先，其次字面相似度 ≥ 0.5；
 * 时间不同的场景不匹配（场景表里时间为空的除外）。认不出就返回 null，交给创作者选。
 */
function matchScene(location, time, scenes) {
  const loc = String(location || '').trim();
  if (!loc) return null;
  const t = String(time || '').trim();
  const sameTime = (s) => !t || !String(s.time || '').trim() || String(s.time).trim() === t;
  const candidates = (scenes || []).filter(sameTime);
  const exact = candidates.find((s) => String(s.location || '').trim() === loc);
  if (exact) return Number(exact.id);
  let best = null;
  let bestScore = 0;
  let tie = false;
  for (const s of candidates) {
    const score = similarity(loc, s.location);
    if (score > bestScore) { best = s; bestScore = score; tie = false; }
    else if (score === bestScore && score > 0) tie = true;
  }
  return best && bestScore >= 0.5 && !tie ? Number(best.id) : null;
}

// ---------- 剧集来源章节 ----------

const CN_DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function chineseNumber(s) {
  if (/^\d+$/.test(s)) return Number(s);
  let total = 0;
  let current = 0;
  for (const ch of s) {
    if (ch in CN_DIGITS) current = CN_DIGITS[ch];
    else if (ch === '十') { total += (current || 1) * 10; current = 0; }
    else if (ch === '百') { total += (current || 1) * 100; current = 0; }
    else return null;
  }
  return total + current || null;
}

function chapterCore(title) {
  return String(title || '').replace(/^\s*第[\d一二三四五六七八九十百零〇两]+[章节回卷集]\s*/, '').replace(/[（(][上中下][）)]/g, '').trim();
}

/**
 * 推断旧剧集来自原著第几章：先看描述里的“第 N 章”，再按标题和章节名对照。
 * chapters 为原著章节列表 [{index,title}]。
 */
function guessSourceChapter(episode, chapters) {
  const text = `${episode.description || ''} ${episode.title || ''}`;
  const m = text.match(/第\s*([\d一二三四五六七八九十百零〇两]+)\s*章/);
  if (m) {
    const n = chineseNumber(m[1]);
    if (n && (!chapters?.length || n <= chapters.length)) return n;
  }
  const core = chapterCore(String(episode.title || '').replace(/^\s*第[\d一二三四五六七八九十]+集\s*/, ''));
  if (core && chapters?.length) {
    const hits = chapters.filter((c) => chapterCore(c.title) === core);
    if (hits.length === 1) return hits[0].index;
  }
  return null;
}

module.exports = {
  cleanNovelText, stripStyleWords, hasStyleWords, composeAppearance, findBibleCharacter,
  normalizeCharacterRefs, isCanonicalCharacterJson, shotSpeakers, spokenLength,
  similarity, matchScene, chineseNumber, guessSourceChapter,
};
