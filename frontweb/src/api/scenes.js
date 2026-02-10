import request from '@/utils/request'

export const sceneAPI = {
  generateImage(data) {
    return request.post('/scenes/generate-image', data)
  },
  update(sceneId, data) {
    return request.put(`/scenes/${sceneId}`, data)
  },
  delete(sceneId) {
    return request.delete(`/scenes/${sceneId}`)
  }
}
