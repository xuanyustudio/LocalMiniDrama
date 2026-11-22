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
        <el-button type="danger" plain :disabled="!canDeleteSelected()" @click="onDelete">
          删除节点
        </el-button>
      </header>
      <div v-if="pendingNodes.length" class="studio-confirm">
        <span>{{ pendingSummary }}</span>
        <el-button type="primary" :loading="confirmBusy" :disabled="confirmBusy" @click="onConfirm(true)">允许</el-button>
        <el-button :loading="confirmBusy" :disabled="confirmBusy" @click="onConfirm(false)">拒绝</el-button>
      </div>
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
          @node-click="onNodeClick"
          @pane-click="selectedId = ''"
          @node-drag-start="onNodeDragStart"
          @node-drag="onNodeDrag"
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
import { computed, defineComponent, h, inject, markRaw, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Handle, Position, VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { ElButton, ElInput, ElMessage, ElSelect, ElOption } from 'element-plus'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import { command, confirmRun, get, upload } from '@/api/freeCanvas'
import { aiAPI } from '@/api/ai'
import { documentFromCommandResponse, pendingConfirmNodes } from '@/utils/freeCanvasReceipt'

const STUDIO_NODE_KEY = 'studio-node-controls'

const NODE_MODEL_SERVICES = {
  text: ['text'],
  script: ['text'],
  storyboard: ['text'],
  character: ['image', 'storyboard_image'],
  scene: ['image', 'storyboard_image'],
  prop: ['image', 'storyboard_image'],
  image: ['image', 'storyboard_image'],
  video: ['video'],
  audio: ['tts'],
}

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

const NODE_FIELDS = {
  text: [{ key: 'text', label: '文本', kind: 'area' }],
  script: [
    { key: 'title', label: '标题', kind: 'text' },
    { key: 'premise', label: '前提', kind: 'area' },
    { key: 'text', label: '正文', kind: 'area' },
  ],
  character: [
    { key: 'name', label: '名字', kind: 'text' },
    { key: 'prompt', label: '形象', kind: 'area' },
  ],
  scene: [
    { key: 'name', label: '名字', kind: 'text' },
    { key: 'prompt', label: '场景', kind: 'area' },
  ],
  prop: [
    { key: 'name', label: '名字', kind: 'text' },
    { key: 'prompt', label: '道具', kind: 'area' },
  ],
  storyboard: [
    { key: 'shot_number', label: '镜号', kind: 'text' },
    { key: 'action', label: '动作', kind: 'area' },
    { key: 'dialogue', label: '台词', kind: 'area' },
    { key: 'prompt', label: '提示词', kind: 'area' },
    { key: 'duration', label: '时长', kind: 'duration' },
  ],
  image: [{ key: 'prompt', label: '提示词', kind: 'area' }],
  video: [
    { key: 'prompt', label: '提示词', kind: 'area' },
    { key: 'duration', label: '时长', kind: 'duration' },
  ],
  audio: [
    { key: 'text', label: '台词', kind: 'area' },
    { key: 'voice_id', label: '音色', kind: 'text' },
  ],
  style: [{ key: 'text', label: '风格', kind: 'area' }],
  group: [{ key: 'title', label: '标题', kind: 'text' }],
}

const NODE_ACTIONS = {
  script: [
    { action: 'generate_text', label: '生成正文' },
    { action: 'split_storyboards', label: '拆成分镜' },
  ],
  storyboard: [{ action: 'generate_text', label: '生成这一镜' }],
  character: [{ action: 'generate_image', label: '生成形象' }],
  scene: [{ action: 'generate_image', label: '生成场景图' }],
  prop: [{ action: 'generate_image', label: '生成道具图' }],
  image: [{ action: 'generate_image', label: '生成图片' }],
  video: [{ action: 'generate_video', label: '生成视频' }],
  audio: [{ action: 'generate_audio', label: '生成配音' }],
}

const STATUS_TEXT = {
  awaiting_confirm: '等待确认',
  running: '生成中',
  succeeded: '已完成',
  failed: '失败',
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

function fieldsOf(type) {
  return NODE_FIELDS[type] || []
}

function actionsOf(type) {
  return NODE_ACTIONS[type] || []
}

function mediaUrl(source, key) {
  const value = source?.data?.[key] ?? source?.[key]
  return typeof value === 'string' && value ? value : ''
}

function flattenModels(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return flattenModels(parsed)
    } catch (_) {}
    return raw.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function modelOptionsForType(type, configs) {
  const services = NODE_MODEL_SERVICES[type]
  if (!services) return []
  const options = []
  const seen = new Set()
  for (const cfg of configs || []) {
    if (!cfg || cfg.is_active === false) continue
    if (!services.includes(cfg.service_type)) continue
    const models = flattenModels(cfg.model)
    const preferred = cfg.default_model ? String(cfg.default_model) : ''
    for (const model of models) {
      if (seen.has(model)) continue
      seen.add(model)
      options.push({
        value: model,
        label: `${model}（${cfg.name || cfg.service_type}）`,
        isDefault: Boolean(cfg.is_default && (!preferred || preferred === model)),
      })
    }
    if (preferred && !seen.has(preferred)) {
      seen.add(preferred)
      options.push({
        value: preferred,
        label: `${preferred}（${cfg.name || cfg.service_type}）`,
        isDefault: Boolean(cfg.is_default),
      })
    }
  }
  return options
}

function defaultModelValue(options, current) {
  if (current && options.some((item) => item.value === current)) return current
  const preferred = options.find((item) => item.isDefault)
  return preferred?.value || options[0]?.value || ''
}

const StudioNode = markRaw(defineComponent({
  name: 'StudioNode',
  inheritAttrs: false,
  props: {
    id: { type: String, default: '' },
    type: { type: String, default: '' },
    data: { type: Object, default: () => ({}) },
    selected: { type: Boolean, default: false },
  },
  setup(props) {
    const controls = inject(STUDIO_NODE_KEY, null)
    const isSelected = computed(() => Boolean(props.selected || (controls && controls.selectedId.value === props.id)))
    return () => {
      const selected = isSelected.value
      const drafts = controls?.fieldDrafts.value || {}
      const status = props.data?.__status || ''
      const error = props.data?.__error || ''
      const children = [
        h(Handle, { type: 'target', position: Position.Left }),
        h('div', { class: 'studio-node-name' }, TYPE_LABELS[props.type] || props.type),
      ]
      if (status && STATUS_TEXT[status]) {
        children.push(h('div', {
          class: {
            'studio-node-status': true,
            'is-busy': status === 'running' || status === 'awaiting_confirm',
          },
        }, [
          (status === 'running' || status === 'awaiting_confirm') ? h('span', { class: 'studio-node-spinner' }) : null,
          STATUS_TEXT[status],
        ]))
      }
      if (error) children.push(h('div', { class: 'studio-node-error' }, error))
      const preview = mainFieldText(props.type, props.data)
      if (!selected && preview) children.push(h('div', { class: 'studio-node-text' }, preview))
      const imageSrc = mediaUrl(props.data, 'image_url')
      const videoSrc = mediaUrl(props.data, 'video_url')
      if (imageSrc) children.push(h('img', { class: 'studio-node-media', src: imageSrc, alt: '' }))
      if (videoSrc) children.push(h('video', { class: 'studio-node-media', src: videoSrc, controls: true }))
      const refMedia = controls?.upstreamMedia?.(props.id) || null
      const refSrc = refMedia ? mediaUrl(refMedia, 'image_url') : ''
      if (!selected && props.type === 'video' && refSrc) {
        children.push(h('div', { class: 'studio-node-ref' }, [
          h('span', '参考图'),
          h('img', { class: 'studio-node-ref-img', src: refSrc, alt: '' }),
        ]))
      }
      if (selected && controls) {
        const panel = []
        const busy = controls.busyKey.value || ''
        const nodeBusy = status === 'running'
        const panelLocked = nodeBusy || status === 'awaiting_confirm' || Boolean(busy)
        if (props.type === 'video') {
          panel.push(h('div', { class: 'studio-node-ref-block nodrag nowheel' }, [
            h('span', '参考图（上游图片）'),
            refSrc
              ? h('img', { class: 'studio-node-ref-img', src: refSrc, alt: '' })
              : h('div', { class: 'studio-node-ref-empty' }, '请从图片/上传节点连到本节点'),
          ]))
        }
        for (const field of fieldsOf(props.type)) {
          const input = field.kind === 'duration'
            ? h(ElSelect, {
              modelValue: drafts[field.key],
              'onUpdate:modelValue': (value) => {
                controls.fieldDrafts.value = { ...controls.fieldDrafts.value, [field.key]: value }
              },
              size: 'small',
              teleported: false,
              disabled: panelLocked,
              class: 'nodrag nowheel',
            }, () => [3, 5, 8, 10].map((seconds) => h(ElOption, {
              key: seconds,
              label: `${seconds} 秒`,
              value: String(seconds),
            })))
            : h(ElInput, {
              modelValue: drafts[field.key],
              'onUpdate:modelValue': (value) => {
                controls.fieldDrafts.value = { ...controls.fieldDrafts.value, [field.key]: value }
              },
              type: field.kind === 'area' ? 'textarea' : 'text',
              rows: field.key === 'text' || field.key === 'premise' ? 4 : 2,
              size: 'small',
              disabled: panelLocked,
              class: 'nodrag nowheel',
              onFocus: () => { controls.focusedField.value = field.key },
            })
          panel.push(h('label', { class: 'studio-node-field nodrag nowheel', key: field.key }, [
            h('span', field.label),
            input,
          ]))
        }
        if (props.type === 'upload') {
          panel.push(h('label', { class: 'studio-node-field nodrag nowheel' }, [
            h('span', '上传图片'),
            h('input', {
              type: 'file',
              accept: 'image/*',
              class: 'nodrag nowheel',
              disabled: panelLocked,
              onChange: controls.onUploadFile,
            }),
          ]))
        }
        const modelOptions = modelOptionsForType(props.type, controls.aiConfigs.value)
        if (modelOptions.length) {
          const modelValue = defaultModelValue(modelOptions, controls.modelDraft.value || props.data?.model)
          panel.push(h('label', { class: 'studio-node-field nodrag nowheel' }, [
            h('span', '模型'),
            h(ElSelect, {
              modelValue,
              'onUpdate:modelValue': (value) => { controls.modelDraft.value = value },
              size: 'small',
              teleported: false,
              disabled: panelLocked,
              class: 'nodrag nowheel studio-node-model',
              placeholder: '选择模型',
            }, () => modelOptions.map((item) => h(ElOption, {
              key: item.value,
              label: item.label,
              value: item.value,
            }))),
          ]))
        }
        const acts = actionsOf(props.type)
        const sendLoading = busy === `${props.id}:send`
        const anyActionLoading = acts.some((item) => busy === `${props.id}:${item.action}`) || nodeBusy
        if (acts.length) {
          panel.push(h('label', { class: 'studio-node-field nodrag nowheel' }, [
            h('span', '补充说明'),
            h(ElInput, {
              modelValue: controls.instructionDraft.value,
              'onUpdate:modelValue': (value) => { controls.instructionDraft.value = value },
              type: 'textarea',
              rows: 2,
              size: 'small',
              placeholder: '可留空',
              disabled: panelLocked,
              class: 'nodrag nowheel',
            }),
          ]))
        }
        const pendingAction = props.data?.pending_action || ''
        const deleteLoading = busy === `${props.id}:delete`
        const buttons = [
          h(ElButton, {
            type: 'primary',
            size: 'small',
            loading: sendLoading,
            disabled: panelLocked,
            onClick: (event) => {
              event.stopPropagation()
              controls.onSend()
            },
          }, () => (sendLoading ? '保存中' : '保存')),
          ...acts.map((item) => {
            const actionLoading = busy === `${props.id}:${item.action}`
              || (nodeBusy && (!pendingAction || pendingAction === item.action))
            return h(ElButton, {
              key: item.action,
              type: 'primary',
              plain: true,
              size: 'small',
              loading: actionLoading,
              disabled: panelLocked,
              onClick: (event) => {
                event.stopPropagation()
                controls.onRun(item.action)
              },
            }, () => (actionLoading ? '生成中' : item.label))
          }),
          h(ElButton, {
            type: 'danger',
            plain: true,
            size: 'small',
            loading: deleteLoading,
            disabled: panelLocked,
            onClick: (event) => {
              event.stopPropagation()
              controls.onDelete()
            },
          }, () => (deleteLoading ? '删除中' : '删除')),
        ]
        panel.push(h('div', { class: 'studio-node-actions nodrag nowheel' }, buttons))
        children.push(h('div', { class: 'studio-node-panel nodrag nowheel' }, panel))
      }
      children.push(h(Handle, { type: 'source', position: Position.Right }))
      return h('div', {
        class: {
          'studio-node': true,
          'is-selected': selected,
          'is-wide': selected,
        },
      }, children)
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
const selectedId = ref('')
const fieldDrafts = ref({})
const focusedField = ref('')
const instructionDraft = ref('')
const modelDraft = ref('')
const aiConfigs = ref([])
const busyKey = ref('')
const confirmBusy = ref(false)
let pollTimer = null

const selected = computed(() => (
  (document.value?.nodes || []).find((node) => node.id === selectedId.value) || null
))
const pendingNodes = computed(() => pendingConfirmNodes(document.value?.nodes))
const pendingSummary = computed(() => {
  const action = pendingNodes.value[0]?.data?.pending_action
  const label = { generate_image: '出图', generate_video: '出视频', generate_audio: '配音' }[action] || '生成'
  return `将为 ${pendingNodes.value.length} 个节点${label}`
})

function syncDrafts(node) {
  if (!node) {
    fieldDrafts.value = {}
    modelDraft.value = ''
    return
  }
  const data = node.data || {}
  const next = {}
  for (const field of fieldsOf(node.type)) {
    if (focusedField.value === field.key && fieldDrafts.value[field.key] != null) {
      next[field.key] = fieldDrafts.value[field.key]
    } else {
      const value = data[field.key]
      next[field.key] = value == null ? '' : String(value)
    }
  }
  fieldDrafts.value = next
  const options = modelOptionsForType(node.type, aiConfigs.value)
  modelDraft.value = defaultModelValue(options, data.model || modelDraft.value)
}

function onNodeClick(payload) {
  const node = payload?.node || payload
  if (node?.id) selectedId.value = node.id
}

const flowEdges = computed(() => (document.value?.edges || []).map((edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  label: edge.relation === 'media_input_for' ? '参考图' : undefined,
  labelStyle: edge.relation === 'media_input_for' ? { fill: '#a5b4fc', fontSize: 11 } : undefined,
  labelBgStyle: edge.relation === 'media_input_for' ? { fill: '#18181b' } : undefined,
})))

let disposed = false
let dragTimer = null
let chain = Promise.resolve()
// 指针还按着的坐标，以及松手后文档尚未确认的坐标。未拖过的 (0, 0) 占位不进这里。
const draggingPositions = new Map()
const pendingPositions = new Map()

function hasRealPosition(node) {
  return !!node && node.position != null
}

function copyPosition(position) {
  if (!position || position.x == null || position.y == null) return null
  return { x: Number(position.x), y: Number(position.y) }
}

function savedPosition(node) {
  if (!hasRealPosition(node)) return null
  return copyPosition(node.position)
}

function samePosition(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y
}

function dragNodesFrom(payload) {
  if (!payload) return []
  if (Array.isArray(payload.nodes) && payload.nodes.length) return payload.nodes
  if (payload.node && payload.node.id != null) return [payload.node]
  if (payload.id != null && payload.position) return [payload]
  return []
}

function rememberDrag(payload) {
  if (loading.value || disposed) return
  for (const node of dragNodesFrom(payload)) {
    if (node?.id == null) continue
    const pos = copyPosition(node.position)
    if (!pos) continue
    draggingPositions.set(node.id, pos)
  }
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
    selected: node.id === selectedId.value,
    data: {
      ...(node.data && typeof node.data === 'object' ? node.data : {}),
      __status: node.status || '',
      __error: node.error || '',
    },
  }
}

function replaceDocument(nextDoc) {
  const next = nextDoc || { nodes: [], edges: [] }
  document.value = next
  const savedById = new Map((next.nodes || []).map((node) => [node.id, node]))
  for (const [id, pos] of pendingPositions) {
    if (draggingPositions.has(id)) continue
    const saved = savedPosition(savedById.get(id))
    if (saved && samePosition(saved, pos)) pendingPositions.delete(id)
  }
  const nextFlow = (next.nodes || []).map(toFlowNode)
  for (const node of nextFlow) {
    const live = draggingPositions.get(node.id)
    if (live) {
      node.position = { x: live.x, y: live.y }
      continue
    }
    const pending = pendingPositions.get(node.id)
    if (!pending) continue
    const saved = savedPosition(savedById.get(node.id))
    if (saved && samePosition(saved, pending)) continue
    node.position = { x: pending.x, y: pending.y }
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

function latestDraggedPosition(id, savedNode) {
  const dragged = draggingPositions.get(id) || pendingPositions.get(id)
  if (dragged) return { x: dragged.x, y: dragged.y }
  if (!hasRealPosition(savedNode)) return null
  const flow = flowNodes.value.find((node) => node.id === id)
  const flowPos = copyPosition(flow?.position)
  if (flowPos) return flowPos
  return savedPosition(savedNode)
}

function collectMoves() {
  const savedNodes = document.value?.nodes || []
  const moves = []
  const seen = new Set()
  for (const node of savedNodes) {
    if (seen.has(node.id)) continue
    const dragged = draggingPositions.has(node.id) || pendingPositions.has(node.id)
    if (!hasRealPosition(node) && !dragged) continue
    seen.add(node.id)
    const pos = latestDraggedPosition(node.id, node)
    if (!pos) continue
    moves.push({ id: node.id, position: { x: pos.x, y: pos.y } })
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
  const before = new Set((document.value?.nodes || []).map((node) => node.id))
  runCommand({
    name: 'apply_ops',
    ops: [{ op: 'create_node', temp_id: 'n', type }],
  }).then((payload) => {
    const doc = documentFromCommandResponse(payload)
    const created = doc?.nodes?.find((node) => !before.has(node.id))
    if (created) selectedId.value = created.id
  }).catch(() => {})
}

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .el-input, .el-textarea, .el-select'))
}

function canDeleteSelected() {
  const node = selected.value
  if (!node || busyKey.value || confirmBusy.value) return false
  if (node.status === 'running' || node.status === 'awaiting_confirm') return false
  return true
}

function onDelete() {
  const node = selected.value
  if (!node || !canDeleteSelected()) return
  const key = `${node.id}:delete`
  const id = node.id
  busyKey.value = key
  runCommand({
    name: 'delete_nodes',
    node_ids: [id],
    approved: true,
  }).then(() => {
    if (selectedId.value === id) selectedId.value = ''
    ElMessage.success('已删除')
  }).catch(() => {}).finally(() => {
    if (busyKey.value === key) busyKey.value = ''
  })
}

function onCanvasKeydown(event) {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  if (isEditableTarget(event.target)) return
  if (!canDeleteSelected()) return
  event.preventDefault()
  onDelete()
}

function fieldValue(field, raw) {
  if (field.kind === 'duration') return Number(raw)
  if (field.key === 'shot_number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  return raw
}

function collectFieldPatch(node) {
  const patch = {}
  for (const field of fieldsOf(node.type)) {
    const next = fieldValue(field, fieldDrafts.value[field.key])
    const current = node.data?.[field.key]
    if (next === current || String(next ?? '') === String(current ?? '')) continue
    patch[field.key] = next
  }
  const options = modelOptionsForType(node.type, aiConfigs.value)
  if (options.length) {
    const model = defaultModelValue(options, modelDraft.value || node.data?.model)
    if (model && model !== (node.data?.model || '')) patch.model = model
    modelDraft.value = model
  }
  return patch
}

function onSend() {
  const node = selected.value
  if (!node || busyKey.value) return
  focusedField.value = ''
  const patch = collectFieldPatch(node)
  if (!Object.keys(patch).length) {
    ElMessage.success('已是最新内容')
    return
  }
  const key = `${node.id}:send`
  busyKey.value = key
  runCommand({
    name: 'update_node',
    id: node.id,
    data: patch,
  }).then(() => {
    ElMessage.success('已保存')
  }).catch(() => {}).finally(() => {
    if (busyKey.value === key) busyKey.value = ''
  })
}

function upstreamMedia(nodeId) {
  const edges = document.value?.edges || []
  for (const edge of edges) {
    if (edge.target !== nodeId || edge.relation !== 'media_input_for') continue
    const source = (document.value?.nodes || []).find((item) => item.id === edge.source)
    if (source && (source.type === 'image' || source.type === 'upload')) return source
  }
  return null
}

function onRun(action) {
  const node = selected.value
  if (!node || busyKey.value) return
  if (action === 'generate_video' && !upstreamMedia(node.id)) {
    ElMessage.warning('请先把图片或上传节点连到本视频节点作为参考图')
    return
  }
  focusedField.value = ''
  const patch = collectFieldPatch(node)
  const model = modelDraft.value || node.data?.model || undefined
  const key = `${node.id}:${action}`
  busyKey.value = key
  const start = Object.keys(patch).length
    ? runCommand({ name: 'update_node', id: node.id, data: patch })
    : Promise.resolve()
  start.then(() => runCommand({
    name: 'run_node',
    node_ids: [node.id],
    action,
    instruction: instructionDraft.value,
    ...(model ? { model } : {}),
  })).catch(() => {}).finally(() => {
    // 异步生成会进入 running，由节点状态继续显示转圈；同步结束则立刻清掉。
    const current = (document.value?.nodes || []).find((item) => item.id === node.id)
    if (busyKey.value === key && current?.status !== 'running') busyKey.value = ''
  })
}

function onConfirm(approved) {
  if (confirmBusy.value) return
  const id = route.params.id
  confirmBusy.value = true
  confirmRun(id, approved, revision.value).then((payload) => {
    if (isCurrentCanvas(id)) applyPayload(payload)
  }).catch((error) => {
    if (isStale(error)) reload().catch(() => {})
  }).finally(() => {
    confirmBusy.value = false
  })
}

async function onUploadFile(event) {
  const file = event.target.files && event.target.files[0]
  event.target.value = ''
  const node = selected.value
  if (!file || !node) return
  try {
    const payload = await upload(route.params.id, node.id, revision.value, file)
    applyPayload(payload)
  } catch (error) {
    if (isStale(error)) reload().catch(() => {})
  }
}

provide(STUDIO_NODE_KEY, {
  selectedId,
  fieldDrafts,
  focusedField,
  instructionDraft,
  modelDraft,
  aiConfigs,
  busyKey,
  upstreamMedia,
  onSend,
  onRun,
  onDelete,
  onUploadFile,
})

function syncPoll() {
  const runningNodes = (document.value?.nodes || []).filter((node) => node.status === 'running')
  if (runningNodes.length && !pollTimer) {
    pollTimer = setInterval(() => {
      reload().catch(() => {})
    }, 3000)
  }
  if (!runningNodes.length && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (busyKey.value) {
    const [nodeId, action] = busyKey.value.split(':')
    if (action === 'send' || action === 'delete') return
    const current = (document.value?.nodes || []).find((node) => node.id === nodeId)
    if (!current || current.status === 'succeeded' || current.status === 'failed' || current.status === 'idle') {
      busyKey.value = ''
    }
  }
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

function scheduleMove() {
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

function onNodeDragStart(payload) {
  if (loading.value || disposed) return
  clearTimeout(dragTimer)
  dragTimer = null
  rememberDrag(payload)
}

function onNodeDrag(payload) {
  rememberDrag(payload)
}

function onNodeDragStop(payload) {
  if (loading.value || disposed) {
    draggingPositions.clear()
    return
  }
  for (const node of dragNodesFrom(payload)) {
    if (node?.id == null) continue
    const pos = copyPosition(node.position) || draggingPositions.get(node.id)
    if (pos) pendingPositions.set(node.id, { x: pos.x, y: pos.y })
  }
  for (const [id, pos] of draggingPositions) {
    if (!pendingPositions.has(id)) pendingPositions.set(id, { x: pos.x, y: pos.y })
  }
  draggingPositions.clear()
  scheduleMove()
}

function clearDragTracking() {
  clearTimeout(dragTimer)
  dragTimer = null
  draggingPositions.clear()
  pendingPositions.clear()
}

async function load() {
  const id = route.params.id
  clearDragTracking()
  loading.value = true
  loadError.value = ''
  try {
    const canvas = await get(id)
    if (!isCurrentCanvas(id)) return
    clearDragTracking()
    applyCanvas(canvas)
  } catch (error) {
    if (!isCurrentCanvas(id)) return
    loadError.value = error?.message || '画布加载失败'
  } finally {
    if (isCurrentCanvas(id)) loading.value = false
  }
}

watch(() => route.params.id, (id, prev) => {
  if (id && id !== prev) {
    selectedId.value = ''
    load()
  }
})

async function loadAiConfigs() {
  try {
    const rows = await aiAPI.list()
    aiConfigs.value = Array.isArray(rows) ? rows : []
  } catch {
    aiConfigs.value = []
  }
}

watch(selected, (node) => {
  instructionDraft.value = ''
  focusedField.value = ''
  syncDrafts(node)
})

watch(selectedId, () => {
  flowNodes.value = (document.value?.nodes || []).map(toFlowNode)
})

watch(document, () => {
  syncPoll()
}, { deep: true })

onMounted(() => {
  window.addEventListener('keydown', onCanvasKeydown)
  loadAiConfigs()
  load()
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('keydown', onCanvasKeydown)
  clearDragTracking()
  clearInterval(pollTimer)
  pollTimer = null
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
.studio-confirm {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #312e81;
  color: #e0e7ff;
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
  min-width: 160px;
  max-width: 220px;
  padding: 10px 12px;
  border: 1px solid var(--border-muted, #3f3f46);
  border-radius: 10px;
  background: var(--bg-card, #18181b);
  color: var(--text-primary);
  box-shadow: var(--shadow, 0 2px 12px rgba(0, 0, 0, 0.4));
}
.studio-node.is-wide {
  min-width: 280px;
  max-width: 320px;
}
.studio-node.is-selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.45), 0 8px 24px rgba(0, 0, 0, 0.35);
  z-index: 5;
}
.studio-node-name {
  font-size: 12px;
  font-weight: 650;
}
.studio-node-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 11px;
  color: #a5b4fc;
}
.studio-node-status.is-busy {
  color: #c4b5fd;
}
.studio-node-spinner {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(196, 181, 253, 0.35);
  border-top-color: #c4b5fd;
  border-radius: 50%;
  animation: studio-spin 0.8s linear infinite;
}
@keyframes studio-spin {
  to { transform: rotate(360deg); }
}
.studio-node-error {
  margin-top: 4px;
  font-size: 11px;
  color: #f87171;
  word-break: break-word;
}
.studio-node-ref,
.studio-node-ref-block {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  color: #a5b4fc;
}
.studio-node-ref-img {
  width: 100%;
  max-height: 96px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #3f3f46;
}
.studio-node-ref-empty {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px dashed #52525b;
  color: #a1a1aa;
  line-height: 1.4;
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
.studio-node-media {
  display: block;
  width: 100%;
  margin-top: 8px;
  border-radius: 8px;
}
.studio-node-panel {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-muted, #3f3f46);
}
.studio-node-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--text-muted, #a1a1aa);
}
.studio-node-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.studio-node-model {
  width: 100%;
}
.studio-node .vue-flow__handle {
  width: 9px;
  height: 9px;
  background: #6366f1;
  border: 0;
}
</style>
