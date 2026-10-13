import request from '@/utils/request'

export const propAPI = {
  get(id) {
    return request.get(`/props/${id}`)
  },
  list(dramaId) {
    return request.get(`/dramas/${dramaId}/props`)
  },
  create(data) {
    return request.post('/props', data)
  },
  update(id, data) {
    return request.put(`/props/${id}`, data)
  },
  generatePrompt(id, model, style) {
    return request.post(`/props/${id}/generate-prompt`, { model, style })
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
  },
  addToMaterialLibrary(id) {
    return request.post(`/props/${id}/add-to-material-library`, {})
  },
  extractFromImage(id) {
    return request.post(`/props/${id}/extract-from-image`, {})
  },
  putRefImage(id, refImagePath) {
    return request.put(`/props/${id}`, { ref_image: refImagePath ?? null })
  }
}
