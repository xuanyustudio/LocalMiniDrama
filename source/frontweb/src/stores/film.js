import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

function episodeVideoKey(dramaId, episodeId) {
  if (dramaId == null || episodeId == null) return null
  return `${dramaId}:${episodeId}`
}

export const useFilmStore = defineStore('film', () => {
  const drama = ref(null)
  const currentEpisode = ref(null)
  const storyInput = ref('')
  const scriptContent = ref('')
  const videoResolution = ref('480p')
  /** 按 dramaId:episodeId 存储合成视频进度与状态 */
  const videoStateByKey = ref({})

  const dramaId = computed(() => drama.value?.id ?? null)
  // 角色/道具/场景默认只显示本集资源（随「选择第几集」变化）
  const characters = computed(() => currentEpisode.value?.characters ?? [])
  const scenes = computed(() => currentEpisode.value?.scenes ?? [])
  const props = computed(() => currentEpisode.value?.props ?? [])
  const storyboards = computed(() => currentEpisode.value?.storyboards ?? [])

  const currentVideoKey = computed(() =>
    episodeVideoKey(drama.value?.id ?? null, currentEpisode.value?.id ?? null)
  )

  const videoProgress = computed(() => {
    const k = currentVideoKey.value
    if (!k) return 0
    return videoStateByKey.value[k]?.progress ?? 0
  })

  const videoStatus = computed(() => {
    const k = currentVideoKey.value
    if (!k) return 'idle'
    return videoStateByKey.value[k]?.status ?? 'idle'
  })

  function _ensureVideoState(key) {
    if (!key) return null
    if (!videoStateByKey.value[key]) {
      videoStateByKey.value = {
        ...videoStateByKey.value,
        [key]: { status: 'idle', progress: 0 },
      }
    }
    return videoStateByKey.value[key]
  }

  function setDrama(d) {
    drama.value = d
  }

  function setCurrentEpisode(ep) {
    currentEpisode.value = ep
  }

  function setStoryInput(text) {
    storyInput.value = text
  }

  function setScriptContent(text) {
    scriptContent.value = text
  }

  function setVideoProgress(p, dId, eId) {
    const key = episodeVideoKey(
      dId ?? drama.value?.id ?? null,
      eId ?? currentEpisode.value?.id ?? null
    )
    if (!key) return
    const prev = _ensureVideoState(key)
    videoStateByKey.value = {
      ...videoStateByKey.value,
      [key]: { ...prev, progress: p },
    }
  }

  function setVideoStatus(s, dId, eId) {
    const key = episodeVideoKey(
      dId ?? drama.value?.id ?? null,
      eId ?? currentEpisode.value?.id ?? null
    )
    if (!key) return
    const prev = _ensureVideoState(key)
    videoStateByKey.value = {
      ...videoStateByKey.value,
      [key]: { ...prev, status: s },
    }
  }

  function getVideoStatus(dId, eId) {
    const key = episodeVideoKey(dId, eId)
    if (!key) return 'idle'
    return videoStateByKey.value[key]?.status ?? 'idle'
  }

  function reset() {
    drama.value = null
    currentEpisode.value = null
    storyInput.value = ''
    scriptContent.value = ''
    // 保留 videoStateByKey：跨剧切换时其它项目的合成状态不丢失
  }

  return {
    drama,
    currentEpisode,
    storyInput,
    scriptContent,
    videoResolution,
    videoStateByKey,
    videoProgress,
    videoStatus,
    dramaId,
    characters,
    scenes,
    props,
    storyboards,
    setDrama,
    setCurrentEpisode,
    setStoryInput,
    setScriptContent,
    setVideoProgress,
    setVideoStatus,
    getVideoStatus,
    reset,
  }
})
