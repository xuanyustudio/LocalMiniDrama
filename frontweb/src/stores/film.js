import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useFilmStore = defineStore('film', () => {
  const drama = ref(null)
  const currentEpisode = ref(null)
  const storyInput = ref('')
  const scriptContent = ref('')
  const videoResolution = ref('720p')
  const videoProgress = ref(0)
  const videoStatus = ref('idle') // idle | generating | done | error

  const dramaId = computed(() => drama.value?.id ?? null)
  // 角色/道具/场景默认只显示本集资源（随「选择第几集」变化）
  const characters = computed(() => currentEpisode.value?.characters ?? [])
  const scenes = computed(() => currentEpisode.value?.scenes ?? [])
  const props = computed(() => currentEpisode.value?.props ?? [])
  const storyboards = computed(() => currentEpisode.value?.storyboards ?? [])

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

  function setVideoProgress(p) {
    videoProgress.value = p
  }

  function setVideoStatus(s) {
    videoStatus.value = s
  }

  function reset() {
    drama.value = null
    currentEpisode.value = null
    storyInput.value = ''
    scriptContent.value = ''
    videoProgress.value = 0
    videoStatus.value = 'idle'
  }

  return {
    drama,
    currentEpisode,
    storyInput,
    scriptContent,
    videoResolution,
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
    reset
  }
})
