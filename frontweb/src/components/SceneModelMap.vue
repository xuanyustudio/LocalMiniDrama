<template>
  <div class="scene-model-map-page">
    <div class="page-header">
      <div class="header-left">
        <p class="page-desc">
          配置不同业务场景使用的 AI 模型路由。当调用 generateText 时传入 scene_key，系统会优先使用此处配置的模型。
        </p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon>
          添加业务场景配置
        </el-button>
      </div>
    </div>

    <div v-if="loading" v-loading="true" class="loading-wrap" />
    
    <template v-else>
      <el-table
        :data="list"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="key" label="场景键 (scene_key)" min-width="220">
          <template #default="{ row }">
            <div class="">
              <code class="scene-key">{{ row.key }}</code>
              <span class="scene-key-label">{{ getSceneKeyLabel(row.key) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="service_type" label="服务类型" width="120">
          <template #default="{ row }">
            <el-tag :type="serviceTypeTagType(row.service_type)" size="small">
              {{ serviceTypeLabel(row.service_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="config_name" label="AI 配置" min-width="180">
          <template #default="{ row }">
            <span v-if="row.config_id">{{ row.config_name || '配置 #' + row.config_id }}</span>
            <el-tag v-else type="info" size="small">使用默认配置</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="model_override" label="模型覆盖" min-width="180">
          <template #default="{ row }">
            <span v-if="row.model_override" class="model-override">{{ row.model_override }}</span>
            <span v-else class="text-muted">使用配置默认模型</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="list.length === 0" description="暂无场景模型映射配置" />
    </template>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingKey ? '编辑业务场景映射' : '添加业务场景映射'"
      width="560px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item prop="key" label="场景键">
          <el-select
            v-model="form.key"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入场景键"
            style="width: 100%"
            :disabled="!!editingKey"
            @change="onKeyChange"
          >
            <el-option
              v-for="k in predefinedKeys"
              :key="k.value"
              :label="k.label"
              :value="k.value"
            />
          </el-select>
          <p class="field-tip">用于在代码中标识业务场景，选择后会自动设置对应的服务类型</p>
        </el-form-item>

        <el-form-item prop="service_type" label="服务类型">
          <el-select v-model="form.service_type" placeholder="选择服务类型" style="width: 100%" disabled>
            <el-option label="文本/对话" value="text" />
            <el-option label="文本生成图片" value="image" />
            <el-option label="分镜图片生成" value="storyboard_image" />
            <el-option label="视频生成" value="video" />
            <el-option label="语音合成 TTS" value="tts" />
          </el-select>
          <p class="field-tip">由场景键自动决定，不可更改</p>
        </el-form-item>

        <el-form-item label="AI 配置">
          <el-select
            v-model="form.config_id"
            clearable
            placeholder="选择 AI 配置（留空使用默认）"
            style="width: 100%"
            @change="onConfigChange"
          >
            <el-option
              v-for="c in filteredConfigs"
              :key="c.id"
              :label="`${c.name} (${c.provider})`"
              :value="c.id"
            />
          </el-select>
          <p class="field-tip">指定具体的 AI 服务配置，不选则使用该类服务的默认配置</p>
        </el-form-item>

        <el-form-item label="模型覆盖">
          <el-select
            v-model="form.model_override"
            clearable
            placeholder="选择模型（留空使用配置默认）"
            style="width: 100%"
            :disabled="!selectedConfigModels.length"
          >
            <el-option
              v-for="m in selectedConfigModels"
              :key="m"
              :label="m"
              :value="m"
            />
          </el-select>
          <p class="field-tip">
            {{ selectedConfigModels.length ? '从该配置的可用模型中选择' : '请先选择 AI 配置' }}
          </p>
        </el-form-item>
        <el-form-item prop="description" label="描述">
          <el-input
            v-model="form.description"
            placeholder="输入场景描述，便于理解用途"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { sceneModelMapAPI } from '@/api/sceneModelMap'
import { aiAPI } from '@/api/ai'

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const configs = ref([])
const dialogVisible = ref(false)
const editingKey = ref(null)
const formRef = ref(null)

const form = ref({
  key: '',
  description: '',
  service_type: 'text',
  config_id: null,
  model_override: ''
})

const rules = {
  key: [{ required: true, message: '请输入场景键', trigger: 'blur' }],
  service_type: [{ required: true, message: '请选择服务类型', trigger: 'change' }]
}

// 预定义场景键及其对应的服务类型
const predefinedKeys = [
  { value: 'image_polish', label: 'image_polish - 分镜图提示词润色', service_type: 'text' },
  // 目前程序里只内置了一个场景键：image_polish
  // 以下为新增的场景键，已添加到对应的接口里
  { value: 'role_image_polish', label: 'role_image_polish - 角色图提示词润色', service_type: 'text' },
  { value: 'prop_image_polish', label: 'prop_image_polish - 道具图提示词润色', service_type: 'text' },
  { value: 'scene_image_polish', label: 'scene_image_polish - 场景图提示词润色', service_type: 'text' },
  { value: 'role_extraction', label: 'role_extraction - 角色提取', service_type: 'text' },
  { value: 'prop_extraction', label: 'prop_extraction - 道具提取', service_type: 'text' },
  { value: 'scene_extraction', label: 'scene_extraction - 场景提取', service_type: 'text' },
  { value: 'storyboard_extraction', label: 'storyboard_extraction - 分镜生成', service_type: 'text' },
  { value: 'identity_anchors', label: 'identity_anchors - 角色视觉锚点提炼', service_type: 'text' },
  { value: 'frame_prompt', label: 'frame_prompt - 帧提示词生成', service_type: 'text' },
  { value: 'novel_import', label: 'novel_import - 小说导入改写', service_type: 'text' },
  { value: 'story_generation', label: 'story_generation - 故事生成', service_type: 'text' },
  //  以下是其他服务类型...未实现
  // 图片生成
  // { value: 'role_image_gen', label: 'role_image_gen - 角色图片生成', service_type: 'image' },
  // { value: 'prop_image_gen', label: 'prop_image_gen - 道具图片生成', service_type: 'image' },
  // { value: 'scene_image_gen', label: 'scene_image_gen - 场景图片生成', service_type: 'image' },
  // { value: 'storyboard_image_gen', label: 'storyboard_image_gen - 分镜图片生成', service_type: 'image' },
  // { value: 'video_frame_gen', label: 'video_frame_gen - 视频帧生成', service_type: 'video' },// 首尾帧视频生成
  // { value: 'video_full_gen', label: 'video_full_gen - 全能视频生成', service_type: 'video' },// 全能模式视频生成
]

// 根据服务类型筛选配置
const filteredConfigs = computed(() => {
  const currentServiceType = form.value.service_type
  console.log('filteredConfigs computed, service_type:', currentServiceType, 'configs:', configs.value.length)
  const filtered = configs.value.filter(c => {
    const match = c.service_type === currentServiceType && c.is_active
    console.log('  config:', c.name, 'service_type:', c.service_type, 'match:', match)
    return match
  })
  console.log('  filtered result:', filtered.length)
  return filtered
})

// 获取选中配置的可用模型列表
const selectedConfigModels = computed(() => {
  if (!form.value.config_id) return []
  const config = configs.value.find(c => c.id === form.value.config_id)
  if (!config) return []
  // 模型可能是数组或逗号/换行分隔的字符串
  const models = config.model
  if (Array.isArray(models)) return models
  if (typeof models === 'string') {
    return models.split(/[\n,，]/).map(s => s.trim()).filter(Boolean)
  }
  return config.default_model ? [config.default_model] : []
})

function serviceTypeLabel(type) {
  const map = {
    text: '文本/对话',
    image: '文本生成图片',
    storyboard_image: '分镜图片生成',
    video: '视频生成',
    tts: '语音合成 TTS'
  }
  return map[type] || type
}

function serviceTypeTagType(type) {
  const map = {
    text: 'primary',
    image: 'success',
    storyboard_image: 'warning',
    video: 'danger',
    tts: 'info'
  }
  return map[type] || ''
}

// 获取场景键的 label
function getSceneKeyLabel(key) {
  const matched = predefinedKeys.find(k => k.value === key)
  if (matched) {
    // 从 label 中提取描述部分（去掉 key 前缀）
    return matched.label.replace(matched.value + ' - ', '')
  }
  return ''
}

// 场景键改变时自动设置服务类型
function onKeyChange(key) {
  console.log('onKeyChange called with key:', key)
  const matched = predefinedKeys.find(k => k.value === key)
  console.log('matched predefined key:', matched)
  if (matched) {
    form.value.service_type = matched.service_type
    console.log('service_type set to:', form.value.service_type)
  }
  // 重置配置和模型选择
  form.value.config_id = null
  form.value.model_override = ''
}

// 配置改变时重置模型选择
function onConfigChange(configId) {
  form.value.model_override = ''
}

async function load() {
  loading.value = true
  try {
    const [mapsData, configsData] = await Promise.all([
      sceneModelMapAPI.list(),
      aiAPI.list()
    ])
    configs.value = configsData || []
    console.log('Loaded configs:', configs.value.map(c => ({ id: c.id, name: c.name, service_type: c.service_type, is_active: c.is_active })))
    
    // 合并配置名称
    list.value = (mapsData || []).map(item => {
      const config = configs.value.find(c => c.id === item.config_id)
      return {
        ...item,
        config_name: config?.name || null
      }
    })
  } catch (err) {
    ElMessage.error('加载场景模型映射失败: ' + (err.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingKey.value = null
  form.value = {
    key: '',
    description: '',
    service_type: 'text',
    config_id: null,
    model_override: ''
  }
  dialogVisible.value = true
}

function openEdit(row) {
  editingKey.value = row.key
  form.value = {
    key: row.key,
    description: row.description || '',
    service_type: row.service_type || 'text',
    config_id: row.config_id || null,
    model_override: row.model_override || ''
  }
  dialogVisible.value = true
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const body = {
      description: form.value.description,
      service_type: form.value.service_type,
      config_id: form.value.config_id || null,
      model_override: form.value.model_override || null
    }
    
    if (editingKey.value) {
      await sceneModelMapAPI.update(editingKey.value, body)
      ElMessage.success('更新成功')
    } else {
      await sceneModelMapAPI.create({ ...body, key: form.value.key })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error('保存失败: ' + (err.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除场景 "${row.key}" 的模型映射配置吗？`,
      '确认删除',
      { type: 'warning' }
    )
    await sceneModelMapAPI.delete(row.key)
    ElMessage.success('删除成功')
    await load()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败: ' + (err.message || '未知错误'))
    }
  }
}

function resetForm() {
  formRef.value?.resetFields()
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.scene-model-map-page {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.page-desc {
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 1.6;
}

.loading-wrap {
  padding: 40px;
}

.scene-key {
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #409eff;
  width: fit-content;
}

.scene-key-label {
  font-size: 12px;
  color: #666;
}

.model-override {
  background: #e6f7ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #096dd9;
}

.text-muted {
  color: #999;
  font-size: 13px;
}

.field-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}
</style>
