import { createRequire } from 'module';

const { flattenModelIds, pickModelId, remapArkModelId } = createRequire(import.meta.url)('../services/modelId.js');

function chooseModelName(row) {
  const models = flattenModelIds(row.model);
  const preferred = pickModelId(row.default_model);
  const picked = preferred && models.includes(preferred) ? preferred : (models[0] || '');
  return remapArkModelId(row.base_url, picked);
}

export function resolveTextModel(db) {
  const row = db.prepare(
    `SELECT id, base_url, api_key, model, default_model
     FROM ai_service_configs
     WHERE service_type = 'text'
       AND is_default = 1
       AND is_active = 1
       AND deleted_at IS NULL
     ORDER BY priority DESC, id ASC
     LIMIT 1`
  ).get();
  if (!row) return { ok: false, error: '请先在 AI 配置里添加文本模型' };
  const url = String(row.base_url || '').trim().replace(/\/+$/, '');
  const modelName = chooseModelName(row);
  if (!url || !modelName) return { ok: false, error: '文本模型的 base_url 或模型名为空' };
  return {
    ok: true,
    model: {
      id: `custom/${modelName}`,
      url,
      apiKey: row.api_key || '',
      api: 'chat',
    },
  };
}
