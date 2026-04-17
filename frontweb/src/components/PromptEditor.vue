<template>
  <div class="prompt-editor-page">
    <div v-if="loading" v-loading="true" class="loading-wrap" />
    <template v-else>
      <div class="editor-layout">
        <!-- 左侧菜单 -->
        <div class="left-sidebar">
          <div class="sidebar-menu">
            <div
              v-for="p in prompts"
              :key="p.key"
              :class="['menu-item', { active: currentKey === p.key }]"
              @click="selectPrompt(p.key)"
            >
              <div class="menu-item-content">
                <span class="menu-label">{{ p.label }}</span>
                <el-tag
                  v-if="p.is_customized"
                  type="warning"
                  size="small"
                  class="menu-tag"
                >已自定义</el-tag>
                <el-tag v-else type="info" size="small" class="menu-tag">默认</el-tag>
              </div>
              <div v-if="isDirty[p.key]" class="dirty-indicator" />
            </div>
          </div>
        </div>

        <!-- 右侧编辑区 -->
        <div class="right-content">
          <p class="page-desc">
            可自定义 AI 生成各阶段使用的提示词（System Prompt）。蓝色锁定区为 JSON
            格式要求，不可修改以确保输出格式正确。
          </p>

          <div v-if="currentPrompt" class="prompt-card">
            <div class="prompt-card-header">
              <div class="prompt-card-meta">
                <span class="prompt-label">{{ currentPrompt.label }}</span>
                <el-tag
                  v-if="currentPrompt.is_customized"
                  type="warning"
                  size="small"
                  class="custom-tag"
                >已自定义</el-tag>
                <el-tag v-else type="info" size="small" class="custom-tag">使用默认</el-tag>
              </div>
              <p class="prompt-desc">{{ currentPrompt.description }}</p>
            </div>

            <div class="prompt-edit-section">
              <div class="section-label">
                <el-icon class="section-icon"><Edit /></el-icon>
                <span>指令内容（可编辑）</span>
              </div>
              <el-input
                v-model="editState[currentPrompt.key]"
                type="textarea"
                :rows="16"
                :placeholder="currentPrompt.default_body"
                class="prompt-textarea"
                @input="markDirty(currentPrompt.key)"
              />
            </div>

            <div v-if="currentPrompt.locked_suffix" class="prompt-locked-section">
              <div class="section-label section-label--locked">
                <el-icon class="section-icon"><Lock /></el-icon>
                <span>JSON 格式要求（锁定，不可修改）</span>
              </div>
              <div class="locked-content">{{ currentPrompt.locked_suffix }}</div>
            </div>

            <div class="prompt-actions">
              <el-button
                type="primary"
                size="small"
                :loading="savingKey === currentPrompt.key"
                :disabled="!isDirty[currentPrompt.key]"
                @click="save(currentPrompt)"
              >
                保存
              </el-button>
              <el-button
                size="small"
                :loading="resettingKey === currentPrompt.key"
                :disabled="!currentPrompt.is_customized && !isDirty[currentPrompt.key]"
                @click="reset(currentPrompt)"
              >
                恢复默认
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Lock } from '@element-plus/icons-vue'
import { promptsAPI } from '@/api/prompts'

const loading = ref(false)
const prompts = ref([])
const editState = ref({})
const isDirty = ref({})
const savingKey = ref(null)
const resettingKey = ref(null)
const currentKey = ref(null)

const currentPrompt = computed(() => {
  return prompts.value.find((p) => p.key === currentKey.value)
})

async function load() {
  loading.value = true
  try {
    const data = await promptsAPI.list()
    prompts.value = data.prompts || []
    for (const p of prompts.value) {
      editState.value[p.key] = p.current_body || p.default_body
    }
    // 默认选中第一个
    if (prompts.value.length > 0) {
      currentKey.value = prompts.value[0].key
    }
  } catch (_) {
    ElMessage.error('加载提示词失败')
  } finally {
    loading.value = false
  }
}

function selectPrompt(key) {
  currentKey.value = key
}

function markDirty(key) {
  const p = prompts.value.find((x) => x.key === key)
  if (!p) return
  const current = p.current_body || p.default_body
  isDirty.value[key] = editState.value[key] !== current
}

async function save(p) {
  const content = editState.value[p.key]
  if (!content?.trim()) {
    ElMessage.warning('内容不能为空')
    return
  }
  savingKey.value = p.key
  try {
    await promptsAPI.update(p.key, content.trim())
    p.current_body = content.trim()
    p.is_customized = true
    isDirty.value[p.key] = false
    ElMessage.success('已保存')
  } catch (_) {
  } finally {
    savingKey.value = null
  }
}

async function reset(p) {
  await ElMessageBox.confirm(`确定将「${p.label}」恢复为系统默认提示词？`, '恢复默认', {
    type: 'warning',
  })
  resettingKey.value = p.key
  try {
    await promptsAPI.reset(p.key)
    p.current_body = null
    p.is_customized = false
    editState.value[p.key] = p.default_body
    isDirty.value[p.key] = false
    ElMessage.success('已恢复默认')
  } catch (_) {
  } finally {
    resettingKey.value = null
  }
}

onMounted(() => load())
</script>

<style scoped>
.prompt-editor-page {
  padding: 0;
  height: 100%;
}
.loading-wrap {
  min-height: 200px;
}

/* 左右布局 */
.editor-layout {
  display: flex;
  height: 100%;
  min-height: calc(100vh - 120px);
}

/* 左侧菜单 */
.left-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-card, #fff);
  border-right: 1px solid var(--border-color, #e4e4e7);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e4e4e7);
}

.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-bright, #18181b);
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.menu-item {
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
  position: relative;
}

.menu-item:hover {
  background: var(--bg-inner, #f8f8f8);
}

.menu-item.active {
  background: var(--el-color-primary-light-9, #f3e8ff);
}

.menu-item.active .menu-label {
  color: var(--el-color-primary, #7c3aed);
  font-weight: 600;
}

.menu-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.menu-label {
  font-size: 13px;
  color: var(--text-bright, #18181b);
  flex: 1;
}

.menu-tag {
  font-size: 10px;
  transform: scale(0.9);
}

.dirty-indicator {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: var(--el-color-warning, #f59e0b);
  border-radius: 50%;
}

/* 右侧内容区 */
.right-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.page-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--text-muted, #71717a);
  line-height: 1.6;
  padding: 10px 14px;
  background: var(--bg-inner, #f8f8f8);
  border-radius: 8px;
  border-left: 3px solid var(--el-color-primary, #7c3aed);
}

.prompt-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color, #e4e4e7);
  border-radius: 12px;
  padding: 20px;
}

.prompt-card-header {
  margin-bottom: 16px;
}

.prompt-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.prompt-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-bright, #18181b);
}

.custom-tag {
  font-size: 11px;
}

.prompt-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted, #71717a);
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted, #71717a);
}

.section-label--locked {
  color: #2563eb;
}

.section-icon {
  font-size: 13px;
}

.prompt-edit-section {
  margin-bottom: 16px;
}

.prompt-textarea :deep(textarea) {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12.5px;
  line-height: 1.6;
}

.prompt-locked-section {
  margin-bottom: 16px;
}

.locked-content {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #1e40af;
  white-space: pre-wrap;
  line-height: 1.6;
  user-select: none;
}

.prompt-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #e4e4e7);
}
</style>
