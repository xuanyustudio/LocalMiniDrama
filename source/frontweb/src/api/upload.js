import request from '@/utils/request'

export const uploadAPI = {
  /**
   * 上传图片文件，返回 { url, local_path }。需传 File 对象。
   * @param {File} file
   * @param {{ dramaId?: number|string|null }} [opts] 有剧集 id 时写入 projects/…/uploads/，否则仍为根目录 uploads/
   */
  uploadImage(file, opts = {}) {
    const form = new FormData()
    form.append('file', file)
    const did = opts.dramaId
    if (did != null && did !== '' && Number(did) > 0) {
      form.append('drama_id', String(did))
    }
    return request.post('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  /**
   * 从图片（base64 data URL 或 http URL）提取实体特征描述，不依赖已有实体 ID。
   * entityType: 'character' | 'scene' | 'prop'
   * imageUrl: data:image/xxx;base64,... 或 http URL
   */
  extractDescriptionFromImage(entityType, imageUrl, entityName) {
    return request.post('/extract-description-from-image', {
      entity_type: entityType,
      image_url: imageUrl,
      entity_name: entityName || undefined,
    })
  }
}
