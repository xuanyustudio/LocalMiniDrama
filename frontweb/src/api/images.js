import request from '@/utils/request'

export const imagesAPI = {
  list(params) {
    return request.get('/images', { params: params || {} })
  },
  create(data, requestConfig) {
    return request.post('/images', data, requestConfig)
  },
  upload(data) {
    return request.post('/images/upload', data)
  },
  delete(id) {
    return request.delete(`/images/${id}`)
  }
}
