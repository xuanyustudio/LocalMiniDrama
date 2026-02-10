import request from '@/utils/request'

export const imagesAPI = {
  list(params) {
    return request.get('/images', { params: params || {} })
  },
  create(data) {
    return request.post('/images', data)
  },
  upload(data) {
    return request.post('/images/upload', data)
  }
}
