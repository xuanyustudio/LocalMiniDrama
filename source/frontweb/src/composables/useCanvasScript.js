import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { dramaAPI } from '@/api/drama'
import { generationAPI } from '@/api/generation'
import { propAPI } from '@/api/props'
import { taskAPI } from '@/api/task'
import { getDramaGenerationOptions } from '@/utils/canvasWorkflow'
import { CANVAS_NODE_STATUS_LABELS } from '@/composables/useCanvasNodeStatus'

async function pollTask(taskId, onTick, maxAttempts = 450, interval = 2000) {
  if (!taskId) return { status: 'completed' }
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval))
    onTick?.()
    try {
      const t = await taskAPI.get(taskId)
      if (t.status === 'completed') return { status: 'completed', result: t.result }
      if (t.status === 'failed') {
        return { status: 'failed', error: t.error?.message || t.error || '任务失败' }
      }
    } catch (e) {
      if (i === maxAttempts - 1) return { status: 'failed', error: e.message || '轮询失败' }
    }
  }
  return { status: 'timeout', error: '任务超时' }
}

export function scriptNodeId(episodeId) {
  return `script:${episodeId}`
}

function buildEpisodesPayload(drama, episodeId, patch) {
  return (drama?.episodes || []).map((ep, i) => {
    const base = {
      episode_number: ep.episode_number ?? i + 1,
      title: ep.title || `第${ep.episode_number ?? i + 1}集`,
      script_content: ep.script_content || '',
      description: ep.description ?? null,
      duration: ep.duration ?? 0,
    }
    if (Number(ep.id) === Number(episodeId)) {
      return { ...base, ...patch }
    }
    return base
  })
}

/** 画布：剧本编辑 + 从剧本提取角色/场景/道具 */
export function useCanvasScript(deps) {
  const { drama, dramaId, refreshCanvas, nodeStatus } = deps
  const scriptBusy = ref(false)

  function setScriptBusy(episodeId, step, message) {
    nodeStatus?.set(scriptNodeId(episodeId), { step, message })
  }

  function clearScriptBusy(episodeId) {
    nodeStatus?.clear(scriptNodeId(episodeId))
  }

  async function runExtractTask(taskId, label) {
    if (!taskId) {
      await refreshCanvas(true)
      return
    }
    const polled = await pollTask(taskId, () => refreshCanvas(true))
    if (polled.status !== 'completed') {
      throw new Error(polled.error || `${label}失败`)
    }
    await refreshCanvas(true)
  }

  async function saveScript(episodeId, { scriptContent, title }) {
    const did = dramaId.value
    const d = drama.value
    if (!did || !d || !episodeId) throw new Error('缺少项目或集数')

    scriptBusy.value = true
    setScriptBusy(episodeId, 'save_script', CANVAS_NODE_STATUS_LABELS.save_script)
    try {
      const payload = buildEpisodesPayload(d, episodeId, {
        script_content: (scriptContent || '').trim(),
        title: (title || '').trim() || undefined,
      })
      await dramaAPI.saveEpisodes(did, payload)
      await refreshCanvas(true)
      ElMessage.success('剧本已保存')
    } finally {
      scriptBusy.value = false
      clearScriptBusy(episodeId)
    }
  }

  async function _extractCharacters(episodeId, scriptContent) {
    const did = dramaId.value
    const outline = (scriptContent || '').trim() || undefined
    const res = await generationAPI.generateCharacters(did, {
      episode_id: episodeId,
      outline,
    })
    await runExtractTask(res?.task_id, '提取角色')
  }

  async function _extractScenes(episodeId) {
    const style = getDramaGenerationOptions(drama.value).style || undefined
    const res = await dramaAPI.extractBackgrounds(episodeId, {
      model: undefined,
      style,
      language: 'zh',
    })
    await runExtractTask(res?.task_id, '提取场景')
  }

  async function _extractProps(episodeId) {
    const res = await propAPI.extractFromScript(episodeId)
    await runExtractTask(res?.task_id, '提取道具')
  }

  async function extractCharacters(episodeId, scriptContent) {
    if (!dramaId.value || !episodeId) throw new Error('请先选择集数')
    scriptBusy.value = true
    setScriptBusy(episodeId, 'extract_chars', CANVAS_NODE_STATUS_LABELS.extract_chars)
    try {
      await _extractCharacters(episodeId, scriptContent)
      ElMessage.success('角色提取完成')
    } finally {
      scriptBusy.value = false
      clearScriptBusy(episodeId)
    }
  }

  async function extractScenes(episodeId) {
    if (!episodeId) throw new Error('请先选择集数')
    scriptBusy.value = true
    setScriptBusy(episodeId, 'extract_scenes', CANVAS_NODE_STATUS_LABELS.extract_scenes)
    try {
      await _extractScenes(episodeId)
      ElMessage.success('场景提取完成')
    } finally {
      scriptBusy.value = false
      clearScriptBusy(episodeId)
    }
  }

  async function extractProps(episodeId) {
    if (!episodeId) throw new Error('请先选择集数')
    scriptBusy.value = true
    setScriptBusy(episodeId, 'extract_props', CANVAS_NODE_STATUS_LABELS.extract_props)
    try {
      await _extractProps(episodeId)
      ElMessage.success('道具提取完成')
    } finally {
      scriptBusy.value = false
      clearScriptBusy(episodeId)
    }
  }

  async function extractAll(episodeId, scriptContent) {
    if (!episodeId) throw new Error('请先选择集数')
    const content = (scriptContent || '').trim()
    if (!content) throw new Error('请先填写剧本内容')

    scriptBusy.value = true
    let didWork = false
    try {
      if ((drama.value?.characters || []).length === 0) {
        setScriptBusy(episodeId, 'extract_chars', '1/3 提取角色…')
        await _extractCharacters(episodeId, content)
        didWork = true
      }
      if ((drama.value?.scenes || []).length === 0) {
        setScriptBusy(episodeId, 'extract_scenes', '2/3 提取场景…')
        await _extractScenes(episodeId)
        didWork = true
      }
      if ((drama.value?.props || []).length === 0) {
        setScriptBusy(episodeId, 'extract_props', '3/3 提取道具…')
        await _extractProps(episodeId)
        didWork = true
      }

      if (!didWork) {
        ElMessage.info('角色、场景、道具均已存在，无需重复提取')
      } else {
        ElMessage.success(
          `提取完成：${(drama.value?.characters || []).length} 角色 · ${(drama.value?.scenes || []).length} 场景 · ${(drama.value?.props || []).length} 道具`
        )
      }
    } catch (e) {
      ElMessage.error(e?.message || '提取失败')
      throw e
    } finally {
      scriptBusy.value = false
      clearScriptBusy(episodeId)
    }
  }

  return {
    scriptBusy,
    saveScript,
    extractCharacters,
    extractScenes,
    extractProps,
    extractAll,
  }
}
