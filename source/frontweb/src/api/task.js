import request from '@/utils/request'

export const taskAPI = {
  get(taskId) {
    return request.get(`/tasks/${taskId}`)
  },
  cancel(taskId, body) {
    return request.post(`/tasks/${taskId}/cancel`, body || {})
  },
  listByResource(resourceId) {
    return request.get('/tasks', { params: { resource_id: String(resourceId) } })
  },
}
