import { ElMessage } from 'element-plus'
import { dramaAPI } from '@/api/drama'
import { generationAPI } from '@/api/generation'
import { stylePromptMetadataForSave } from '@/constants/styleOptions'

/**
 * 从故事梗概调用 AI 生成多集剧本并写入 drama（与 FilmCreate.onGenerateStory 一致）
 * @returns {Promise<{ ok: boolean, dramaId?: number, episodeCount?: number, error?: string }>}
 */
export async function runGenerateStoryFromPremise({
  premise,
  storyStyle,
  storyType,
  storyEpisodeCount,
  scriptTitle,
  generationStyle,
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

  const preferredEpisodeNumber = store.currentEpisode?.episode_number ?? savedCurrentEpisodeNumber?.value ?? 1

  storyGenerating.value = true
  try {
    const res = await generationAPI.generateStory({
      premise: text,
      style: storyStyle || undefined,
      type: storyType || undefined,
      episode_count: storyEpisodeCount || 1,
    })

    const episodes = res?.episodes || []
    if (episodes.length === 0) {
      ElMessage.error('AI 未能生成剧本，请重试')
      return { ok: false }
    }

    scriptGenerating.value = true
    try {
      let dramaId = store.dramaId
      if (!dramaId) {
        const drama = await dramaAPI.create({
          title: scriptTitle || '新故事',
          description: text,
          genre: storyType || undefined,
          style: generationStyle || undefined,
          metadata: {
            ...stylePromptMetadataForSave(generationStyle),
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

      const epPayload = episodes.map((ep, i) => ({
        episode_number: ep.episode ?? i + 1,
        title: ep.title || `第${ep.episode ?? i + 1}集`,
        script_content: ep.content || '',
      }))
      savedCurrentEpisodeNumber.value = preferredEpisodeNumber
      await dramaAPI.saveEpisodes(dramaId, epPayload)

      await dramaAPI.saveOutline(dramaId, {
        summary: text,
        genre: storyType || undefined,
        style: generationStyle || undefined,
        metadata: {
          ...stylePromptMetadataForSave(generationStyle),
          story_style: storyStyle || undefined,
          aspect_ratio: projectAspectRatio || '16:9',
        },
      }).catch(() => {})

      if (!skipPostLoad) {
        await loadDrama()

        const episodesAfterSave = store.drama?.episodes || []
        const preferredEp = episodesAfterSave.find((ep) => Number(ep.episode_number) === Number(preferredEpisodeNumber))
          || episodesAfterSave[0]
        if (preferredEp) {
          selectedEpisodeId.value = preferredEp.id
          onEpisodeSelect(preferredEp.id)
        }
      }

      const n = episodes.length
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
      ElMessage.error(e.message || '保存剧本失败')
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
