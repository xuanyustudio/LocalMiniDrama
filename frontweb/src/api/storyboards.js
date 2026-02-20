import request from '@/utils/request'

export const storyboardsAPI = {
  update(id, data) {
    return request.put(`/storyboards/${id}`, data)
  }
}
