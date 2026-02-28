import request from '@/utils/request'

export const promptsAPI = {
  list() {
    return request.get('/settings/prompts')
  },
  update(key, content) {
    return request.put(`/settings/prompts/${key}`, { content })
  },
  reset(key) {
    return request.delete(`/settings/prompts/${key}`)
  },
}
