// 根据故事梗概 + 风格/类型，调用文本模型生成扩展后的故事/剧本
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const loadConfig = require('../config').loadConfig;

async function generateStory(db, log, body) {
  const premise = (body.premise || body.prompt || body.text || '').trim();
  if (!premise) {
    throw new Error('请提供故事梗概');
  }
  const cfg = loadConfig();
  const style = body.style || body.genre || null;
  const type = body.type || null;
  const systemPrompt = promptI18n.getStoryExpansionSystemPrompt(cfg);
  const userPrompt = promptI18n.buildStoryExpansionUserPrompt(cfg, premise, style, type);
  const content = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
    model: body.model || undefined,
    temperature: 0.8,
    max_tokens: 2000,
  });
  return { content: (content || '').trim() };
}

module.exports = {
  generateStory,
};
