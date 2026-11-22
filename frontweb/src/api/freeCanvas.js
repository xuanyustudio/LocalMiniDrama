import request from '@/utils/request'

export function list() {
  return request.get('/free-canvases')
}

export function create(title) {
  return request.post('/free-canvases', { title })
}

export function get(id) {
  return request.get(`/free-canvases/${id}`)
}

export function command(id, body) {
  return request.post(`/free-canvases/${id}/commands`, body)
}

export function upload(id, nodeId, revision, file) {
  const form = new FormData()
  form.append('file', file)
  form.append('node_id', nodeId == null ? '' : String(nodeId))
  form.append('revision', revision == null ? '' : String(revision))
  return request.post(`/free-canvases/${id}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
