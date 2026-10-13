import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 600000,
  headers: { 'Content-Type': 'application/json' }
})

request.interceptors.response.use(
  (response) => {
    // blob 类型直接返回原始数据，不做 JSON 解包
    if (response.config?.responseType === 'blob') {
      return response.data
    }
    const res = response.data
    if (res.success !== false) {
      return res.data !== undefined ? res.data : res
    }
    return Promise.reject(new Error(res.error?.message || '请求失败'))
  },
  (error) => {
    // 提取后端实际错误信息（优先 API 返回的 message，而非 axios 通用 "status code 500"）
    const backendMsg = error.response?.data?.error?.message
    const msg = backendMsg || error.message || '网络错误'
    ElMessage.error(msg)
    // 将真实错误信息写回 message，使组件 catch 块可直接用 e.message 获取可读内容
    if (backendMsg) error.message = backendMsg
    return Promise.reject(error)
  }
)

export default request
