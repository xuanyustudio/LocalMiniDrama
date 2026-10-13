import { assetImageUrl } from './mediaUrl'
import { parseDramaMetadata } from './canvasLayout'

export function dramaUsesFirstLastFrame(drama) {
  const meta = parseDramaMetadata(drama?.metadata)
  return !!meta.storyboard_use_first_last_frame
}

function isHttpVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  const t = url.trim()
  return t.startsWith('http://') || t.startsWith('https://')
}

function isCompletedImage(i) {
  return i?.status === 'completed'
    && i.frame_type !== 'quad_grid'
    && i.frame_type !== 'nine_grid'
    && (i.image_url || i.local_path)
}

export function getSbImagesList(imagesBySbId, storyboardId) {
  const list = imagesBySbId?.[storyboardId]
  return Array.isArray(list) ? list.filter(isCompletedImage) : []
}

export function getSbVideosList(videosBySbId, storyboardId) {
  const list = videosBySbId?.[storyboardId]
  if (!Array.isArray(list)) return []
  return list.filter((v) => v.status === 'completed' && ((v.local_path && String(v.local_path).trim()) || isHttpVideoUrl(v.video_url)))
}

/** 首帧图记录（与 FilmCreate.getSbFirstImage 一致） */
export function resolveSbFirstImageRecord(sb, imagesBySbId) {
  if (!sb) return null
  const images = getSbImagesList(imagesBySbId, sb.id)
  if (sb.first_frame_image_id != null) {
    const bound = images.find((i) => i.id === sb.first_frame_image_id)
    if (bound) return bound
  }
  const typed = images.find((i) => i.frame_type === 'storyboard_first')
  if (typed) return typed
  if (sb.local_path || sb.image_url) {
    return {
      id: sb.first_frame_image_id,
      image_url: sb.image_url,
      local_path: sb.local_path,
      frame_type: 'storyboard_first',
    }
  }
  return null
}

/** 尾帧图记录（与 FilmCreate.getSbLastImage 一致） */
export function resolveSbLastImageRecord(sb, imagesBySbId) {
  if (!sb) return null
  const images = getSbImagesList(imagesBySbId, sb.id)
  if (sb.last_frame_image_id != null) {
    const bound = images.find((i) => i.id === sb.last_frame_image_id)
    if (bound) return bound
  }
  const typed = images.find((i) => i.frame_type === 'storyboard_last')
  if (typed) return typed
  if (sb.last_frame_image_url || sb.last_frame_local_path) {
    return {
      id: sb.last_frame_image_id,
      image_url: sb.last_frame_image_url,
      local_path: sb.last_frame_local_path,
      frame_type: 'storyboard_last',
    }
  }
  return null
}

/** 经典单图模式主图 */
export function resolveSbMainImageRecord(sb, imagesBySbId) {
  if (!sb) return null
  const images = getSbImagesList(imagesBySbId, sb.id)
  if (images.length) return images[0]
  if (sb.local_path || sb.image_url) {
    return { image_url: sb.image_url, local_path: sb.local_path }
  }
  return null
}

export function imageRecordUrl(record) {
  return assetImageUrl(record)
}

/** 当前分镜视频（优先匹配 storyboard.video_url） */
export function resolveSbVideoRecord(sb, videosBySbId) {
  if (!sb) return null
  const list = getSbVideosList(videosBySbId, sb.id)
  if (list.length) {
    if (sb.video_url) {
      const matched = list.find((v) => v.video_url === sb.video_url)
      if (matched) return matched
      const lp = sb.video_url.replace(/^\/static\//, '')
      const byPath = list.find((v) => v.local_path && (v.local_path === lp || sb.video_url.includes(v.local_path)))
      if (byPath) return byPath
    }
    return list[0]
  }
  if (sb.video_url || sb.local_path) {
    return { video_url: sb.video_url, local_path: sb.local_path }
  }
  return null
}

export function videoRecordUrl(record) {
  if (!record) return ''
  const localPath = record.local_path && String(record.local_path).trim()
  if (localPath) return '/static/' + localPath.replace(/^\//, '')
  if (record.video_url && isHttpVideoUrl(record.video_url)) return record.video_url
  if (record.video_url) {
    const p = String(record.video_url).trim()
    if (p.startsWith('/static/')) return p
    if (!p.startsWith('http')) return '/static/' + p.replace(/^\//, '')
    return p
  }
  return ''
}

export function sbVideoFirstLastUrls(sb, imagesBySbId, useFirstLast) {
  const universal = sb?.creation_mode === 'universal'
  let first = ''
  let last = undefined
  if (!universal) {
    const firstRec = useFirstLast ? resolveSbFirstImageRecord(sb, imagesBySbId) : resolveSbMainImageRecord(sb, imagesBySbId)
    first = imageRecordUrl(firstRec)
  }
  if (useFirstLast && !universal) {
    const lastRec = resolveSbLastImageRecord(sb, imagesBySbId)
    const lu = imageRecordUrl(lastRec)
    if (lu) last = lu
  }
  return { first: first || undefined, last }
}

/** 分镜是否已有可用图片（与列表模式 hasSbImage 逻辑对齐） */
export function hasStoryboardImage(sb, imagesBySbId, drama) {
  if (!sb) return false
  if (dramaUsesFirstLastFrame(drama) && sb.creation_mode !== 'universal') {
    return !!(resolveSbFirstImageRecord(sb, imagesBySbId) || sb.image_url || sb.local_path || sb.composed_image)
  }
  return !!(resolveSbMainImageRecord(sb, imagesBySbId) || sb.image_url || sb.local_path || sb.composed_image)
}

/** 分镜是否已有可用视频 */
export function hasStoryboardVideo(sb, videosBySbId) {
  if (!sb) return false
  const rec = resolveSbVideoRecord(sb, videosBySbId)
  return !!(rec?.video_url || rec?.local_path || sb.video_url)
}
