<template>
  <div class="ai-config-content">
    <div class="content-actions">
      <el-button type="primary" @click="openAdd">
        <el-icon><Plus /></el-icon>
        添加配置
      </el-button>
      <el-button type="success" plain @click="openOneKeyTongyi">
        <el-icon><MagicStick /></el-icon>
        一键配置通义
      </el-button>
      <el-button type="success" plain @click="openOneKeyVolc">
        <el-icon><MagicStick /></el-icon>
        一键配置火山
      </el-button>
    </div>
    <p class="default-tip">每种服务类型仅有一个默认配置：文本用于生成故事；文本生成图片用于角色/场景/道具图；分镜图片生成用于分镜图（支持参考图）；视频用于生成视频。</p>
    <el-table v-loading="loading" :data="list" stripe style="width: 100%">
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="service_type" label="类型" width="100">
        <template #default="{ row }">
          {{ serviceTypeLabel(row.service_type) }}
        </template>
      </el-table-column>
      <el-table-column prop="provider" label="提供商" width="100" />
      <el-table-column prop="base_url" label="Base URL" min-width="180" show-overflow-tooltip />
      <el-table-column prop="priority" label="优先级" width="80" />
      <el-table-column prop="is_default" label="默认" width="70">
        <template #default="{ row }">
          <el-tag v-if="row.is_default" type="success" size="small">是</el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="default_model" label="默认模型" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.default_model || (Array.isArray(row.model) && row.model[0]) || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openTest(row)">测试</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加/编辑 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑配置' : '添加配置'"
      width="520px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="服务类型" prop="service_type">
          <el-select v-model="form.service_type" placeholder="选择类型" style="width: 100%" @change="onServiceTypeChange">
            <el-option label="文本/对话" value="text" />
            <el-option label="文本生成图片" value="image" />
            <el-option label="分镜图片生成" value="storyboard_image" />
            <el-option label="视频生成" value="video" />
          </el-select>
        </el-form-item>
        <el-form-item label="厂商" prop="provider">
          <el-select
            v-model="form.provider"
            placeholder="从下拉选择预设（自动填充 Base URL 和模型）或输入自定义厂商名"
            clearable
            filterable
            allow-create
            default-first-option
            style="width: 100%"
            @change="onProviderChange"
          >
            <el-option
              v-for="p in availableProviderOptions"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：OpenAI 图文，可自动生成" />
        </el-form-item>
        <el-form-item label="Base URL" prop="base_url">
          <el-input v-model="form.base_url" placeholder="选择预设厂商后自动填充，可修改" />
        </el-form-item>
        <el-form-item label="API Key" prop="api_key">
          <el-input v-model="form.api_key" type="password" placeholder="API 密钥" show-password-on="click" />
        </el-form-item>
        <el-form-item label="模型">
          <div class="model-row">
            <el-select
              v-model="presetModelPick"
              placeholder="追加预设模型"
              clearable
              filterable
              style="width: 220px; margin-bottom: 8px"
              @change="onPresetModelSelect"
            >
              <el-option v-for="m in availableModels" :key="m" :label="m" :value="m" />
            </el-select>
          </div>
          <el-input v-model="form.modelText" type="textarea" :rows="2" placeholder="选择预设厂商后自动填入，可编辑；多个用逗号或换行分隔" />
        </el-form-item>
        <el-form-item label="生成时默认使用">
          <el-select
            v-model="form.default_model"
            :placeholder="formModelList.length ? '从上面模型列表中选一个作为生成时使用的默认' : '请先填写上方模型列表'"
            clearable
            style="width: 100%"
          >
            <el-option v-for="m in formModelList" :key="m" :label="m" :value="m" />
          </el-select>
          <p class="field-tip">该配置被选为「默认」时，生成故事/图片/视频将使用此处指定的模型。</p>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :min="0" :max="999" />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="form.is_default" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 一键配置通义 -->
    <el-dialog
      v-model="oneKeyTongyiVisible"
      title="一键配置通义"
      width="440px"
      :close-on-click-modal="false"
      @closed="oneKeyTongyiKey = ''"
    >
      <p class="one-key-tip">将同时创建「文本」「图片」「视频」三条通义配置，只需填写一次 API Key。</p>
      <el-form label-width="0">
        <el-form-item>
          <el-input
            v-model="oneKeyTongyiKey"
            type="password"
            placeholder="请输入通义（DashScope）API Key"
            show-password-on="click"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="oneKeyTongyiVisible = false">取消</el-button>
        <el-button type="success" :loading="oneKeyTongyiSaving" :disabled="!oneKeyTongyiKey.trim()" @click="submitOneKeyTongyi">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 一键配置火山 -->
    <el-dialog
      v-model="oneKeyVolcVisible"
      title="一键配置火山"
      width="440px"
      :close-on-click-modal="false"
      @closed="oneKeyVolcKey = ''"
    >
      <p class="one-key-tip">将同时创建「文本」「图片」「视频」三条火山引擎配置，只需填写一次 API Key。</p>
      <el-form label-width="0">
        <el-form-item>
          <el-input
            v-model="oneKeyVolcKey"
            type="password"
            placeholder="请输入火山引擎（方舟）API Key"
            show-password-on="click"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="oneKeyVolcVisible = false">取消</el-button>
        <el-button type="success" :loading="oneKeyVolcSaving" :disabled="!oneKeyVolcKey.trim()" @click="submitOneKeyVolc">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 测试连接 -->
    <el-dialog v-model="testVisible" title="测试连接" width="400px">
      <p v-if="testResult === null">正在测试…</p>
      <el-alert v-else-if="testResult" type="success" title="连接成功" show-icon />
      <el-alert v-else type="error" :title="testError || '连接失败'" show-icon />
      <template #footer>
        <el-button @click="testVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MagicStick } from '@element-plus/icons-vue'
import { aiAPI } from '@/api/ai'

const loading = ref(false)
const list = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formRef = ref(null)
const form = ref({
  service_type: 'text',
  name: '',
  provider: '',
  base_url: '',
  api_key: '',
  modelText: '',
  default_model: '',
  priority: 0,
  is_default: false
})
const presetModelPick = ref('')

const formModelList = computed(() => parseModelText(form.value.modelText))

// 保证「生成时默认使用」下拉有可选且选中值在列表内，否则会不显示或修改无效
watch(
  () => [formModelList.value, form.value.default_model],
  () => {
    const list = formModelList.value
    if (list.length === 0) return
    const current = form.value.default_model
    if (!current || !list.includes(current)) {
      form.value.default_model = list[0] || ''
    }
  },
  { immediate: true }
)

function onServiceTypeChange() {
  const st = form.value.service_type || 'text'
  const listByType = providerConfigs[st] || []
  const current = form.value.provider
  if (!current || !listByType.some((p) => p.id === current)) {
    form.value.provider = ''
    form.value.base_url = ''
    form.value.modelText = ''
    form.value.default_model = ''
  }
}

function onPresetModelSelect(value) {
  if (!value) return
  const listParsed = parseModelText(form.value.modelText)
  if (listParsed.includes(value)) {
    presetModelPick.value = ''
    return
  }
  const append = listParsed.length ? '\n' + value : value
  form.value.modelText = (form.value.modelText || '').trim() + append
  presetModelPick.value = ''
}
const rules = {
  service_type: [{ required: true, message: '请选择服务类型', trigger: 'change' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  provider: [{ required: true, message: '请选择或输入厂商', trigger: 'change' }],
  base_url: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }],
  api_key: [{ required: true, message: '请输入 API Key', trigger: 'blur' }]
}
const testVisible = ref(false)
const testResult = ref(null)
const testError = ref('')
const oneKeyTongyiVisible = ref(false)
const oneKeyTongyiKey = ref('')
const oneKeyTongyiSaving = ref(false)
const oneKeyVolcVisible = ref(false)
const oneKeyVolcKey = ref('')
const oneKeyVolcSaving = ref(false)

/** 预设厂商与模型（与参考前端一致） */
const providerConfigs = {
  text: [
    { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'] },
    { id: 'volcengine', name: '火山引擎', models: ['doubao-1-5-pro-32k-250115', 'kimi-k2-thinking-251104'] },
    { id: 'chatfire', name: 'Chatfire', models: ['gemini-3-flash-preview', 'claude-sonnet-4-5-20250929', 'doubao-seed-1-8-251228'] },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-pro', 'gemini-3-flash-preview'] },
    { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
    { id: 'qwen', name: '通义千问', models: ['qwen3-max', 'qwen-plus', 'qwen-flash'] }
  ],
  image: [
    { id: 'volcengine', name: '火山引擎', models: ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'] },
    { id: 'chatfire', name: 'Chatfire', models: ['nano-banana-pro', 'doubao-seedream-4-5-251128', 'qwen-image'] },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-3-pro-image-preview'] },
    { id: 'openai', name: 'OpenAI', models: ['dall-e-3', 'dall-e-2'] },
    { id: 'dashscope', name: '通义万象', models: ['wan2.6-image', 'qwen-image-edit-plus-2026-01-09', 'qwen-image-edit-plus', 'qwen-image-edit-max'] },
    { id: 'qwen_image', name: '通义千问', models: ['qwen-image-max', 'qwen-image-plus', 'qwen-image'] }
  ],
  storyboard_image: [
    { id: 'dashscope', name: '通义万象', models: ['wan2.6-image', 'qwen-image-edit-plus-2026-01-09', 'qwen-image-edit-plus', 'qwen-image-edit-max'] },
    { id: 'volcengine', name: '火山引擎', models: ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'] },
    { id: 'chatfire', name: 'Chatfire', models: ['nano-banana-pro', 'doubao-seedream-4-5-251128', 'qwen-image'] },
    { id: 'openai', name: 'OpenAI', models: ['dall-e-3', 'dall-e-2'] }
  ],
  video: [
    { id: 'volces', name: '火山引擎', models: ['doubao-seedance-1-5-pro-251215', 'doubao-seedance-1-0-lite-i2v-250428', 'doubao-seedance-1-0-lite-t2v-250428', 'doubao-seedance-1-0-pro-250528', 'doubao-seedance-1-0-pro-fast-251015'] },
    { id: 'chatfire', name: 'Chatfire', models: ['doubao-seedance-1-5-pro-251215', 'doubao-seedance-1-0-lite-i2v-250428', 'doubao-seedance-1-0-lite-t2v-250428', 'doubao-seedance-1-0-pro-250528', 'doubao-seedance-1-0-pro-fast-251015', 'sora-2', 'sora-2-pro'] },
    { id: 'minimax', name: 'MiniMax 海螺', models: ['MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-2.3-Fast', 'MiniMax-Hailuo-02'] },
    { id: 'dashscope', name: '通义万相', models: ['wan2.6-r2v-flash', 'wan2.6-t2v', 'wan2.2-kf2v-flash', 'wan2.6-i2v-flash', 'wanx2.1-vace-plus'] },
    { id: 'openai', name: 'OpenAI', models: ['sora-2', 'sora-2-pro'] }
  ]
}

/** 厂商 id → 默认 Base URL（与参考前端 AIConfigDialog 757-775 一致） */
function getBaseUrlForProvider(provider) {
  if (!provider) return ''
  const p = String(provider).toLowerCase()
  if (p === 'gemini' || p === 'google') return 'https://generativelanguage.googleapis.com'
  if (p === 'minimax') return 'https://api.minimaxi.com/v1'
  if (p === 'volces' || p === 'volcengine') return 'https://ark.cn-beijing.volces.com/api/v3'
  if (p === 'openai') return 'https://api.openai.com/v1'
  if (p === 'deepseek') return 'https://api.deepseek.com'
  if (p === 'dashscope') return 'https://dashscope.aliyuncs.com'
  if (p === 'qwen_image') return 'https://dashscope.aliyuncs.com'
  if (p === 'qwen') return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  return 'https://api.chatfire.site/v1'
}

/** 当前服务类型下的预设厂商列表（编辑时若当前 provider 不在列表则补一项） */
const availableProviderOptions = computed(() => {
  const st = form.value.service_type || 'text'
  const listByType = providerConfigs[st] || []
  const current = form.value.provider
  if (editingId.value && current && !listByType.some((p) => p.id === current)) {
    return [{ id: current, name: current + ' (当前)', models: [] }, ...listByType]
  }
  return listByType
})

/** 当前厂商的预设模型列表（用于追加预设模型） */
const availableModels = computed(() => {
  const st = form.value.service_type
  const provider = form.value.provider
  if (!st || !provider) return []
  const p = (providerConfigs[st] || []).find((x) => x.id === provider)
  return p?.models || []
})

function onProviderChange(providerId) {
  const st = form.value.service_type || 'text'
  const p = (providerConfigs[st] || []).find((x) => x.id === providerId)
  if (!p) {
    form.value.base_url = ''
    form.value.modelText = ''
    form.value.default_model = ''
    return
  }
  form.value.base_url = getBaseUrlForProvider(providerId)
  form.value.modelText = (p.models || []).join('\n')
  form.value.default_model = (p.models && p.models[0]) || ''
  if (!editingId.value) {
    form.value.name = (p.name || providerId) + ' ' + serviceTypeLabel(st)
  }
}

/** 通义一键配置用 */
const TONGYI_CONFIGS = [
  { service_type: 'text', name: '通义千问', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', provider: 'qwen', model: ['qwen-plus'] },
  { service_type: 'image', name: '通义万象 文本生图', base_url: 'https://dashscope.aliyuncs.com', provider: 'dashscope', model: ['wan2.6-image'] },
  { service_type: 'image', name: '通义千问 文本生图', base_url: 'https://dashscope.aliyuncs.com', provider: 'qwen_image', model: ['qwen-image-max', 'qwen-image-plus', 'qwen-image'] },
  { service_type: 'storyboard_image', name: '通义万象 分镜图', base_url: 'https://dashscope.aliyuncs.com', provider: 'dashscope', model: ['wan2.6-image'] },
  { service_type: 'video', name: '通义万相', base_url: 'https://dashscope.aliyuncs.com', provider: 'dashscope', model: ['wan2.2-kf2v-flash'] }
]

/** 火山引擎一键配置用 */
const VOLCENGINE_CONFIGS = [
  { service_type: 'text', name: '火山引擎 文本', base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['doubao-1-5-pro-32k-250115', 'kimi-k2-thinking-251104'] },
  { service_type: 'image', name: '火山引擎 即梦 文本生图', base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['doubao-seedream-4-5-251128'] },
  { service_type: 'storyboard_image', name: '火山引擎 即梦 分镜图', base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['doubao-seedream-4-5-251128'] },
  { service_type: 'video', name: '火山引擎 即梦 视频', base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volces', model: ['doubao-seedance-1-5-pro-251215'] }
]

function serviceTypeLabel(t) {
  const map = { text: '文本', image: '文本生成图片', storyboard_image: '分镜图片生成', video: '视频' }
  return map[t] || t
}

async function loadList() {
  loading.value = true
  try {
    list.value = await aiAPI.list()
  } catch (_) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function parseModelText(text) {
  if (!text || !String(text).trim()) return []
  return String(text)
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function resetForm() {
  editingId.value = null
  presetModelPick.value = ''
  form.value = {
    service_type: 'text',
    name: '',
    provider: '',
    base_url: '',
    api_key: '',
    modelText: '',
    default_model: '',
    priority: 0,
    is_default: true  // 新增时默认勾选「设为默认」，便于理解当前会使用哪条配置
  }
  formRef.value?.resetFields?.()
}

function openAdd() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  const model = Array.isArray(row.model) ? row.model : (row.model ? [row.model] : [])
  const modelList = model.map((m) => String(m).trim()).filter(Boolean)
  const defaultInList = row.default_model && modelList.includes(row.default_model)
  form.value = {
    service_type: row.service_type,
    name: row.name,
    provider: row.provider,
    base_url: row.base_url,
    api_key: row.api_key,
    modelText: modelList.join('\n'),
    default_model: defaultInList ? row.default_model : (modelList[0] || ''),
    priority: row.priority ?? 0,
    is_default: !!row.is_default
  }
  dialogVisible.value = true
}

async function submit() {
  await formRef.value?.validate?.().catch(() => {})
  saving.value = true
  try {
    const modelList = parseModelText(form.value.modelText)
    const defaultModel = form.value.default_model && modelList.includes(form.value.default_model)
      ? form.value.default_model
      : modelList[0] || null
    const payload = {
      service_type: form.value.service_type,
      name: form.value.name,
      provider: form.value.provider,
      base_url: form.value.base_url,
      api_key: form.value.api_key,
      model: modelList,
      default_model: defaultModel,
      priority: form.value.priority,
      is_default: form.value.is_default
    }
    if (editingId.value) {
      await aiAPI.update(editingId.value, payload)
      ElMessage.success('保存成功')
    } else {
      await aiAPI.create(payload)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    await loadList()
  } catch (e) {
    // request 已统一报错
  } finally {
    saving.value = false
  }
}

async function openTest(row) {
  testVisible.value = true
  testResult.value = null
  testError.value = ''
  try {
    await aiAPI.testConnection({
      base_url: row.base_url,
      api_key: row.api_key,
      model: Array.isArray(row.model) ? row.model[0] : row.model,
      provider: row.provider,
      endpoint: row.endpoint,
      service_type: row.service_type
    })
    testResult.value = true
  } catch (e) {
    testResult.value = false
    testError.value = e?.message || '请求失败'
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确定删除配置「${row.name}」？`, '删除确认', {
    type: 'warning'
  })
  try {
    await aiAPI.delete(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch (_) {}
}

function openOneKeyTongyi() {
  oneKeyTongyiKey.value = ''
  oneKeyTongyiVisible.value = true
}

async function submitOneKeyTongyi() {
  const apiKey = oneKeyTongyiKey.value.trim()
  if (!apiKey) return
  oneKeyTongyiSaving.value = true
  try {
    for (const cfg of TONGYI_CONFIGS) {
      const models = cfg.model || []
      await aiAPI.create({
        service_type: cfg.service_type,
        name: cfg.name,
        provider: cfg.provider,
        base_url: cfg.base_url,
        api_key: apiKey,
        model: models,
        default_model: models[0] || null,
        priority: 10,
        is_default: true
      })
    }
    ElMessage.success('已创建通义文本、文本生图、分镜图、视频配置')
    oneKeyTongyiVisible.value = false
    await loadList()
  } catch (_) {
    // 错误已由 request 统一提示
  } finally {
    oneKeyTongyiSaving.value = false
  }
}

function openOneKeyVolc() {
  oneKeyVolcKey.value = ''
  oneKeyVolcVisible.value = true
}

async function submitOneKeyVolc() {
  const apiKey = oneKeyVolcKey.value.trim()
  if (!apiKey) return
  oneKeyVolcSaving.value = true
  try {
    for (const cfg of VOLCENGINE_CONFIGS) {
      const models = cfg.model || []
      await aiAPI.create({
        service_type: cfg.service_type,
        name: cfg.name,
        provider: cfg.provider,
        base_url: cfg.base_url,
        api_key: apiKey,
        model: models,
        default_model: models[0] || null,
        priority: 10,
        is_default: true
      })
    }
    ElMessage.success('已创建火山引擎文本、文本生图、分镜图、视频配置')
    oneKeyVolcVisible.value = false
    await loadList()
  } catch (_) {
    // 错误已由 request 统一提示
  } finally {
    oneKeyVolcSaving.value = false
  }
}

onMounted(() => loadList())
</script>

<style scoped>
.ai-config-content {
  padding: 0;
}
.content-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.one-key-tip {
  margin: 0 0 12px;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}
.default-tip {
  margin: 0 0 16px;
  padding: 10px 12px;
  background: #f0f9ff;
  border-radius: 6px;
  font-size: 13px;
  color: #0369a1;
  line-height: 1.5;
}
.model-row { margin-bottom: 4px; }
.field-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
</style>
