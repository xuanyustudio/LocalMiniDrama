// backend-node/src/services/voiceMatchService.js
const { safeParseAIJSON } = require('../utils/safeJson');
const aiClient = require('./aiClient');
const voiceLibraryService = require('./voiceLibraryService');

function buildRecommendPrompt(characters, voices) {
  const charLines = characters.map((c) =>
    `- id=${c.id} 名称="${c.name || ''}" 角色定位="${c.role || ''}" 描述="${(c.description || '').slice(0, 200)}" 性格="${(c.personality || '').slice(0, 200)}" 外貌="${(c.appearance || '').slice(0, 200)}"`
  ).join('\n');
  const voiceLines = voices.map((v) =>
    `- id=${v.id} 名称="${v.name}" 性别=${v.gender || '未知'} 年龄段=${v.age_range || '未知'} 描述="${v.description || ''}" 标签=${(v.tags || []).join(',')}`
  ).join('\n');
  return `下面是一批短剧角色和一个可选语音库，请为每个角色匹配一个最合适的语音。

【角色列表】
${charLines}

【语音库】
${voiceLines}

请只返回 JSON 对象，key 为角色 id（字符串），value 为一个对象 {"voice_id": 数字, "reason": "一句话理由"}。不要返回任何角色 id 或语音 id 不在上面列表中的内容。`;
}

const RECOMMEND_SYSTEM_PROMPT = '你是短剧配音选角专家，根据角色的性别、年龄、性格、外貌描述，从提供的语音库中挑选最贴合的语音。只输出合法 JSON，不要输出任何解释文字或 markdown 代码块标记。';

function parseRecommendResponse(rawText, characters, voices) {
  const parsed = safeParseAIJSON(rawText, {}, null);
  const charIds = new Set(characters.map((c) => String(c.id)));
  const voiceIds = new Set(voices.map((v) => v.id));
  const result = [];
  for (const key of Object.keys(parsed)) {
    if (!charIds.has(String(key))) continue;
    const entry = parsed[key];
    const voiceId = Number(entry && entry.voice_id);
    if (!voiceId || !voiceIds.has(voiceId)) continue;
    result.push({ character_id: Number(key), voice_id: voiceId, reason: (entry && entry.reason) || '' });
  }
  return result;
}

async function recommendVoicesForDrama(db, log, dramaId, opts = {}) {
  const characters = db.prepare(
    'SELECT id, name, role, description, personality, appearance, voice_id FROM characters WHERE drama_id = ? AND deleted_at IS NULL'
  ).all(Number(dramaId));
  if (characters.length === 0) throw new Error('该剧集暂无角色');
  const targets = opts.onlyUnassigned ? characters.filter((c) => !c.voice_id) : characters;
  if (targets.length === 0) return [];
  const voices = voiceLibraryService.listVoices(db, {});
  if (voices.length === 0) throw new Error('请先在配音管理中添加语音');
  const userPrompt = buildRecommendPrompt(targets, voices);
  const rawText = await aiClient.generateText(db, log, 'text', userPrompt, RECOMMEND_SYSTEM_PROMPT, { json_mode: true, temperature: 0.4 });
  const matches = parseRecommendResponse(rawText, targets, voices);
  if (matches.length === 0) throw new Error('AI 未返回有效的配音推荐结果，请重试');
  const now = new Date().toISOString();
  const results = [];
  for (const m of matches) {
    db.prepare('UPDATE characters SET voice_id = ?, updated_at = ? WHERE id = ?').run(m.voice_id, now, m.character_id);
    const character = characters.find((c) => c.id === m.character_id);
    const voice = voices.find((v) => v.id === m.voice_id);
    results.push({ character_id: m.character_id, character_name: character?.name, voice_id: m.voice_id, voice_name: voice?.name, reason: m.reason });
  }
  log.info('Voice recommend batch done', { drama_id: dramaId, count: results.length });
  return results;
}

async function regenerateForCharacter(db, log, characterId) {
  const character = db.prepare(
    'SELECT id, drama_id, name, role, description, personality, appearance, voice_id FROM characters WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(characterId));
  if (!character) throw new Error('角色不存在');
  const allVoices = voiceLibraryService.listVoices(db, {});
  if (allVoices.length === 0) throw new Error('请先在配音管理中添加语音');
  const candidateVoices = character.voice_id ? allVoices.filter((v) => v.id !== character.voice_id) : allVoices;
  const voices = candidateVoices.length > 0 ? candidateVoices : allVoices;
  const userPrompt = buildRecommendPrompt([character], voices);
  const rawText = await aiClient.generateText(db, log, 'text', userPrompt, RECOMMEND_SYSTEM_PROMPT, { json_mode: true, temperature: 0.6 });
  const matches = parseRecommendResponse(rawText, [character], voices);
  if (matches.length === 0) throw new Error('AI 未返回有效的配音推荐结果，请重试');
  const m = matches[0];
  const now = new Date().toISOString();
  db.prepare('UPDATE characters SET voice_id = ?, updated_at = ? WHERE id = ?').run(m.voice_id, now, character.id);
  const voice = voices.find((v) => v.id === m.voice_id);
  log.info('Voice regenerate done', { character_id: characterId, voice_id: m.voice_id });
  return { character_id: character.id, character_name: character.name, voice_id: m.voice_id, voice_name: voice?.name, reason: m.reason };
}

module.exports = {
  buildRecommendPrompt,
  parseRecommendResponse,
  RECOMMEND_SYSTEM_PROMPT,
  recommendVoicesForDrama,
  regenerateForCharacter,
};
