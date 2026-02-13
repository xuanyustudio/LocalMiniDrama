import request from '@/utils/request'

export const sceneAPI = {
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
  }
}
