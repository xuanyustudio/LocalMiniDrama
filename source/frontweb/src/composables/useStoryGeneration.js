import { ElMessage } from 'element-plus'
import { dramaAPI } from '@/api/drama'
import { generationAPI } from '@/api/generation'
import { stylePromptMetadataForSave } from '@/constants/styleOptions'
import { GEN_RESOURCE } from '@/stores/generationTaskStore'

/**
 * 从故事梗概调用 AI 生成多集剧本并写入 drama（与 FilmCreate.onGenerateStory 一致）
 * 生成与保存由后端异步任务完成，离开页面后仍会入库。
 * @returns {Promise<{ ok: boolean, dramaId?: number, episodeCount?: number, error?: string }>}
 */
export async function runGenerateStoryFromPremise({
  premise,
  storyStyle,
  storyType,
  storyEpisodeCount,
  scriptTitle,
  generationStyle,
  customStylePrompt,
  projectAspectRatio,
  store,
  router,
  route,
  loadDrama,
  savedCurrentEpisodeNumber,
  selectedEpisodeId,
  onEpisodeSelect,
  storyGenerating,
  scriptGenerating,
  pollTask,
  replaceRouteWhenNew = true,
  onComplete,
  /** 为 true 时保存集数/梗概后不调用 loadDrama（用于剧本管理页生成后直接 router.push 进创作页） */
  skipPostLoad = false,
}) {
  const text = (premise || '').trim()
  if (!text) {
    ElMessage.warning('请先输入故事梗概')
    return { ok: false }
  }

  storyGenerating.value = true
  try {
    let dramaId = store.dramaId
    if (!dramaId) {
      const drama = await dramaAPI.create({
        title: scriptTitle || '新故事',
        description: text,
        genre: storyType || undefined,
        style: generationStyle || undefined,
        metadata: {
          ...stylePromptMetadataForSave(generationStyle, customStylePrompt),
          story_style: storyStyle || undefined,
          aspect_ratio: projectAspectRatio || '16:9',
        },
      })
      store.setDrama(drama)
      dramaId = drama.id
      if (replaceRouteWhenNew && route?.params?.id === 'new' && router) {
        router.replace('/film/' + dramaId)
      }
    }

    const dramaTitle = store.drama?.title || scriptTitle || '项目'
    const meta = {
      dramaId,
      episodeId: store.currentEpisode?.id ?? selectedEpisodeId?.value ?? 0,
      dramaTitle,
      episodeNumber: store.currentEpisode?.episode_number ?? 1,
      resourceType: GEN_RESOURCE.GENERATE_STORY,
      resourceId: Number(dramaId),
      label: `${dramaTitle} 生成剧本`,
    }

    scriptGenerating.value = true
    try {
      const res = await generationAPI.generateStory({
        drama_id: dramaId,
        premise: text,
        style: storyStyle || undefined,
        type: storyType || undefined,
        episode_count: storyEpisodeCount || 1,
        title: scriptTitle || undefined,
        summary: text,
        genre: storyType || undefined,
        drama_style: generationStyle || undefined,
        metadata: {
          ...stylePromptMetadataForSave(generationStyle, customStylePrompt),
          story_style: storyStyle || undefined,
          aspect_ratio: projectAspectRatio || '16:9',
        },
      })

      const taskId = res?.task_id
      if (!taskId) {
        ElMessage.error('未能启动剧本生成任务')
        return { ok: false }
      }

      const pollRes = await pollTask(taskId, () => loadDrama?.(), meta)
      if (pollRes?.status !== 'completed') {
        return { ok: false, error: pollRes?.error || '剧本生成失败' }
      }

      savedCurrentEpisodeNumber.value = 1

      if (!skipPostLoad) {
        await loadDrama()

        const firstEp = (store.drama?.episodes || [])[0]
        if (firstEp) {
          selectedEpisodeId.value = firstEp.id
          onEpisodeSelect(firstEp.id)
        }
      }

      const parsedResult = typeof pollRes?.result === 'string'
        ? (() => { try { return JSON.parse(pollRes.result) } catch { return {} } })()
        : (pollRes?.result || {})
      const n = (store.drama?.episodes || []).length || parsedResult.episode_count || 1
      if (!skipPostLoad) {
        ElMessage.success(n > 1 ? `剧本已生成，共 ${n} 集，已默认选中第1集` : '剧本已生成并已保存')
      } else {
        ElMessage.success(n > 1 ? `剧本已生成，共 ${n} 集` : '剧本已生成并已保存')
      }
      if (typeof onComplete === 'function') {
        onComplete({ episodeCount: n, dramaId })
      }
      return { ok: true, dramaId, episodeCount: n }
    } catch (e) {
      ElMessage.error(e.message || '剧本生成失败')
      return { ok: false, error: e.message }
    } finally {
      scriptGenerating.value = false
    }
  } catch (e) {
    ElMessage.error(e.message || '故事生成失败')
    return { ok: false, error: e.message }
  } finally {
    storyGenerating.value = false
  }
}
