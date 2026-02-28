<template>
  <div class="prompt-editor-page">
    <div v-if="loading" v-loading="true" class="loading-wrap" />
    <template v-else>
      <p class="page-desc">
        可自定义 AI 生成各阶段使用的提示词（System Prompt）。蓝色锁定区为 JSON 格式要求，不可修改以确保输出格式正确。
      </p>
      <div v-for="p in prompts" :key="p.key" class="prompt-card">
        <div class="prompt-card-header">
          <div class="prompt-card-meta">
            <span class="prompt-label">{{ p.label }}</span>
            <el-tag v-if="p.is_customized" type="warning" size="small" class="custom-tag">已自定义</el-tag>
            <el-tag v-else type="info" size="small" class="custom-tag">使用默认</el-tag>
          </div>
          <p class="prompt-desc">{{ p.description }}</p>
        </div>

        <div class="prompt-edit-section">
          <div class="section-label">
            <el-icon class="section-icon"><Edit /></el-icon>
            <span>指令内容（可编辑）</span>
          </div>
          <el-input
            v-model="editState[p.key]"
            type="textarea"
            :rows="10"
            :placeholder="p.default_body"
            class="prompt-textarea"
            @input="markDirty(p.key)"
          />
        </div>

        <div v-if="p.locked_suffix" class="prompt-locked-section">
          <div class="section-label section-label--locked">
            <el-icon class="section-icon"><Lock /></el-icon>
            <span>JSON 格式要求（锁定，不可修改）</span>
          </div>
          <div class="locked-content">{{ p.locked_suffix }}</div>
        </div>

        <div class="prompt-actions">
          <el-button
            type="primary"
            size="small"
            :loading="savingKey === p.key"
            :disabled="!isDirty[p.key]"
            @click="save(p)"
          >
            保存
          </el-button>
          <el-button
            size="small"
            :loading="resettingKey === p.key"
            :disabled="!p.is_customized && !isDirty[p.key]"
            @click="reset(p)"
          >
            恢复默认
          </el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Lock } from '@element-plus/icons-vue'
import { promptsAPI } from '@/api/prompts'

const loading = ref(false)
const prompts = ref([])
const editState = ref({})
const isDirty = ref({})
const savingKey = ref(null)
const resettingKey = ref(null)

async function load() {
  loading.value = true
  try {
    const data = await promptsAPI.list()
    prompts.value = data.prompts || []
    for (const p of prompts.value) {
      editState.value[p.key] = p.current_body || p.default_body
    }
  } catch (_) {
    ElMessage.error('加载提示词失败')
  } finally {
    loading.value = false
  }
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
  await ElMessageBox.confirm(`确定将「${p.label}」恢复为系统默认提示词？`, '恢复默认', { type: 'warning' })
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
}
.loading-wrap {
  min-height: 200px;
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
  margin-bottom: 20px;
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
  font-size: 15px;
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
  margin-bottom: 12px;
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
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #e4e4e7);
}
</style>
