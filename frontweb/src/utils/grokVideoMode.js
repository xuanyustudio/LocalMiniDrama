export const GROK_DEFAULT_ASPECT = '9:16'
export const GROK_DEFAULT_RESOLUTION = '720p'
export const GROK_DEFAULT_DURATION = 6

function sameUrl(a, b) {
  const x = String(a || '').trim()
  const y = String(b || '').trim()
  if (!x || !y) return false
  if (x === y) return true
  return x.split('?')[0].replace(/\/+$/, '') === y.split('?')[0].replace(/\/+$/, '')
}

export function resolveGrokGenerationMode({ firstFrameUrl, imageUrl, referenceUrls } = {}) {
  const image = String(firstFrameUrl || imageUrl || '').trim()
  const refs = (Array.isArray(referenceUrls) ? referenceUrls : [])
    .map((u) => String(u || '').trim())
    .filter(Boolean)
  const extra = image ? refs.filter((u) => !sameUrl(u, image)) : refs
  if (image && extra.length) {
    return { mode: 'invalid', error: 'image and reference_images cannot both be submitted' }
  }
  if (image) return { mode: 'i2v', image, reference_images: null }
  if (refs.length) return { mode: 'r2v', image: null, reference_images: refs }
  return { mode: 't2v', image: null, reference_images: null }
}

export function applyGrokVideoMode(mode, { firstFrameUrl, imageUrl, referenceUrls, resolution } = {}) {
  const chosen = String(mode || 'auto')
  if (chosen === 't2v') {
    return {
      mode: 't2v',
      image_url: undefined,
      first_frame_url: undefined,
      reference_image_urls: undefined,
      resolution: resolution || GROK_DEFAULT_RESOLUTION,
    }
  }
  if (chosen === 'i2v') {
    const url = String(firstFrameUrl || imageUrl || (referenceUrls && referenceUrls[0]) || '').trim()
    return {
      mode: 'i2v',
      image_url: url || undefined,
      first_frame_url: url || undefined,
      reference_image_urls: undefined,
      resolution: resolution || GROK_DEFAULT_RESOLUTION,
    }
  }
  if (chosen === 'r2v') {
    const refs = (Array.isArray(referenceUrls) ? referenceUrls : []).filter(Boolean)
    const reso = String(resolution || '').includes('1080') ? '720p' : (resolution || GROK_DEFAULT_RESOLUTION)
    return {
      mode: 'r2v',
      image_url: undefined,
      first_frame_url: undefined,
      reference_image_urls: refs.length ? refs : undefined,
      resolution: reso,
    }
  }
  const resolved = resolveGrokGenerationMode({ firstFrameUrl, imageUrl, referenceUrls })
  if (resolved.mode === 'invalid') return { mode: 'invalid', error: resolved.error }
  if (resolved.mode === 'i2v') {
    return applyGrokVideoMode('i2v', { firstFrameUrl: resolved.image, resolution })
  }
  if (resolved.mode === 'r2v') {
    return applyGrokVideoMode('r2v', { referenceUrls: resolved.reference_images, resolution })
  }
  return applyGrokVideoMode('t2v', { resolution })
}

export function isGrok1080pAllowed(mode) {
  return String(mode || '') !== 'r2v'
}

export function isXaiVideoConfig(cfg) {
  const p = String(cfg?.provider || '').toLowerCase()
  const proto = String(cfg?.api_protocol || '').toLowerCase()
  return p === 'xai' || p === 'grok' || proto === 'xai'
}

/**
 * 制作页/画布提交视频前的互斥整理。
 * applyExclusive=false 时保留其他供应商（Seedance/Kling 等）的首帧+参考图原样。
 */
export function composeGrokAwareVideoBody(mode, body = {}, { applyExclusive = true } = {}) {
  const base = {
    ...body,
    aspect_ratio: body.aspect_ratio || GROK_DEFAULT_ASPECT,
  }
  if (!applyExclusive) return base
  const applied = applyGrokVideoMode(mode, {
    firstFrameUrl: body.first_frame_url,
    imageUrl: body.image_url,
    referenceUrls: body.reference_image_urls,
    resolution: body.resolution,
  })
  if (applied.error) {
    const err = new Error(applied.error)
    err.code = 'GROK_MODE_INVALID'
    throw err
  }
  return {
    ...base,
    image_url: applied.image_url,
    first_frame_url: applied.first_frame_url,
    reference_image_urls: applied.reference_image_urls,
    resolution: applied.resolution,
  }
}
