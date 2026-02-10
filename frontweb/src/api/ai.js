import request from '@/utils/request'

export const aiAPI = {
  list(serviceType) {
    return request.get('/ai-configs', { params: serviceType ? { service_type: serviceType } : {} })
  },
  get(id) {
    return request.get(`/ai-configs/${id}`)
  },
  create(body) {
    return request.post('/ai-configs', body)
  },
  update(id, body) {
    return request.put(`/ai-configs/${id}`, body)
  },
  delete(id) {
    return request.delete(`/ai-configs/${id}`)
  },
  testConnection(body) {
    return request.post('/ai-configs/test', body)
  }
}
