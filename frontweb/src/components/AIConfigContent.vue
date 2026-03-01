<template>
  <div class="ai-config-content">
    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane label="AI 配置" name="configs">
        <div class="tab-content">
          <div class="content-actions">
            <el-button type="primary" @click="openAdd">
              <el-icon><Plus /></el-icon>
              添加配置
            </el-button>
            <el-button plain @click="exportConfigs">
              <el-icon><Download /></el-icon>
              导出配置
            </el-button>
            <el-button plain @click="triggerImport">
              <el-icon><Upload /></el-icon>
              导入配置
            </el-button>
            <input ref="importFileRef" type="file" accept=".json" style="display:none" @change="importConfigs" />
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
        </div>
      </el-tab-pane>
      <el-tab-pane label="高级设置（提示词）" name="prompts">
        <div class="tab-content">
          <PromptEditor />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 添加/编辑 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑配置' : '添加配置'"
      width="520px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item prop="service_type">
          <template #label>
            <span class="form-label-tip">服务类型
              <el-tooltip placement="top" :show-arrow="true" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    <b>文本/对话</b>：用于 AI 生成故事剧本<br>
                    <b>文本生成图片</b>：角色、场景、道具的图片生成（不支持参考图）<br>
                    <b>分镜图片生成</b>：生成分镜图片，支持传入角色参考图<br>
                    <b>视频生成</b>：根据分镜图生成视频片段
                  </div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-select v-model="form.service_type" placeholder="选择类型" style="width: 100%" @change="onServiceTypeChange">
            <el-option label="文本/对话" value="text" />
            <el-option label="文本生成图片" value="image" />
            <el-option label="分镜图片生成" value="storyboard_image" />
            <el-option label="视频生成" value="video" />
          </el-select>
        </el-form-item>
        <el-form-item prop="provider">
          <template #label>
            <span class="form-label-tip">厂商
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    从下拉选择预设厂商，会自动填入 Base URL 和模型列表。<br>
                    也可直接输入自定义厂商名（需手动填写其他字段）。<br>
                    <b>推荐</b>：通义千问 / 火山引擎，国内访问稳定。
                  </div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-select
            v-model="form.provider"
            placeholder="选择预设厂商（自动填充 URL 和模型）"
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
              :class="p.id === '__custom__' ? 'provider-custom-option' : ''"
            />
          </el-select>
        </el-form-item>
        <el-form-item prop="name">
          <template #label>
            <span class="form-label-tip">名称
              <el-tooltip content="配置的显示名，用于在列表中区分不同配置，选择厂商后可自动生成。" placement="top" popper-class="cfg-tip-popper">
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model="form.name" placeholder="如：OpenAI 图文，可自动生成" />
        </el-form-item>
        <el-form-item prop="base_url">
          <template #label>
            <span class="form-label-tip">Base URL
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    API 接口地址，选择预设厂商后自动填入，一般无需修改。<br>
                    示例：https://dashscope.aliyuncs.com
                  </div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model="form.base_url" placeholder="选择预设厂商后自动填充，可修改" />
        </el-form-item>
        <el-form-item prop="api_key">
          <template #label>
            <span class="form-label-tip">API Key
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    在对应 AI 平台申请的密钥，用于身份验证。<br>
                    通义：<b>dashscope.aliyuncs.com</b><br>
                    火山：<b>console.volcengine.com/ark</b>
                  </div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model="form.api_key" type="password" placeholder="API 密钥" show-password />
        </el-form-item>
        <!-- 端点配置：视频必填（自定义厂商）；图片/分镜在使用代理或特殊厂商时填写 -->
        <template v-if="form.service_type !== 'text'">
          <el-form-item>
            <template #label>
              <span class="form-label-tip">提交端点
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content">
                      接口路径，追加在 Base URL 之后。<br>
                      <b>预设厂商</b>（火山 / 通义 / NanoBanana）留空，系统自动推断。<br>
                      <b>视频自定义厂商</b>必须填写，如 /v1/video/generations<br>
                      <b>NanoBanana 代理</b>（如星衍云）填写代理路径，如 /fal-ai/nano-banana
                    </div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="form.endpoint" :placeholder="form.service_type === 'video' ? '自定义视频厂商必填，如 /v1/video/generations；预设厂商留空' : '代理或特殊厂商时填写，如 /fal-ai/nano-banana；预设厂商留空'" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-tip">查询端点
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content">
                      查询任务状态的接口路径，{taskId} 会被替换为实际任务 ID。<br>
                      <b>预设厂商</b>留空即可，由系统自动推断。<br>
                      <b>视频自定义厂商</b>必须填写，如 /v1/video/tasks/{taskId}<br>
                      <b>图片/NanoBanana</b> 代理若不支持轮询可留空
                    </div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="form.query_endpoint" placeholder="自定义视频厂商必填，如 /v1/video/tasks/{taskId}；预设厂商留空" />
          </el-form-item>
        </template>
        <el-form-item>
          <template #label>
            <span class="form-label-tip">模型列表
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    该厂商下可用的模型，多个用逗号或换行分隔。<br>
                    可从上方「追加预设模型」下拉快速添加，也可手动输入。
                  </div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
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
        <el-form-item>
          <template #label>
            <span class="form-label-tip">默认模型
              <el-tooltip content="有多个模型时，实际调用哪个进行生成。建议选响应快、效果好的那个。" placement="top" popper-class="cfg-tip-popper">
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
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
        <el-form-item>
          <template #label>
            <span class="form-label-tip">优先级
              <el-tooltip content="同一服务类型有多个配置时，数字越大越优先被调用。默认 0，一般设为 10 即可。" placement="top" popper-class="cfg-tip-popper">
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input-number v-model="form.priority" :min="0" :max="999" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <span class="form-label-tip">设为默认
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    每种服务类型只有一个「默认」配置。<br>
                    生成时系统会优先使用默认配置，建议每类至少设一个默认。
                  </div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
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
      title="一键配置通义千问 / 万象"
      width="520px"
      :close-on-click-modal="false"
      @closed="oneKeyTongyiKey = ''"
    >
      <div class="one-key-help">
        <div class="one-key-section">
          <div class="one-key-section-title">📋 将自动创建以下配置</div>
          <ul class="one-key-list">
            <li><b>文本/对话</b>：通义千问（qwen-plus）— 生成故事剧本</li>
            <li><b>文本生成图片</b>：通义万象（wan2.6-image）— 角色/场景/道具图</li>
            <li><b>文本生成图片</b>：通义千问图像（qwen-image-max）— 角色/场景图备选</li>
            <li><b>分镜图片生成</b>：通义万象（wan2.6-image）— 支持角色参考图</li>
            <li><b>视频生成</b>：通义万相（wan2.2-kf2v-flash）— 生成视频片段</li>
          </ul>
        </div>
        <div class="one-key-section">
          <div class="one-key-section-title">🔑 如何申请 API Key</div>
          <ol class="one-key-list">
            <li>前往阿里云百炼控制台：<a href="https://bailian.console.aliyun.com/" target="_blank" class="one-key-link">bailian.console.aliyun.com</a></li>
            <li>注册/登录阿里云账号，开通「百炼」服务（新用户有免费额度）</li>
            <li>左侧菜单点击「API Key」→「创建 API Key」</li>
            <li>复制生成的 Key（格式：<code>sk-xxxxxxxx</code>）填入下方</li>
          </ol>
          <p class="one-key-note">💡 通义一个 Key 同时支持文本、图片、视频等所有服务</p>
        </div>
      </div>
      <el-form label-width="0" style="margin-top: 8px">
        <el-form-item>
          <el-input
            v-model="oneKeyTongyiKey"
            type="password"
            placeholder="请输入通义（DashScope）API Key，格式：sk-xxxxxxxx"
            show-password-on="click"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="oneKeyTongyiVisible = false">取消</el-button>
        <el-button type="success" :loading="oneKeyTongyiSaving" :disabled="!oneKeyTongyiKey.trim()" @click="submitOneKeyTongyi">
          确定，一键创建配置
        </el-button>
      </template>
    </el-dialog>

    <!-- 一键配置火山 -->
    <el-dialog
      v-model="oneKeyVolcVisible"
      title="一键配置火山引擎（方舟）"
      width="520px"
      :close-on-click-modal="false"
      @closed="oneKeyVolcKey = ''"
    >
      <div class="one-key-help">
        <div class="one-key-section">
          <div class="one-key-section-title">📋 将自动创建以下配置</div>
          <ul class="one-key-list">
            <li><b>文本/对话</b>：豆包 1.5 Pro（doubao-1-5-pro-32k-250115）— 生成故事剧本</li>
            <li><b>文本生成图片</b>：即梦 4.5（doubao-seedream-4-5-251128）— 角色/场景/道具图</li>
            <li><b>分镜图片生成</b>：即梦 4.5（doubao-seedream-4-5-251128）— 支持角色参考图</li>
            <li><b>视频生成</b>：即梦 Seedance 1.5 Pro — 生成视频片段</li>
          </ul>
        </div>
        <div class="one-key-section">
          <div class="one-key-section-title">🔑 如何申请 API Key</div>
          <ol class="one-key-list">
            <li>前往火山引擎方舟控制台：<a href="https://console.volcengine.com/ark" target="_blank" class="one-key-link">console.volcengine.com/ark</a></li>
            <li>注册/登录字节跳动火山引擎账号（新用户有免费 token 额度）</li>
            <li>左侧菜单点击「API Key 管理」→「创建 API Key」</li>
            <li>复制生成的 Key 填入下方</li>
          </ol>
          <p class="one-key-note">💡 方舟平台一个 Key 同时支持豆包文本、即梦图片与视频等所有服务</p>
          <p class="one-key-note">⚠️ 视频生成需在控制台「开通」对应模型（即梦 Seedance）后方可使用</p>
        </div>
      </div>
      <el-form label-width="0" style="margin-top: 8px">
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
          确定，一键创建配置
        </el-button>
      </template>
    </el-dialog>

    <!-- 测试连接 -->
    <el-dialog v-model="testVisible" title="测试连接" width="420px">
      <p v-if="testResult === null">正在测试…</p>
      <template v-else-if="testResult">
        <el-alert
          v-if="testServiceType === 'image' || testServiceType === 'storyboard_image' || testServiceType === 'video'"
          type="success"
          title="连接成功"
          description="API Key 有效，网络已连通。提示：测试仅验证 Key 合法性，不实际生成图片/视频，模型名填错、账号未开通该功能或配额不足时实际生成仍可能报错。"
          show-icon
          :closable="false"
        />
        <el-alert
          v-else
          type="success"
          title="连接成功"
          description="文本生成接口已正常响应。"
          show-icon
          :closable="false"
        />
      </template>
      <el-alert v-else type="error" :title="testError || '连接失败'" show-icon :closable="false" />
      <template #footer>
        <el-button @click="testVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MagicStick, QuestionFilled, Download, Upload } from '@element-plus/icons-vue'
import { aiAPI } from '@/api/ai'
import PromptEditor from '@/components/PromptEditor.vue'

const activeTab = ref('configs')
const importFileRef = ref(null)
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
  endpoint: '',
  query_endpoint: '',
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
const testServiceType = ref('')
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
    { id: 'nano_banana', name: 'NanoBanana', models: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'] },
    { id: 'chatfire', name: 'Chatfire', models: ['nano-banana-pro', 'doubao-seedream-4-5-251128', 'qwen-image'] },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-3-pro-image-preview'] },
    { id: 'openai', name: 'OpenAI', models: ['dall-e-3', 'dall-e-2'] },
    { id: 'dashscope', name: '通义万象', models: ['wan2.6-image', 'qwen-image-edit-plus-2026-01-09', 'qwen-image-edit-plus', 'qwen-image-edit-max'] },
    { id: 'qwen_image', name: '通义千问', models: ['qwen-image-max', 'qwen-image-plus', 'qwen-image'] }
  ],
  storyboard_image: [
    { id: 'dashscope', name: '通义万象', models: ['wan2.6-image', 'qwen-image-edit-plus-2026-01-09', 'qwen-image-edit-plus', 'qwen-image-edit-max'] },
    { id: 'volcengine', name: '火山引擎', models: ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'] },
    { id: 'nano_banana', name: 'NanoBanana', models: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'] },
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
  if (p === 'nano_banana') return 'https://api.nanobananaapi.ai'
  return 'https://api.chatfire.site/v1'
}

const CUSTOM_PROVIDER_SENTINEL = '__custom__'

/** 当前服务类型下的预设厂商列表（编辑时若当前 provider 不在列表则补一项；末尾始终附一项自定义入口） */
const availableProviderOptions = computed(() => {
  const st = form.value.service_type || 'text'
  const listByType = providerConfigs[st] || []
  const current = form.value.provider
  let result = [...listByType]
  if (editingId.value && current && current !== CUSTOM_PROVIDER_SENTINEL && !listByType.some((p) => p.id === current)) {
    result = [{ id: current, name: current + ' (当前)', models: [] }, ...result]
  }
  result.push({ id: CUSTOM_PROVIDER_SENTINEL, name: '✏️ 自定义（直接输入厂商名）', models: [] })
  return result
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
  if (providerId === CUSTOM_PROVIDER_SENTINEL) {
    form.value.provider = ''
    form.value.base_url = ''
    form.value.modelText = ''
    form.value.default_model = ''
    return
  }
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
    endpoint: '',
    query_endpoint: '',
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
    endpoint: row.endpoint || '',
    query_endpoint: row.query_endpoint || '',
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
      endpoint: form.value.endpoint || null,
      query_endpoint: form.value.query_endpoint || null,
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
  testServiceType.value = row.service_type || 'text'
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

async function exportConfigs() {
  try {
    const configs = await aiAPI.list()
    const exportData = configs.map(({ id, created_at, updated_at, ...rest }) => rest)
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-configs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${exportData.length} 条配置`)
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

function triggerImport() {
  importFileRef.value?.click()
}

async function importConfigs(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const configs = JSON.parse(text)
    if (!Array.isArray(configs)) {
      ElMessage.error('文件格式不正确，需要 JSON 数组')
      return
    }
    let success = 0
    let failed = 0
    for (const cfg of configs) {
      try {
        const models = Array.isArray(cfg.model) ? cfg.model : (cfg.model ? [cfg.model] : [])
        await aiAPI.create({
          service_type: cfg.service_type,
          name: cfg.name,
          provider: cfg.provider,
          base_url: cfg.base_url,
          api_key: cfg.api_key || '',
          endpoint: cfg.endpoint || null,
          query_endpoint: cfg.query_endpoint || null,
          model: models,
          default_model: cfg.default_model || null,
          priority: cfg.priority ?? 0,
          is_default: !!cfg.is_default
        })
        success++
      } catch (_) {
        failed++
      }
    }
    ElMessage.success(`导入完成：${success} 条成功${failed ? `，${failed} 条失败` : ''}`)
    await loadList()
  } catch (e) {
    ElMessage.error('导入失败：' + (e.message || '文件解析错误'))
  } finally {
    event.target.value = ''
  }
}

onMounted(() => loadList())
</script>

<style>
.provider-custom-option {
  border-top: 1px solid var(--el-border-color-light, #e4e7ed);
  margin-top: 4px;
  padding-top: 4px;
  color: var(--el-color-primary, #409eff) !important;
  font-style: italic;
}
</style>

<style scoped>
.ai-config-content {
  padding: 0;
}
.config-tabs {
  margin-top: -4px;
}
.tab-content {
  padding-top: 16px;
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
.one-key-help {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.one-key-section {
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 8px;
  padding: 12px 14px;
}
.one-key-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
  margin-bottom: 8px;
}
.one-key-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
  line-height: 1.8;
}
.one-key-list li {
  margin-bottom: 2px;
}
.one-key-link {
  color: var(--el-color-primary, #409eff);
  text-decoration: none;
}
.one-key-link:hover {
  text-decoration: underline;
}
.one-key-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  line-height: 1.5;
}
.one-key-note + .one-key-note {
  margin-top: 4px;
}
code {
  background: var(--el-fill-color, #f0f2f5);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: monospace;
}
.cfg-tip-content code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
  font-family: monospace;
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
.form-label-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.tip-icon {
  font-size: 13px;
  color: #909399;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;
}
.tip-icon:hover {
  color: #409eff;
}
</style>
