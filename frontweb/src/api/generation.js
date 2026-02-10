import request from '@/utils/request'

export const generationAPI = {
  /**
   * @param {string|number} dramaId
   * @param {{ episode_id?: string|number, outline?: string, count?: number, model?: string }} [options] - episode_id 用于关联本集，outline 为梗概/剧本摘要
   */
  generateCharacters(dramaId, options = {}) {
    const body = { drama_id: dramaId }
    if (options.episode_id != null) body.episode_id = options.episode_id
    if (options.outline != null && String(options.outline).trim()) body.outline = options.outline
    if (options.count != null) body.count = options.count
    if (options.model != null) body.model = options.model
    return request.post('/generation/characters', body)
  },
  /** 根据故事梗概 + 风格/类型 生成扩展剧本正文，返回 { content } */
  generateStory(body) {
    return request.post('/generation/story', body)
  }
}
