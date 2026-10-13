export function parseModelList(models, defaultModel = '') {
  if (Array.isArray(models)) {
    return models.map((m) => String(m).trim()).filter(Boolean)
  }
  if (typeof models === 'string') {
    return models.split(/[\n,，]/).map((s) => s.trim()).filter(Boolean)
  }
  return defaultModel ? [String(defaultModel).trim()].filter(Boolean) : []
}

export function getSelectableModels(configs, serviceType, configId) {
  const list = Array.isArray(configs) ? configs : []
  const selectedConfig = configId
    ? list.find((c) => c.id === configId)
    : null
  const config = selectedConfig
    || list.find((c) => c.service_type === serviceType && c.is_active && c.is_default)
    || list.find((c) => c.service_type === serviceType && c.is_active)

  if (!config) return []
  return parseModelList(config.model, config.default_model)
}
