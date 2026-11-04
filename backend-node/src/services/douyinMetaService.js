// 为短剧生成抖音发布用的标题与话题标签
const aiClient = require('./aiClient');
const dramaService = require('./dramaService');
const { safeParseAIJSON } = require('../utils/safeJson');

const MAX_EPISODE_CONTEXT = 8;
const MAX_SCRIPT_CHARS_PER_EPISODE = 400;

function parseTagsField(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function buildEpisodeContext(db, dramaId) {
  const rows = db.prepare(
    `SELECT episode_number, title, description, script_content
     FROM episodes
     WHERE drama_id = ? AND deleted_at IS NULL
     ORDER BY episode_number ASC
     LIMIT ?`
  ).all(dramaId, MAX_EPISODE_CONTEXT);
  return rows.map((r) => {
    const script = String(r.script_content || '').replace(/\s+/g, ' ').slice(0, MAX_SCRIPT_CHARS_PER_EPISODE);
    const desc = String(r.description || '').replace(/\s+/g, ' ').slice(0, 200);
    const parts = [`第${r.episode_number ?? ''}集${r.title ? `《${r.title}》` : ''}`];
    if (desc) parts.push(`梗概：${desc}`);
    if (script) parts.push(`片段：${script}`);
    return parts.join(' ');
  }).join('\n');
}

function normalizeTitle(value) {
  return String(value || '').replace(/^#+/, '').replace(/^《|》$/g, '').trim();
}

function normalizeTag(value) {
  return String(value || '').replace(/^#+/, '').replace(/[\s#]+/g, '').trim();
}

function uniqueLimited(list, limit, normalizer) {
  const out = [];
  const seen = new Set();
  for (const item of list || []) {
    const v = normalizer(item);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * 根据短剧信息生成抖音标题与标签
 * @returns {Promise<{title: string, titles: string[], tags: string[]}|null>} 剧本不存在时返回 null
 */
async function generateDouyinMeta(db, log, dramaId) {
  const drama = dramaService.getDramaById(db, Number(dramaId));
  if (!drama) return null;

  const metadata = drama.metadata || {};
  const style = metadata.style_prompt_zh || metadata.style_prompt_en || drama.style || '';
  const existingTags = parseTagsField(drama.tags).join('、');
  const episodeContext = buildEpisodeContext(db, drama.id);

  const systemPrompt = `你是资深抖音短剧运营，擅长为短剧撰写高点击率的标题与话题标签。

请根据用户提供的短剧信息，输出：
1. 3-5 个抖音标题：每个 12-28 个汉字，带强钩子（反转、悬念、身份差、情绪冲突、爽点），不使用书名号，不加序号，不要重复。
2. 8-12 个话题标签：每个 2-8 个字，不带 # 号，覆盖题材、人设、情节钩子与情绪共鸣，避免"热门""推荐"等宽泛无效词。

只返回严格 JSON：{"titles":["标题1","标题2"],"tags":["标签1","标签2"]}，不要输出任何其他内容。`;

  const userPrompt = [
    `短剧标题：${drama.title || '（未命名）'}`,
    drama.genre ? `题材：${drama.genre}` : '',
    drama.description ? `简介：${String(drama.description).slice(0, 800)}` : '',
    style ? `画风/风格：${style}` : '',
    existingTags ? `已有标签：${existingTags}` : '',
    episodeContext ? `分集内容：\n${episodeContext}` : '',
  ].filter(Boolean).join('\n');

  log.info('douyin meta generation start', { drama_id: drama.id });
  const content = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
    json_mode: true,
    temperature: 0.9,
    min_max_tokens: 1200,
  });

  const parsed = safeParseAIJSON(content, {}, log);
  const titles = uniqueLimited(parsed && parsed.titles, 5, normalizeTitle);
  const tags = uniqueLimited(parsed && parsed.tags, 12, normalizeTag);
  if (titles.length === 0 && tags.length === 0) {
    throw new Error('AI 未返回有效的标题和标签，请重试');
  }
  log.info('douyin meta generation done', { drama_id: drama.id, title_count: titles.length, tag_count: tags.length });
  return { title: titles[0] || '', titles, tags };
}

module.exports = { generateDouyinMeta };
