/** 把模型字段收成单个模型 ID。兼容数组，以及被整段 JSON 当模型名传出去的情况。 */
function flattenModelIds(model, depth = 0) {
  if (model == null || depth > 4) return [];
  if (Array.isArray(model)) {
    return model.flatMap((item) => flattenModelIds(item, depth + 1));
  }
  const text = String(model).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return flattenModelIds(parsed, depth + 1);
    } catch (_) {}
  }
  return [text];
}

function pickModelId(model, fallback = '') {
  return flattenModelIds(model)[0] || fallback;
}

const ARK_RETIRED_TEXT_MODELS = {
  'deepseek-v3-2-251201': 'deepseek-v4-flash-ga-260731',
  'doubao-1-5-pro-32k-250115': 'doubao-seed-2-1-lite-260915',
  'kimi-k2-thinking-251104': 'doubao-seed-2-1-lite-260915',
};

const ARK_RETIRED_VIDEO_MODELS = {
  'doubao-seedance-1-5-pro-251215': 'doubao-seedance-2-0-fast-260128',
};

function isOfficialArkBase(baseUrl) {
  return String(baseUrl || '').toLowerCase().includes('volces.com');
}

function remapArkModelId(baseUrl, modelId) {
  const id = pickModelId(modelId);
  if (!id || !isOfficialArkBase(baseUrl)) return id;
  const key = id.toLowerCase();
  return ARK_RETIRED_TEXT_MODELS[key] || ARK_RETIRED_VIDEO_MODELS[key] || id;
}

function remapArkModelList(baseUrl, model) {
  const seen = new Set();
  const out = [];
  for (const id of flattenModelIds(model)) {
    const next = remapArkModelId(baseUrl, id);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

module.exports = {
  flattenModelIds,
  pickModelId,
  isOfficialArkBase,
  remapArkModelId,
  remapArkModelList,
  ARK_RETIRED_TEXT_MODELS,
  ARK_RETIRED_VIDEO_MODELS,
};
