import request from '@/utils/request'

export const propLibraryAPI = {
  list(params) {
    return request.get('/prop-library', { params })
  },
  get(id) {
    return request.get(`/prop-library/${id}`)
  },
  create(data) {
    return request.post('/prop-library', data)
  },
  update(id, data) {
    return request.put(`/prop-library/${id}`, data)
  },
  delete(id) {
    return request.delete(`/prop-library/${id}`)
  }
}
