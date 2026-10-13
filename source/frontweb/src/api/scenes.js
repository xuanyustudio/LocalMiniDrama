import request from '@/utils/request'

export const sceneAPI = {
  get(sceneId) {
    return request.get(`/scenes/${sceneId}`)
  },
  list(dramaId) {
    return request.get(`/dramas/${dramaId}/scenes`)
  },
  generatePrompt(sceneId, model, style, mode) {
    return request.post(`/scenes/${sceneId}/generate-prompt`, { model, style, mode })
  },
  create(data) {
    return request.post('/scenes', data)
  },
  generateImage(data) {
    return request.post('/scenes/generate-image', data)
  },
  update(sceneId, data) {
    return request.put(`/scenes/${sceneId}`, data)
  },
  delete(sceneId) {
    return request.delete(`/scenes/${sceneId}`)
  },
  addToLibrary(sceneId, body = {}) {
    return request.post(`/scenes/${sceneId}/add-to-library`, body)
  },
  addToMaterialLibrary(sceneId) {
    return request.post(`/scenes/${sceneId}/add-to-material-library`, {})
  },
  addToTeamLibrary(sceneId, body = {}) {
    return request.post(`/scenes/${sceneId}/add-to-team-library`, body)
  },
  extractFromImage(sceneId) {
    return request.post(`/scenes/${sceneId}/extract-from-image`, {})
  },
  putRefImage(sceneId, refImagePath) {
    return request.put(`/scenes/${sceneId}`, { ref_image: refImagePath ?? null })
  },
  generateFourViewImage(sceneId, model, style) {
    return request.post(`/scenes/${sceneId}/generate-four-view-image`, { model, style })
  }
}
