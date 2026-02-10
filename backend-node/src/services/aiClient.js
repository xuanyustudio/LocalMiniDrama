// 与 Go pkg/ai + application/services/ai_service 对齐：读取 ai_service_configs，调用 OpenAI 兼容的 chat completions
const aiConfigService = require('./aiConfigService');

// 使用前端设置的「默认」与「优先级」：listConfigs 已按 is_default DESC, priority DESC 排序
function getDefaultConfig(db, serviceType) {
  const configs = aiConfigService.listConfigs(db, serviceType);
  const active = configs.filter((c) => c.is_active);
  if (active.length === 0) return null;
  const defaultOne = active.find((c) => c.is_default);
  return defaultOne != null ? defaultOne : active[0];
}

function getConfigForModel(db, serviceType, modelName) {
  const configs = aiConfigService.listConfigs(db, serviceType);
  for (const config of configs) {
    if (!config.is_active) continue;
    const models = Array.isArray(config.model) ? config.model : [config.model];
    if (models.includes(modelName)) return config;
  }
  return null;
}

function buildChatUrl(config) {
  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/chat/completions';
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

function getModelFromConfig(config, preferredModel) {
  const models = Array.isArray(config.model) ? config.model : (config.model != null ? [config.model] : []);
  if (preferredModel && models.includes(preferredModel)) return preferredModel;
  if (config.default_model && models.includes(config.default_model)) return config.default_model;
  return models[0] || 'gpt-3.5-turbo';
}

async function generateText(db, log, serviceType, userPrompt, systemPrompt, options = {}) {
  const { model: preferredModel, temperature = 0.7 } = options;
  let config = preferredModel
    ? getConfigForModel(db, serviceType, preferredModel)
    : getDefaultConfig(db, serviceType);
  if (!config) {
    throw new Error('未配置文本模型，请在「AI 配置」中添加 text 类型且已启用的配置');
  }
  const model = getModelFromConfig(config, preferredModel);
  const url = buildChatUrl(config);
  const body = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: userPrompt },
    ],
    temperature: Number(temperature),
    ...(options.max_tokens != null ? { max_tokens: Number(options.max_tokens) } : {}),
  };
  log.info('AI generateText request', { url: url.slice(0, 60), model });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (config.api_key || ''),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    log.error('AI generateText failed', { status: res.status, body: errText.slice(0, 300) });
    throw new Error('AI 请求失败: ' + res.status + ' ' + errText.slice(0, 200));
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    throw new Error('AI 返回格式异常');
  }
  return content;
}

module.exports = {
  getDefaultConfig,
  getConfigForModel,
  generateText,
};
