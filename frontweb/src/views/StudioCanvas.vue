<template>
  <div v-loading="loading" class="studio-canvas">
    <p v-if="loadError" class="studio-error">{{ loadError }}</p>
    <template v-else>
      <header v-if="!loading" class="studio-toolbar">
        <el-button text @click="router.push('/studio')">画布列表</el-button>
        <el-input
          v-model="titleDraft"
          class="studio-title"
          placeholder="画布标题"
          @blur="onTitleBlur"
          @keyup.enter="onTitleBlur"
        />
        <el-select v-model="aspectRatio" class="studio-aspect" @change="onAspectChange">
          <el-option label="9:16" value="9:16" />
          <el-option label="16:9" value="16:9" />
          <el-option label="1:1" value="1:1" />
        </el-select>
        <el-dropdown trigger="click" @command="onAddNode">
          <el-button>添加节点</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in NODE_TYPES"
                :key="item.type"
                :command="item.type"
              >
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </header>
      <div class="studio-flow">
        <VueFlow
          v-if="!loading"
          v-model:nodes="flowNodes"
          :edges="flowEdges"
          :node-types="nodeTypes"
          :delete-key-code="null"
          :edges-updatable="false"
          :fit-view-on-init="flowNodes.length > 0"
          class="studio-vue-flow"
          @connect="onConnect"
          @node-drag-stop="onNodeDragStop"
        >
          <Background pattern-color="#3f3f46" :gap="20" />
          <Controls />
        </VueFlow>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Handle, Position, VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { ElMessage } from 'element-plus'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import { command, get } from '@/api/freeCanvas'
import { documentFromCommandResponse } from '@/utils/freeCanvasReceipt'

const NODE_TYPES = [
  { type: 'text', label: '文本' },
  { type: 'script', label: '剧本' },
  { type: 'character', label: '角色' },
  { type: 'scene', label: '场景' },
  { type: 'prop', label: '道具' },
  { type: 'storyboard', label: '分镜' },
  { type: 'upload', label: '上传图' },
  { type: 'image', label: '图片' },
  { type: 'video', label: '视频' },
  { type: 'audio', label: '配音' },
  { type: 'compose', label: '合成' },
  { type: 'style', label: '风格' },
  { type: 'group', label: '编组' },
]

const TYPE_LABELS = Object.fromEntries(NODE_TYPES.map((item) => [item.type, item.label]))

const MAIN_FIELD = {
  text: 'text',
  style: 'text',
  audio: 'text',
  script: 'title',
  character: 'name',
  scene: 'name',
  prop: 'name',
  storyboard: 'action',
  upload: 'source_file_name',
  image: 'prompt',
  video: 'prompt',
  group: 'title',
}

const RELATION_ORDER = ['prompt_for', 'media_input_for', 'context_for', 'composition_input_for']

// 与后端 freeCanvas document.js 的合法连线一致。同一对类型按 RELATION_ORDER 取第一对。
const LEGAL_PAIRS = [
  ['text', 'prompt_for', 'script'],
  ['text', 'prompt_for', 'storyboard'],
  ['text', 'prompt_for', 'image'],
  ['text', 'prompt_for', 'video'],
  ['style', 'prompt_for', 'script'],
  ['style', 'prompt_for', 'storyboard'],
  ['style', 'prompt_for', 'image'],
  ['style', 'prompt_for', 'video'],
  ['script', 'prompt_for', 'storyboard'],
  ['storyboard', 'prompt_for', 'image'],
  ['storyboard', 'prompt_for', 'video'],
  ['upload', 'media_input_for', 'image'],
  ['upload', 'media_input_for', 'video'],
  ['image', 'media_input_for', 'video'],
  ['character', 'context_for', 'storyboard'],
  ['character', 'context_for', 'image'],
  ['scene', 'context_for', 'storyboard'],
  ['scene', 'context_for', 'image'],
  ['prop', 'context_for', 'storyboard'],
  ['prop', 'context_for', 'image'],
  ['video', 'composition_input_for', 'compose'],
  ['audio', 'composition_input_for', 'compose'],
]

function mainFieldText(type, data) {
  const key = MAIN_FIELD[type]
  if (!key) return ''
  const value = data && data[key]
  if (value == null) return ''
  return String(value)
}

const StudioNode = markRaw(defineComponent({
  name: 'StudioNode',
  inheritAttrs: false,
  props: {
    id: { type: String, default: '' },
    type: { type: String, default: '' },
    data: { type: Object, default: () => ({}) },
  },
  setup(props) {
    return () => {
      const text = mainFieldText(props.type, props.data)
      const children = [
        h(Handle, { type: 'target', position: Position.Left }),
        h('div', { class: 'studio-node-name' }, TYPE_LABELS[props.type] || props.type),
      ]
      if (text) children.push(h('div', { class: 'studio-node-text' }, text))
      children.push(h(Handle, { type: 'source', position: Position.Right }))
      return h('div', { class: 'studio-node' }, children)
    }
  },
}))

const nodeTypes = Object.fromEntries(NODE_TYPES.map((item) => [item.type, StudioNode]))

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const loadError = ref('')
const revision = ref(0)
const title = ref('')
const titleDraft = ref('')
const aspectRatio = ref('9:16')
const confirmedAspect = ref('9:16')
const document = ref({ nodes: [], edges: [] })
const flowNodes = ref([])

const flowEdges = computed(() => (document.value?.edges || []).map((edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
})))

let disposed = false
let dragTimer = null
let chain = Promise.resolve()

function hasRealPosition(node) {
  return !!node && node.position != null
}

function toFlowNode(node) {
  const pos = node.position
  const position = pos != null && pos.x != null && pos.y != null
    ? { x: Number(pos.x), y: Number(pos.y) }
    : { x: 0, y: 0 }
  return {
    id: node.id,
    type: node.type,
    position,
    data: node.data && typeof node.data === 'object' ? { ...node.data } : {},
  }
}

function replaceDocument(nextDoc) {
  const keepLocal = dragTimer != null
  const localPositions = keepLocal
    ? new Map(flowNodes.value.map((node) => [node.id, { x: node.position?.x, y: node.position?.y }]))
    : null
  document.value = nextDoc || { nodes: [], edges: [] }
  const nextFlow = (document.value.nodes || []).map(toFlowNode)
  if (localPositions) {
    for (const node of nextFlow) {
      const saved = (document.value.nodes || []).find((item) => item.id === node.id)
      const local = localPositions.get(node.id)
      if (!local || !saved || !hasRealPosition(saved)) continue
      if (local.x == null || local.y == null) continue
      node.position = { x: local.x, y: local.y }
    }
  }
  flowNodes.value = nextFlow
}

function isCurrentCanvas(id) {
  return !disposed && String(route.params.id) === String(id)
}

function applyCanvas(canvas) {
  if (!canvas || !isCurrentCanvas(canvas.id)) return
  revision.value = canvas.revision
  title.value = canvas.title ?? ''
  titleDraft.value = title.value
  aspectRatio.value = canvas.aspect_ratio || '9:16'
  confirmedAspect.value = aspectRatio.value
  replaceDocument(canvas.document || { nodes: [], edges: [] })
}

function applyPayload(payload, options = {}) {
  if (disposed || !payload) return
  const nextDoc = documentFromCommandResponse(payload)
  if (nextDoc) replaceDocument(nextDoc)
  const canvas = payload.canvas
  if (!canvas) return
  if (canvas.revision != null) revision.value = canvas.revision
  if (canvas.title !== undefined) {
    const draftDirty = titleDraft.value !== title.value
    title.value = canvas.title ?? ''
    if (options.syncTitleDraft || !draftDirty) titleDraft.value = title.value
  }
  if (canvas.aspect_ratio !== undefined) {
    const aspectDirty = aspectRatio.value !== confirmedAspect.value
    confirmedAspect.value = canvas.aspect_ratio
    if (options.syncAspect || !aspectDirty) aspectRatio.value = canvas.aspect_ratio
  }
}

function isStale(error) {
  return String(error?.message || '').includes('画布已被更新')
}

function collectMoves() {
  const saved = new Map((document.value?.nodes || []).map((node) => [node.id, node]))
  const moves = []
  for (const node of flowNodes.value) {
    const original = saved.get(node.id)
    if (!original || !hasRealPosition(original)) continue
    const x = node.position?.x
    const y = node.position?.y
    if (x == null || y == null) continue
    moves.push({ id: node.id, position: { x, y } })
  }
  return moves
}

async function reload() {
  const id = route.params.id
  const canvas = await get(id)
  if (!isCurrentCanvas(id)) return
  applyCanvas(canvas)
}

function runCommand(body, options = {}) {
  const id = route.params.id
  const task = chain.then(async () => {
    if (disposed || route.params.id !== id) return null
    if (!options.skipMoveFlush && dragTimer) {
      clearTimeout(dragTimer)
      dragTimer = null
      const nodes = collectMoves()
      if (nodes.length && isCurrentCanvas(id)) {
        const moved = await command(id, {
          name: 'apply_ops',
          revision: revision.value,
          ops: [{ op: 'move_nodes', nodes }],
        })
        if (isCurrentCanvas(id)) applyPayload(moved)
      }
    }
    if (!isCurrentCanvas(id)) return null
    const payload = await command(id, { ...body, revision: revision.value })
    if (isCurrentCanvas(id)) applyPayload(payload, options)
    return payload
  })
  chain = task.then(() => {}, async (error) => {
    if (!isStale(error) || !isCurrentCanvas(id)) return
    try {
      await reload()
    } catch {
      // 拦截器已提示
    }
  })
  return task
}

function nodeType(id) {
  const node = (document.value?.nodes || []).find((item) => item.id === id)
  return node?.type || ''
}

function matchRelation(sourceType, targetType) {
  for (const relation of RELATION_ORDER) {
    const found = LEGAL_PAIRS.find((pair) => pair[0] === sourceType && pair[1] === relation && pair[2] === targetType)
    if (found) return relation
  }
  return ''
}

function onConnect(connection) {
  const relation = matchRelation(nodeType(connection?.source), nodeType(connection?.target))
  if (!relation) {
    ElMessage.error('这种连线不允许')
    return
  }
  runCommand({
    name: 'apply_ops',
    ops: [{
      op: 'create_edge',
      source: connection.source,
      target: connection.target,
      relation,
    }],
  }).catch(() => {})
}

function onAddNode(type) {
  runCommand({
    name: 'apply_ops',
    ops: [{ op: 'create_node', temp_id: 'n', type }],
  }).catch(() => {})
}

function onTitleBlur() {
  if (titleDraft.value === title.value) return
  const next = titleDraft.value
  runCommand({ name: 'update_canvas', title: next }, { syncTitleDraft: true }).catch((error) => {
    if (!isStale(error) && titleDraft.value === next) titleDraft.value = title.value
  })
}

function onAspectChange(value) {
  if (value === confirmedAspect.value) return
  runCommand({ name: 'update_canvas', aspect_ratio: value }, { syncAspect: true }).catch((error) => {
    if (!isStale(error)) aspectRatio.value = confirmedAspect.value
  })
}

function onNodeDragStop() {
  clearTimeout(dragTimer)
  dragTimer = setTimeout(() => {
    dragTimer = null
    const nodes = collectMoves()
    if (!nodes.length) return
    runCommand({
      name: 'apply_ops',
      ops: [{ op: 'move_nodes', nodes }],
    }, { skipMoveFlush: true }).catch(() => {})
  }, 400)
}

async function load() {
  const id = route.params.id
  clearTimeout(dragTimer)
  dragTimer = null
  loading.value = true
  loadError.value = ''
  try {
    const canvas = await get(id)
    if (!isCurrentCanvas(id)) return
    applyCanvas(canvas)
  } catch (error) {
    if (!isCurrentCanvas(id)) return
    loadError.value = error?.message || '画布加载失败'
  } finally {
    if (isCurrentCanvas(id)) loading.value = false
  }
}

watch(() => route.params.id, (id, prev) => {
  if (id && id !== prev) load()
})

onMounted(load)

onBeforeUnmount(() => {
  disposed = true
  clearTimeout(dragTimer)
  dragTimer = null
})
</script>

<style scoped>
.studio-canvas {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
  color: var(--text-primary);
}
.studio-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color, #27272a);
  background: var(--bg-card, #18181b);
}
.studio-title {
  width: 240px;
}
.studio-aspect {
  width: 110px;
}
.studio-flow {
  flex: 1;
  min-height: 0;
}
.studio-vue-flow {
  width: 100%;
  height: 100%;
  background: var(--bg-page);
}
.studio-error {
  margin: 48px auto;
  color: var(--text-muted, #a1a1aa);
}
</style>

<style>
.studio-node {
  min-width: 148px;
  max-width: 220px;
  padding: 10px 12px;
  border: 1px solid var(--border-muted, #3f3f46);
  border-radius: 10px;
  background: var(--bg-card, #18181b);
  color: var(--text-primary);
  box-shadow: var(--shadow, 0 2px 12px rgba(0, 0, 0, 0.4));
}
.studio-node-name {
  font-size: 12px;
  font-weight: 650;
}
.studio-node-text {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted, #a1a1aa);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.studio-node .vue-flow__handle {
  width: 9px;
  height: 9px;
  background: #6366f1;
  border: 0;
}
</style>
