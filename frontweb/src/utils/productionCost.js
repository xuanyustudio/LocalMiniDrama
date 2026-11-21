const routes = [
  [/^\/dramas\/(\d+)\/adaptation\/(rewrite|script)$/, match => ({ kind: match[2], id: match[1] })],
  [/^\/generation\/story$/, () => ({ kind: 'story' })],
  [/^\/dramas\/(\d+)\/story-bible\/generate$/, match => ({ kind: 'bible', id: match[1] })],
  [/^\/dramas\/(\d+)\/story-bible\/book$/, match => ({ kind: 'bible_book', id: match[1] })],
  // 免费规则体检不计费，只有请 AI 剧本医生时才报价
  [/^\/dramas\/(\d+)\/script-review$/, (match, data) => data.ai === true ? { kind: 'review', id: match[1] } : null],
  [/^\/generation\/characters$/, (_m, data) => ({ kind: 'characters', id: data.episode_id })],
  [/^\/episodes\/(\d+)\/(storyboards|props\/extract|characters\/extract)$/, match => ({ kind: { storyboards: 'boards', 'props/extract': 'props', 'characters/extract': 'characters' }[match[2]], id: match[1] })],
  [/^\/images\/episode\/(\d+)\/backgrounds\/extract$/, match => ({ kind: 'scenes', id: match[1] })],
  [/^\/audio\/extract(?:\/batch)?$/, () => ({ kind: 'tts' })],
  [/^\/videos$/, () => ({ kind: 'video' })],
  [/^\/images$/, (_m, data) => ({ kind: data.storyboard_id ? 'storyboard_image' : 'image' })],
  [/^\/characters\/batch-generate-images$/, () => ({ kind: 'image' })],
  [/^\/characters\/(\d+)\/generate-(?:four-view-)?image$/, match => ({ kind: 'character_image', id: match[1] })],
  [/^\/scenes\/(\d+)\/generate-four-view-image$/, match => ({ kind: 'scene_image', id: match[1], quad: true })],
  [/^\/scenes\/generate-image$/, (_m, data) => ({ kind: 'scene_image', id: data.scene_id, quad: data.use_quad_grid !== false })],
  [/^\/props\/\d+\/generate$|^\/images\/scene\/\d+$/, () => ({ kind: 'image' })],
  [/^\/storyboards\/\d+\/frame-prompt$/, () => ({ kind: 'frame_prompt' })],
  [/^\/storyboards\/\d+\/(?:polish-prompt|(?:classic-video-prompt-polish|universal-segment-(?:prompt|polish))(?:-stream)?)$/, () => ({ kind: 'polish' })],
  [/^\/storyboards\/\d+\/regenerate-layout-description$/, () => ({ kind: 'layout' })],
  [/^\/characters\/\d+\/extract-anchors$/, () => ({ kind: 'anchors' })],
  [/^\/props\/\d+\/generate-prompt$/, () => ({ kind: 'prop_prompt' })],
  [/^\/characters\/\d+\/generate-prompt$/, () => ({ kind: 'character_prompt' })],
  [/^\/scenes\/\d+\/generate-prompt$/, () => ({ kind: 'scene_prompt' })],
  [/^\/(?:characters|scenes|props)\/\d+\/extract-from-image$|^\/extract-description-from-image$/, () => ({ kind: 'vision' })],
  [/^\/agent\/(?:chat|decline)$/, () => ({ kind: 'agent' })],
  // 「测试连接」只发极短请求且后端不要求回执，不弹费用确认
  [/^\/characters\/\d+\/(?:sd2-certify|sd2-voice-upload|add-to-material-library)$|^\/(?:props|scenes)\/\d+\/add-to-material-library$|^\/ai-configs\/model-ark-asset$|^\/storyboards\/\d+\/upscale$/, () => ({ kind: 'service' })],
]

export function productionCostItem(path, body = {}) {
  const url = path.replace(/^\/api\/v1(?=\/)/, '').split('?')[0]
  const form = typeof FormData === 'function' && body instanceof FormData ? body : null
  const data = form ? {} : body || {}
  if (url === '/agent/approve') {
    const { dramaId, episodeId, runId, toolCallId } = data
    return { kind: 'agent_approval', data: { dramaId, episodeId, runId, toolCallId } }
  }
  if (url === '/dramas/import-novel') {
    const summarize = form?.get('ai_summarize') ?? data.ai_summarize
    if (summarize !== true && summarize !== 'true') return null
    return { kind: 'novel_import', data: { max_chapters: form?.get('max_chapters') ?? data.max_chapters,
      text_chars: (form?.get('text') || data.text || '').length } }
  }
  const finalize = /^\/episodes\/(\d+)\/finalize$/.exec(url)
  if (finalize && data.burn_narration_subtitles) return { kind: 'merge_voice', id: finalize[1] }
  for (const [pattern, identify] of routes) {
    const match = pattern.exec(url)
    if (!match) continue
    const info = identify(match, data)
    if (!info) return null
    const { model, provider, storyboard_id, storyboard_ids, duration, voice_id, tts_kind, speaker_voices, frame_type } = data
    const pricingData = { model, provider, storyboard_id, storyboard_ids, duration, voice_id, tts_kind, speaker_voices, frame_type,
      // 生成故事时后端读取 premise（其次 prompt / text）
      text_chars: [info.kind === 'story' ? (data.premise || data.prompt || data.text) : data.prompt, info.kind === 'bible' ? data.text : null, info.kind === 'review' ? data.script : null, data.outline, data.story, data.draft_universal_segment_text, data.message].reduce((sum, value) => sum + (typeof value === 'string' ? value.length : 0), 0),
      reference_count: data.reference_image_urls?.length,
      count: data.character_ids?.length,
      character_ids: data.character_ids,
    }
    if (info.kind === 'tts') pricingData.text = data.text
    if (info.kind === 'bible' && !data.text) pricingData.chapter = data.chapter
    if (info.kind === 'bible_book') Object.assign(pricingData, { from: data.from, to: data.to, resume: data.resume === true })
    if (info.kind === 'rewrite') Object.assign(pricingData, { chapter: data.chapter, rules: data.rules, character_rules: data.character_rules })
    if (info.kind === 'script') pricingData.rewritten = data.rewritten
    return { ...info, data: pricingData }
  }
  return null
}

function usd(value) {
  if (value > 0 && value < 0.0001) return '低于 US$0.0001'
  return `US$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false })}`
}

function range(min, max) {
  const a = usd(min)
  const b = usd(max)
  return a === b ? a : `${a}–${b}`
}

export function productionCostTotal(quote) {
  if (!quote.partial) return `本次预计 ${range(quote.minUsd, quote.maxUsd)}`
  return quote.maxUsd > 0 ? `已知部分约 ${range(quote.minUsd, quote.maxUsd)}，另有未报价项目` : '本次包含未报价项目'
}

export function productionCostMessage(quote, description = '') {
  const lines = new Map()
  for (const row of quote.rows) {
    const key = JSON.stringify([row.label, row.model, row.note, row.maxUsd === null])
    const current = lines.get(key)
    if (current) {
      current.count += 1
      if (current.maxUsd !== null) {
        current.minUsd += row.minUsd
        current.maxUsd += row.maxUsd
      }
    } else {
      lines.set(key, { ...row, count: 1 })
    }
  }
  const details = [...lines.values()].map(row => {
    const scope = row.count > 1 ? ` · ${row.count} 项` : row.basis ? ` · ${row.basis}` : ''
    const amount = row.maxUsd === null ? '暂无单价' : range(row.minUsd, row.maxUsd)
    return `${row.label}${row.model ? ` · ${row.model}` : ''}${scope} · ${amount}${row.note ? `（${row.note}）` : ''}`
  })
  return [description, productionCostTotal(quote), ...details, '按服务商公开标价估算，未扣除免费额度或优惠。重试和重新生成可能另计，实际费用以服务商账单为准。'].filter(Boolean).join('\n')
}
