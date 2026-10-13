import { parseCanvasLayout, resolveNodePosition } from './canvasLayout'
import { getStoryboardGroupMap, parseWorkflowGroups } from './canvasWorkflow'
import { assetImageUrl, storyboardImageUrl, storyboardVideoUrl, audioUrl } from './mediaUrl'
import {
  dramaUsesFirstLastFrame,
  imageRecordUrl,
  resolveSbFirstImageRecord,
  resolveSbLastImageRecord,
  resolveSbMainImageRecord,
  resolveSbVideoRecord,
  videoRecordUrl,
} from './storyboardMedia'

const ASSET_X = 48
const SCRIPT_OFFSET_X = 248
const ASSET_SECTION_GAP = 36
const ASSET_ROW_H = 188
const PIPELINE_X = 360
const EPISODE_ROW_GAP = 48
const SB_GAP_Y = 280
const MEDIA_OFFSET_X = 228
const MEDIA_GAP_X = 188
/** 单行流水线（分镜 + 媒体）大致宽度，用于画布 bounds */
const SB_PIPELINE_WIDTH = MEDIA_OFFSET_X + 5 * MEDIA_GAP_X + 200

const ASSET_EDGE_STYLE = { stroke: '#34d399', strokeWidth: 1.5, strokeDasharray: '6 4' }
const SCRIPT_EDGE_STYLE = { stroke: '#fbbf24', strokeWidth: 2, strokeDasharray: '8 4' }
const PIPELINE_EDGE_STYLE = { stroke: '#818cf8', strokeWidth: 2 }
const CHAIN_EDGE_STYLE = { stroke: '#a78bfa', strokeWidth: 1.5, strokeDasharray: '4 3' }

/** Vue Flow 贝塞尔曲线（curvature 越大弧线越明显） */
function makeEdge(props) {
  return {
    type: 'default',
    pathOptions: { curvature: 0.62 },
    ...props,
  }
}

function truncate(text, max = 72) {
  if (!text) return ''
  const s = String(text).replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) + '…' : s
}

function storyboardSummary(sb) {
  if (sb.creation_mode === 'universal' && sb.universal_segment_text) {
    return truncate(sb.universal_segment_text, 90)
  }
  const parts = [sb.action, sb.dialogue, sb.result].filter(Boolean)
  return truncate(parts.join(' · '), 90) || truncate(sb.description, 90) || '暂无脚本内容'
}

function sectionLabel(id, label, x, y) {
  return {
    id,
    type: 'canvasLabel',
    position: { x, y },
        data: { label },
        selectable: false,
        draggable: false,
        connectable: false,
      }
}

function makeNode(base) {
  const fixed = base.type === 'canvasLabel' || base.type === 'canvasAddButton'
  const draggable = base.draggable ?? !fixed
  return { ...base, draggable }
}

function buildAssetNodes(drama, savedLayout, startY) {
  const nodes = []
  const edges = []
  let y = startY

  const sections = [
    { key: 'characters', label: '👤 角色', hint: '从剧本提取', items: drama.characters || [], kind: 'character', prefix: 'char' },
    { key: 'scenes', label: '🏞 场景', hint: '从剧本提取', items: drama.scenes || [], kind: 'scene', prefix: 'scene' },
    { key: 'props', label: '🎭 道具', hint: '从剧本提取', items: drama.props || [], kind: 'prop', prefix: 'prop' },
  ]

  for (const sec of sections) {
    nodes.push(sectionLabel(`label:${sec.key}`, `${sec.label} ${sec.items.length} · ${sec.hint}`, ASSET_X, y))
    y += 36
    for (const item of sec.items) {
      const id = `${sec.prefix}:${item.id}`
      nodes.push(makeNode({
        id,
        type: 'canvasAsset',
        position: resolveNodePosition(savedLayout, id, { x: ASSET_X, y }),
        data: { kind: sec.kind, entity: item },
      }))
      y += ASSET_ROW_H
    }
    const addId = `add:${sec.kind}`
    nodes.push(makeNode({
      id: addId,
      type: 'canvasAddButton',
      position: resolveNodePosition(savedLayout, addId, { x: ASSET_X, y }),
      data: { assetType: sec.kind, label: '+ 新建' },
      draggable: false,
      selectable: false,
      connectable: false,
    }))
    y += 72 + ASSET_SECTION_GAP
  }

  return { nodes, edges, nextY: y }
}

function universalSegmentText(sb) {
  return (sb?.universal_segment_text || sb?.video_prompt || sb?.description || '').trim()
}

function appendUniversalNode(nodes, edges, ctx) {
  const { savedLayout, sb, sbId, fromId, mediaX, mediaY, uniId } = ctx
  const text = universalSegmentText(sb)
  if (!text) return fromId
  nodes.push(makeNode({
    id: uniId,
    type: 'canvasMedia',
    position: resolveNodePosition(savedLayout, uniId, { x: mediaX, y: mediaY }),
    data: {
      kind: 'universal',
      storyboard: sb,
      summary: text,
    },
  }))
  edges.push(makeEdge({
    id: `e-${fromId}-${uniId}`,
    source: fromId,
    target: uniId,
    style: PIPELINE_EDGE_STYLE,
  }))
  return uniId
}

function appendMediaImageNode(nodes, edges, ctx) {
  const {
    savedLayout, sb, sbId, fromId, mediaX, mediaY, imgId, url, frameKind, frameLabel,
  } = ctx
  if (!url) return fromId
  nodes.push(makeNode({
    id: imgId,
    type: 'canvasMedia',
    position: resolveNodePosition(savedLayout, imgId, { x: mediaX, y: mediaY }),
    data: {
      kind: 'image',
      storyboard: sb,
      url,
      frameKind: frameKind || null,
      frameLabel: frameLabel || null,
    },
  }))
  edges.push(makeEdge({
    id: `e-${fromId}-${imgId}`,
    source: fromId,
    target: imgId,
    style: PIPELINE_EDGE_STYLE,
  }))
  return imgId
}

function buildEpisodePipeline(episode, savedLayout, startY, options = {}) {
  const nodes = []
  const edges = []
  const storyboards = episode.storyboards || []
  const groupMap = options.workflowGroupMap || new Map()
  const imagesBySbId = options.imagesBySbId || {}
  const videosBySbId = options.videosBySbId || {}
  const useFirstLastFrame = options.useFirstLastFrame ?? false

  const epId = `episode:${episode.id}`
  const scriptId = `script:${episode.id}`
  nodes.push(makeNode({
    id: scriptId,
    type: 'canvasScript',
    position: resolveNodePosition(savedLayout, scriptId, { x: PIPELINE_X - SCRIPT_OFFSET_X, y: startY }),
    data: {
      episode,
      summary: truncate(episode.script_content, 96) || '',
    },
  }))
  nodes.push(makeNode({
    id: epId,
    type: 'canvasEpisode',
    position: resolveNodePosition(savedLayout, epId, { x: PIPELINE_X, y: startY }),
    data: { episode },
  }))
  edges.push(makeEdge({
    id: `e-script-${episode.id}-ep`,
    source: scriptId,
    target: epId,
    style: SCRIPT_EDGE_STYLE,
  }))

  const rowYBase = startY + 56
  let prevSbId = null

  storyboards.forEach((sb, index) => {
    const sbId = `sb:${sb.id}`
    const sbX = PIPELINE_X
    const rowY = rowYBase + index * SB_GAP_Y
    const wfGroup = groupMap.get(sb.id)
    nodes.push(makeNode({
      id: sbId,
      type: 'canvasStoryboard',
      position: resolveNodePosition(savedLayout, sbId, { x: sbX, y: rowY }),
      data: {
        storyboard: sb,
        episodeId: episode.id,
        index: index + 1,
        workflowGroup: wfGroup ? { id: wfGroup.id, title: wfGroup.title } : null,
      },
    }))

    let mediaX = sbX + MEDIA_OFFSET_X
    const mediaY = rowY + 8
    const isUniversal = sb.creation_mode === 'universal'
    let pipelineTailId = sbId

    if (isUniversal) {
      const uniId = `sbuni:${sb.id}`
      const nextId = appendUniversalNode(nodes, edges, {
        savedLayout, sb, sbId, fromId: sbId, mediaX, mediaY, uniId,
      })
      if (nextId !== sbId) {
        pipelineTailId = nextId
        mediaX += MEDIA_GAP_X
      }
    } else {
      const txtId = `sbtxt:${sb.id}`
      nodes.push(makeNode({
        id: txtId,
        type: 'canvasMedia',
        position: resolveNodePosition(savedLayout, txtId, { x: mediaX, y: mediaY }),
        data: { kind: 'text', storyboard: sb, summary: storyboardSummary(sb) },
      }))
      edges.push(makeEdge({
        id: `e-${sbId}-${txtId}`,
        source: sbId,
        target: txtId,
        style: PIPELINE_EDGE_STYLE,
        animated: false,
      }))
      mediaX += MEDIA_GAP_X
      pipelineTailId = txtId

      const useFirstLast = useFirstLastFrame

      if (useFirstLast) {
        const firstUrl = imageRecordUrl(resolveSbFirstImageRecord(sb, imagesBySbId))
        if (firstUrl) {
          const imgId = `sbimg-first:${sb.id}`
          pipelineTailId = appendMediaImageNode(nodes, edges, {
            savedLayout, sb, sbId, fromId: pipelineTailId, mediaX, mediaY, imgId, url: firstUrl,
            frameKind: 'first', frameLabel: '首帧',
          })
          mediaX += MEDIA_GAP_X
        }
        const lastUrl = imageRecordUrl(resolveSbLastImageRecord(sb, imagesBySbId))
        if (lastUrl) {
          const imgId = `sbimg-last:${sb.id}`
          pipelineTailId = appendMediaImageNode(nodes, edges, {
            savedLayout, sb, sbId, fromId: pipelineTailId, mediaX, mediaY, imgId, url: lastUrl,
            frameKind: 'last', frameLabel: '尾帧',
          })
          mediaX += MEDIA_GAP_X
        }
      } else {
        const mainUrl = imageRecordUrl(resolveSbMainImageRecord(sb, imagesBySbId)) || storyboardImageUrl(sb)
        if (mainUrl) {
          const imgId = `sbimg:${sb.id}`
          pipelineTailId = appendMediaImageNode(nodes, edges, {
            savedLayout, sb, sbId, fromId: pipelineTailId, mediaX, mediaY, imgId, url: mainUrl,
            frameKind: null, frameLabel: '分镜图',
          })
          mediaX += MEDIA_GAP_X
        }
      }
    }

    const vidUrl = videoRecordUrl(resolveSbVideoRecord(sb, videosBySbId)) || storyboardVideoUrl(sb)
    if (vidUrl) {
      const vidId = `sbvid:${sb.id}`
      nodes.push(makeNode({
        id: vidId,
        type: 'canvasMedia',
        position: resolveNodePosition(savedLayout, vidId, { x: mediaX, y: mediaY }),
        data: { kind: 'video', storyboard: sb, url: vidUrl },
      }))
      edges.push(makeEdge({
        id: `e-${pipelineTailId}-${vidId}`,
        source: pipelineTailId,
        target: vidId,
        style: PIPELINE_EDGE_STYLE,
      }))
      mediaX += MEDIA_GAP_X
    }

    if (sb.audio_local_path) {
      const audId = `sbaud:${sb.id}:dialogue`
      nodes.push(makeNode({
        id: audId,
        type: 'canvasMedia',
        position: resolveNodePosition(savedLayout, audId, { x: mediaX, y: mediaY }),
        data: { kind: 'audio', storyboard: sb, url: audioUrl(sb.audio_local_path), audioType: 'dialogue' },
      }))
      edges.push(makeEdge({
        id: `e-sb-aud-${sb.id}`,
        source: sbId,
        target: audId,
        style: { stroke: '#fbbf24', strokeWidth: 1.5 },
      }))
    }

    const charIds = Array.isArray(sb.characters) ? sb.characters : []
    for (const charId of charIds) {
      const source = `char:${charId}`
      edges.push(makeEdge({
        id: `e-char-${charId}-sb-${sb.id}`,
        source,
        target: sbId,
        style: ASSET_EDGE_STYLE,
      }))
    }

    if (sb.scene_id) {
      edges.push(makeEdge({
        id: `e-scene-${sb.scene_id}-sb-${sb.id}`,
        source: `scene:${sb.scene_id}`,
        target: sbId,
        style: ASSET_EDGE_STYLE,
      }))
    }

    const propIds = Array.isArray(sb.prop_ids) ? sb.prop_ids : []
    for (const propId of propIds) {
      edges.push(makeEdge({
        id: `e-prop-${propId}-sb-${sb.id}`,
        source: `prop:${propId}`,
        target: sbId,
        style: ASSET_EDGE_STYLE,
      }))
    }

    if (prevSbId) {
      edges.push(makeEdge({
        id: `e-chain-${prevSbId}-${sbId}`,
        source: prevSbId,
        target: sbId,
        sourceHandle: 'chain-out',
        targetHandle: 'chain-in',
        style: CHAIN_EDGE_STYLE,
      }))
    }
    prevSbId = sbId
  })

  const addSbId = `add:storyboard:${episode.id}`
  const addY = rowYBase + storyboards.length * SB_GAP_Y
  nodes.push(makeNode({
    id: addSbId,
    type: 'canvasAddButton',
    position: resolveNodePosition(savedLayout, addSbId, { x: PIPELINE_X, y: addY }),
    data: { assetType: 'storyboard', label: '+ 新建分镜', episodeId: episode.id },
    draggable: false,
    selectable: false,
    connectable: false,
  }))

  const rowWidth = SB_PIPELINE_WIDTH
  const nextY = addY + 120 + EPISODE_ROW_GAP
  return { nodes, edges, nextY, rowWidth }
}

/**
 * 将 drama API 数据转为 Vue Flow 图（兼容无 canvas_layout 的旧 JSON）
 * @param {object} drama
 * @param {{ episodeId?: number|null }} options
 */
export function buildDramaCanvasGraph(drama, options = {}) {
  if (!drama) return { nodes: [], edges: [] }

  const savedLayout = options.savedLayout ?? parseCanvasLayout(drama.metadata)
  const workflowGroupMap = options.workflowGroupMap ?? getStoryboardGroupMap(
    options.workflowGroups ?? parseWorkflowGroups(drama.metadata)
  )
  const useFirstLastFrame = options.useFirstLastFrame ?? dramaUsesFirstLastFrame(drama)
  const episodeId = options.episodeId ?? null
  const episodes = episodeId
    ? (drama.episodes || []).filter((ep) => ep.id === episodeId)
    : (drama.episodes || [])

  const nodes = []
  const edges = []

  const headerId = 'drama:header'
  nodes.push(makeNode({
    id: headerId,
    type: 'canvasDramaHeader',
    position: resolveNodePosition(savedLayout, headerId, { x: PIPELINE_X, y: 16 }),
    data: { drama },
  }))

  const assetBlock = buildAssetNodes(drama, savedLayout, 80)
  nodes.push(...assetBlock.nodes)

  let pipelineY = 88
  let maxPipelineX = PIPELINE_X

  for (const ep of episodes) {
    const block = buildEpisodePipeline(ep, savedLayout, pipelineY, {
      ...options,
      workflowGroupMap,
      useFirstLastFrame,
    })
    nodes.push(...block.nodes)
    edges.push(...block.edges)
    pipelineY = block.nextY
    if (block.rowWidth) maxPipelineX = Math.max(maxPipelineX, PIPELINE_X + block.rowWidth)
  }

  if (!episodes.length) {
    nodes.push(sectionLabel('label:empty', '暂无剧集，可点顶栏「+ 集」或右键空白处新建', PIPELINE_X, pipelineY))
  }

  return {
    nodes,
    edges,
    savedLayout,
    bounds: {
      width: Math.max(maxPipelineX + SCRIPT_OFFSET_X + 200, 1200),
      height: Math.max(pipelineY + 80, assetBlock.nextY, 600),
    },
  }
}

export function getStoryboardRefFromNode(node) {
  if (!node?.data?.storyboard) return null
  return {
    storyboardId: node.data.storyboard.id,
    episodeId: node.data.episodeId || node.data.storyboard.episode_id,
  }
}

/** 点击素材时，计算应高亮的节点与连线 */
export function getAssetRelationHighlight(drama, assetNodeId) {
  const nodeIds = new Set([assetNodeId])
  const edgeIds = new Set()
  if (!drama || !assetNodeId) return { nodeIds, edgeIds }

  const [prefix, rawId] = assetNodeId.split(':')
  const entityId = Number(rawId)
  if (!entityId) return { nodeIds, edgeIds }

  for (const ep of drama.episodes || []) {
    for (const sb of ep.storyboards || []) {
      let linked = false
      if (prefix === 'char' && (sb.characters || []).includes(entityId)) linked = true
      if (prefix === 'scene' && sb.scene_id === entityId) linked = true
      if (prefix === 'prop' && (sb.prop_ids || []).includes(entityId)) linked = true
      if (!linked) continue

      const sbId = `sb:${sb.id}`
      nodeIds.add(sbId)
      nodeIds.add(`sbtxt:${sb.id}`)
      nodeIds.add(`sbuni:${sb.id}`)
      nodeIds.add(`sbimg:${sb.id}`)
      nodeIds.add(`sbimg-first:${sb.id}`)
      nodeIds.add(`sbimg-last:${sb.id}`)
      if (storyboardVideoUrl(sb)) nodeIds.add(`sbvid:${sb.id}`)
      if (sb.audio_local_path) nodeIds.add(`sbaud:${sb.id}:dialogue`)

      if (prefix === 'char') edgeIds.add(`e-char-${entityId}-sb-${sb.id}`)
      if (prefix === 'scene') edgeIds.add(`e-scene-${entityId}-sb-${sb.id}`)
      if (prefix === 'prop') {
        edgeIds.add(`e-prop-${entityId}-sb-${sb.id}`)
      }
    }
  }
  return { nodeIds, edgeIds }
}

export function applyCanvasHighlight(nodes, edges, highlightNodeId, drama) {
  if (!highlightNodeId) {
    return {
      nodes: nodes.map((n) => ({ ...n, class: undefined, data: { ...n.data, dimmed: false, highlighted: false } })),
      edges: edges.map((e) => ({
        ...e,
        animated: false,
        style: e._baseStyle || e.style,
      })),
    }
  }

  const { nodeIds, edgeIds } = getAssetRelationHighlight(drama, highlightNodeId)
  return {
    nodes: nodes.map((n) => {
      const highlighted = nodeIds.has(n.id)
      const dimmed = !highlighted
      return {
        ...n,
        class: highlighted ? 'canvas-node-highlight' : 'canvas-node-dim',
        data: { ...n.data, highlighted, dimmed },
      }
    }),
    edges: edges.map((e) => {
      const baseStyle = e._baseStyle || e.style
      const highlighted = edgeIds.has(e.id)
      return {
        ...e,
        _baseStyle: baseStyle,
        animated: highlighted,
        style: highlighted
          ? { ...baseStyle, stroke: '#34d399', strokeWidth: 2.5, opacity: 1 }
          : { ...baseStyle, opacity: 0.15 },
      }
    }),
  }
}

/** 为边附加 _baseStyle 便于高亮恢复 */
export function stampEdgeBaseStyles(edges) {
  return edges.map((e) => ({ ...e, _baseStyle: e.style ? { ...e.style } : undefined }))
}

/**
 * 按默认网格规则计算全部节点坐标（忽略已保存的手动位置）
 * @returns {{ positions: Record<string, {x:number,y:number}>, bounds: object }}
 */
export function computeAutoLayoutPositions(drama, options = {}) {
  const emptyLayout = { version: 1, nodes: {} }
  const graph = buildDramaCanvasGraph(drama, {
    ...options,
    savedLayout: emptyLayout,
  })
  const positions = {}
  for (const node of graph.nodes) {
    if (node?.id && node.position) {
      positions[node.id] = { x: node.position.x, y: node.position.y }
    }
  }
  return { positions, bounds: graph.bounds }
}
