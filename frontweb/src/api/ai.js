import request from '@/utils/request'

export const aiAPI = {
  list(serviceType) {
    return request.get('/ai-configs', { params: serviceType ? { service_type: serviceType } : {} })
  }
}
