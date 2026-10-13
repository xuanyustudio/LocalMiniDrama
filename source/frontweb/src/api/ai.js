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
  },
  /** 即梦2角色认证：GET /api/business/v1/assets（body: base_url, api_key, limit?, cursor?） */
  listJimeng2MaterialAssets(body) {
    return request.post('/ai-configs/jimeng2-list-assets', body)
  },
  /** ModelArk 私有资产库：action + payload，见 AI 配置页 SD2 资产管理 */
  modelArkAsset(body) {
    return request.post('/ai-configs/model-ark-asset', body)
  },
  getVendorLock() {
    return request.get('/ai-configs/vendor-lock')
  },
  bulkUpdateKey(apiKey) {
    return request.put('/ai-configs/bulk-update-key', { api_key: apiKey })
  }
}
