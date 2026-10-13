<template>
  <div class="style-picker-wrap">
    <!-- 触发按钮，外观与 el-select 一致 -->
    <div
      class="style-picker-trigger"
      :class="{ 'has-value': !!modelValue }"
      @click="visible = true"
    >
      <template v-if="displayLabel">
        <span class="spt-swatch" :style="triggerSwatchStyle" />
        <span class="spt-label">{{ displayLabel }}</span>
      </template>
      <span v-else class="spt-placeholder">{{ placeholder }}</span>
      <el-icon class="spt-arrow"><ArrowDown /></el-icon>
      <span v-if="modelValue" class="spt-clear" @click.stop="clearSelection">
        <el-icon><CircleClose /></el-icon>
      </span>
    </div>

    <!-- 选择弹窗 -->
    <el-dialog
      v-model="visible"
      title="选择生成风格"
      width="90vw"
      style="max-width: 1100px"
      class="style-picker-dialog"
      :append-to-body="true"
      destroy-on-close
      @closed="showCustomEditor = false"
    >
      <div class="spd-search">
        <el-input
          v-model="search"
          placeholder="搜索风格名称..."
          clearable
          style="width: 240px"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <span v-if="modelValue" class="spd-selected-hint">
          已选：{{ getStyleLabel(modelValue) || displayLabel }}
        </span>
      </div>

      <div class="spd-body">
        <template v-for="group in filteredGroups" :key="group.label">
          <div class="spd-group-title">{{ group.label }}</div>
          <div class="spd-grid">
            <div
              v-for="opt in group.options"
              :key="opt.value"
              class="spd-item"
              :class="{ 'is-active': modelValue === opt.value }"
              @click="select(opt)"
            >
              <div class="spd-thumb" :style="thumbStyle(opt)">
                <img
                  v-if="opt.thumb"
                  :src="opt.thumb"
                  :alt="opt.label"
                  loading="lazy"
                  @error="(e) => e.target.style.display = 'none'"
                />
                <span v-if="!opt.thumb" class="spd-thumb-text">{{ opt.label.slice(0, 2) }}</span>
              </div>
              <div class="spd-name">{{ opt.label }}</div>
              <div v-if="modelValue === opt.value" class="spd-check">✓</div>
            </div>
          </div>
        </template>

        <template v-if="showCustomSection">
          <div class="spd-group-title">其他</div>
          <div class="spd-grid">
            <div
              class="spd-item"
              :class="{ 'is-active': modelValue === CUSTOM_STYLE_VALUE }"
              @click="openCustomEditor"
            >
              <div class="spd-thumb" :style="{ background: CUSTOM_SWATCH }">
                <span class="spd-thumb-text">自定</span>
              </div>
              <div class="spd-name">自定义</div>
              <div v-if="modelValue === CUSTOM_STYLE_VALUE" class="spd-check">✓</div>
            </div>
          </div>
        </template>

        <div v-if="showCustomEditor" class="spd-custom-editor">
          <el-input
            v-model="customDraft"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="描述画面风格，例如：赛博朋克水墨，霓虹灯映在宣纸上…"
          />
          <div class="spd-custom-actions">
            <el-button @click="showCustomEditor = false">取消</el-button>
            <el-button type="primary" @click="confirmCustom">确认</el-button>
          </div>
        </div>

        <div v-if="filteredGroups.length === 0 && !showCustomSection" class="spd-empty">没有匹配的风格</div>
      </div>

      <template #footer>
        <el-button @click="clearAndClose">清除选择</el-button>
        <el-button type="primary" @click="visible = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ArrowDown, CircleClose, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { CUSTOM_STYLE_VALUE, getStyleLabel } from '@/constants/styleOptions'

const CUSTOM_SWATCH = 'linear-gradient(135deg,#5b8def,#2dd4bf)'

const props = defineProps({
  modelValue: { type: String, default: '' },
  customPrompt: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '图片/视频风格' },
})

const emit = defineEmits(['update:modelValue', 'update:customPrompt', 'change'])

const visible = ref(false)
const search = ref('')
const showCustomEditor = ref(false)
const customDraft = ref('')

const allOptions = computed(() => props.options.flatMap((g) => g.options))
const selectedOption = computed(() => allOptions.value.find((o) => o.value === props.modelValue) || null)

const isCustom = computed(() => props.modelValue === CUSTOM_STYLE_VALUE)

const displayLabel = computed(() => {
  if (isCustom.value) return '自定义'
  return selectedOption.value?.label || ''
})

const triggerSwatchStyle = computed(() => {
  if (isCustom.value) return { background: CUSTOM_SWATCH }
  return swatchStyle(selectedOption.value)
})

const showCustomSection = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return true
  return '自定义'.includes(kw) || 'custom'.includes(kw) || kw.includes('自定义') || kw.includes('custom')
})

const filteredGroups = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return props.options
  return props.options
    .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(kw) || o.value.toLowerCase().includes(kw)) }))
    .filter((g) => g.options.length > 0)
})

function thumbStyle(opt) {
  if (opt.thumb) return {}
  return { background: opt.color || 'linear-gradient(135deg,#667eea,#764ba2)' }
}

function swatchStyle(opt) {
  return { background: opt?.color || 'linear-gradient(135deg,#667eea,#764ba2)' }
}

function openCustomEditor() {
  customDraft.value = props.customPrompt || ''
  showCustomEditor.value = true
}

function confirmCustom() {
  const text = customDraft.value.trim()
  if (!text) {
    ElMessage.warning('请填写画风描述')
    return
  }
  emit('update:customPrompt', text)
  emit('update:modelValue', CUSTOM_STYLE_VALUE)
  emit('change', CUSTOM_STYLE_VALUE)
  showCustomEditor.value = false
  visible.value = false
}

function select(opt) {
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  showCustomEditor.value = false
  visible.value = false
}

function clearSelection() {
  emit('update:modelValue', '')
  emit('update:customPrompt', '')
  emit('change', '')
}

function clearAndClose() {
  clearSelection()
  showCustomEditor.value = false
  visible.value = false
}
</script>

<style scoped>
.style-picker-wrap {
  display: inline-block;
}
.style-picker-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-blank);
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  user-select: none;
  min-width: 150px;
  transition: border-color 0.2s;
  position: relative;
}
.style-picker-trigger:hover {
  border-color: var(--el-color-primary);
}
.style-picker-trigger.has-value {
  color: var(--el-text-color-primary);
}
.spt-swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}
.spt-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spt-placeholder {
  flex: 1;
}
.spt-arrow {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}
.spt-clear {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  display: flex;
  align-items: center;
}
.spt-clear:hover {
  color: var(--el-color-primary);
}

/* 弹窗内部 */
.spd-search {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.spd-selected-hint {
  font-size: 13px;
  color: var(--el-color-primary);
}
.spd-body {
  max-height: 65vh;
  overflow-y: auto;
  padding-right: 6px;
}
.spd-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 6px 0 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 10px;
}
.spd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.spd-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.1s;
  position: relative;
  background: var(--el-fill-color-light);
}
.spd-item:hover {
  border-color: var(--el-color-primary-light-5);
  transform: translateY(-1px);
}
.spd-item.is-active {
  border-color: var(--el-color-primary);
}
.spd-thumb {
  width: 100%;
  aspect-ratio: 3/4;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}
.spd-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.spd-thumb-text {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
  letter-spacing: 1px;
}
.spd-name {
  font-size: 12px;
  text-align: center;
  padding: 4px 4px 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
}
.spd-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.spd-empty {
  text-align: center;
  padding: 40px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
.spd-custom-editor {
  margin-top: 4px;
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}
.spd-custom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>

<style>
.style-picker-dialog .el-dialog__body {
  padding: 16px 24px 8px;
}
</style>
