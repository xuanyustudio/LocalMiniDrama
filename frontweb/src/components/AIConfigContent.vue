<template>
  <div class="ai-config-content">
    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane label="AI 配置" name="configs">
        <div class="tab-content">
          <!-- 普通模式操作栏 -->
          <div v-if="!vendorLock.enabled" class="content-actions">
            <div class="actions-left">
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
            <div class="actions-right">
              <transition name="fade-slide">
                <el-button
                  v-if="selectedRows.length > 0"
                  type="danger"
                  :loading="batchDeleting"
                  @click="onBatchDelete"
                >
                  <el-icon><Delete /></el-icon>
                  删除选中 ({{ selectedRows.length }})
                </el-button>
              </transition>
            </div>
          </div>
          <!-- 锁定模式提示栏 -->
          <div v-else class="vendor-lock-bar">
            <el-alert
              type="info"
              :closable="false"
              class="vendor-lock-tip"
            >
              <template #title>
                <span>🔒 当前为厂商锁定模式，AI 服务由管理员统一配置。你只能修改 <b>API Key</b> 和 <b>默认模型</b>。</span>
              </template>
            </el-alert>
            <el-button type="primary" size="small" class="vendor-bulk-key-btn" @click="openBulkKey">
              <el-icon><Key /></el-icon>
              一键换Key
            </el-button>
          </div>
          <p class="default-tip">每种服务类型仅有一个默认配置：文本用于生成故事；文本生成图片用于角色/场景/道具图；分镜图片生成用于分镜图（支持参考图）；视频用于生成视频；语音合成 TTS 用于分镜配音。</p>
          <el-table
            v-loading="loading"
            :data="list"
            stripe
            style="width: 100%"
            @selection-change="onSelectionChange"
          >
            <el-table-column v-if="!vendorLock.enabled" type="selection" width="46" />
            <el-table-column prop="name" label="名称" min-width="130" />
            <el-table-column prop="provider" label="提供商" width="96" />
            <el-table-column prop="base_url" label="Base URL" min-width="170" show-overflow-tooltip />
            <el-table-column prop="default_model" label="默认模型" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.default_model || (Array.isArray(row.model) && row.model[0]) || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="service_type" label="类型" width="148">
              <template #default="{ row }">
                <span :class="['type-badge', 'type-' + row.service_type]">
                  <el-icon class="type-icon">
                    <ChatDotRound v-if="row.service_type === 'text'" />
                    <Picture v-else-if="row.service_type === 'image'" />
                    <Film v-else-if="row.service_type === 'storyboard_image'" />
                    <VideoCamera v-else-if="row.service_type === 'video'" />
                    <Microphone v-else-if="row.service_type === 'tts'" />
                  </el-icon>
                  {{ serviceTypeLabel(row.service_type) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="is_default" label="默认" width="60">
              <template #default="{ row }">
                <el-tag v-if="row.is_default" type="success" size="small">✓</el-tag>
                <span v-else class="no-default">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openTest(row)">测试</el-button>
                <el-button link type="primary" size="small" @click="openEdit(row)">{{ vendorLock.enabled ? '修改Key' : '编辑' }}</el-button>
                <el-button v-if="!vendorLock.enabled" link type="danger" size="small" @click="onDelete(row)">删除</el-button>
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
      <el-tab-pane label="高级设置（业务场景）" name="sceneModelMap">
        <div class="tab-content">
          <SceneModelMap />
        </div>
      </el-tab-pane>
      <el-tab-pane label="生成设置" name="generation">
        <div class="tab-content generation-settings">
          <div class="gs-section-title">⚡ 一键生成并发设置</div>
          <p class="gs-desc">控制「一键生成视频」和「补全并生成」流水线中，各类任务同时并行生成的数量。并发数越高速度越快，但过高可能触发 API 限流（429 错误）。建议根据你的 API 额度选择。</p>

          <div class="gs-row">
            <span class="gs-label">图片并发数</span>
            <el-select
              v-model="genConcurrencyInput"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入并发数"
              style="width: 180px"
              @change="onConcurrencyChange"
            >
              <el-option label="1（串行，最稳定）" :value="1" />
              <el-option label="2" :value="2" />
              <el-option label="3（默认）" :value="3" />
              <el-option label="5" :value="5" />
              <el-option label="8" :value="8" />
              <el-option label="10" :value="10" />
            </el-select>
            <span class="gs-unit">个任务同时生成</span>
          </div>

          <div class="gs-row" style="margin-top: 10px">
            <span class="gs-label">视频并发数</span>
            <el-select
              v-model="genVideoConcurrencyInput"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入并发数"
              style="width: 180px"
              @change="onVideoConcurrencyChange"
            >
              <el-option label="1（串行，最稳定）" :value="1" />
              <el-option label="2" :value="2" />
              <el-option label="3（默认）" :value="3" />
              <el-option label="5" :value="5" />
              <el-option label="8" :value="8" />
              <el-option label="10" :value="10" />
            </el-select>
            <span class="gs-unit">个任务同时生成</span>
          </div>

          <div style="margin-top: 14px">
            <el-button
              type="primary"
              size="small"
              :loading="genSettingSaving"
              @click="saveGenerationSettings"
            >保存</el-button>
          </div>
          <el-alert
            v-if="genSettingSaved"
            type="success"
            title="已保存"
            :closable="false"
            show-icon
            style="margin-top: 12px; width: fit-content"
          />
          <div class="gs-tip-box">
            <div class="gs-tip-title">📌 适用范围</div>
            <ul class="gs-tip-list">
              <li>图片并发：步骤 2 角色图、步骤 4 场景图、步骤 6 分镜图</li>
              <li>视频并发：步骤 7 分镜视频</li>
            </ul>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 添加/编辑 -->
    <el-dialog
      v-model="dialogVisible"
      :title="vendorLock.enabled ? '修改 API Key / 默认模型' : (editingId ? '编辑配置' : '添加配置')"
      width="520px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <!-- 锁定模式：只展示 api_key 和 default_model -->
      <template v-if="vendorLock.enabled">
        <el-descriptions :column="1" border style="margin-bottom: 16px">
          <el-descriptions-item label="名称">{{ form.name }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ serviceTypeLabel(form.service_type) }}</el-descriptions-item>
          <el-descriptions-item label="厂商">{{ form.provider }}</el-descriptions-item>
        </el-descriptions>
        <el-form ref="formRef" :model="form" label-width="100px">
          <el-form-item prop="api_key" :rules="[{ required: true, message: '请输入 API Key', trigger: 'blur' }]">
            <template #label><span class="form-label-tip">API Key</span></template>
            <el-input
              v-model="form.api_key"
              type="password"
              :placeholder="form.provider === 'jimeng_ai_api' ? '即梦 Session，多个用英文逗号分隔' : '输入你的 API 密钥'"
              show-password
            />
          </el-form-item>
          <el-form-item>
            <template #label><span class="form-label-tip">默认模型</span></template>
            <el-select v-model="form.default_model" clearable style="width: 100%">
              <el-option v-for="m in formModelList" :key="m" :label="m" :value="m" />
            </el-select>
            <p class="field-tip">实际调用时使用的模型，可从预设列表中选择。</p>
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
      </template>

      <!-- 普通模式：完整表单 -->
      <el-form v-else ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item prop="service_type">
          <template #label>
            <span class="form-label-tip">服务类型
              <el-tooltip placement="top" :show-arrow="true" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    <b>文本/对话</b>：用于 AI 生成故事剧本<br>
                    <b>文本生成图片</b>：角色、场景、道具的图片生成（不支持参考图）<br>
                    <b>分镜图片生成</b>：生成分镜图片，支持传入角色参考图<br>
                    <b>视频生成</b>：根据分镜图生成视频片段<br>
                    <b>语音合成 TTS</b>：为分镜对白自动合成语音（点分镜配音按钮时使用）
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
            <el-option label="语音合成 TTS" value="tts" />
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
        <!-- 接口规范：仅图片/分镜/视频类型显示，预设厂商自动填充；自定义厂商必选 -->
        <el-form-item v-if="form.service_type !== 'text' && form.service_type !== 'tts'">
          <template #label>
            <span class="form-label-tip">接口规范
              <el-icon class="tip-icon" style="cursor:pointer;color:#409eff" @click="showProtocolHelp = true"><QuestionFilled /></el-icon>
            </span>
          </template>
          <el-select v-model="form.api_protocol" style="width: 100%" placeholder="选择接口规范（自定义厂商必选）" clearable>
            <el-option label="OpenAI 兼容（大多数中转站默认）" value="openai" />
            <el-option label="火山引擎（豆包 Seedream / Seedance）" value="volcengine" />
            <el-option label="火山即梦 Seedance 全能（方舟多图参考，Seedance 2.0 等）" value="volcengine_omni" />
            <el-option label="通义万象 DashScope" value="dashscope" />
            <el-option label="Google Gemini（图片 / Veo 视频）" value="gemini" />
            <el-option label="Sora 中转站（multipart/form-data，seconds+size）" value="sora" />
            <el-option label="Veo3 兼容（JSON，images+enhance_prompt，自动翻译英文）" value="veo3" />
            <el-option label="Vidu 视频" value="vidu" />
            <el-option label="可灵 Omni-Video（官方 api-beijing / ffir 中转，O1 全能）" value="kling_omni" />
            <el-option label="xAI Grok Imagine（官方 prompt + aspect_ratio，/v1/videos/generations）" value="xai" />
            <el-option label="NanoBanana" value="nano_banana" />
          </el-select>
        </el-form-item>

        <!-- 接口规范帮助 Dialog -->
        <el-dialog v-model="showProtocolHelp" title="接口规范说明" width="700px" top="5vh">
          <div class="protocol-help">
            <div class="ph-section-title">🖼 图片 / 分镜图 协议</div>
            <el-collapse accordion>
              <el-collapse-item name="openai-img">
                <template #title><span class="ph-tag ph-tag-img">图片</span> OpenAI 兼容 — 绝大多数中转站默认</template>
                <div class="ph-body">
                  <b>适用场景：</b>OpenAI 官方、各类中转/代理站（ChatFire、硅基流动等）<br>
                  <b>Endpoint：</b><code>POST /v1/images/generations</code><br>
                  <pre>{ "model": "dall-e-3", "prompt": "...", "n": 1, "size": "1024x1024" }</pre>
                </div>
              </el-collapse-item>
              <el-collapse-item name="volcengine-img">
                <template #title><span class="ph-tag ph-tag-img">图片</span> 火山引擎 — 豆包 Seedream</template>
                <div class="ph-body">
                  <b>Endpoint：</b><code>POST /api/v3/images/generations</code><br>
                  <b>Base URL：</b><code>https://ark.cn-beijing.volces.com/api/v3</code><br>
                  <pre>{ "model": "doubao-seedream-4-5-251128", "prompt": "...", "size": "1024x1024" }</pre>
                </div>
              </el-collapse-item>
              <el-collapse-item name="dashscope-img">
                <template #title><span class="ph-tag ph-tag-img">图片</span> 通义万象 DashScope</template>
                <div class="ph-body">
                  <b>Base URL：</b><code>https://dashscope.aliyuncs.com</code><br>
                  <b>Endpoint：</b><code>POST /api/v1/services/aigc/text2image/image-synthesis</code>
                </div>
              </el-collapse-item>
              <el-collapse-item name="gemini-img">
                <template #title><span class="ph-tag ph-tag-img">图片</span> Google Gemini</template>
                <div class="ph-body">
                  <b>认证：</b>URL 参数 <code>?key=API_KEY</code><br>
                  <b>Endpoint：</b><code>POST /v1beta/models/{model}:generateContent</code>
                </div>
              </el-collapse-item>
            </el-collapse>

            <div class="ph-section-title" style="margin-top:16px">🎬 视频 协议</div>
            <el-collapse accordion>
              <el-collapse-item name="openai-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> OpenAI 兼容 — content 数组格式</template>
                <div class="ph-body">
                  <b>适用场景：</b>各类中转站视频接口（ChatFire 等）<br>
                  <b>Endpoint：</b>自定义，如 <code>POST /v1/video/create</code><br>
                  <pre>{ "model": "sora-2-pro",
  "content": [
    { "type": "text", "text": "..." },
    { "type": "image_url", "image_url": { "url": "https://..." }, "role": "reference_image" }
  ],
  "ratio": "9:16", "duration": 5, "watermark": false, "resolution": "720p" }</pre>
                </div>
              </el-collapse-item>
              <el-collapse-item name="sora-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> Sora 中转站 — multipart/form-data</template>
                <div class="ph-body">
                  <b>适用场景：</b>Sora API 格式的中转站<br>
                  <b>默认 Endpoint：</b><code>POST /v1/videos</code>（创建），<code>GET /v1/videos/{taskId}</code>（查询）<br>
                  <b>请求格式：</b>multipart/form-data（非 JSON）<br>
                  <pre>model       = "sora-2"
prompt      = "..."
seconds     = "4" | "8" | "12"
size        = "720x1280" | "1280x720" | "1024x1792" | "1792x1024"
watermark   = "false"
private     = "false"
input_reference = (图片文件，可选)</pre>
                  <b>注意：</b>参考图会自动 resize 到与 size 一致后上传。
                </div>
              </el-collapse-item>
              <el-collapse-item name="veo3-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> Veo3 兼容 — images + enhance_prompt</template>
                <div class="ph-body">
                  <b>适用场景：</b>Veo3 系列模型的 JSON 格式接口<br>
                  <b>默认 Endpoint：</b><code>POST /v1/video/create</code>（创建），<code>GET /v1/video/query?id={taskId}</code>（查询）<br>
                  <pre>{ "model": "veo3.1",
  "prompt": "...",
  "enhance_prompt": true,
  "images": ["data:image/jpeg;base64,..."]
}</pre>
                  <b>注意：</b><code>enhance_prompt: true</code> 会让接口自动将提示词翻译为英文。localhost 图片会自动转为 base64 内嵌。
                </div>
              </el-collapse-item>
              <el-collapse-item name="volcengine-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> 火山引擎 — 豆包 Seedance</template>
                <div class="ph-body">
                  <b>Endpoint：</b><code>POST …/contents/generations/tasks</code>（与后端一致）<br>
                  <b>Base URL：</b><code>https://ark.cn-beijing.volces.com/api/v3</code><br>
                  <pre>{ "model": "doubao-seedance-1-5-pro-251215",
  "content": [{ "type": "text", "text": "..." }],
  "ratio": "9:16", "duration": 5,
  "watermark": false, "resolution": "720p" }</pre>
                </div>
              </el-collapse-item>
              <el-collapse-item name="volcengine-omni-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> 火山即梦 Seedance 全能（多图参考）</template>
                <div class="ph-body">
                  <b>适用：</b>方舟 Seedance 2.0 等支持多参考图的全能链路；与「全能模式」分镜、<code>@图片1</code>… 提示词配合使用。<br>
                  <b>Endpoint：</b><code>POST {base}/contents/generations/tasks</code>，轮询 <code>GET {base}/contents/generations/tasks/{taskId}</code><br>
                  <b>厂商：</b>仍选「火山引擎」，<b>接口规范</b>选本项；模型填控制台接入点（如 <code>doubao-seedance-2-0-260128</code>，以控制台为准）。<br>
                  <pre>{ "model": "doubao-seedance-2-0-260128",
  "task_type": "i2v",
  "content": [
    { "type": "text", "text": "… @图片1 … @图片2 …" },
    { "type": "image_url", "image_url": { "url": "https://..." } },
    { "type": "image_url", "image_url": { "url": "https://..." }, "role": "reference_image" }
  ],
  "ratio": "9:16", "duration": 8, "watermark": false }</pre>
                  <b>说明：</b>全能模式下列均为参考图（场景、角色…），每张均 <code>role: reference_image</code>；最多 9 张，时长 Seedance 2.x 按 4–15 秒吸附。
                </div>
              </el-collapse-item>
              <el-collapse-item name="dashscope-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> 通义万象 DashScope</template>
                <div class="ph-body">
                  <b>Base URL：</b><code>https://dashscope.aliyuncs.com</code><br>
                  <b>Endpoint：</b><code>POST /api/v1/services/aigc/video-generation/video-synthesis</code><br>
                  <pre>{ "model": "wan2.2-kf2v-flash",
  "input": { "prompt": "...", "img_url": "https://..." },
  "parameters": { "size": "1280*720", "duration": 5 } }</pre>
                </div>
              </el-collapse-item>
              <el-collapse-item name="gemini-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> Google Gemini — Veo 视频</template>
                <div class="ph-body">
                  <b>认证：</b>URL 参数 <code>?key=API_KEY</code><br>
                  <b>Endpoint：</b><code>POST /v1beta/models/{model}:generateVideo</code>
                </div>
              </el-collapse-item>
              <el-collapse-item name="vidu-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> Vidu</template>
                <div class="ph-body">
                  <b>适用场景：</b>Vidu 官方及兼容接口<br>
                  <b>认证：</b><code>Authorization: Token {api_key}</code>（非 Bearer）<br>
                  <b>默认 Endpoint：</b><code>POST /ent/v2/img2video</code>（创建），<code>GET /ent/v2/tasks/{taskId}/creations</code>（查询）<br>
                  <pre>{ "model": "viduq3-pro",
  "images": ["https://..."],
  "prompt": "...",
  "duration": 5,
  "resolution": "720p",
  "movement_amplitude": "auto",
  "audio": false,
  "watermark": false
}</pre>
                  <b>注意：</b>官方 api.vidu.cn 用 <code>Token</code> 认证，中转站用 <code>Bearer</code>，系统自动识别。localhost 图片自动上传图床。
                </div>
              </el-collapse-item>
              <el-collapse-item name="jimeng-ai-api-vid">
                <template #title><span class="ph-tag ph-tag-vid">视频</span> Jimeng AI API（自建服务）</template>
                <div class="ph-body">
                  <b>说明：</b>需自行部署 <code>jimeng-free-api-all</code> 等即梦 OpenAI 兼容服务并启动（如 <code>http://127.0.0.1:8000</code>）。本系统仅作为客户端转发请求。<br>
                  <b>Base URL：</b>填你的服务根地址，无尾斜杠。<br>
                  <b>API Key：</b>填即梦网页 <b>Session</b>；多个账号用<b>英文逗号</b>分隔，由对方服务轮询使用。<br>
                  <b>默认路径：</b><code>POST /v1/videos/generations</code>（可在「Endpoint」覆盖）。Seedance 多图需分镜参考图；响应为同步 <code>data[0].url</code>。
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
          <template #footer>
            <el-button @click="showProtocolHelp = false">关闭</el-button>
          </template>
        </el-dialog>
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
          <el-input
            v-model="form.api_key"
            type="password"
            :placeholder="form.provider === 'jimeng_ai_api' ? '即梦 Session，多个用英文逗号分隔' : 'API 密钥'"
            show-password
          />
        </el-form-item>
        <template v-if="form.service_type === 'video' && form.api_protocol === 'kling_omni'">
          <el-form-item>
            <template #label><span class="form-label-tip">AccessKey</span></template>
            <el-input
              v-model="form.kling_access_key"
              type="password"
              show-password
              placeholder="可灵开放平台 AccessKey（与 SecretKey 成对，可不填上方 API Key）"
              autocomplete="off"
            />
            <p class="field-tip">
              官方 JWT 规则见
              <a href="https://klingai.com/document-api/apiReference/commonInfo" target="_blank" rel="noopener noreferrer">commonInfo</a>
              （<a href="https://app.klingai.com/cn/dev/document-api/apiReference/commonInfo" target="_blank" rel="noopener noreferrer">中文版</a>）。
              后端使用与官方示例一致的 HS256（<code>iss</code>=AccessKey，<code>exp</code>、<code>nbf</code>）生成 Token。
              若接口返回 <code>1000 Authorization signature is invalid</code>：请确认 AccessKey/SecretKey 未填反、无多余空格；并尝试勾选下方「SecretKey 为 Base64」；
              Base URL 区域（<code>api-beijing.klingai.com</code> / <code>api-singapore.klingai.com</code>）须与密钥所属区域一致。
            </p>
          </el-form-item>
          <el-form-item>
            <template #label><span class="form-label-tip">SecretKey</span></template>
            <el-input
              v-model="form.kling_secret_key"
              type="password"
              show-password
              placeholder="可灵开放平台 SecretKey"
              autocomplete="off"
            />
            <el-checkbox v-model="form.kling_secret_key_base64" style="margin-top: 8px; display: block">
              SecretKey 为 Base64 字符串（解码后的二进制再用于签名；若仍报签名无效可切换此项重试）
            </el-checkbox>
            <p class="field-tip">
              官方域名：<code>POST {base}/v1/videos/omni-video</code>，轮询
              <code>GET {base}/v1/videos/omni-video/{taskId}</code>；飞儿等中转仍为
              <code>/kling/v1/videos/omni-video</code> 与
              <code>/kling/v1/images/omni-image/{taskId}</code>。详见
              <a href="https://klingai.com/document-api/apiReference/model/OmniVideo" target="_blank" rel="noopener noreferrer">OmniVideo</a>。
            </p>
          </el-form-item>
        </template>
        <!-- TTS 专属字段：声音 ID 和 MiniMax Group ID -->
        <template v-if="form.service_type === 'tts'">
          <el-form-item>
            <template #label>
              <span class="form-label-tip">声音 ID
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content">
                      TTS 合成使用的音色 ID。<br>
                      <b>MiniMax 常用音色：</b><br>
                      female-shaonv（少女）、female-chengshu（成熟）<br>
                      male-qingxin（清新男）、male-zhicheng（知城男）<br>
                      audiobook_female_2（有声书女）、audiobook_male_1（有声书男）
                    </div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-select
              v-model="form.voice_id"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入声音 ID"
              style="width: 100%"
            >
              <el-option-group label="MiniMax 女声">
                <el-option label="female-shaonv（少女）" value="female-shaonv" />
                <el-option label="female-chengshu（成熟）" value="female-chengshu" />
                <el-option label="female-tianmei（甜美）" value="female-tianmei" />
                <el-option label="audiobook_female_2（有声书）" value="audiobook_female_2" />
              </el-option-group>
              <el-option-group label="MiniMax 男声">
                <el-option label="male-qingxin（清新）" value="male-qingxin" />
                <el-option label="male-zhicheng（知城）" value="male-zhicheng" />
                <el-option label="audiobook_male_1（有声书）" value="audiobook_male_1" />
              </el-option-group>
            </el-select>
            <p class="field-tip">MiniMax 必填；不填默认 female-shaonv。</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-tip">Group ID
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content">
                      MiniMax 账号的 GroupId，调用 T2A v2 接口时附在 URL 参数里。<br>
                      登录 <b>platform.minimaxi.com</b> → 账户设置 → 即可查看 GroupId。
                    </div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="form.group_id" placeholder="MiniMax GroupId，如 1234567890" />
            <p class="field-tip">仅 MiniMax T2A 需要此字段。</p>
          </el-form-item>
        </template>

        <!-- 端点配置：视频必填（自定义厂商）；图片/分镜在使用代理或特殊厂商时填写 -->
        <template v-if="form.service_type !== 'text' && form.service_type !== 'tts'">
          <el-form-item>
            <template #label>
              <span class="form-label-tip">提交端点
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content">
                      接口路径，追加在 Base URL 之后。<br>
                      <b>预设厂商</b>（火山 / 通义 / NanoBanana）留空，系统自动推断。<br>
                      <b>视频自定义厂商</b>必须填写，如 /v1/videos/generations<br>
                      <b>NanoBanana 代理</b>填写代理路径，如 /fal-ai/nano-banana
                    </div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="form.endpoint" :placeholder="form.service_type === 'video' ? '自定义视频厂商必填，如 /v1/videos/generations；预设厂商留空' : '代理或特殊厂商时填写，如 /fal-ai/nano-banana；预设厂商留空'" />
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

        <!-- 接口地址预览：选择厂商/协议后自动展示，帮助用户核对 -->
        <div v-if="endpointPreviewInfo" class="endpoint-preview-box" :class="{ 'ep-box-gemini': endpointPreviewInfo.isGemini }">
          <div class="ep-preview-header">
            <span>📌 系统将使用以下接口地址</span>
            <span v-if="endpointPreviewInfo.isGemini" class="ep-auto-badge ep-badge-gemini">Gemini 固定模式</span>
            <span v-else-if="endpointPreviewInfo.isAuto && form.service_type !== 'text'" class="ep-auto-badge">自动推断</span>
          </div>
          <div class="ep-row">
            <span class="ep-label">提交地址：</span>
            <code class="ep-url">{{ endpointPreviewInfo.submit }}</code>
          </div>
          <div v-if="endpointPreviewInfo.query" class="ep-row">
            <span class="ep-label">查询地址：</span>
            <code class="ep-url">{{ endpointPreviewInfo.query }}</code>
          </div>
          <p v-if="endpointPreviewInfo.isGemini" class="ep-tip ep-tip-warn">
            ⚠️ Gemini 端点由系统根据模型名固定生成，上方「提交端点」和「查询端点」字段对 Gemini 无效，填了也不生效。
          </p>
          <p v-else class="ep-tip">以上为系统推断的实际调用地址（可手动填写上方端点字段来覆盖）</p>
        </div>

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
            <li><b>文本/对话</b>：DeepSeek V3（deepseek-v3-2-251201）— 生成故事剧本</li>
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

    <!-- 一键换Key（锁定模式） -->
    <el-dialog v-model="bulkKeyVisible" title="一键换Key" width="440px" :close-on-click-modal="false">
      <el-alert
        type="warning"
        :closable="false"
        style="margin-bottom: 16px"
        title="此操作将替换所有配置的 API Key，请确认新 Key 可用后再提交。"
        show-icon
      />
      <el-form label-width="80px">
        <el-form-item label="新 API Key">
          <el-input
            v-model="bulkKeyInput"
            type="password"
            show-password
            placeholder="粘贴新的 API Key"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bulkKeyVisible = false">取消</el-button>
        <el-button type="primary" :loading="bulkKeySaving" :disabled="!bulkKeyInput.trim()" @click="submitBulkKey">确认替换</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MagicStick, QuestionFilled, Download, Upload, Delete, ChatDotRound, Picture, Film, VideoCamera, Key, Microphone } from '@element-plus/icons-vue'
import { aiAPI } from '@/api/ai'
import { generationSettingsAPI } from '@/api/prompts'
import PromptEditor from '@/components/PromptEditor.vue'
import SceneModelMap from '@/components/SceneModelMap.vue'

const activeTab = ref('configs')
const importFileRef = ref(null)

// ---- 生成设置 ----
const genConcurrencyInput = ref(3)
const genVideoConcurrencyInput = ref(3)
const genSettingSaving = ref(false)
const genSettingSaved = ref(false)

async function loadGenerationSettings() {
  try {
    const res = await generationSettingsAPI.get()
    genConcurrencyInput.value = res?.concurrency ?? 3
    genVideoConcurrencyInput.value = res?.video_concurrency ?? 3
  } catch (_) {}
}

function onConcurrencyChange(val) {
  const n = Number(val)
  if (!isNaN(n) && n >= 1) genConcurrencyInput.value = Math.min(20, Math.max(1, Math.round(n)))
}

function onVideoConcurrencyChange(val) {
  const n = Number(val)
  if (!isNaN(n) && n >= 1) genVideoConcurrencyInput.value = Math.min(20, Math.max(1, Math.round(n)))
}

async function saveGenerationSettings() {
  const n = Number(genConcurrencyInput.value)
  const nv = Number(genVideoConcurrencyInput.value)
  if (isNaN(n) || n < 1 || n > 20) {
    ElMessage.warning('图片并发数请填写 1-20 之间的整数')
    return
  }
  if (isNaN(nv) || nv < 1 || nv > 20) {
    ElMessage.warning('视频并发数请填写 1-20 之间的整数')
    return
  }
  genSettingSaving.value = true
  genSettingSaved.value = false
  try {
    await generationSettingsAPI.update({ concurrency: Math.round(n), video_concurrency: Math.round(nv) })
    genSettingSaved.value = true
    setTimeout(() => { genSettingSaved.value = false }, 2000)
  } catch (e) {
    ElMessage.error('保存失败：' + (e?.message || ''))
  } finally {
    genSettingSaving.value = false
  }
}
const loading = ref(false)
const list = ref([])
const selectedRows = ref([])
const batchDeleting = ref(false)
const vendorLock = ref({ enabled: false, config_file: '' })
const dialogVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const showProtocolHelp = ref(false)
const bulkKeyVisible = ref(false)
const bulkKeyInput = ref('')
const bulkKeySaving = ref(false)
const formRef = ref(null)
const form = ref({
  service_type: 'text',
  name: '',
  provider: '',
  api_protocol: '',
  base_url: '',
  api_key: '',
  endpoint: '',
  query_endpoint: '',
  modelText: '',
  default_model: '',
  priority: 0,
  is_default: false,
  // 可灵 Omni 官方 AK/SK（存 settings，后端生成 JWT）
  kling_access_key: '',
  kling_secret_key: '',
  kling_secret_key_base64: false,
  // TTS 专属字段
  voice_id: '',
  group_id: '',
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
const rules = computed(() => ({
  service_type: [{ required: true, message: '请选择服务类型', trigger: 'change' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  provider: [{ required: true, message: '请选择或输入厂商', trigger: 'change' }],
  base_url: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }],
  api_key: [
    {
      validator: (_rule, v, cb) => {
        const st = form.value.service_type
        const proto = form.value.api_protocol
        const ak = (form.value.kling_access_key || '').trim()
        const sk = (form.value.kling_secret_key || '').trim()
        if (st === 'video' && proto === 'kling_omni' && ak && sk) return cb()
        if (v != null && String(v).trim()) return cb()
        cb(new Error('请输入 API Key，或使用官方 AccessKey + SecretKey（可不填 API Key）'))
      },
      trigger: 'blur',
    },
  ],
}))
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
    { id: 'volcengine', name: '火山引擎', models: ['deepseek-v3-2-251201', 'doubao-1-5-pro-32k-250115', 'kimi-k2-thinking-251104'] },
    // { id: 'chatfire', name: 'Chatfire', models: ['gemini-3-flash-preview', 'claude-sonnet-4-5-20250929', 'doubao-seed-1-8-251228'] },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-pro', 'gemini-3-flash-preview'] },
    { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
    { id: 'qwen', name: '通义千问', models: ['qwen3-max', 'qwen-plus', 'qwen-flash'] }
  ],
  image: [
    { id: 'volcengine', name: '火山引擎', models: ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'] },
    { id: 'kling', name: '可灵 Kling', models: ['kling-image', 'kling-omni-image'] },
    { id: 'nano_banana', name: 'NanoBanana', models: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'] },
    // { id: 'chatfire', name: 'Chatfire', models: ['nano-banana-pro', 'doubao-seedream-4-5-251128', 'qwen-image'] },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'] },
    { id: 'openai', name: 'OpenAI', models: ['dall-e-3', 'dall-e-2'] },
    { id: 'dashscope', name: '通义万象', models: ['wan2.6-image', 'qwen-image-edit-plus-2026-01-09', 'qwen-image-edit-plus', 'qwen-image-edit-max'] },
    { id: 'qwen_image', name: '通义千问', models: ['qwen-image-max', 'qwen-image-plus', 'qwen-image'] }
  ],
  storyboard_image: [
    { id: 'dashscope', name: '通义万象', models: ['wan2.6-image', 'qwen-image-edit-plus-2026-01-09', 'qwen-image-edit-plus', 'qwen-image-edit-max'] },
    { id: 'volcengine', name: '火山引擎', models: ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'] },
    { id: 'kling', name: '可灵 Kling', models: ['kling-image', 'kling-omni-image'] },
    { id: 'nano_banana', name: 'NanoBanana', models: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'] },
    // { id: 'chatfire', name: 'Chatfire', models: ['nano-banana-pro', 'doubao-seedream-4-5-251128', 'qwen-image'] },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'] },
    { id: 'openai', name: 'OpenAI', models: ['dall-e-3', 'dall-e-2'] }
  ],
  video: [
    { id: 'klingai', name: '可灵官方 Omni (api-beijing.klingai.com)', models: ['kling-video-o1', 'kling-v3-omni'] },
    { id: 'ffir', name: '飞儿API / 可灵 Omni-Video (ffir.cn)', models: ['kling-video-o1', 'kling-v3-omni'] },
    { id: 'kling', name: '可灵 Kling', models: ['kling-omni-video', 'kling-video', 'kling-motion-control'] },
    { id: 'vidu', name: 'Vidu', models: ['viduq2', 'viduq2-pro', 'viduq2-turbo', 'viduq3-pro'] },
    { id: 'volces', name: '火山引擎', models: ['doubao-seedance-2-0-260128', 'doubao-seedance-2-0-fast-260128', 'doubao-seedance-1-5-pro-251215', 'doubao-seedance-1-0-lite-i2v-250428', 'doubao-seedance-1-0-lite-t2v-250428', 'doubao-seedance-1-0-pro-250528', 'doubao-seedance-1-0-pro-fast-251015'] },
    // { id: 'chatfire', name: 'Chatfire', models: ['doubao-seedance-1-5-pro-251215', 'doubao-seedance-1-0-lite-i2v-250428', 'doubao-seedance-1-0-lite-t2v-250428', 'doubao-seedance-1-0-pro-250528', 'doubao-seedance-1-0-pro-fast-251015', 'sora-2', 'sora-2-pro'] },
    { id: 'minimax', name: 'MiniMax 海螺', models: ['MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-2.3-Fast', 'MiniMax-Hailuo-02'] },
    { id: 'gemini', name: 'Google Gemini (Veo)', models: ['veo-3.1-generate-preview', 'veo-3.0-generate-preview', 'veo-3.0-fast-generate-preview'] },
    { id: 'dashscope', name: '通义万相', models: ['wan2.6-r2v-flash', 'wan2.6-t2v', 'wan2.2-kf2v-flash', 'wan2.6-i2v-flash', 'wanx2.1-vace-plus'] },
    {
      id: 'jimeng_ai_api',
      name: 'Jimeng AI API（自建即梦免费 API）',
      models: [
        'jimeng-video-seedance-2.0',
        'seedance-2.0',
        'jimeng-video-seedance-2.0-fast',
        'jimeng-video-3.0',
        'jimeng-video-3.0-pro',
        'jimeng-video-3.5-pro',
      ],
    },
    { id: 'openai', name: 'OpenAI', models: ['sora-2', 'sora-2-pro'] },
    { id: 'xai', name: 'xAI Grok Imagine', models: ['grok-imagine-video'] },
  ],
  tts: [
    { id: 'minimax', name: 'MiniMax T2A', models: ['speech-02-hd', 'speech-02-turbo'] },
  ]
}

/** 厂商 id → 默认接口规范（api_protocol） */
const providerProtocolMap = {
  // image / storyboard_image
  volcengine: 'volcengine',
  volces: 'volcengine',
  volc: 'volcengine',
  nano_banana: 'nano_banana',
  dashscope: 'dashscope',
  qwen_image: 'dashscope',
  gemini: 'gemini',
  google: 'gemini',
  kling: 'kling',
  ffir: 'kling_omni',
  klingai: 'kling_omni',
  // video
  vidu: 'vidu',
  xai: 'xai',
  grok: 'xai',
  minimax: 'openai',
  openai: 'openai',
  chatfire: 'openai',
  qwen: 'openai',
  deepseek: 'openai',
  jimeng_ai_api: 'jimeng_ai_api',
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
  if (p === 'vidu') return 'https://api.vidu.cn'
  if (p === 'kling') return 'https://api.klingai.com'
  if (p === 'klingai') return 'https://api-beijing.klingai.com'
  if (p === 'ffir') return 'https://ffir.cn'
  if (p === 'jimeng_ai_api') return 'http://127.0.0.1:8000'
  if (p === 'xai' || p === 'grok') return 'https://api.x.ai'
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

/** 根据当前厂商/协议/base_url 推算实际将使用的接口地址，供用户核对 */
const endpointPreviewInfo = computed(() => {
  const { provider, api_protocol, base_url, service_type, endpoint, query_endpoint } = form.value
  const p = String(provider || '').toLowerCase()
  const proto = api_protocol || providerProtocolMap[p] || ''
  const base = (base_url || '').replace(/\/$/, '')
  if (!base && !proto && !p) return null

  let submitPath = '', queryPath = ''

  if (service_type === 'text') {
    submitPath = '/chat/completions'
  } else if (service_type === 'tts') {
    if (p === 'minimax') {
      submitPath = '/t2a_v2?GroupId={group_id}'
    } else {
      submitPath = endpoint || '/tts'
    }
  } else if (service_type === 'image' || service_type === 'storyboard_image') {
    if (endpoint) {
      submitPath = endpoint
    } else if (proto === 'volcengine' || p === 'volcengine' || p === 'volces') {
      submitPath = '/images/generations'
    } else if (proto === 'dashscope' || p === 'dashscope' || p === 'qwen_image') {
      submitPath = '/api/v1/services/aigc/multimodal-generation/generation'
    } else if (proto === 'gemini' || p === 'gemini') {
      const m = form.value.default_model || '{模型名}'
      submitPath = `/v1beta/models/${m}:generateContent?key=***`
      return { submit: base + submitPath, query: null, isAuto: true, isGemini: true }
    } else if (proto === 'nano_banana' || p === 'nano_banana') {
      submitPath = '/v1/images/generations'  // nano_banana base_url 无 /v1
    } else if (proto === 'kling' || p === 'kling' || p === 'klingai') {
      submitPath = '/v1/images/generations'
    } else {
      submitPath = '/images/generations'  // openai 兼容：base_url 已含 /v1
    }
    } else if (service_type === 'video') {
    if (endpoint) {
      submitPath = endpoint
    } else if (proto === 'volcengine_omni') {
      submitPath = '/contents/generations/tasks'
    } else if (proto === 'volcengine' || p === 'volces' || p === 'volcengine') {
      submitPath = '/videos/generations'
    } else if (proto === 'dashscope' || p === 'dashscope') {
      submitPath = '/api/v1/services/aigc/video-generation/video-synthesis'
    } else if (proto === 'gemini' || p === 'gemini') {
      const m = form.value.default_model || '{模型名}'
      return {
        submit: `${base}/v1beta/models/${m}:predictLongRunning  （API Key 放 header: x-goog-api-key）`,
        query: `${base}/v1beta/{operationName}  （operationName 由提交响应返回）`,
        isAuto: true,
        isGemini: true
      }
    } else if (proto === 'vidu' || p === 'vidu') {
      submitPath = '/ent/v2/img2video'
    } else if (proto === 'sora') {
      submitPath = '/v1/videos'
    } else if (proto === 'xai') {
      submitPath = '/v1/videos/generations'
    } else if (proto === 'veo3') {
      submitPath = '/v1/video/create'
    } else if (proto === 'jimeng_ai_api' || p === 'jimeng_ai_api') {
      submitPath = endpoint || '/v1/videos/generations'
      return {
        submit: (base || '(请填 Base URL)') + submitPath + '  （Bearer 为即梦 Session，可多账号英文逗号分隔；同步返回 data[0].url）',
        query: null,
        isAuto: true,
      }
    } else if (proto === 'kling_omni' || p === 'ffir' || p === 'klingai') {
      const omniFfir = p === 'ffir' || /ffir\.cn/i.test(base)
      const omniKlingOfficial = p === 'klingai' || /api(-beijing|-singapore)?\.klingai\.com/i.test(base)
      submitPath = omniFfir ? '/kling/v1/videos/omni-video' : omniKlingOfficial ? '/v1/videos/omni-video' : '/kling/v1/videos/omni-video'
    } else if (proto === 'kling' || p === 'kling' || p === 'klingai') {
      submitPath = '/v1/videos/text2video (T2V) 或 /v1/videos/image2video (I2V)'
    } else if (p === 'minimax') {
      submitPath = '/video_generation'  // minimax base_url 已含 /v1
    } else {
      submitPath = '/v1/video/create'
    }

    if (query_endpoint) {
      queryPath = query_endpoint
    } else if (proto === 'volcengine_omni') {
      queryPath = '/contents/generations/tasks/{taskId}'
    } else if (proto === 'volcengine' || p === 'volces' || p === 'volcengine') {
      queryPath = '/tasks/{taskId}/info'
    } else if (proto === 'dashscope' || p === 'dashscope') {
      queryPath = '/api/v1/tasks/{taskId}/info'
    } else if (proto === 'vidu' || p === 'vidu') {
      queryPath = '/ent/v2/tasks/{taskId}/creations'
    } else if (proto === 'sora') {
      queryPath = '/v1/videos/{taskId}'
    } else if (proto === 'xai') {
      queryPath = '/v1/videos/{taskId}'
    } else if (proto === 'veo3') {
      queryPath = '/v1/video/query?id={taskId}'
    } else if (proto === 'kling_omni' || p === 'ffir' || p === 'klingai') {
      const omniFfirQ = p === 'ffir' || /ffir\.cn/i.test(base)
      const omniKlingOfficialQ = p === 'klingai' || /api(-beijing|-singapore)?\.klingai\.com/i.test(base)
      queryPath = omniFfirQ
        ? '/kling/v1/images/omni-image/{taskId}'
        : omniKlingOfficialQ
          ? '/v1/videos/omni-video/{taskId}'
          : '/kling/v1/images/omni-image/{taskId}'
    } else if (proto === 'kling' || p === 'kling' || p === 'klingai') {
      queryPath = '/v1/videos/{videoType}/{taskId}（自动按任务类型选择）'
    } else if (p === 'minimax') {
      queryPath = '/query/video_generation?task_id={taskId}'  // minimax base_url 已含 /v1
    } else if (proto !== 'gemini' && p !== 'gemini') {
      queryPath = '/v1/video/query?id={taskId}'
    }
  }

  const submitUrl = base ? (base + submitPath) : ('(未填 Base URL)' + submitPath)
  const queryUrl = queryPath ? (base ? base + queryPath : '(未填 Base URL)' + queryPath) : null

  if (!submitPath) return null
  return {
    submit: submitUrl,
    query: queryUrl,
    isAuto: !endpoint  // 端点是自动推断的（非用户手填）
  }
})

function onProviderChange(providerId) {
  if (providerId === CUSTOM_PROVIDER_SENTINEL) {
    form.value.provider = ''
    form.value.api_protocol = ''
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
  // 自动填充接口规范
  form.value.api_protocol = providerProtocolMap[providerId] || (st === 'text' ? '' : 'openai')
  if (st === 'video' && providerId === 'jimeng_ai_api') {
    form.value.endpoint = ''
    form.value.query_endpoint = ''
  }
  if (st === 'video' && (providerId === 'ffir' || providerId === 'klingai')) {
    if (providerId === 'ffir') {
      form.value.endpoint = '/kling/v1/videos/omni-video'
      form.value.query_endpoint = '/kling/v1/images/omni-image/{taskId}'
    } else {
      form.value.endpoint = '/v1/videos/omni-video'
      form.value.query_endpoint = '/v1/videos/omni-video/{taskId}'
    }
  }
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
  { service_type: 'text', name: '火山引擎 文本', base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['deepseek-v3-2-251201', 'doubao-1-5-pro-32k-250115', 'kimi-k2-thinking-251104'] },
  { service_type: 'image', name: '火山引擎 即梦 文本生图', base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['doubao-seedream-4-5-251128'] },
  { service_type: 'storyboard_image', name: '火山引擎 即梦 分镜图', base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['doubao-seedream-4-5-251128'] },
  { service_type: 'video', name: '火山引擎 即梦 视频', base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volces', model: ['doubao-seedance-1-5-pro-251215'] }
]

function serviceTypeLabel(t) {
  const map = { text: '文本', image: '文本生成图片', storyboard_image: '分镜图片生成', video: '视频', tts: '语音合成 TTS' }
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
    api_protocol: '',
    base_url: '',
    api_key: '',
    endpoint: '',
    query_endpoint: '',
    modelText: '',
    default_model: '',
    priority: 0,
    is_default: true,  // 新增时默认勾选「设为默认」，便于理解当前会使用哪条配置
    voice_id: '',
    group_id: '',
    kling_access_key: '',
    kling_secret_key: '',
    kling_secret_key_base64: false,
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
  // TTS / 可灵 Omni 等从 settings 解析
  let voice_id = row.voice_id || ''
  let group_id = row.group_id || ''
  let kling_access_key = ''
  let kling_secret_key = ''
  let kling_secret_key_base64 = false
  if (row.settings) {
    try {
      const s = JSON.parse(row.settings)
      if (row.service_type === 'tts') {
        voice_id = s.voice_id || voice_id
        group_id = s.group_id || group_id
      }
      if (row.service_type === 'video' && row.api_protocol === 'kling_omni') {
        kling_access_key = s.kling_access_key || ''
        kling_secret_key = s.kling_secret_key || ''
        kling_secret_key_base64 = !!s.kling_secret_key_base64
      }
    } catch (_) {}
  }
  form.value = {
    service_type: row.service_type,
    name: row.name,
    provider: row.provider,
    api_protocol: row.api_protocol || '',
    base_url: row.base_url,
    api_key: row.api_key,
    endpoint: row.endpoint || '',
    query_endpoint: row.query_endpoint || '',
    modelText: modelList.join('\n'),
    default_model: defaultInList ? row.default_model : (modelList[0] || ''),
    priority: row.priority ?? 0,
    is_default: !!row.is_default,
    voice_id,
    group_id,
    kling_access_key,
    kling_secret_key,
    kling_secret_key_base64,
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
    // TTS / 可灵 Omni 官方 AKSK 打包进 settings
    let settings = undefined
    if (form.value.service_type === 'tts') {
      const s = {}
      if (form.value.voice_id) s.voice_id = form.value.voice_id
      if (form.value.group_id) s.group_id = form.value.group_id
      settings = Object.keys(s).length ? JSON.stringify(s) : null
    } else if (form.value.service_type === 'video' && form.value.api_protocol === 'kling_omni') {
      let baseS = {}
      if (editingId.value) {
        const prev = list.value.find((r) => r.id === editingId.value)
        if (prev?.settings) {
          try {
            baseS = JSON.parse(prev.settings)
          } catch (_) {}
        }
      }
      if ((form.value.kling_access_key || '').trim()) baseS.kling_access_key = form.value.kling_access_key.trim()
      else delete baseS.kling_access_key
      if ((form.value.kling_secret_key || '').trim()) baseS.kling_secret_key = form.value.kling_secret_key.trim()
      else delete baseS.kling_secret_key
      if (form.value.kling_secret_key_base64) baseS.kling_secret_key_base64 = true
      else delete baseS.kling_secret_key_base64
      settings = Object.keys(baseS).length ? JSON.stringify(baseS) : null
    }
    const payload = {
      service_type: form.value.service_type,
      name: form.value.name,
      provider: form.value.provider,
      api_protocol: form.value.api_protocol || '',
      base_url: form.value.base_url,
      api_key: form.value.api_key,
      endpoint: form.value.endpoint || '',
      query_endpoint: form.value.query_endpoint || '',
      model: modelList,
      default_model: defaultModel,
      priority: form.value.priority,
      is_default: form.value.is_default,
      ...(settings !== undefined ? { settings } : {}),
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

function openBulkKey() {
  bulkKeyInput.value = ''
  bulkKeyVisible.value = true
}

async function submitBulkKey() {
  const key = bulkKeyInput.value.trim()
  if (!key) return
  bulkKeySaving.value = true
  try {
    const res = await aiAPI.bulkUpdateKey(key)
    ElMessage.success(res?.message || '所有配置的 API Key 已更新')
    bulkKeyVisible.value = false
    await loadList()
  } catch (_) {
  } finally {
    bulkKeySaving.value = false
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

function onSelectionChange(rows) {
  selectedRows.value = rows
}

async function onBatchDelete() {
  if (!selectedRows.value.length) return
  await ElMessageBox.confirm(
    `确定删除选中的 ${selectedRows.value.length} 条配置？此操作不可恢复。`,
    '批量删除确认',
    { type: 'warning', confirmButtonText: '确定删除', confirmButtonClass: 'el-button--danger' }
  )
  batchDeleting.value = true
  let success = 0, failed = 0
  for (const row of selectedRows.value) {
    try {
      await aiAPI.delete(row.id)
      success++
    } catch (_) { failed++ }
  }
  batchDeleting.value = false
  selectedRows.value = []
  ElMessage.success(`已删除 ${success} 条${failed ? `，${failed} 条失败` : ''}`)
  await loadList()
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
          api_protocol: cfg.api_protocol || null,
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

async function loadVendorLock() {
  try {
    vendorLock.value = await aiAPI.getVendorLock()
  } catch (_) {
    vendorLock.value = { enabled: false, config_file: '' }
  }
}

onMounted(() => {
  loadVendorLock()
  loadList()
  loadGenerationSettings()
})
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
  max-height: calc(100vh - 320px);
  overflow-y: auto;
}
.content-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
}
.actions-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.actions-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* 过渡动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

/* 类型徽章 */
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid transparent;
}
.type-icon {
  font-size: 13px;
  flex-shrink: 0;
}

/* 文本/对话 — 蓝色 */
.type-text {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.25);
}
/* 文本生成图片 — 绿色 */
.type-image {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.25);
}
/* 分镜图片生成 — 紫色 */
.type-storyboard_image {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
  border-color: rgba(139, 92, 246, 0.25);
}
/* 视频 — 橙色 */
.type-video {
  background: rgba(249, 115, 22, 0.12);
  color: #f97316;
  border-color: rgba(249, 115, 22, 0.25);
}

.no-default {
  color: #9ca3af;
  font-size: 13px;
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
.vendor-lock-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.vendor-lock-bar .vendor-lock-tip {
  flex: 1;
  margin-bottom: 0;
}
.vendor-bulk-key-btn {
  white-space: nowrap;
  flex-shrink: 0;
  color: #fff !important;
}
.vendor-lock-tip {
  margin-bottom: 16px;
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
.ph-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  padding: 4px 0 6px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 4px;
}
.ph-tag {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 6px;
  font-weight: 600;
  vertical-align: middle;
}
.ph-tag-img {
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #b3d8ff;
}
.ph-tag-vid {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #b3e19d;
}
.protocol-help .ph-body {
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
}
.protocol-help .ph-body pre {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  margin: 6px 0 2px;
  white-space: pre-wrap;
  word-break: break-all;
}
.protocol-help .ph-body code {
  background: #f0f2f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
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
.endpoint-preview-box {
  background: #f0f7ff;
  border: 1px solid #c6e0ff;
  border-radius: 6px;
  padding: 10px 14px;
  margin: -4px 0 14px;
  font-size: 12px;
}
.ep-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 8px;
  font-size: 12px;
}
.ep-auto-badge {
  background: #e6f1ff;
  color: #409eff;
  border: 1px solid #b3d8ff;
  border-radius: 3px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 400;
}
.ep-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 5px;
  gap: 6px;
  line-height: 1.5;
}
.ep-row:last-of-type {
  margin-bottom: 0;
}
.ep-label {
  flex-shrink: 0;
  color: #606266;
  min-width: 68px;
}
.ep-url {
  word-break: break-all;
  color: #303133;
  background: rgba(255,255,255,0.7);
  border: 1px solid #dce8fa;
  border-radius: 3px;
  padding: 1px 6px;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 11.5px;
  line-height: 1.6;
}
.ep-tip {
  margin: 8px 0 0;
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}
.ep-tip-warn {
  color: #e6a23c;
}
.ep-box-gemini {
  background: #fffbf0;
  border-color: #f5dfa0;
}
.ep-box-gemini .ep-preview-header {
  color: #b8860b;
}
.ep-badge-gemini {
  background: #fef6e0;
  color: #b8860b;
  border-color: #f0d080;
}
.generation-settings {
  max-width: 600px;
}
.gs-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.gs-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 20px;
}
.gs-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.gs-label {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
  white-space: nowrap;
}
.gs-unit {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
.gs-tip-box {
  margin-top: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 13px;
}
.gs-tip-title {
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.gs-tip-list {
  margin: 0 0 8px 16px;
  padding: 0;
  color: #606266;
  line-height: 1.8;
}
.gs-tip-note {
  color: #909399;
  font-size: 12px;
}
</style>
