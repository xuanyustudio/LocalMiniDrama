import axios from 'axios'
import { h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productionCostItem, productionCostMessage } from './productionCost.js'

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 600000,
  headers: { 'Content-Type': 'application/json' }
})

export async function confirmProductionCost(items, description = '') {
  const config = { productionCostApproved: true }
  if (!items.length) return config
  const quote = await request.post('/production-profile/quote', { items, prepare_confirmation: true })
  if (quote.maxUsd === 0 && !quote.partial) return config
  try {
    await ElMessageBox.confirm(h('div', { style: { whiteSpace: 'pre-line', lineHeight: 1.7 } }, productionCostMessage(quote, description)), '确认本步 API 费用', {
      type: 'warning', confirmButtonText: '确认继续', cancelButtonText: '取消',
    })
  } catch {
    return null
  }
  if (quote.offer) {
    const { receipt } = await request.post('/production-profile/quote/confirm', { offer: quote.offer })
    config.headers = { 'X-Production-Approval': receipt }
  }
  return config
}

export async function approveProductionRequest(path, body) {
  const item = productionCostItem(path, body)
  if (!item) return
  const description = {
    rewrite: '使用云端模型时，将只发送本章及填写的改编要求。',
    script: '使用当前编辑框中的改写稿生成一集剧本。',
  }[item.kind]
  const approval = await confirmProductionCost([item], description)
  if (!approval) throw new axios.CanceledError('已取消本次生成')
  return approval.headers
}

request.interceptors.request.use(async config => {
  if (config.method === 'post' && config.productionCostApproved !== true) {
    const headers = await approveProductionRequest(config.url, config.data)
    if (headers) config.headers.set(headers)
  }
  return config
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
    if (axios.isCancel(error)) return Promise.reject(error)
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
