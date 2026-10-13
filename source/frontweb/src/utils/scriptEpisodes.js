/**
 * 从剧本文本中按行首「第…集 / 章 / 节」拆分为多集（与小说导入规则一致，且支持同集标题后紧跟正文）。
 * @param {string} text
 * @returns {{ split: boolean, episodes: Array<{ title: string, script_content: string }> }}
 */
export function parseScriptIntoEpisodes(text) {
  const raw = (text ?? '').toString()
  const trimmedAll = raw.trim()
  if (!trimmedAll) {
    return { split: false, episodes: [] }
  }

  const markerRe =
    /^(第\s*(?:[零一二三四五六七八九十百千]|\d|[\uFF10-\uFF19])+\s*(?:集|章|节))\s*(.*)$/

  /** 行首各类括号包住「第…集/章/节」时，先展平成「第一集 …」再匹配 markerRe */
  const TITLE_IN_EP =
    '第\\s*(?:[零一二三四五六七八九十百千]|\\d|[\\uFF10-\\uFF19])+\\s*(?:集|章|节)'
  const EP_LINE_UNWRAPPERS = [
    new RegExp(`^【\\s*(${TITLE_IN_EP})(?:\\s*】\\s*|\\s{1,})(.*)$`),
    new RegExp(`^《\\s*(${TITLE_IN_EP})(?:\\s*》\\s*|\\s{1,})(.*)$`),
    new RegExp(`^<\\s*(${TITLE_IN_EP})(?:\\s*>\\s*|\\s{1,})(.*)$`),
    new RegExp(`^＜\\s*(${TITLE_IN_EP})(?:\\s*＞\\s*|\\s{1,})(.*)$`),
    // ASCII [ … ] / [ … 】 / [ … 正文
    new RegExp(`^\\[\\s*(${TITLE_IN_EP})(?:\\s*\\]\\s*|\\s*】\\s*|\\s{1,})(.*)$`),
    new RegExp(`^［\\s*(${TITLE_IN_EP})(?:\\s*］\\s*|\\s{1,})(.*)$`),
  ]

  function normalizeLineForEpisodeMarkers(trimmedLine) {
    const t = trimmedLine
    if (!t) return t
    for (const re of EP_LINE_UNWRAPPERS) {
      const um = re.exec(t)
      if (um) {
        const titlePart = (um[1] || '').trim()
        const bodyPart = (um[2] ?? '').trim()
        return bodyPart ? `${titlePart} ${bodyPart}` : titlePart
      }
    }
    return t
  }

  const lines = raw.split(/\r?\n/)
  const segments = []
  let preamble = []
  let current = null

  function flush() {
    if (!current) return
    const script_content = current.lines.join('\n').replace(/\s+$/, '')
    segments.push({ title: current.title, script_content })
    current = null
  }

  for (const line of lines) {
    const t = normalizeLineForEpisodeMarkers(line.trim())
    const m = t.match(markerRe)
    if (m) {
      if (current) flush()
      current = { title: m[1], lines: preamble.length ? [...preamble] : [] }
      preamble = []
      const tail = m[2] ?? ''
      if (tail.length) current.lines.push(tail)
    } else if (!current) {
      preamble.push(line)
    } else {
      current.lines.push(line)
    }
  }
  flush()

  if (segments.length === 0) {
    return { split: false, episodes: [{ title: '', script_content: trimmedAll }] }
  }

  const split = segments.length >= 2
  return { split, episodes: segments }
}

/**
 * 将分集列表拼成纯文本（每集「标题」与正文分行），便于再次保存时按行首标题拆分。
 * @param {Array<{ title: string, script_content?: string }>} episodes
 */
export function episodesListToPlainScript(episodes) {
  if (!episodes?.length) return ''
  return episodes
    .map((e) => {
      const t = (e.title || '').trim()
      const body = (e.script_content ?? '').toString().replace(/\s+$/, '')
      return body ? `${t}\n${body}` : t
    })
    .filter(Boolean)
    .join('\n\n')
}
