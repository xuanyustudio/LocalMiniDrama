import request from '@/utils/request'

export const dramaAPI = {
  list(params) {
    return request.get('/dramas', { params: params || {} })
  },
  create(data) {
    return request.post('/dramas', data)
  },
  get(id) {
    return request.get(`/dramas/${id}`)
  },
  update(id, data) {
    return request.put(`/dramas/${id}`, data)
  },
  delete(id) {
    return request.delete(`/dramas/${id}`)
  },
  saveEpisodes(id, episodes) {
    return request.put(`/dramas/${id}/episodes`, { episodes })
  },
  saveCharacters(id, data) {
    return request.put(`/dramas/${id}/characters`, data)
  },
  /** 保存梗概/故事摘要到项目（outline），body: { summary, title?, genre?, tags? } */
  saveOutline(id, data) {
    return request.put(`/dramas/${id}/outline`, data)
  },
  saveProgress(id, data) {
    return request.put(`/dramas/${id}/progress`, data)
  },
  getStoryboards(episodeId) {
    return request.get(`/episodes/${episodeId}/storyboards`)
  },
  generateStoryboard(episodeId, options) {
    // 兼容旧调用方式: generateStoryboard(episodeId, model, style)
    let body = {};
    if (arguments.length > 2 || typeof options === 'string') {
       body.model = arguments[1];
       body.style = arguments[2];
    } else {
       body = options || {};
    }
    return request.post(`/episodes/${episodeId}/storyboards`, body)
  },
  finalizeEpisode(episodeId, data) {
    return request.post(`/episodes/${episodeId}/finalize`, data || {})
  },
  extractBackgrounds(episodeId, body) {
    return request.post(`/images/episode/${episodeId}/backgrounds/extract`, body || {})
  },
  extractEpisodeCharacters(episodeId) {
    return request.post(`/episodes/${episodeId}/characters/extract`)
  }
}
