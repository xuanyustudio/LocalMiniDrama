<template>
  <div class="sd2-asset-mgmt tab-content">
    <el-alert type="info" :closable="false" class="sd2-intro" show-icon>
      <template #title>
        <span>
          对接 BytePlus ModelArk / 火山方舟<strong>私有资产库</strong>（Seedance 2.0 等使用的 <code>Asset://</code> 素材）。
          配置完成后请点击下方<strong>「保存到 AI 配置」</strong>，创作页「SD2认证」将优先使用「即梦2角色认证」；若未配置则使用此处保存的官方资产库配置。
          官方流程：<a href="https://docs.byteplus.com/en/docs/ModelArk/2318270" target="_blank" rel="noopener">CreateAssetGroup</a>
          → CreateAsset → List / Get / Update / Delete。
          带 <code>?Action=</code> 的接口为<strong>控制面 OpenAPI</strong>，须使用控制台
          <a href="https://console.volcengine.com/iam/keymanage" target="_blank" rel="noopener">访问密钥（AK/SK）</a>签名，不能用推理用的 ARK API Key 当 Bearer，否则会报 Invalid Authorization（见
          <a href="https://docs.byteplus.com/en/docs/ModelArk/1298459" target="_blank" rel="noopener">认证说明</a>）。
          若已能调通接口但返回 <strong>403</strong> 且含 <code>not authorized</code> / <code>ark:CreateAssetGroup</code>，说明 AK 对应 IAM 用户<strong>缺策略</strong>：在控制台为该用户绑定含 ModelArk 私有资产/资产组管理的权限（参见
          <a href="https://docs.byteplus.com/en/docs/ModelArk/1263493" target="_blank" rel="noopener">IAM 访问控制</a>），勿仅用「能推理」的极简权限。
        </span>
      </template>
    </el-alert>

    <el-form label-width="120px" class="sd2-form">
      <el-form-item label="Base URL">
        <el-input
          v-model="baseUrl"
          placeholder="须含 /api/v3，如 https://ark.ap-southeast-1.byteplusapi.com/api/v3（仅域名时后端会尝试自动补全）"
          clearable
        />
        <p class="field-hint">OpenAPI 与推理共用前缀一般为 <code>/api/v3</code>；若只填域名可能导致路由不对、工程名不生效。</p>
      </el-form-item>
      <el-form-item label="鉴权方式">
        <el-radio-group v-model="authMode">
          <el-radio-button value="volc_sign">AK/SK 签名（官方 OpenAPI）</el-radio-button>
          <el-radio-button value="bearer">Bearer 推理 Key</el-radio-button>
        </el-radio-group>
        <p class="field-hint">选「官方 OpenAPI」路径时，请用本项并填写 AK/SK；选「Bearer」仅适合 <code>/asset/…</code> 等中转。</p>
      </el-form-item>
      <el-form-item v-if="authMode === 'bearer'" label="API Key">
        <el-input v-model="apiKey" type="password" show-password placeholder="推理用 ARK / 中转 API Key" clearable />
      </el-form-item>
      <template v-else>
        <el-form-item label="Access Key ID">
          <el-input v-model="accessKeyId" placeholder="控制台 IAM Access Key ID" clearable />
        </el-form-item>
        <el-form-item label="Secret Key">
          <el-input v-model="secretAccessKey" type="password" show-password placeholder="Secret Access Key" clearable />
        </el-form-item>
        <el-form-item label="Region">
          <el-input v-model="signRegion" placeholder="可空：国内 ark 多为 cn-beijing；BytePlus 国际多为 ap-southeast-1" clearable />
        </el-form-item>
      </template>
      <el-form-item label="路径模式">
        <el-select v-model="pathMode" style="width: 100%">
          <el-option label="官方 OpenAPI：POST {Base}?Action=…&Version=…（火山/BytePlus 默认）" value="open_api_query" />
          <el-option label="路径：POST {Base}/asset/{Action}（部分中转）" value="asset_subpath" />
          <el-option label="扁平：POST {Base}/{Action}" value="flat" />
        </el-select>
        <p class="field-hint">官方接口必须在 Query 里带 <code>Action</code>；若用 AnyFast 等自建路径再选中转模式。</p>
      </el-form-item>
      <el-form-item label="API Version">
        <el-input v-model="apiVersion" placeholder="默认 2024-01-01（仅官方 OpenAPI 模式使用）" clearable />
      </el-form-item>
      <el-form-item v-if="pathMode === 'open_api_query'" label="工程 / 项目名">
        <el-input
          v-model="projectName"
          placeholder="与控制台「项目」标识完全一致（区分大小写、下划线等）"
          clearable
        />
        <p class="field-hint">
          会写入 <strong>Query</strong> 与 <strong>JSON Body</strong> 的 <code>ProjectName</code>（与 Action 一并签名）。
          若仍报 403 且文案里是 <code>project/*</code>，多为 IAM 未授权该动作；请确认策略里资源是否包含你的工程（或 <code>project/*</code>），错误提示不一定替换为具体工程名。
        </p>
      </el-form-item>
      <el-form-item label="model（可选）">
        <el-input v-model="billingModel" placeholder="部分中转要求计费模型，如 volc-asset；官方直连可留空" clearable />
      </el-form-item>
      <el-form-item label="从配置填入">
        <el-select
          v-model="fillConfigId"
          filterable
          clearable
          placeholder="选择已保存的视频类配置（火山等）"
          style="width: 100%"
          @change="onFillFromSaved"
        >
          <el-option
            v-for="c in videoLikeConfigs"
            :key="c.id"
            :label="`${c.name} · ${c.base_url || ''}`"
            :value="c.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="默认资产组 Id">
        <el-input
          v-model="assetGroupIdForCert"
          placeholder="创作页 SD2 认证写入此组；可左侧点选资产组自动填入"
          clearable
        />
        <p class="field-hint">保存到 AI 配置时必填。与下方「资产」列表使用的组 Id 一致。</p>
      </el-form-item>
      <el-form-item label=" ">
        <div class="sd2-save-row">
          <el-button type="primary" :loading="savingConfig" @click="saveToAiConfig">
            保存到 AI 配置
          </el-button>
          <span v-if="savedConfigId" class="sd2-saved-hint">
            已关联配置 #{{ savedConfigId }}（创作页 SD2 认证在未配置「即梦2角色认证」时使用）
          </span>
        </div>
      </el-form-item>
    </el-form>

    <el-row :gutter="16">
      <el-col :span="11">
        <div class="panel-title">资产组</div>
        <div class="panel-actions">
          <el-button type="primary" size="small" :loading="loadingGroups" @click="refreshGroups">刷新列表</el-button>
          <el-button type="success" size="small" @click="openCreateGroup">新建组</el-button>
        </div>
        <el-table
          :data="groupRows"
          size="small"
          stripe
          highlight-current-row
          max-height="320"
          @current-change="onGroupRowChange"
        >
          <el-table-column prop="Id" label="Id" min-width="120" show-overflow-tooltip />
          <el-table-column prop="Name" label="名称" min-width="100" show-overflow-tooltip />
          <el-table-column label="操作" width="168" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="getGroupDetail(row)">详情</el-button>
              <el-button link type="primary" size="small" @click="openEditGroup(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="deleteGroup(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
      <el-col :span="13">
        <div class="panel-title">资产（需组 Id）</div>
        <div class="panel-actions row-gap">
          <el-input v-model="assetGroupIdInput" placeholder="组 Id，或左侧点选一行" clearable style="flex: 1; min-width: 140px" />
          <el-button type="primary" size="small" :loading="loadingAssets" @click="refreshAssets">刷新</el-button>
          <el-button type="success" size="small" @click="openCreateAsset">新建资产</el-button>
        </div>
        <el-table :data="assetRows" size="small" stripe max-height="320">
          <el-table-column prop="Id" label="Id" min-width="120" show-overflow-tooltip />
          <el-table-column prop="Name" label="名称" min-width="90" show-overflow-tooltip />
          <el-table-column prop="AssetType" label="类型" width="88" />
          <el-table-column label="操作" width="168" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="getAssetDetail(row)">详情</el-button>
              <el-button link type="primary" size="small" @click="openEditAsset(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="deleteAsset(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <div class="panel-title" style="margin-top: 16px">最近一次响应（调试）</div>
    <el-input v-model="lastRawJson" type="textarea" :rows="6" readonly class="mono" />

    <!-- 新建资产组 -->
    <el-dialog v-model="dlgGroupCreate" title="CreateAssetGroup" width="480px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="Name" required>
          <el-input v-model="formGroupName" placeholder="资产组名称" />
        </el-form-item>
        <el-form-item label="扩展 JSON">
          <el-input v-model="formGroupExtraJson" type="textarea" :rows="3" placeholder='可选，合并进请求体，如 {"Description":"..."}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgGroupCreate = false">取消</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitCreateGroup">提交</el-button>
      </template>
    </el-dialog>

    <!-- 编辑资产组 -->
    <el-dialog v-model="dlgGroupEdit" title="UpdateAssetGroup" width="520px" destroy-on-close>
      <el-alert type="warning" :closable="false" title="按官方文档填写需更新的字段；以下为常用名称修改。" style="margin-bottom: 12px" />
      <el-form label-width="100px">
        <el-form-item label="Id" required>
          <el-input v-model="editGroupId" disabled />
        </el-form-item>
        <el-form-item label="Name">
          <el-input v-model="editGroupName" />
        </el-form-item>
        <el-form-item label="完整 JSON">
          <el-input v-model="editGroupFullJson" type="textarea" :rows="6" placeholder='若填写则优先整段作为请求体（须含 Id）' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgGroupEdit = false">取消</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitUpdateGroup">提交</el-button>
      </template>
    </el-dialog>

    <!-- 新建资产 -->
    <el-dialog v-model="dlgAssetCreate" title="CreateAsset" width="520px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="GroupId" required>
          <el-input v-model="formAssetGroupId" placeholder="资产组 Id" />
        </el-form-item>
        <el-form-item label="Name" required>
          <el-input v-model="formAssetName" />
        </el-form-item>
        <el-form-item label="AssetType">
          <el-select v-model="formAssetType" style="width: 100%">
            <el-option label="Image" value="Image" />
            <el-option label="Video" value="Video" />
            <el-option label="Audio" value="Audio" />
          </el-select>
        </el-form-item>
        <el-form-item label="model">
          <el-input v-model="formAssetModel" placeholder="视频建议 volc-asset-video；音频 volc-asset-audio；图片可空" clearable />
        </el-form-item>
        <el-form-item label="URL">
          <el-input v-model="formAssetUrl" type="textarea" :rows="2" placeholder="公网 URL / data:image/...;base64,..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgAssetCreate = false">取消</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitCreateAsset">提交</el-button>
      </template>
    </el-dialog>

    <!-- 编辑资产 -->
    <el-dialog v-model="dlgAssetEdit" title="UpdateAsset" width="520px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="Id" required>
          <el-input v-model="editAssetId" disabled />
        </el-form-item>
        <el-form-item label="Name">
          <el-input v-model="editAssetName" />
        </el-form-item>
        <el-form-item label="完整 JSON">
          <el-input v-model="editAssetFullJson" type="textarea" :rows="6" placeholder="若填写则整段作为请求体（须含 Id）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgAssetEdit = false">取消</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitUpdateAsset">提交</el-button>
      </template>
    </el-dialog>

    <!-- 详情 JSON -->
    <el-dialog v-model="dlgDetail" title="详情" width="640px" destroy-on-close>
      <el-input :model-value="detailJson" type="textarea" :rows="16" readonly class="mono" />
      <template #footer>
        <el-button type="primary" @click="dlgDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { aiAPI } from '@/api/ai'

const props = defineProps({
  /** AI 配置列表（与 AI 配置页同源），用于一键填入 Base / Key */
  configs: { type: Array, default: () => [] },
})

const emit = defineEmits(['saved'])

const baseUrl = ref('')
const apiKey = ref('')
const pathMode = ref('open_api_query')
const apiVersion = ref('2024-01-01')
/** OpenAPI 可选查询参数 ProjectName（与控制台项目对应，便于 IAM 精确到 project/某工程 而非 project/*） */
const projectName = ref('')
const authMode = ref('volc_sign')
const accessKeyId = ref('')
const secretAccessKey = ref('')
const signRegion = ref('')
/** 仅合并到 List / Create 类请求，避免影响 Get/Update/Delete */
const billingModel = ref('')
const fillConfigId = ref(null)
const savedConfigId = ref(null)
const savingConfig = ref(false)
/** 创作页 SD2 认证默认写入的资产组 */
const assetGroupIdForCert = ref('')
const loadingGroups = ref(false)
const loadingAssets = ref(false)
const dlgLoading = ref(false)
const lastRawJson = ref('')
const assetGroupIdInput = ref('')
const lastListGroupsPayload = ref(null)
const lastListAssetsPayload = ref(null)

const dlgGroupCreate = ref(false)
const formGroupName = ref('')
const formGroupExtraJson = ref('')

const dlgGroupEdit = ref(false)
const editGroupId = ref('')
const editGroupName = ref('')
const editGroupFullJson = ref('')

const dlgAssetCreate = ref(false)
const formAssetGroupId = ref('')
const formAssetName = ref('')
const formAssetType = ref('Image')
const formAssetModel = ref('')
const formAssetUrl = ref('')

const dlgAssetEdit = ref(false)
const editAssetId = ref('')
const editAssetName = ref('')
const editAssetFullJson = ref('')

const dlgDetail = ref(false)
const detailJson = ref('')

const videoLikeConfigs = computed(() => {
  const rows = props.configs || []
  return rows.filter((c) => {
    if (c.service_type !== 'video') return false
    const u = (c.base_url || '').toLowerCase()
    const p = (c.api_protocol || '').toLowerCase()
    return (
      p.includes('volc') ||
      u.includes('volces.com') ||
      u.includes('byteplus') ||
      u.includes('byteplustech') ||
      u.includes('/ark')
    )
  })
})

const savedModelArkConfigs = computed(() => {
  return (props.configs || []).filter((c) => c.service_type === 'model_ark_asset')
})

function parseSettingsJson(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (_) {
    return {}
  }
}

function loadFromSavedRow(row) {
  if (!row) return
  savedConfigId.value = row.id
  baseUrl.value = (row.base_url || '').replace(/\/$/, '')
  apiKey.value = row.api_key || ''
  const s = parseSettingsJson(row.settings)
  authMode.value = s.auth_mode || 'volc_sign'
  pathMode.value = s.path_mode || 'open_api_query'
  apiVersion.value = s.api_version || '2024-01-01'
  projectName.value = s.project_name || ''
  billingModel.value = s.billing_model || ''
  assetGroupIdForCert.value = s.asset_group_id || ''
  accessKeyId.value = s.access_key_id || ''
  secretAccessKey.value = s.secret_access_key || ''
  signRegion.value = s.sign_region || ''
  if (assetGroupIdForCert.value) assetGroupIdInput.value = assetGroupIdForCert.value
}

function applyDefaultSavedConfig() {
  const rows = savedModelArkConfigs.value
  if (!rows.length) return
  const pick = rows.find((c) => c.is_default) || rows[0]
  loadFromSavedRow(pick)
}

watch(
  () => props.configs,
  () => {
    if (!savedConfigId.value) applyDefaultSavedConfig()
    else {
      const row = (props.configs || []).find((c) => c.id === savedConfigId.value)
      if (row) loadFromSavedRow(row)
    }
  },
  { immediate: true }
)

onMounted(() => {
  applyDefaultSavedConfig()
})

async function saveToAiConfig() {
  const w = connWarn()
  if (!connReady() || w) {
    ElMessage.warning(w || '请先完成连接信息')
    return
  }
  if (!assetGroupIdForCert.value.trim()) {
    ElMessage.warning('请填写默认资产组 Id（创作页 SD2 认证需要）')
    return
  }
  const settings = {
    auth_mode: authMode.value,
    path_mode: pathMode.value,
    api_version: apiVersion.value.trim() || '2024-01-01',
    project_name: projectName.value.trim(),
    billing_model: billingModel.value.trim(),
    asset_group_id: assetGroupIdForCert.value.trim(),
  }
  if (authMode.value === 'volc_sign') {
    settings.access_key_id = accessKeyId.value.trim()
    settings.secret_access_key = secretAccessKey.value.trim()
    if (signRegion.value.trim()) settings.sign_region = signRegion.value.trim()
  }
  const payload = {
    service_type: 'model_ark_asset',
    name: 'SD2 资产库',
    provider: 'model_ark',
    base_url: baseUrl.value.trim(),
    api_key: authMode.value === 'bearer' ? apiKey.value : '',
    model: ['-'],
    default_model: '-',
    priority: 10,
    is_default: true,
    settings: JSON.stringify(settings),
  }
  savingConfig.value = true
  try {
    if (savedConfigId.value) {
      await aiAPI.update(savedConfigId.value, payload)
      ElMessage.success('已更新 AI 配置')
    } else {
      const created = await aiAPI.create(payload)
      savedConfigId.value = created?.id ?? null
      ElMessage.success('已保存到 AI 配置')
    }
    emit('saved')
  } catch (_) {
    /* request 已统一报错 */
  } finally {
    savingConfig.value = false
  }
}

function setLastJson(obj) {
  try {
    lastRawJson.value = JSON.stringify(obj, null, 2)
  } catch (_) {
    lastRawJson.value = String(obj)
  }
}

function extractRows(resp) {
  if (!resp) return []
  if (Array.isArray(resp)) return resp
  const keys = [
    'Items',
    'List',
    'AssetGroups',
    'Assets',
    'Groups',
    'Data',
  ]
  for (const k of keys) {
    if (Array.isArray(resp[k])) return resp[k]
  }
  const r = resp.Result || resp.result
  if (r && typeof r === 'object') {
    for (const k of keys) {
      if (Array.isArray(r[k])) return r[k]
    }
  }
  return []
}

const groupRows = computed(() => extractRows(lastListGroupsPayload.value))
const assetRows = computed(() => extractRows(lastListAssetsPayload.value))

function onFillFromSaved(id) {
  if (id == null || id === '') return
  const c = (props.configs || []).find((x) => x.id === id)
  if (!c) return
  baseUrl.value = (c.base_url || '').replace(/\/$/, '')
  apiKey.value = c.api_key || ''
  ElMessage.success('已填入所选配置的 Base URL 与 API Key')
}

function onGroupRowChange(row) {
  if (row && row.Id) {
    assetGroupIdInput.value = row.Id
    if (!assetGroupIdForCert.value.trim()) assetGroupIdForCert.value = row.Id
  }
}

function mergeBillingModel(payload, withModel) {
  const p = { ...(payload || {}) }
  if (withModel && billingModel.value.trim() && !String(p.model || '').trim()) {
    p.model = billingModel.value.trim()
  }
  return p
}

function connReady() {
  if (!baseUrl.value.trim()) return false
  if (authMode.value === 'volc_sign') {
    return !!(accessKeyId.value.trim() && secretAccessKey.value.trim())
  }
  return !!apiKey.value.trim()
}

function connWarn() {
  if (!baseUrl.value.trim()) return '请先填写 Base URL'
  if (authMode.value === 'volc_sign') {
    if (!accessKeyId.value.trim() || !secretAccessKey.value.trim()) {
      return '官方 OpenAPI 请填写 Access Key ID 与 Secret Access Key（控制台 IAM，非推理 API Key）'
    }
  } else if (!apiKey.value.trim()) {
    return '请先填写 API Key'
  }
  if (authMode.value === 'volc_sign' && pathMode.value !== 'open_api_query') {
    return 'AK/SK 签名请配合「官方 OpenAPI」路径模式'
  }
  return ''
}

async function call(action, payload, opts = {}) {
  const { withBillingModel = false } = opts
  const body = {
    base_url: baseUrl.value.trim(),
    action,
    path_mode: pathMode.value,
    api_version: apiVersion.value.trim() || undefined,
    auth_mode: authMode.value,
    payload: mergeBillingModel(payload, withBillingModel),
  }
  if (pathMode.value === 'open_api_query' && projectName.value.trim()) {
    body.project_name = projectName.value.trim()
  }
  if (authMode.value === 'bearer') {
    body.api_key = apiKey.value
  } else {
    body.access_key_id = accessKeyId.value.trim()
    body.secret_access_key = secretAccessKey.value.trim()
    if (signRegion.value.trim()) body.sign_region = signRegion.value.trim()
  }
  return aiAPI.modelArkAsset(body)
}

async function refreshGroups() {
  const w = connWarn()
  if (!connReady() || w) {
    ElMessage.warning(w || '请先完成连接信息')
    return
  }
  loadingGroups.value = true
  try {
    const body = {
      PageNumber: 1,
      PageSize: 50,
      /** Filter、Filter.GroupType 均为官方 ListAssetGroups 必填；AIGC 为私有资产库常用类型 */
      Filter: {
        GroupType: 'AIGC',
      },
    }
    const data = await call('ListAssetGroups', body, { withBillingModel: true })
    lastListGroupsPayload.value = data
    setLastJson(data)
  } catch (e) {
    lastListGroupsPayload.value = null
  } finally {
    loadingGroups.value = false
  }
}

async function refreshAssets() {
  const gid = assetGroupIdInput.value.trim()
  const w = connWarn()
  if (!connReady() || w) {
    ElMessage.warning(w || '请先完成连接信息')
    return
  }
  if (!gid) {
    ElMessage.warning('请填写或选择资产组 Id')
    return
  }
  loadingAssets.value = true
  try {
    const body = {
      PageNumber: 1,
      PageSize: 50,
      Filter: {
        GroupType: 'AIGC',
        GroupIds: [gid],
      },
    }
    const data = await call('ListAssets', body, { withBillingModel: true })
    lastListAssetsPayload.value = data
    setLastJson(data)
  } catch (e) {
    lastListAssetsPayload.value = null
  } finally {
    loadingAssets.value = false
  }
}

function openCreateGroup() {
  formGroupName.value = ''
  formGroupExtraJson.value = ''
  dlgGroupCreate.value = true
}

async function submitCreateGroup() {
  if (!formGroupName.value.trim()) {
    ElMessage.warning('请填写 Name')
    return
  }
  dlgLoading.value = true
  try {
    let extra = {}
    if (formGroupExtraJson.value.trim()) {
      try {
        extra = JSON.parse(formGroupExtraJson.value)
      } catch (_) {
        ElMessage.error('扩展 JSON 格式无效')
        return
      }
    }
    const payload = { Name: formGroupName.value.trim(), ...extra }
    const data = await call('CreateAssetGroup', payload, { withBillingModel: true })
    setLastJson(data)
    ElMessage.success('已创建')
    dlgGroupCreate.value = false
    await refreshGroups()
  } finally {
    dlgLoading.value = false
  }
}

async function getGroupDetail(row) {
  dlgLoading.value = true
  try {
    const data = await call('GetAssetGroup', { Id: row.Id })
    detailJson.value = JSON.stringify(data, null, 2)
    dlgDetail.value = true
    setLastJson(data)
  } finally {
    dlgLoading.value = false
  }
}

function openEditGroup(row) {
  editGroupId.value = row.Id
  editGroupName.value = row.Name || ''
  editGroupFullJson.value = ''
  dlgGroupEdit.value = true
}

async function submitUpdateGroup() {
  dlgLoading.value = true
  try {
    let payload
    if (editGroupFullJson.value.trim()) {
      try {
        payload = JSON.parse(editGroupFullJson.value)
      } catch (_) {
        ElMessage.error('完整 JSON 无效')
        return
      }
    } else {
      payload = { Id: editGroupId.value, Name: editGroupName.value }
    }
    const data = await call('UpdateAssetGroup', payload)
    setLastJson(data)
    ElMessage.success('已更新')
    dlgGroupEdit.value = false
    await refreshGroups()
  } finally {
    dlgLoading.value = false
  }
}

async function deleteGroup(row) {
  try {
    await ElMessageBox.confirm(`确定删除资产组「${row.Name || row.Id}」？`, 'DeleteAssetGroup', {
      type: 'warning',
    })
  } catch (_) {
    return
  }
  dlgLoading.value = true
  try {
    const data = await call('DeleteAssetGroup', { Id: row.Id })
    setLastJson(data)
    ElMessage.success('已删除')
    if (assetGroupIdInput.value === row.Id) assetGroupIdInput.value = ''
    await refreshGroups()
  } finally {
    dlgLoading.value = false
  }
}

function openCreateAsset() {
  formAssetGroupId.value = assetGroupIdInput.value.trim()
  formAssetName.value = ''
  formAssetType.value = 'Image'
  formAssetModel.value = ''
  formAssetUrl.value = ''
  dlgAssetCreate.value = true
}

async function submitCreateAsset() {
  if (!formAssetGroupId.value.trim() || !formAssetName.value.trim()) {
    ElMessage.warning('请填写 GroupId 与 Name')
    return
  }
  dlgLoading.value = true
  try {
    const payload = {
      GroupId: formAssetGroupId.value.trim(),
      Name: formAssetName.value.trim(),
      AssetType: formAssetType.value,
    }
    if (formAssetUrl.value.trim()) payload.URL = formAssetUrl.value.trim()
    if (formAssetModel.value.trim()) payload.model = formAssetModel.value.trim()
    const data = await call('CreateAsset', payload, { withBillingModel: true })
    setLastJson(data)
    ElMessage.success('已创建')
    dlgAssetCreate.value = false
    await refreshAssets()
  } finally {
    dlgLoading.value = false
  }
}

async function getAssetDetail(row) {
  dlgLoading.value = true
  try {
    const data = await call('GetAsset', { Id: row.Id })
    detailJson.value = JSON.stringify(data, null, 2)
    dlgDetail.value = true
    setLastJson(data)
  } finally {
    dlgLoading.value = false
  }
}

function openEditAsset(row) {
  editAssetId.value = row.Id
  editAssetName.value = row.Name || ''
  editAssetFullJson.value = ''
  dlgAssetEdit.value = true
}

async function submitUpdateAsset() {
  dlgLoading.value = true
  try {
    let payload
    if (editAssetFullJson.value.trim()) {
      try {
        payload = JSON.parse(editAssetFullJson.value)
      } catch (_) {
        ElMessage.error('完整 JSON 无效')
        return
      }
    } else {
      payload = { Id: editAssetId.value, Name: editAssetName.value }
    }
    const data = await call('UpdateAsset', payload)
    setLastJson(data)
    ElMessage.success('已更新')
    dlgAssetEdit.value = false
    await refreshAssets()
  } finally {
    dlgLoading.value = false
  }
}

async function deleteAsset(row) {
  try {
    await ElMessageBox.confirm(`确定删除资产「${row.Name || row.Id}」？`, 'DeleteAsset', { type: 'warning' })
  } catch (_) {
    return
  }
  dlgLoading.value = true
  try {
    const data = await call('DeleteAsset', { Id: row.Id })
    setLastJson(data)
    ElMessage.success('已删除')
    await refreshAssets()
  } finally {
    dlgLoading.value = false
  }
}
</script>

<style scoped>
.sd2-asset-mgmt {
  max-width: 1100px;
}
.sd2-intro {
  margin-bottom: 14px;
}
.sd2-intro code {
  font-size: 12px;
}
.sd2-form {
  margin-bottom: 8px;
  max-width: 720px;
}
.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.field-hint code {
  font-size: 11px;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.panel-actions.row-gap {
  flex-wrap: nowrap;
}
.mono :deep(textarea) {
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
}
.sd2-save-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}
.sd2-saved-hint {
  font-size: 12px;
  color: #67c23a;
  line-height: 1.5;
}
</style>
