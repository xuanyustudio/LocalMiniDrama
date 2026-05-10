const OFFICIAL_HOST_RE = /(^|\.)api\.deepseek\.com$/i;

const LEGACY_MODEL_OPTIONS = {
  'deepseek-chat': { model: 'deepseek-v4-flash', thinking: 'disabled' },
  'deepseek-reasoner': { model: 'deepseek-v4-flash', thinking: 'enabled' },
};

function parseSettings(settings) {
  if (!settings) return {};
  if (typeof settings === 'object') return settings;
  try {
    const parsed = JSON.parse(settings);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function isDeepSeekOfficialConfig(config = {}) {
  const provider = String(config.provider || '').trim().toLowerCase();
  if (provider === 'deepseek') return true;

  const rawBase = String(config.base_url || '').trim();
  if (!rawBase) return false;
  try {
    const url = new URL(rawBase);
    return OFFICIAL_HOST_RE.test(url.hostname);
  } catch (_) {
    return rawBase.toLowerCase().includes('api.deepseek.com');
  }
}

function normalizeThinking(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
  const v = String(value).trim().toLowerCase();
  if (v === 'enabled' || v === 'enable' || v === 'on' || v === 'true' || v === 'thinking') return 'enabled';
  if (v === 'disabled' || v === 'disable' || v === 'off' || v === 'false' || v === 'non-thinking') return 'disabled';
  return null;
}

function normalizeReasoningEffort(value) {
  if (value == null || value === '') return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'max' || v === 'xhigh') return 'max';
  if (v === 'high' || v === 'medium' || v === 'low') return 'high';
  return null;
}

function resolveDeepSeekOptions(config = {}, model) {
  const modelName = String(model || '').trim();
  const legacy = LEGACY_MODEL_OPTIONS[modelName.toLowerCase()] || null;
  const settings = parseSettings(config.settings);
  const nested = settings.deepseek && typeof settings.deepseek === 'object' ? settings.deepseek : {};

  const explicitThinking = normalizeThinking(
    settings.deepseek_thinking
      ?? settings.thinking
      ?? nested.thinking
      ?? nested.type
  );
  const reasoningEffort = normalizeReasoningEffort(
    settings.deepseek_reasoning_effort
      ?? settings.reasoning_effort
      ?? nested.reasoning_effort
      ?? nested.effort
  );

  return {
    model: legacy ? legacy.model : modelName,
    thinking: explicitThinking || legacy?.thinking || null,
    reasoning_effort: reasoningEffort,
  };
}

function applyDeepSeekChatOptions(config, body) {
  if (!isDeepSeekOfficialConfig(config)) return body;

  const opts = resolveDeepSeekOptions(config, body?.model);
  const next = {
    ...body,
    model: opts.model || body.model,
  };

  if (opts.thinking) {
    next.thinking = { type: opts.thinking };
  }

  if (opts.thinking === 'enabled') {
    if (opts.reasoning_effort) next.reasoning_effort = opts.reasoning_effort;
    delete next.temperature;
  } else {
    delete next.reasoning_effort;
  }

  return next;
}

function applyDeepSeekConnectivityOptions(config, body) {
  if (!isDeepSeekOfficialConfig(config)) return body;
  const next = applyDeepSeekChatOptions(config, body);
  if (!next.thinking) {
    next.thinking = { type: 'disabled' };
  }
  delete next.reasoning_effort;
  return next;
}

module.exports = {
  applyDeepSeekChatOptions,
  applyDeepSeekConnectivityOptions,
  isDeepSeekOfficialConfig,
  parseSettings,
  resolveDeepSeekOptions,
};
