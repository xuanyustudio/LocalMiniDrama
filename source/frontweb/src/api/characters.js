import request from '@/utils/request'

export const characterAPI = {
  get(characterId) {
    return request.get(`/characters/${characterId}`)
  },
  generateImage(characterId, model, style) {
    return request.post(`/characters/${characterId}/generate-image`, { model, style })
  },
  generatePrompt(characterId, model, style) {
    return request.post(`/characters/${characterId}/generate-prompt`, { model, style })
  },
  batchGenerateImages(characterIds, model, style) {
    return request.post('/characters/batch-generate-images', {
      character_ids: characterIds.map(String),
      model,
      style
    })
  },
  update(characterId, data) {
    return request.put(`/characters/${characterId}`, data)
  },
  putImage(characterId, data) {
    return request.put(`/characters/${characterId}/image`, data)
  },
  putRefImage(characterId, refImagePath) {
    return request.put(`/characters/${characterId}/image`, { ref_image: refImagePath })
  },
  delete(characterId) {
    return request.delete(`/characters/${characterId}`)
  },
  addToLibrary(characterId, body) {
    return request.post(`/characters/${characterId}/add-to-library`, body || {})
  },
  addToMaterialLibrary(characterId) {
    return request.post(`/characters/${characterId}/add-to-material-library`, {})
  },
  addToTeamLibrary(characterId, body = {}) {
    return request.post(`/characters/${characterId}/add-to-team-library`, body)
  },
  extractFromImage(characterId) {
    return request.post(`/characters/${characterId}/extract-from-image`, {})
  },
  extractAnchors(characterId) {
    return request.post(`/characters/${characterId}/extract-anchors`, {})
  },
  sd2Certify(characterId) {
    return request.post(`/characters/${characterId}/sd2-certify`, {})
  },
  sd2CertifyRefresh(characterId) {
    return request.post(`/characters/${characterId}/sd2-certify/refresh`, {})
  },
  sd2VoiceUpload(characterId, file) {
    const form = new FormData()
    form.append('file', file)
    return request.post(`/characters/${characterId}/sd2-voice-upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  sd2VoiceRefresh(characterId) {
    return request.post(`/characters/${characterId}/sd2-voice-refresh`, {})
  }
}
