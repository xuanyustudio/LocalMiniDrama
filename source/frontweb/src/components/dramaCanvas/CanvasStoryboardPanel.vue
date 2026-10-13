<template>
  <div
    class="canvas-node-panel sb-panel nodrag nopan nowheel"
    @pointerdown.stop
    @mousedown.stop
    @click.stop
    @mouseup.stop
    @wheel.stop
  >
    <div class="panel-head">
      <span>分镜 #{{ storyboard?.storyboard_number ?? storyboard?.id }}</span>
      <div class="head-actions">
        <span v-if="busyLabel" class="busy-tag">{{ busyLabel }}</span>
        <el-button link size="small" type="primary" @click.stop="openListMode">列表详情</el-button>
        <el-button link size="small" @click.stop="closePanel">收起</el-button>
      </div>
    </div>

    <el-form label-position="left" label-width="36px" size="small" class="panel-form compact-form">
      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="分镜标题" @blur="saveMeta" />
      </el-form-item>

      <div class="relation-row">
        <el-form-item label="角色" class="rel-item">
          <el-select
            v-model="characterIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            filterable
            placeholder="角色"
            teleported
            popper-class="canvas-panel-popper"
            @visible-change="onSelectVisibleChange"
            @change="onRelationChange"
          >
            <el-option
              v-for="c in characters"
              :key="c.id"
              :label="c.name || '未命名'"
              :value="normalizeEntityId(c.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="场景" class="rel-item">
          <el-select
            v-model="sceneId"
            clearable
            filterable
            placeholder="场景"
            teleported
            popper-class="canvas-panel-popper"
            @visible-change="onSelectVisibleChange"
            @change="onRelationChange"
          >
            <el-option
              v-for="s in scenes"
              :key="s.id"
              :label="s.location || '未命名'"
              :value="normalizeEntityId(s.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="道具" class="rel-item">
          <el-select
            v-model="propIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            filterable
            placeholder="道具"
            teleported
            popper-class="canvas-panel-popper"
            @visible-change="onSelectVisibleChange"
            @change="onRelationChange"
          >
            <el-option
              v-for="p in propsList"
              :key="p.id"
              :label="p.name || '未命名'"
              :value="normalizeEntityId(p.id)"
            />
          </el-select>
        </el-form-item>
      </div>
      <div class="inline-add-row">
        <el-button link type="primary" size="small" @click.stop="createAsset('character')">+角色</el-button>
        <el-button link type="primary" size="small" @click.stop="createAsset('scene')">+场景</el-button>
        <el-button link type="primary" size="small" @click.stop="createAsset('prop')">+道具</el-button>
      </div>

      <div class="meta-row">
        <el-form-item label="景别" class="meta-item">
          <el-input v-model="form.shot_type" placeholder="特写" @blur="saveMeta" />
        </el-form-item>
        <el-form-item label="时长" class="meta-item narrow">
          <el-input-number v-model="form.duration" :min="1" :max="120" controls-position="right" @change="saveMeta" />
        </el-form-item>
      </div>

      <template v-if="isUniversal">
        <el-form-item label="全能词">
          <el-input
            v-model="form.universal_segment_text"
            type="textarea"
            :rows="2"
            resize="vertical"
            placeholder="全能模式片段描述"
          />
        </el-form-item>
        <el-form-item label="视频词">
          <el-input
            v-model="form.video_prompt"
            type="textarea"
            :rows="2"
            resize="vertical"
            placeholder="生视频提示词"
          />
        </el-form-item>
      </template>
      <template v-else>
        <div class="text-row-2">
          <el-form-item label="动作" class="flex-1">
            <el-input
              v-model="form.action"
              type="textarea"
              :rows="2"
              resize="vertical"
              placeholder="画面动作"
            />
          </el-form-item>
          <el-form-item label="对白" class="flex-1">
            <el-input
              v-model="form.dialogue"
              type="textarea"
              :rows="2"
              resize="vertical"
              placeholder="角色对白"
            />
          </el-form-item>
        </div>
        <el-form-item label="生图词">
          <el-input
            v-model="form.image_prompt"
            type="textarea"
            :rows="2"
            resize="vertical"
            placeholder="图片提示词"
          />
        </el-form-item>
        <el-form-item label="视频词">
          <el-input
            v-model="form.video_prompt"
            type="textarea"
            :rows="2"
            resize="vertical"
            placeholder="视频提示词"
          />
        </el-form-item>
      </template>
    </el-form>

    <div class="panel-actions">
      <el-button size="small" :loading="saving" @click.stop="saveFields">保存</el-button>
      <el-button v-if="!isUniversal" size="small" :loading="busyStep === 'polish'" @click.stop="polishPrompt">润色</el-button>
      <el-button v-if="!isUniversal" size="small" type="primary" :loading="busyStep === 'image'" @click.stop="runStep('image')">生图</el-button>
      <el-button size="small" type="primary" :loading="busyStep === 'video'" @click.stop="runStep('video')">生视频</el-button>
      <el-button size="small" type="warning" :loading="busyStep === 'audio'" @click.stop="runStep('audio')">配音</el-button>
      <el-button size="small" type="danger" plain @click.stop="deleteStoryboard">删除</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storyboardsAPI } from '@/api/storyboards'
import { useCanvasContext } from '@/composables/useCanvasContext'
import { CANVAS_NODE_STATUS_LABELS } from '@/composables/useCanvasNodeStatus'
import {
  normalizeEntityId,
  parseStoryboardCharacterIds,
  parseStoryboardPropIds,
  parseStoryboardSceneId,
} from '@/utils/canvasEntityIds'
import { runImageStep, runVideoStep, runAudioStep } from '@/composables/useCanvasWorkflowRunner'
import { findStoryboardInDrama, getDramaGenerationOptions } from '@/utils/canvasWorkflow'

const props = defineProps({
  storyboard: { type: Object, required: true },
  episodeId: { type: Number, default: null },
  nodeId: { type: String, default: '' },
})

const router = useRouter()
const ctx = useCanvasContext()
const saving = ref(false)
const busyStep = ref('')
const characterIds = ref([])
const sceneId = ref(null)
const propIds = ref([])
const form = reactive({
  title: '',
  action: '',
  dialogue: '',
  image_prompt: '',
  video_prompt: '',
  universal_segment_text: '',
  shot_type: '',
  duration: 5,
})

const sbNodeId = computed(() => props.nodeId || (props.storyboard?.id ? `sb:${props.storyboard.id}` : ''))

const isUniversal = computed(() => props.storyboard?.creation_mode === 'universal')
const characters = computed(() => ctx?.drama?.value?.characters || [])
const scenes = computed(() => ctx?.drama?.value?.scenes || [])
const propsList = computed(() => ctx?.drama?.value?.props || [])

const busyLabel = computed(() => {
  const map = ctx?.nodeStatus?.map
  const st = map && sbNodeId.value ? map[sbNodeId.value] : null
  return st?.message || (busyStep.value ? CANVAS_NODE_STATUS_LABELS[busyStep.value] : '')
})

function syncForm(sb) {
  form.title = sb?.title || ''
  form.action = sb?.action || ''
  form.dialogue = sb?.dialogue || ''
  form.image_prompt = sb?.image_prompt || sb?.polished_prompt || ''
  form.video_prompt = sb?.video_prompt || ''
  form.universal_segment_text = sb?.universal_segment_text || ''
  form.shot_type = sb?.shot_type || ''
  form.duration = sb?.duration != null ? Number(sb.duration) : 5
  characterIds.value = parseStoryboardCharacterIds(sb)
  sceneId.value = parseStoryboardSceneId(sb)
  propIds.value = parseStoryboardPropIds(sb)
}

watch(() => props.storyboard, (sb) => syncForm(sb), { immediate: true, deep: true })

function onSelectVisibleChange(open) {
  if (open) ctx?.suppressPaneClick?.()
  else ctx?.suppressPaneClick?.(400)
}

function closePanel() {
  ctx?.clearFocusedNode?.()
}

function createAsset(type) {
  ctx?.openCreateDialog?.(type)
}

function openListMode() {
  const dramaId = ctx?.drama?.value?.id
  if (!dramaId) return
  router.push({
    path: `/film/${dramaId}`,
    query: props.episodeId ? { episode: String(props.episodeId) } : {},
    hash: props.storyboard?.id ? `#sb-${props.storyboard.id}` : undefined,
  })
}

async function onRelationChange() {
  if (!props.storyboard?.id) return
  try {
    await storyboardsAPI.update(props.storyboard.id, {
      character_ids: characterIds.value,
      scene_id: sceneId.value,
      prop_ids: propIds.value,
    })
    await ctx?.refreshDrama?.(true)
  } catch (e) {
    ElMessage.error(e?.message || '关联保存失败')
  }
}

async function saveMeta() {
  if (!props.storyboard?.id) return
  try {
    await storyboardsAPI.update(props.storyboard.id, {
      title: form.title.trim() || null,
      shot_type: form.shot_type.trim() || null,
      duration: form.duration ?? 5,
    })
    await ctx?.refreshDrama?.(true)
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
}

async function persistForm(silent = false) {
  if (!props.storyboard?.id) return
  const payload = isUniversal.value
    ? {
        title: form.title.trim() || null,
        universal_segment_text: form.universal_segment_text.trim() || null,
        video_prompt: form.video_prompt.trim() || null,
        shot_type: form.shot_type.trim() || null,
        duration: form.duration ?? 5,
      }
    : {
        title: form.title.trim() || null,
        action: form.action.trim() || null,
        dialogue: form.dialogue.trim() || null,
        image_prompt: form.image_prompt.trim() || null,
        video_prompt: form.video_prompt.trim() || null,
        shot_type: form.shot_type.trim() || null,
        duration: form.duration ?? 5,
      }
  await storyboardsAPI.update(props.storyboard.id, payload)
  if (!silent) ElMessage.success('已保存')
}

async function saveFields() {
  if (!props.storyboard?.id) return
  saving.value = true
  ctx?.nodeStatus?.set(sbNodeId.value, { step: 'save', message: CANVAS_NODE_STATUS_LABELS.save })
  try {
    await persistForm(false)
    await ctx?.refreshDrama?.(true)
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
    if (!busyStep.value) ctx?.nodeStatus?.clear(sbNodeId.value)
  }
}

async function deleteStoryboard() {
  if (!props.storyboard?.id) return
  try {
    await ElMessageBox.confirm('确定删除该分镜？此操作不可恢复。', '删除分镜', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await storyboardsAPI.delete(props.storyboard.id)
    ctx?.clearFocusedNode?.()
    ElMessage.success('分镜已删除')
    await ctx?.refresh?.()
  } catch (e) {
    if (e === 'cancel') return
    ElMessage.error(e?.message || '删除失败')
  }
}

async function polishPrompt() {
  if (!props.storyboard?.id) return
  busyStep.value = 'polish'
  ctx?.nodeStatus?.set(sbNodeId.value, { step: 'polish', message: CANVAS_NODE_STATUS_LABELS.polish })
  try {
    const res = await storyboardsAPI.polishPrompt(props.storyboard.id)
    if (res?.polished_prompt) form.image_prompt = res.polished_prompt
    ElMessage.success('提示词已润色')
    await ctx?.refreshDrama?.(true)
  } catch (e) {
    ElMessage.error(e?.message || '润色失败')
  } finally {
    busyStep.value = ''
    ctx?.nodeStatus?.clear(sbNodeId.value)
  }
}

async function runStep(step) {
  const drama = ctx?.drama?.value
  const sbId = props.storyboard?.id
  if (!drama || !sbId) return

  if (step !== 'audio') {
    try {
      await persistForm(true)
    } catch (e) {
      ElMessage.error(e?.message || '保存失败')
      return
    }
  }

  busyStep.value = step
  const statusMsg = CANVAS_NODE_STATUS_LABELS[step] || '处理中…'
  ctx?.nodeStatus?.set(sbNodeId.value, { step, message: statusMsg })
  if (step === 'image') ctx?.nodeStatus?.set(`sbimg:${sbId}`, { step, message: statusMsg })
  if (step === 'video') ctx?.nodeStatus?.set(`sbvid:${sbId}`, { step, message: statusMsg })
  try {
    const found = findStoryboardInDrama(drama, sbId)
    const sb = found?.storyboard || props.storyboard
    const genOpts = ctx?.getGenerationOptions?.() || getDramaGenerationOptions(drama)
    if (step === 'image') await runImageStep(drama, sb, genOpts)
    else if (step === 'video') await runVideoStep(drama, sb, genOpts)
    else if (step === 'audio') {
      const res = await runAudioStep(sb)
      if (res?.skipped) {
        ElMessage.info(res.reason || '已跳过')
        return
      }
    }
    ElMessage.success(step === 'image' ? '生图完成' : step === 'video' ? '视频生成完成' : '配音完成')
    await ctx?.refresh?.()
  } catch (e) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    busyStep.value = ''
    ctx?.nodeStatus?.clear(sbNodeId.value)
    if (step === 'image') ctx?.nodeStatus?.clear(`sbimg:${sbId}`)
    if (step === 'video') ctx?.nodeStatus?.clear(`sbvid:${sbId}`)
  }
}
</script>

<style scoped>
.sb-panel {
  margin-top: 10px;
  width: min(560px, 94vw);
  padding: 10px 14px 12px;
  border-radius: 12px;
  border: 1px solid rgba(129, 140, 248, 0.45);
  background: rgba(15, 15, 18, 0.97);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #c7d2fe;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.busy-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.18);
  color: #93c5fd;
  animation: pulse-tag 1.2s ease-in-out infinite;
}
.compact-form :deep(.el-form-item) {
  margin-bottom: 6px;
}
.compact-form :deep(.el-form-item__label) {
  color: #71717a;
  font-size: 11px;
}
.compact-form :deep(.el-input__wrapper),
.compact-form :deep(.el-select__wrapper) {
  min-height: 28px;
}
.compact-form :deep(.el-textarea__inner) {
  resize: vertical;
  min-height: 52px;
  line-height: 1.45;
}
.relation-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.rel-item {
  flex: 1;
  min-width: 0;
  margin-bottom: 4px !important;
}
.inline-add-row {
  display: flex;
  gap: 10px;
  margin: 0 0 8px 36px;
}
.meta-row {
  display: flex;
  gap: 10px;
}
.meta-item { flex: 1; min-width: 0; }
.meta-item.narrow { max-width: 140px; flex: 0 0 140px; }
.text-row-2 {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.flex-1 { flex: 1; min-width: 0; }
.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(63, 63, 70, 0.8);
}
.panel-actions :deep(.el-button) {
  margin: 0;
}
@keyframes pulse-tag {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; }
}
</style>

<style>
.canvas-panel-popper {
  z-index: 4000 !important;
}
.canvas-panel-popper.el-select__popper .el-select-dropdown__wrap {
  max-height: 168px !important;
}
</style>
