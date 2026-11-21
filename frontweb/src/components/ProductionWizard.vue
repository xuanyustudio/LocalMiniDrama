<template>
  <section id="anchor-production-wizard" class="production-wizard">
    <div class="wizard-heading">
      <div>
        <h2>小说短剧工作台</h2>
        <p>上传小说后选一章，改写成正文和剧本，保存为一集后继续制作。云端生成前会显示本步估价。</p>
      </div>
      <el-button @click="serviceDialog = true">模型与费用</el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false">
      <el-button v-if="pollFailed" link type="primary" @click="refresh">重新读取进度</el-button>
    </el-alert>

    <div class="wizard-pipeline">
      <div class="wizard-bible-heading">
        <div>
          <strong>流水线体检（免费）</strong>
          <p v-if="pipeline?.next" class="wizard-note">下一步：{{ pipeline.next.name }} · {{ pipeline.next.text }}</p>
          <p v-else-if="pipeline" class="wizard-note">九个工位都已就绪。</p>
          <p v-else class="wizard-note">按“原著 → 档案 → 剧本 → 拍摄本 → 定妆 → 场景 → 画面 → 视频 → 成片”逐步检查。</p>
        </div>
        <el-button size="small" :loading="pipelinePending === 'load'" :disabled="Boolean(pipelinePending)" @click="loadPipeline">重新体检</el-button>
      </div>
      <el-alert v-if="pipelineError" :title="pipelineError" type="error" :closable="false" show-icon />
      <ol v-if="pipeline" class="wizard-stages">
        <li v-for="stage in pipeline.stages" :key="stage.key" :class="'is-' + stage.status">
          <button type="button" class="wizard-stage-head" :aria-expanded="openStage === stage.key" @click="openStage = openStage === stage.key ? '' : stage.key">
            <span class="wizard-light" :aria-label="stageStatusText[stage.status]"></span>
            <strong>{{ stage.name }}</strong>
            <span class="wizard-note">{{ stage.status === 'ok' ? stage.detail : stageStatusText[stage.status] + ' · ' + stage.issues.length + ' 项' }}</span>
          </button>
          <ul v-if="openStage === stage.key && stage.issues.length">
            <li v-for="(issue, i) in stage.issues" :key="i">
              <span>{{ issue.text }}</span>
              <el-button v-if="issue.fix" size="small" type="primary" link :loading="pipelinePending === issue.fix.action" :disabled="Boolean(pipelinePending)" @click="runPipelineFix(issue.fix.action)">{{ issue.fix.label }}</el-button>
            </li>
          </ul>
        </li>
      </ol>
    </div>

    <div class="wizard-bible">
      <div>
        <strong>故事档案</strong>
        <p class="wizard-note">{{ bibleSummary }}</p>
      </div>
      <el-button @click="openBible">{{ bibleEmpty ? '建立故事档案' : '查看 / 编辑' }}</el-button>
    </div>

    <div class="wizard-input">
      <div>
        <label for="wizard-text-file">小说文件</label>
        <div class="file-row">
          <input id="wizard-text-file" type="file" accept=".txt,text/plain" :disabled="busy" @change="chooseFile" />
          <el-button type="primary" :loading="pending === 'source'" :disabled="!sourceFile || busy" @click="uploadSource">上传 TXT</el-button>
        </div>
        <p v-if="source" class="wizard-note">当前原稿：{{ source.name }} · {{ chapters.length }} 个章节</p>
        <p v-else class="wizard-note">支持 UTF-8 和 GBK，先保存在本机。</p>
      </div>
      <div>
        <label for="wizard-chapter">本集改编章节</label>
        <el-select id="wizard-chapter" v-model="chapter" filterable :disabled="!chapters.length || busy" placeholder="上传 TXT 后选择章节">
          <el-option v-for="item in chapters" :key="item.index" :label="item.title || '第' + item.index + '章'" :value="item.index" />
        </el-select>
      </div>
    </div>

    <template v-if="chapters.length">
      <div class="wizard-input">
        <div>
          <label for="wizard-rules">改编要求</label>
          <el-input id="wizard-rules" v-model="rules" type="textarea" :rows="3" :maxlength="2000" :disabled="busy"
            placeholder="例如：保留主线和结局，压缩背景说明，用动作和对白表现冲突。" />
        </div>
        <div>
          <label for="wizard-characters">人物调整</label>
          <el-input id="wizard-characters" v-model="characterRules" type="textarea" :rows="3" :maxlength="1000" :disabled="busy"
            placeholder="例如：张三改名林川，保留他与李四的师徒关系。" />
        </div>
      </div>
      <el-button type="primary" :disabled="!chapter || busy" :loading="isRunning('rewrite') || pending === 'rewrite'" @click="startRewrite">
        {{ job?.stage === 'rewrite' && job.status === 'failed' ? '继续改写本章' : '改写本章' }}
      </el-button>
    </template>

    <div v-if="job" class="wizard-progress" aria-live="polite">
      <p>{{ progressLabel }}</p>
      <el-progress v-if="job.status === 'running' && job.total" :percentage="Math.round(100 * Math.min(job.done || 0, job.total) / job.total)" />
    </div>

    <div v-if="rewritten" class="wizard-draft">
      <label for="wizard-rewritten">改写正文 · 可编辑</label>
      <el-input id="wizard-rewritten" v-model="rewritten" type="textarea" :rows="8" :disabled="busy" />
      <div class="wizard-actions">
        <label for="wizard-seconds">目标时长（秒）</label>
        <el-input-number id="wizard-seconds" v-model="seconds" :min="15" :max="180" :step="5" :disabled="busy" />
        <el-button type="primary" :disabled="busy || !rewritten.trim()" :loading="isRunning('script') || pending === 'script'" @click="startScript">用改写稿生成剧本</el-button>
      </div>
    </div>

    <div v-if="script" class="wizard-draft">
      <label for="wizard-script">剧本 · 可编辑</label>
      <el-input id="wizard-script" v-model="script" type="textarea" :rows="9" :disabled="busy || !!savedScript" />
      <div class="wizard-actions">
        <el-button type="primary" :disabled="busy || !script.trim() || savedScript === script" :loading="pending === 'save'" @click="saveScript">
          {{ savedScript === script ? '已保存为一集' : '保存为新一集' }}
        </el-button>
        <p class="wizard-note">保存后可为这一集生成分镜。现有分集会保留。</p>
      </div>
      <div class="wizard-doctor">
        <div class="wizard-actions">
          <strong>剧本医生</strong>
          <el-button size="small" :loading="reviewPending === 'rules'" :disabled="!script.trim() || Boolean(reviewPending)" @click="reviewCurrentScript(false)">免费体检</el-button>
          <el-button size="small" type="primary" :loading="reviewPending === 'ai'" :disabled="!script.trim() || Boolean(reviewPending)" @click="reviewCurrentScript(true)">AI 详细审阅</el-button>
          <span v-if="reviewStale" class="wizard-note">剧本已修改，结果可能过时</span>
        </div>
        <template v-if="review">
          <ul class="wizard-checks">
            <li v-for="check in review.checks" :key="check.id" :class="'is-' + check.level">
              <strong>{{ { ok: '✓', warn: '!', error: '✕' }[check.level] }} {{ check.title }}</strong>
              <span v-if="check.detail">{{ check.detail }}</span>
            </li>
          </ul>
          <div v-if="review.ai" class="wizard-ai-review">
            <p><strong>{{ review.ai.score }} 分 · {{ review.ai.verdict }}</strong></p>
            <ol v-if="review.ai.top_fixes.length">
              <li v-for="fix in review.ai.top_fixes" :key="fix">{{ fix }}</li>
            </ol>
            <details>
              <summary>逐项意见</summary>
              <div v-for="item in review.ai.items" :key="item.criterion" class="wizard-ai-item">
                <strong>{{ item.criterion }} · {{ item.score }}/5</strong>
                <p>{{ item.comment }}</p>
                <p v-if="item.suggestion">建议：{{ item.suggestion }}</p>
              </div>
            </details>
          </div>
          <p class="wizard-note">体检识别“姓名：台词”和剧本块（单独一行 **姓名**，下面写台词）两种写法，按约每秒 4 字估算语速。AI 意见仅供参考，改不改由你决定。</p>
        </template>
      </div>
    </div>

    <div class="wizard-production">
      <h3>本集制作</h3>
      <p v-if="!episodeReady" class="wizard-note">请先保存剧本，或在页面顶部选中已有剧本的分集。</p>
      <button v-if="speakers.length" class="wizard-voice-link" type="button" @click="voiceDialog = true">设置角色音色</button>
      <div class="wizard-steps">
        <div v-for="step in stages" :key="step.id" class="wizard-stage">
          <strong>{{ step.label }}</strong>
          <span>{{ step.status }}</span>
          <el-button size="small" :disabled="step.disabled || busy || Boolean(activeStage)" :loading="activeStage === step.id" @click="runStage(step)">{{ step.action }}</el-button>
        </div>
      </div>
      <div v-if="videoReview.length" class="wizard-video-review">
        <strong>{{ videoReview.length }} 个镜头需要处理内容审核</strong>
        <p class="wizard-note">批量生成和试生成会跳过这些镜头。处理后可在对应分镜单独生成。</p>
        <ul>
          <li v-for="issue in videoReview" :key="issue.id">
            <el-button type="primary" link @click="$emit('show-storyboard', issue.id)">查看第 {{ issue.number }} 镜</el-button>
            <span>{{ issue.label }}</span>
          </li>
        </ul>
      </div>
      <div v-if="episodeId" class="wizard-actions">
        <a :href="'/api/v1/episodes/' + episodeId + '/jianying-package'" download>下载剪映素材包</a>
        <a v-if="videoUrl" :href="videoUrl" download target="_blank" rel="noopener noreferrer">下载成片</a>
      </div>
      <p v-if="episodeId" class="wizard-note">素材包包含分镜、字幕、时间线及已生成素材，可在剪映中按时间线重新排布。</p>
    </div>

    <el-dialog v-model="bibleDialog" title="故事档案" width="min(760px, 96vw)" append-to-body>
      <p class="wizard-note">故事档案是这部剧的设定依据。改写和编剧都会参照它，剧本医生也用它检查人物是否前后一致。AI 整理出的是草稿，检查后再保存。</p>
      <div class="wizard-actions">
        <el-button :loading="biblePending === 'generate'" :disabled="Boolean(biblePending) || (!rewritten.trim() && !chapter)" @click="generateBible">
          {{ rewritten.trim() ? '用 AI 从改写稿整理' : '用 AI 从当前章节整理' }}
        </el-button>
        <el-button :loading="biblePending === 'import'" :disabled="Boolean(biblePending)" @click="importCharacters">从本剧角色导入（免费）</el-button>
        <span class="wizard-note">都会在现有内容的基础上补充，不会清空你写的部分。</span>
      </div>
      <div v-if="chapters.length" class="wizard-book">
        <strong>从全书整理</strong>
        <p class="wizard-note">长篇小说按章节顺序分批读完，每批在上一批整理出的档案上补充修正，主角和人物身份按全书戏份判断。整理在后台进行，可以关掉窗口，回来再看进度。</p>
        <div class="wizard-actions">
          <span>第</span>
          <el-input-number v-model="bookFrom" :min="1" :max="chapters.length" size="small" :disabled="bookRunning" />
          <span>到</span>
          <el-input-number v-model="bookTo" :min="1" :max="chapters.length" size="small" :disabled="bookRunning" />
          <span>章（共 {{ chapters.length }} 章）</span>
          <el-checkbox v-model="bookKeepExisting" :disabled="bookRunning">在现有档案基础上补充</el-checkbox>
        </div>
        <div class="wizard-actions">
          <el-button v-if="!bookRunning" type="primary" :loading="biblePending === 'book'" :disabled="Boolean(biblePending)" @click="startBook(false)">开始整理</el-button>
          <el-button v-if="bookJob?.status === 'failed' || bookJob?.status === 'cancelled'" :disabled="Boolean(biblePending)" @click="startBook(true)">接着整理（剩 {{ bookJob.total_batches - bookJob.done }} 批）</el-button>
          <el-button v-if="bookRunning" @click="cancelBook">停止</el-button>
          <el-button v-if="bookJob?.done && !bookRunning" @click="loadBookDraft">把整理结果填入下方</el-button>
        </div>
        <template v-if="bookJob">
          <el-progress :percentage="bookPercent" :status="bookJob.status === 'done' ? 'success' : bookJob.status === 'failed' ? 'exception' : undefined" />
          <p class="wizard-note">{{ bookStatusText }}</p>
        </template>
      </div>
      <div class="wizard-bible-form">
        <label>一句话故事<el-input v-model="bible.logline" :maxlength="300" placeholder="谁，想要什么，被什么阻挡" /></label>
        <div class="wizard-input">
          <label>类型<el-input v-model="bible.genre" :maxlength="60" placeholder="例如：逆袭、悬疑、古装" /></label>
          <label>基调<el-input v-model="bible.tone" :maxlength="300" placeholder="例如：紧张、爽快、带点幽默" /></label>
        </div>
        <label>世界观<el-input v-model="bible.world" type="textarea" :rows="2" :maxlength="1200" placeholder="时代、地点、特殊规则" /></label>
        <div class="wizard-bible-heading">
          <strong>人物（{{ bible.characters.length }}）</strong>
          <el-button size="small" :disabled="bible.characters.length >= 30" @click="addCharacter">添加人物</el-button>
        </div>
        <div v-for="(person, index) in bible.characters" :key="index" class="wizard-person">
          <div class="wizard-input">
            <el-input v-model="person.name" :maxlength="30" placeholder="姓名" />
            <el-input v-model="person.aliases" :maxlength="60" placeholder="别名，用顿号分隔" />
            <el-input v-model="person.role" :maxlength="60" placeholder="身份，例如：主角" />
            <el-button size="small" link type="danger" @click="bible.characters.splice(index, 1)">删除</el-button>
          </div>
          <el-input v-model="person.appearance" :maxlength="300" placeholder="固定外貌：性别、年龄、身材、脸、发型（不写“超写实”等画风词）" />
          <el-input v-model="person.costume" :maxlength="300" placeholder="服装，可按阶段写，例如：刑警时期：深色夹克" />
          <div class="wizard-input">
            <el-input v-model="person.personality" :maxlength="300" placeholder="性格" />
            <el-input v-model="person.goal" :maxlength="300" placeholder="想要什么" />
          </div>
          <el-input v-model="person.relationships" :maxlength="300" placeholder="与其他人物的关系" />
        </div>
        <label>主要地点（每行一条）<el-input v-model="biblePlaces" type="textarea" :rows="3" placeholder="例如：屯口乡公路（黎明前）：乡村沥青路，晨雾" /></label>
        <label>不可改动的事实（每行一条）<el-input v-model="bibleFacts" type="textarea" :rows="3" placeholder="例如：林宁是陆禾的师父" /></label>
        <label>风格规则（每行一条）<el-input v-model="bibleRules" type="textarea" :rows="3" placeholder="例如：每集结尾留一个反转" /></label>
      </div>
      <el-alert v-if="bibleError" :title="bibleError" type="error" :closable="false" show-icon />
      <template #footer>
        <el-button @click="bibleDialog = false">关闭</el-button>
        <el-button type="primary" :loading="biblePending === 'save'" :disabled="Boolean(biblePending)" @click="saveBible">保存档案</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="voiceDialog" title="角色音色" width="min(560px, 94vw)" append-to-body>
      <p class="wizard-note">选择不同音色有助于区分人物。保存的分镜对白以“姓名：台词”逐行书写。</p>
      <div v-for="name in speakers" :key="name" class="wizard-voice-row">
        <span>{{ name }}</span>
        <el-select v-model="speakerVoices[name]" placeholder="默认 · 沉稳男声">
          <el-option label="沉稳男声" value="Chinese (Mandarin)_Reliable_Executive" />
          <el-option label="清晰女声" value="Chinese (Mandarin)_IntellectualGirl" />
        </el-select>
      </div>
      <template #footer><el-button type="primary" @click="voiceDialog = false">完成</el-button></template>
    </el-dialog>

    <el-dialog v-model="serviceDialog" title="生产模型与费用" width="min(660px, 94vw)" append-to-body>
      <p>密钥填写到工作台目录的 <code>backend-node/.env</code>，也可以双击 <code>Set-Production-Keys.bat</code> 打开该文件。保存后回到这里刷新并启用需要的模型。</p>
      <div class="wizard-services">
        <div v-for="provider in providers" :key="provider.key">
          <strong>{{ provider.name }}</strong>
          <p>{{ provider.models }}</p>
          <p>{{ profile?.[provider.key] ? '已读取到密钥，实际调用结果待验证' : '尚未读取到密钥' }}</p>
          <a :href="provider.url" target="_blank" rel="noopener noreferrer">服务商控制台</a>
        </div>
      </div>
      <div class="wizard-actions">
        <el-button :loading="profileLoading" @click="loadProfile">刷新配置</el-button>
        <el-button type="primary" :loading="pending === 'activate'" :disabled="pending || !profile?.bailian_key" @click="activate({ provider: 'bailian', text: true, image: true, video: true, tts: true })">
          {{ Object.values(profile?.bailian_active || {}).filter(Boolean).length === 5 ? '百炼已启用 · 重新应用' : '启用百炼新加坡区' }}
        </el-button>
        <el-button type="primary" :loading="pending === 'activate'" :disabled="pending || !profile?.byteplus_key" @click="activate({ text: true, image: true, video: true })">
          {{ profile?.active?.text && profile?.active?.image && profile?.active?.video ? '重新应用 BytePlus 配置' : '启用 BytePlus' }}
        </el-button>
        <el-button type="primary" :loading="pending === 'activate'" :disabled="pending || !profile?.minimax_key" @click="activate({ tts: true })">
          {{ profile?.active?.tts ? '重新应用配音配置' : '启用配音' }}
        </el-button>
      </div>
      <h3>成本估算（美元）</h3>
      <div class="wizard-input">
        <div>
          <label for="wizard-estimate-images">出图张数</label>
          <el-input-number id="wizard-estimate-images" v-model="estimateImages" :min="0" :max="1000" />
        </div>
        <div>
          <label for="wizard-estimate-video">720p 视频生成秒数</label>
          <el-input-number id="wizard-estimate-video" v-model="estimateSeconds" :min="0" :max="6000" :step="5" />
        </div>
      </div>
      <el-button size="small" :loading="estimateLoading" @click="calculateEstimate">查看预算</el-button>
      <p v-if="estimateTotal"><strong>{{ estimateTotal }}</strong></p>
      <p class="wizard-note">以上用于规划图片与视频预算。每次点击生成时，确认单会按当前选用的模型和本次工作量重新报价。</p>
      <el-alert v-if="profileError" :title="profileError" type="error" :closable="false" show-icon />
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import { productionCostTotal } from '@/utils/productionCost'

const props = defineProps({
  projectId: { type: [Number, String], required: true },
  episodeReady: Boolean,
  episodeId: { type: [Number, String], default: null },
  videoUrl: { type: String, default: '' },
  speakers: { type: Array, default: () => [] },
  videoReview: { type: Array, default: () => [] },
  getStages: { type: Function, required: true },
  runProductionStage: { type: Function, required: true },
  saveEpisode: { type: Function, required: true },
})
const emit = defineEmits(['show-storyboard', 'data-changed'])

const source = ref(null)
const job = ref(null)
const chapter = ref(null)
const sourceFile = ref(null)
const rules = ref('')
const characterRules = ref('')
const rewritten = ref('')
const script = ref('')
const seconds = ref(60)
const savedScript = ref('')
const pending = ref('')
const error = ref('')
const pollFailed = ref(false)
const serviceDialog = ref(false)
const voiceDialog = ref(false)
const speakerVoices = ref({})
const profile = ref(null)
const stages = computed(() => props.getStages(profile.value?.video_duration_limits))
const profileLoading = ref(false)
const profileError = ref('')
const activeStage = ref('')
const estimateImages = ref(10)
const estimateSeconds = ref(60)
const estimateTotal = ref('')
const estimateLoading = ref(false)
const bailianService = (service) => Boolean(profile.value?.bailian_active?.[service])
const chapters = computed(() => source.value?.chapters || [])
const busy = computed(() => Boolean(pending.value) || job.value?.status === 'running')
const adaptationPath = computed(() => '/dramas/' + encodeURIComponent(props.projectId) + '/adaptation')
const providers = [
  { key: 'bailian_key', name: '阿里云百炼 · 新加坡', models: '通义千问 3.7 · 万相生图与无声视频 · CosyVoice 中文配音', url: 'https://modelstudio.console.alibabacloud.com/?apiKey=1' },
  { key: 'byteplus_key', name: 'BytePlus ModelArk', models: 'Dola Seed 2.1 Turbo · Seedream 5.0 Pro · Seedance 2.0 Fast', url: 'https://ai.byteplus.com/ark/region:ap-southeast-1/apikey' },
  { key: 'minimax_key', name: 'MiniMax 国际站', models: 'Speech 2.8 Turbo 中文配音', url: 'https://platform.minimax.io/' },
]

const emptyBible = () => ({ logline: '', genre: '', tone: '', world: '', characters: [], places: [], facts: [], style_rules: [] })
const bible = ref(emptyBible())
const savedBible = ref(emptyBible())
const bibleFacts = ref('')
const biblePlaces = ref('')
const pipeline = ref(null)
const pipelinePending = ref('')
const pipelineError = ref('')
const openStage = ref('')
const stageStatusText = { ok: '就绪', warn: '需要处理', missing: '缺少' }
const bibleRules = ref('')
const bibleDialog = ref(false)
const biblePending = ref('')
const bibleError = ref('')
const review = ref(null)
const reviewedScript = ref('')
const reviewPending = ref('')
const bibleEmpty = computed(() => !savedBible.value.logline && !savedBible.value.world && !savedBible.value.characters.length && !savedBible.value.facts.length)
const bibleSummary = computed(() => {
  if (bibleEmpty.value) return '还没有档案。建议先整理人物和关键事实，改写、编剧和审阅会更一致。'
  const names = savedBible.value.characters.map((c) => c.name).slice(0, 5).join('、')
  return [savedBible.value.logline, names && '人物：' + names + (savedBible.value.characters.length > 5 ? ' 等' : '')].filter(Boolean).join(' · ')
})
const reviewStale = computed(() => Boolean(review.value) && reviewedScript.value !== script.value)
const biblePath = computed(() => '/dramas/' + encodeURIComponent(props.projectId) + '/story-bible')

function setBibleForm(data) {
  const value = { ...emptyBible(), ...(data || {}) }
  bible.value = { ...value, characters: value.characters.map((c) => ({ ...c })) }
  bibleFacts.value = value.facts.join('\n')
  biblePlaces.value = (value.places || []).join('\n')
  bibleRules.value = value.style_rules.join('\n')
}

const pipelinePath = computed(() => '/dramas/' + encodeURIComponent(props.projectId) + '/pipeline')

async function loadPipeline() {
  pipelinePending.value = 'load'
  pipelineError.value = ''
  try {
    const data = await request.get(pipelinePath.value)
    if (!alive) return
    pipeline.value = data
    if (!openStage.value && data.next) openStage.value = data.next.key
  } catch (e) {
    pipelineError.value = '体检失败：' + e.message
  } finally {
    pipelinePending.value = ''
  }
}

async function runPipelineFix(action) {
  pipelinePending.value = action
  pipelineError.value = ''
  try {
    const data = await request.post(pipelinePath.value + '/fix', { action })
    pipeline.value = data.report
    ElMessage.success(data.message)
    if (action === 'import-to-bible') loadBible()
    else if (data.changed) emit('data-changed')
  } catch (e) {
    pipelineError.value = e.message
  } finally {
    pipelinePending.value = ''
  }
}

async function loadBible() {
  try {
    const data = await request.get(biblePath.value)
    if (!alive) return
    savedBible.value = data.bible
    setBibleForm(data.bible)
  } catch (e) {
    bibleError.value = '无法读取故事档案。' + e.message
  }
}

function openBible() {
  bibleError.value = ''
  setBibleForm(savedBible.value)
  bibleDialog.value = true
  if (chapters.value.length) {
    if (!bookTo.value || bookTo.value > chapters.value.length) bookTo.value = chapters.value.length
    loadBook()
  }
}

// ---------- 从全书分批整理 ----------
const bookJob = ref(null)
const bookFrom = ref(1)
const bookTo = ref(null)
const bookKeepExisting = ref(false)
let bookTimer = null
const bookRunning = computed(() => bookJob.value?.status === 'running')
const bookPercent = computed(() => {
  const j = bookJob.value
  return j?.total_batches ? Math.round((j.done / j.total_batches) * 100) : 0
})
const bookStatusText = computed(() => {
  const j = bookJob.value
  if (!j) return ''
  const range = `第 ${j.from}–${j.to} 章，已完成 ${j.done}/${j.total_batches} 批`
  const skipped = j.skipped?.length ? `；第 ${j.skipped.join('、')} 章超过 48000 字已跳过` : ''
  if (j.status === 'running') return `正在整理${j.current ? `第 ${j.current.from}–${j.current.to} 章` : ''}…（${range}）${skipped}`
  if (j.status === 'done') return `整理完成（${range}）${skipped}。点“把整理结果填入下方”，检查后保存。`
  if (j.status === 'cancelled') return `已停止（${range}）。可以接着整理，或先把已整理的结果填入下方。`
  return `${j.error || '整理失败'}（${range}）`
})

const bookPath = computed(() => biblePath.value + '/book')

async function loadBook() {
  clearTimeout(bookTimer)
  try {
    const { job: data } = await request.get(bookPath.value)
    if (!alive) return
    bookJob.value = data
    if (data && !bookRunning.value) { bookFrom.value = data.from; bookTo.value = data.to }
  } catch (e) {
    bibleError.value = '无法读取整理进度。' + e.message
  }
  if (alive && bookRunning.value) bookTimer = setTimeout(loadBook, 3000)
}

async function startBook(resume) {
  biblePending.value = 'book'
  bibleError.value = ''
  try {
    const body = resume ? { resume: true } : { from: bookFrom.value, to: bookTo.value, fresh: !bookKeepExisting.value }
    const { job: data } = await request.post(bookPath.value, body)
    bookJob.value = data
    loadBook()
  } catch (e) {
    if (e.code !== 'ERR_CANCELED') bibleError.value = e.message
  } finally {
    biblePending.value = ''
  }
}

async function cancelBook() {
  try {
    await request.post(bookPath.value + '/cancel', {})
    ElMessage.info('这一批读完后停止')
  } catch (e) {
    bibleError.value = e.message
  }
}

function loadBookDraft() {
  if (!bookJob.value?.draft) return
  setBibleForm(bookJob.value.draft)
  ElMessage.success('已填入整理结果，请检查后点“保存档案”')
}

function addCharacter() {
  bible.value.characters.push({ name: '', aliases: '', role: '', appearance: '', costume: '', personality: '', goal: '', relationships: '' })
}

function bibleFromForm() {
  const split = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean)
  return { ...bible.value, places: split(biblePlaces.value), facts: split(bibleFacts.value), style_rules: split(bibleRules.value) }
}

async function generateBible() {
  biblePending.value = 'generate'
  bibleError.value = ''
  try {
    const body = rewritten.value.trim() ? { text: rewritten.value } : { chapter: chapter.value }
    const { draft } = await request.post(biblePath.value + '/generate', body)
    setBibleForm(draft)
    ElMessage.success('已整理出草稿，请检查后保存')
  } catch (e) {
    if (e.code !== 'ERR_CANCELED') bibleError.value = e.message
  } finally {
    biblePending.value = ''
  }
}

async function importCharacters() {
  biblePending.value = 'import'
  bibleError.value = ''
  try {
    const { draft, added, total } = await request.post(biblePath.value + '/import-characters', { bible: bibleFromForm() })
    setBibleForm(draft)
    ElMessage.success(total ? `已导入 ${added} 个新人物，已有人物补全了空白信息。请检查后保存` : '本剧角色库还没有人物')
  } catch (e) {
    bibleError.value = e.message
  } finally {
    biblePending.value = ''
  }
}

async function saveBible() {
  biblePending.value = 'save'
  bibleError.value = ''
  try {
    const data = await request.put(biblePath.value, { bible: bibleFromForm() })
    savedBible.value = data.bible
    setBibleForm(data.bible)
    bibleDialog.value = false
    ElMessage.success('故事档案已保存')
    loadPipeline()
  } catch (e) {
    bibleError.value = e.message
  } finally {
    biblePending.value = ''
  }
}

async function reviewCurrentScript(ai) {
  const current = script.value
  reviewPending.value = ai ? 'ai' : 'rules'
  try {
    review.value = await request.post('/dramas/' + encodeURIComponent(props.projectId) + '/script-review', { script: current, seconds: seconds.value, ai })
    reviewedScript.value = current
  } catch (e) {
    if (e.code !== 'ERR_CANCELED') ElMessage.error(e.message || '审阅失败')
  } finally {
    reviewPending.value = ''
  }
}

let timer
let lastRewrite = ''
let lastScript = ''
let alive = true

function isRunning(stage) {
  return job.value?.stage === stage && job.value?.status === 'running'
}

const progressLabel = computed(() => {
  const current = job.value
  if (!current) return ''
  const name = current.stage === 'script' ? '剧本' : '正文改写'
  if (current.status === 'failed') return name + '未完成'
  if (current.status === 'completed') return name + '已完成，可以在下方检查和编辑。'
  const counts = current.total ? ' ' + (current.done || 0) + '/' + current.total : ''
  return '正在生成' + name + counts + '，可以刷新或稍后回来查看结果。'
})

function applySnapshot(data) {
  source.value = data?.source || null
  job.value = data?.job || null
  if (!chapters.value.some((item) => item.index === chapter.value)) {
    chapter.value = job.value?.chapter || chapters.value[0]?.index || null
  }
  const current = job.value
  if (!current) return
  if (current.seconds) seconds.value = current.seconds
  rules.value = current.rules ?? rules.value
  characterRules.value = current.character_rules ?? characterRules.value
  if (current.rewritten && current.rewritten !== lastRewrite) {
    lastRewrite = current.rewritten
    rewritten.value = current.rewritten
  }
  if (current.script && current.script !== lastScript) {
    lastScript = current.script
    script.value = current.script
    savedScript.value = current.episode ? current.script : ''
    if (current.status === 'completed') reviewCurrentScript(false)
  }
  error.value = current.status === 'failed' ? current.error || '生成失败，可以重试。' : ''
}

function schedulePoll() {
  clearTimeout(timer)
  if (alive && job.value?.status === 'running') timer = setTimeout(refresh, 1800)
}

async function refresh() {
  try {
    const data = await request.get(adaptationPath.value)
    if (!alive) return
    pollFailed.value = false
    applySnapshot(data)
    schedulePoll()
  } catch (e) {
    if (!alive) return
    pollFailed.value = true
    error.value = '无法读取制作进度。' + e.message
  }
}

function chooseFile(event) {
  sourceFile.value = event.target.files?.[0] || null
}

async function postAdaptation(action, data, config) {
  if (busy.value) return false
  pending.value = action
  error.value = ''
  try {
    const next = await request.post(adaptationPath.value + '/' + action, data, config)
    if (!alive) return false
    if (action === 'source' || action === 'rewrite') {
      rewritten.value = ''
      lastRewrite = ''
    }
    script.value = ''
    lastScript = ''
    savedScript.value = ''
    if (action === 'source') chapter.value = null
    applySnapshot(next)
    schedulePoll()
    return true
  } catch (e) {
    if (e.code !== 'ERR_CANCELED') error.value = e.message
    return false
  } finally {
    pending.value = ''
  }
}

async function uploadSource() {
  if (!sourceFile.value) return
  if (source.value && !await confirm('上传后，这份文件将成为项目当前用于改编的原稿。', '切换小说原稿')) return
  const form = new FormData()
  form.append('file', sourceFile.value)
  if (await postAdaptation('source', form, { headers: { 'Content-Type': 'multipart/form-data' } })) sourceFile.value = null
}

async function confirm(message, title) {
  try {
    await ElMessageBox.confirm(message, title, { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' })
    return true
  } catch {
    return false
  }
}

async function startRewrite() {
  await postAdaptation('rewrite', { chapter: chapter.value, rules: rules.value, character_rules: characterRules.value })
}

async function startScript() {
  await postAdaptation('script', { rewritten: rewritten.value, seconds: seconds.value })
}

async function saveScript() {
  pending.value = 'save'
  try {
    const currentChapter = chapters.value.find((item) => item.index === job.value?.chapter)
    await props.saveEpisode({ script: script.value, title: currentChapter?.title || '小说改编', seconds: seconds.value })
    savedScript.value = script.value
  } catch (e) {
    error.value = e.message
  } finally {
    pending.value = ''
  }
}

async function loadProfile() {
  profileLoading.value = true
  profileError.value = ''
  try {
    profile.value = await request.get('/production-profile')
  } catch (e) {
    profileError.value = e.message
  } finally {
    profileLoading.value = false
  }
}

async function activate(features) {
  pending.value = 'activate'
  profileError.value = ''
  try {
    profile.value = await request.post('/production-profile/activate', features)
    estimateTotal.value = ''
    ElMessage.success('已选择生产模型。生成时按服务商用量计费。')
  } catch (e) {
    profileError.value = e.message
  } finally {
    pending.value = ''
  }
}

async function calculateEstimate() {
  const items = []
  if (estimateImages.value > 0) items.push({ kind: 'storyboard_image', data: { count: estimateImages.value } })
  if (estimateSeconds.value > 0) items.push({ kind: 'video', data: { duration: estimateSeconds.value } })
  estimateTotal.value = ''
  if (!items.length) {
    estimateTotal.value = '本次预计 US$0.00'
    return
  }
  estimateLoading.value = true
  try {
    estimateTotal.value = productionCostTotal(await request.post('/production-profile/quote', { items }))
  } catch (e) {
    profileError.value = e.message
  } finally {
    estimateLoading.value = false
  }
}

function serviceReady(service) {
  if (bailianService(service)) return profile.value?.bailian_key
  const key = service === 'tts' ? 'minimax_key' : 'byteplus_key'
  return profile.value?.[key] && profile.value?.active?.[service]
}

async function runStage(step) {
  if (activeStage.value || step.disabled) return
  activeStage.value = step.id
  try {
    const service = { references: 'image', image: 'storyboard_image', video_sample: 'video', video: 'video', tts: 'tts' }[step.id]
    if (service) {
      await loadProfile()
      if (profileError.value) throw new Error(profileError.value)
      if (!serviceReady(service) || (step.needsImage && !serviceReady('storyboard_image'))) {
        serviceDialog.value = true
        throw new Error('请先在“模型与费用”里启用这一步需要的服务')
      }
    }
    const voices = Object.fromEntries(Object.entries(speakerVoices.value).filter(([, voice]) => voice))
    await props.runProductionStage(step, voices, profile.value?.video_duration_limits)
  } catch (e) {
    ElMessage.error(e.message || '制作操作失败')
  } finally {
    activeStage.value = ''
  }
}

watch(serviceDialog, (open) => { if (open) loadProfile() })
watch([estimateImages, estimateSeconds], () => { estimateTotal.value = '' })
watch(() => props.episodeId, () => { speakerVoices.value = {} })
onBeforeUnmount(() => {
  alive = false
  clearTimeout(timer)
  clearTimeout(bookTimer)
})
refresh()
loadProfile()
loadBible()
loadPipeline()
</script>

<style scoped>
.production-wizard {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: clamp(16px, 2.4vw, 28px);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  scroll-margin-top: 88px;
}
.wizard-heading, .wizard-input, .wizard-actions, .file-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.wizard-heading { justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.wizard-heading h2, .wizard-production h3 { margin: 0; }
.wizard-heading p { margin: 6px 0 0; color: var(--el-text-color-secondary); }
.wizard-input { align-items: start; margin: 14px 0; }
.wizard-input > div { flex: 1 1 270px; min-width: 0; }
.wizard-input label, .wizard-draft > label { display: block; margin-bottom: 6px; font-weight: 600; }
.wizard-input .el-select { width: 100%; }
.file-row input { max-width: 100%; color: inherit; }
.wizard-note { margin: 5px 0; color: var(--el-text-color-secondary); font-size: .86rem; }
.wizard-progress p { margin-bottom: 8px; }
.wizard-draft { margin-top: 16px; }
.wizard-actions { margin-top: 10px; }
.wizard-production { border-top: 1px solid var(--el-border-color); margin-top: 20px; padding-top: 18px; }
.wizard-steps, .wizard-services { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 10px; margin-top: 12px; }
.wizard-stage, .wizard-services > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}
.wizard-stage span { color: var(--el-text-color-secondary); font-size: .82rem; }
.wizard-video-review { margin-top: 12px; padding: 12px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.wizard-video-review ul { display: grid; gap: 5px 16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); list-style: none; margin: 8px 0 0; padding: 0; }
.wizard-video-review li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: .86rem; }
.wizard-services p { margin: 0; }
.wizard-voice-link { border: 0; padding: 6px 0; color: var(--el-color-primary); background: none; cursor: pointer; font: inherit; }
.wizard-voice-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 10px 0; }
.wizard-voice-row .el-select { width: 185px; }
.wizard-pipeline { margin-bottom: 14px; padding: 12px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.wizard-stages { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 4px; }
.wizard-stages > li > ul { margin: 4px 0 8px 26px; padding-left: 14px; display: grid; gap: 6px; }
.wizard-stages > li > ul > li { overflow-wrap: anywhere; }
.wizard-stage-head { display: flex; align-items: baseline; gap: 8px; width: 100%; padding: 6px 4px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 6px; }
.wizard-stage-head:hover { background: var(--el-fill-color-light); }
.wizard-stage-head:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 1px; }
.wizard-stage-head strong { flex: 0 0 auto; }
.wizard-stage-head .wizard-note { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wizard-light { flex: 0 0 10px; width: 10px; height: 10px; border-radius: 50%; align-self: center; background: var(--el-color-success); }
.is-warn .wizard-light { background: var(--el-color-warning); }
.is-missing .wizard-light { background: var(--el-color-danger); }
.wizard-bible { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; padding: 12px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.wizard-bible > div { flex: 1 1 260px; min-width: 0; }
.wizard-bible-form { display: grid; gap: 10px; margin-top: 12px; }
.wizard-bible-form label { display: grid; gap: 4px; font-weight: 600; }
.wizard-bible-form .wizard-input { margin: 0; }
.wizard-bible-form .wizard-input > * { flex: 1 1 180px; }
.wizard-bible-heading { display: flex; justify-content: space-between; align-items: center; }
.wizard-book { display: grid; gap: 8px; margin: 12px 0; padding: 12px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.wizard-person { display: grid; gap: 6px; padding: 10px; border: 1px dashed var(--el-border-color); border-radius: 8px; }
.wizard-doctor { margin-top: 14px; padding: 12px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.wizard-doctor .wizard-actions { margin-top: 0; }
.wizard-checks { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 6px; }
.wizard-checks li { display: grid; gap: 2px; font-size: .88rem; }
.wizard-checks span { color: var(--el-text-color-secondary); }
.wizard-checks .is-ok strong { color: var(--el-color-success); }
.wizard-checks .is-warn strong { color: var(--el-color-warning); }
.wizard-checks .is-error strong { color: var(--el-color-danger); }
.wizard-ai-review { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--el-border-color); }
.wizard-ai-review ol { margin: 6px 0; padding-left: 20px; }
.wizard-ai-item { margin: 8px 0; }
.wizard-ai-item p { margin: 2px 0; color: var(--el-text-color-secondary); font-size: .88rem; }
</style>
