import request from '@/utils/request'

export const propAPI = {
  list(dramaId) {
    return request.get(`/dramas/${dramaId}/props`)
  },
  create(data) {
    return request.post('/props', data)
  },
  update(id, data) {
    return request.put(`/props/${id}`, data)
  },
  generateImage(id, model, style) {
    const body = { model, style }
    if (body.model == null && body.style == null) return request.post(`/props/${id}/generate`)
    return request.post(`/props/${id}/generate`, body)
  },
  extractFromScript(episodeId) {
    return request.post(`/episodes/${episodeId}/props/extract`)
  },
  delete(id) {
    return request.delete(`/props/${id}`)
  },
  addToLibrary(id, body = {}) {
    return request.post(`/props/${id}/add-to-library`, body)
  }
}
