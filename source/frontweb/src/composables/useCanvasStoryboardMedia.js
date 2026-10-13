import { ref } from 'vue'
import { imagesAPI } from '@/api/images'
import { videosAPI } from '@/api/videos'

/**
 * 加载当前剧集分镜的 images / videos 列表（与 FilmCreate.loadStoryboardMedia 对齐）
 */
export function useCanvasStoryboardMedia() {
  const imagesBySbId = ref({})
  const videosBySbId = ref({})
  const mediaLoading = ref(false)

  async function loadForStoryboards(storyboards) {
    const boards = storyboards || []
    if (!boards.length) {
      imagesBySbId.value = {}
      videosBySbId.value = {}
      return
    }
    mediaLoading.value = true
    try {
      const nextImages = { ...imagesBySbId.value }
      const nextVideos = { ...videosBySbId.value }
      await Promise.all(
        boards.map(async (sb) => {
          try {
            const [imgRes, vidRes] = await Promise.all([
              imagesAPI.list({ storyboard_id: sb.id, page: 1, page_size: 100 }),
              videosAPI.list({ storyboard_id: sb.id, page: 1, page_size: 50 }),
            ])
            nextImages[sb.id] = imgRes?.items || []
            nextVideos[sb.id] = vidRes?.items || []
          } catch (_) {
            nextImages[sb.id] = []
            nextVideos[sb.id] = []
          }
        })
      )
      imagesBySbId.value = nextImages
      videosBySbId.value = nextVideos
    } finally {
      mediaLoading.value = false
    }
  }

  async function loadForDrama(drama, episodeId = null) {
    const episodes = episodeId
      ? (drama?.episodes || []).filter((ep) => ep.id === episodeId)
      : (drama?.episodes || [])
    const boards = episodes.flatMap((ep) => ep.storyboards || [])
    await loadForStoryboards(boards)
  }

  return {
    imagesBySbId,
    videosBySbId,
    mediaLoading,
    loadForStoryboards,
    loadForDrama,
  }
}
