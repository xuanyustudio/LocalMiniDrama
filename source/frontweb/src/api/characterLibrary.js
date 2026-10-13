import request from '@/utils/request'

export const characterLibraryAPI = {
  list(params) {
    return request.get('/character-library', { params })
  },
  get(id) {
    return request.get(`/character-library/${id}`)
  },
  create(data) {
    return request.post('/character-library', data)
  },
  update(id, data) {
    return request.put(`/character-library/${id}`, data)
  },
  delete(id) {
    return request.delete(`/character-library/${id}`)
  }
}
