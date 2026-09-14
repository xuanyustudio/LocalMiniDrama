const ALLOWED_DURATIONS = Object.freeze([5, 10, 15, 30]);

function isForbiddenVideoModel(name) {
  const model = String(name || '').trim().toLowerCase();
  if (!model) return false;
  if (model.includes('hailuo') || model.includes('海螺')) return true;
  return /seedance[-_.]?1(?:[-_.]?0)?(?:\D|$)/i.test(model)
    || /doubao-seedance-1-0/i.test(model);
}

function filterUsableVideoModels(models) {
  return (Array.isArray(models) ? models : [models])
    .map((model) => String(model || '').trim())
    .filter((model) => model && !isForbiddenVideoModel(model));
}

function filterDiscoveredProjectVideoModels(models) {
  return filterUsableVideoModels(models).filter((model) =>
    /^H3(?:$|[-_])/i.test(model)
    || /minimax[-_]?h3/i.test(model)
    || /^Dola(?:$|[-_])/i.test(model)
    || /seedance[-_.]?2/i.test(model)
  );
}

function quantizeStoryboardDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return 5;
  return ALLOWED_DURATIONS.find((duration) => value <= duration) || 30;
}

function durationFromModelName(name) {
  const match = String(name || '').match(/(?:^|[-_])(5|10|15|30)s(?:$|[-_])/i);
  return match ? Number(match[1]) : null;
}

function chooseVideoModel(models, preferredModel, duration, options = {}) {
  const usable = filterUsableVideoModels(models);
  if (!usable.length) return '';
  const preferred = String(preferredModel || '').trim();
  if (preferred && !isForbiddenVideoModel(preferred) && usable.includes(preferred)) return preferred;
  const wanted = quantizeStoryboardDuration(duration);
  const exactSeedance = usable.find((model) =>
    /seedance[-_.]?2/i.test(model) && durationFromModelName(model) === wanted
  );
  if (exactSeedance) return exactSeedance;
  const h3 = usable.find((model) => /^H3(?:$|[-_])/i.test(model) || /minimax[-_]?h3/i.test(model));
  if (h3 && wanted <= 15) return h3;
  const exact = usable.find((model) => durationFromModelName(model) === wanted);
  if (exact) return exact;
  return usable.find((model) => model === options.defaultModel) || usable[0];
}

module.exports = {
  ALLOWED_DURATIONS,
  isForbiddenVideoModel,
  filterUsableVideoModels,
  filterDiscoveredProjectVideoModels,
  quantizeStoryboardDuration,
  durationFromModelName,
  chooseVideoModel,
};
