import request, { approveProductionRequest } from '@/utils/request'
import { parseSseBlock } from '@/utils/agentStream'

async function readError(response) {
  try {
    const data = await response.json()
    return data?.error?.message || '请求失败'
  } catch (_) {
    return '请求失败'
  }
}

export async function streamAgent(path, body, onEvent) {
  const approval = await approveProductionRequest(path, body)
  const response = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...approval },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response))
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const event of parseSseBlock(`${parts.join('\n\n')}\n\n`)) onEvent(event)
  }
  if (buffer.trim()) {
    for (const event of parseSseBlock(`${buffer}\n\n`)) onEvent(event)
  }
}

export const agentAPI = {
  history(dramaId) {
    return request.get('/agent/history', { params: { dramaId } })
  },
  chat(body, onEvent) {
    return streamAgent('/agent/chat', body, onEvent)
  },
  approve(body, onEvent) {
    return streamAgent('/agent/approve', body, onEvent)
  },
  decline(body, onEvent) {
    return streamAgent('/agent/decline', body, onEvent)
  },
}
