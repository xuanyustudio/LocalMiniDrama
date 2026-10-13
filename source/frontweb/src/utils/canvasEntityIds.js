/** 统一实体 ID 为 number，避免 el-select 因 string/number 混用显示 raw id */
export function normalizeEntityId(id) {
  if (id == null || id === '') return null
  const n = Number(id)
  return Number.isFinite(n) ? n : null
}

export function normalizeEntityIdList(ids) {
  if (!Array.isArray(ids)) return []
  return ids.map(normalizeEntityId).filter((n) => n != null)
}

export function parseStoryboardCharacterIds(sb) {
  const charList = Array.isArray(sb?.characters)
    ? sb.characters
    : (sb?.characters != null ? [sb.characters] : [])
  return normalizeEntityIdList(
    charList.map((c) => (typeof c === 'object' && c != null ? c.id : c))
  )
}

export function parseStoryboardPropIds(sb) {
  return normalizeEntityIdList(sb?.prop_ids)
}

export function parseStoryboardSceneId(sb) {
  return normalizeEntityId(sb?.scene_id)
}
