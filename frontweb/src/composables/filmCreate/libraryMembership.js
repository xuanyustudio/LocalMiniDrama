import { ref } from 'vue'

export function createLibraryMembershipState() {
  return {
    dramaSourceIds: ref(new Set()),
    materialSourceIds: ref(new Set()),
  }
}

function assetSourceId(asset) {
  if (asset?.id == null) return ''
  return String(asset.id).trim()
}

function itemSourceId(item) {
  if (item?.source_id == null) return ''
  return String(item.source_id).trim()
}

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function fetchSourceIds(api, params, ids) {
  const out = new Set()
  for (const chunk of chunkArray(ids, 80)) {
    const res = await api.list({
      ...params,
      source_ids: chunk.join(','),
      page_size: chunk.length || 1,
    })
    for (const item of res?.items || []) {
      const id = itemSourceId(item)
      if (id) out.add(id)
    }
  }
  return out
}

export async function loadLibraryMembership({ api, sourceType, assets, dramaId, dramaSourceIds, materialSourceIds }) {
  const ids = [...new Set((assets || []).map(assetSourceId).filter(Boolean))]
  if (ids.length === 0) {
    dramaSourceIds.value = new Set()
    materialSourceIds.value = new Set()
    return
  }
  try {
    const [dramaIds, materialIds] = await Promise.all([
      dramaId
        ? fetchSourceIds(api, { drama_id: dramaId, source_type: sourceType }, ids)
        : Promise.resolve(new Set()),
      fetchSourceIds(api, { global: 1, source_type: sourceType }, ids),
    ])
    dramaSourceIds.value = dramaIds
    materialSourceIds.value = materialIds
  } catch (err) {
    console.warn('[libraryMembership] load failed:', err?.message || err)
    dramaSourceIds.value = new Set()
    materialSourceIds.value = new Set()
  }
}

export function hasAssetInLibrary(sourceIdsRef, asset) {
  const id = assetSourceId(asset)
  return !!id && sourceIdsRef.value.has(id)
}

export function markAssetInLibrary(sourceIdsRef, asset) {
  const id = assetSourceId(asset)
  if (!id) return
  sourceIdsRef.value = new Set([...sourceIdsRef.value, id])
}
