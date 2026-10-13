import { parseDramaMetadata } from './canvasLayout'

export const DEFAULT_PIPELINE = ['image', 'video', 'audio']

export function parseWorkflowGroups(metadata) {
  const meta = parseDramaMetadata(metadata)
  const groups = meta.workflow_groups
  return Array.isArray(groups) ? groups : []
}

export function storyboardIdFromNodeId(nodeId) {
  if (!nodeId || typeof nodeId !== 'string') return null
  if (!nodeId.startsWith('sb:')) return null
  const id = Number(nodeId.slice(3))
  return Number.isFinite(id) ? id : null
}

export function nodeIdFromStoryboardId(storyboardId) {
  return `sb:${storyboardId}`
}

export function getStoryboardGroupMap(workflowGroups) {
  const map = new Map()
  for (const group of workflowGroups || []) {
    for (const sbId of group.storyboard_ids || []) {
      map.set(Number(sbId), group)
    }
  }
  return map
}

export function createWorkflowGroup(existingGroups, { title, storyboardIds, pipeline = DEFAULT_PIPELINE }) {
  const ids = [...new Set((storyboardIds || []).map(Number).filter(Number.isFinite))]
  if (!ids.length) throw new Error('请至少选择一个分镜')
  const group = {
    id: `wg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title || `工作流 ${(existingGroups?.length || 0) + 1}`,
    storyboard_ids: ids,
    pipeline: normalizePipeline(pipeline),
    created_at: new Date().toISOString(),
  }
  return [...(existingGroups || []), group]
}

export function deleteWorkflowGroup(existingGroups, groupId) {
  return (existingGroups || []).filter((g) => g.id !== groupId)
}

export function normalizePipeline(pipeline) {
  const allowed = ['image', 'video', 'audio']
  const list = Array.isArray(pipeline) ? pipeline.filter((s) => allowed.includes(s)) : []
  return list.length ? list : [...DEFAULT_PIPELINE]
}

export function findStoryboardInDrama(drama, storyboardId) {
  for (const ep of drama?.episodes || []) {
    const sb = (ep.storyboards || []).find((s) => s.id === storyboardId)
    if (sb) return { storyboard: sb, episode: ep }
  }
  return null
}

export function getDramaGenerationOptions(drama) {
  const meta = parseDramaMetadata(drama?.metadata)
  return {
    aspectRatio: meta.aspect_ratio || '16:9',
    style: meta.style_prompt_en || meta.style_prompt_zh || drama?.style || '',
    videoResolution: meta.video_resolution || '480p',
  }
}

export function toAbsoluteMediaUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (typeof window !== 'undefined') {
    const path = url.startsWith('/') ? url : `/static/${url.replace(/^\//, '')}`
    return `${window.location.origin}${path}`
  }
  return url
}
