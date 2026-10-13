import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { dramaAPI } from '@/api/drama'
import { storyboardsAPI } from '@/api/storyboards'
import { sceneAPI } from '@/api/scenes'
import { propAPI } from '@/api/props'

/** 合并 drama 级与本集已关联角色，避免 drama.characters 被布局保存截断后漏传 */
function collectExistingCharacters(dramaData, episodeId) {
  const map = new Map()
  for (const c of dramaData?.characters || []) {
    if (c?.id != null) map.set(Number(c.id), c)
  }
  if (episodeId != null) {
    const ep = (dramaData?.episodes || []).find((e) => Number(e.id) === Number(episodeId))
    for (const c of ep?.characters || []) {
      if (c?.id != null && !map.has(Number(c.id))) map.set(Number(c.id), c)
    }
  }
  return [...map.values()]
}

function toCharacterSavePayload(c) {
  return {
    id: c.id,
    name: c.name || '',
    role: c.role || undefined,
    description: c.description || undefined,
    personality: c.personality || undefined,
    appearance: c.appearance || undefined,
    image_url: c.image_url || undefined,
    local_path: c.local_path || undefined,
  }
}

/** 画布内新建实体（复用列表模式同款 API） */
export function useCanvasCrud(deps) {
  const {
    drama,
    filterEpisodeId,
    layoutCache,
    focusedNodeId,
    refreshCanvas,
    persistCanvasState,
  } = deps

  const createDialogVisible = ref(false)
  const createDialogType = ref('storyboard')
  /** 右键菜单创建时在画布上的坐标 { x, y } */
  const pendingFlowPosition = ref(null)

  function resolveEpisodeId() {
    if (filterEpisodeId.value) return filterEpisodeId.value
    const eps = drama.value?.episodes || []
    if (eps.length === 1) return eps[0].id
    return null
  }

  function openCreateDialog(type, flowPosition = null) {
    if (['storyboard', 'character', 'scene', 'prop'].includes(type) && !resolveEpisodeId()) {
      ElMessage.warning('请先选择集数（或确保项目至少有一集）')
      return
    }
    createDialogType.value = type
    pendingFlowPosition.value = flowPosition
    createDialogVisible.value = true
  }

  async function saveNodePosition(nodeId, pos) {
    if (!pos || !nodeId) return
    const prev = layoutCache.value || { version: 1, nodes: {} }
    layoutCache.value = {
      ...prev,
      version: 1,
      nodes: {
        ...(prev.nodes || {}),
        [nodeId]: { x: pos.x, y: pos.y },
      },
    }
    await persistCanvasState({ layoutOnly: true })
  }

  async function focusAfterCreate(nodeId) {
    await refreshCanvas()
    if (nodeId) focusedNodeId.value = nodeId
    pendingFlowPosition.value = null
  }

  async function createStoryboard(form) {
    const episodeId = resolveEpisodeId()
    if (!episodeId) throw new Error('请先选择集数')

    const boards = (drama.value?.episodes || [])
      .find((ep) => ep.id === episodeId)?.storyboards || []
    const maxNum = boards.reduce((max, sb) => Math.max(max, sb.storyboard_number || 0), 0)
    const nextNum = maxNum + 1
    const title = (form.title || '').trim() || `镜头 ${nextNum}`

    const sb = await storyboardsAPI.create({
      episode_id: episodeId,
      storyboard_number: nextNum,
      title,
      description: (form.description || '').trim() || '',
    })

    const nodeId = `sb:${sb.id}`
    const pos = pendingFlowPosition.value
    if (pos) await saveNodePosition(nodeId, pos)
    await focusAfterCreate(nodeId)
    ElMessage.success('分镜已添加')
    return sb
  }

  async function createEpisode(form) {
    const dramaId = drama.value?.id
    if (!dramaId) throw new Error('项目未加载')

    const list = drama.value.episodes || []
    const nextNum = list.length > 0
      ? Math.max(...list.map((ep) => Number(ep.episode_number) || 0), 0) + 1
      : 1
    const title = (form.title || '').trim() || `第${nextNum}集`

    const updated = list.map((ep, i) => ({
      episode_number: ep.episode_number ?? i + 1,
      title: ep.title || `第${ep.episode_number ?? i + 1}集`,
      script_content: ep.script_content || '',
      description: ep.description ?? null,
      duration: ep.duration ?? 0,
    }))
    updated.push({
      episode_number: nextNum,
      title,
      script_content: '',
      description: null,
      duration: 0,
    })

    await dramaAPI.saveEpisodes(dramaId, updated)
    await refreshCanvas()

    const newEp = (drama.value?.episodes || []).find((ep) => Number(ep.episode_number) === nextNum)
    if (newEp?.id) {
      filterEpisodeId.value = newEp.id
      const pos = pendingFlowPosition.value
      if (pos) await saveNodePosition(`episode:${newEp.id}`, pos)
      await refreshCanvas()
    }
    pendingFlowPosition.value = null
    ElMessage.success(`已添加${title}`)
  }

  async function createCharacter(form) {
    const dramaId = drama.value?.id
    const episodeId = resolveEpisodeId()
    if (!dramaId) throw new Error('项目未加载')

    const beforeIds = new Set((drama.value?.characters || []).map((c) => c.id))

    const existing = collectExistingCharacters(drama.value, episodeId).map(toCharacterSavePayload)

    const name = form.name.trim()
    await dramaAPI.saveCharacters(dramaId, {
      characters: [...existing, {
        name,
        role: form.role?.trim() || undefined,
        description: form.description?.trim() || undefined,
        appearance: form.appearance?.trim() || undefined,
      }],
      episode_id: episodeId ?? undefined,
    })

    await refreshCanvas()
    const newChar = (drama.value?.characters || []).find((c) => !beforeIds.has(c.id))
      || (drama.value?.characters || []).find((c) => c.name === name)
    const nodeId = newChar?.id ? `char:${newChar.id}` : null
    const pos = pendingFlowPosition.value
    if (nodeId && pos) await saveNodePosition(nodeId, pos)
    await focusAfterCreate(nodeId)
    ElMessage.success('角色已添加')
  }

  async function createScene(form) {
    const dramaId = drama.value?.id
    const episodeId = resolveEpisodeId()
    if (!dramaId) throw new Error('项目未加载')

    const scene = await sceneAPI.create({
      drama_id: dramaId,
      episode_id: episodeId ?? undefined,
      location: form.location.trim(),
      time: form.time?.trim() || undefined,
      prompt: form.prompt?.trim() || undefined,
    })

    const sceneId = scene?.id ?? scene?.scene?.id
    const nodeId = sceneId ? `scene:${sceneId}` : null
    const pos = pendingFlowPosition.value
    if (nodeId && pos) await saveNodePosition(nodeId, pos)
    await focusAfterCreate(nodeId)
    ElMessage.success('场景已添加')
  }

  async function createProp(form) {
    const dramaId = drama.value?.id
    const episodeId = resolveEpisodeId()
    if (!dramaId) throw new Error('项目未加载')

    const prop = await propAPI.create({
      drama_id: dramaId,
      episode_id: episodeId ?? undefined,
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      prompt: form.prompt?.trim() || undefined,
    })

    const propId = prop?.id ?? prop?.prop?.id
    const nodeId = propId ? `prop:${propId}` : null
    const pos = pendingFlowPosition.value
    if (nodeId && pos) await saveNodePosition(nodeId, pos)
    await focusAfterCreate(nodeId)
    ElMessage.success('道具已添加')
  }

  async function submitCreate(form) {
    const type = createDialogType.value
    if (type === 'storyboard') await createStoryboard(form)
    else if (type === 'episode') await createEpisode(form)
    else if (type === 'character') await createCharacter(form)
    else if (type === 'scene') await createScene(form)
    else if (type === 'prop') await createProp(form)
    createDialogVisible.value = false
  }

  return {
    createDialogVisible,
    createDialogType,
    pendingFlowPosition,
    openCreateDialog,
    submitCreate,
    resolveEpisodeId,
  }
}
