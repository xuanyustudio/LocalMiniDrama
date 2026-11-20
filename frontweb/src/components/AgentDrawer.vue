<template>
  <el-drawer :model-value="open" title="助手" direction="rtl" size="400px" @close="emit('update:open', false)">
    <div class="agent-drawer">
      <el-select
        v-if="showEpisodePicker"
        :model-value="agent.episodeId"
        class="episode-picker"
        placeholder="当前集"
        clearable
        @change="agent.setEpisodeId"
      >
        <el-option
          v-for="episode in agent.episodes"
          :key="episode.id"
          :label="episode.title || ('第' + (episode.episode_number || '') + '集')"
          :value="episode.id"
        />
      </el-select>

      <div ref="logRef" class="log">
        <p v-if="!messages.length && !errorText" class="empty">可以让我看看这个项目，或改剧本、角色、场景和分镜。</p>
        <article v-for="(message, index) in messages" :key="index" class="bubble" :class="message.role">
          <p v-if="message.text">{{ message.text }}</p>
          <p v-if="message.summary" class="summary">{{ message.summary }}</p>
          <img v-if="thumb(message)" :src="thumb(message)" alt="" />
          <div v-if="message.approval && message.approval.pending" class="approval">
            <span>{{ message.approval.toolName?.startsWith('generate_') ? '助手请求生成素材' : '删除' + (message.approval.label || '这一项') + '？' }}</span>
            <el-button size="small" :type="message.approval.toolName?.startsWith('generate_') ? 'primary' : 'danger'" @click="decide(message, true)">
              {{ message.approval.toolName?.startsWith('generate_') ? '查看费用' : '允许' }}
            </el-button>
            <el-button size="small" @click="decide(message, false)">拒绝</el-button>
          </div>
        </article>
        <p v-if="errorText" class="error">{{ errorText }}</p>
      </div>

      <form class="composer" @submit.prevent="send">
        <el-input v-model="draft" type="textarea" :rows="3" placeholder="说说要改什么" :disabled="busy" />
        <el-button type="primary" native-type="submit" :loading="busy" :disabled="!draft.trim()">发送</el-button>
      </form>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { agentAPI } from '@/api/agent'
import { taskAPI } from '@/api/task'
import { useAgentContext } from '@/stores/agentContext'

const props = defineProps({
  open: { type: Boolean, default: false },
  dramaId: { type: Number, required: true },
})
const emit = defineEmits(['update:open'])

const route = useRoute()
const agent = useAgentContext()
const messages = ref([])
const draft = ref('')
const busy = ref(false)
const errorText = ref('')
const logRef = ref(null)
const timers = new Set()
const showEpisodePicker = computed(() => route.name === 'drama-detail')

function thumb(message) {
  if (message.localPath) return `/static/${String(message.localPath).replace(/^\//, '')}`
  return message.imageUrl || ''
}

function scrollDown() {
  nextTick(() => {
    if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
  })
}

function notifyChanged(toolName) {
  if (toolName === 'get_current_project' || toolName === 'get_task') return
  window.dispatchEvent(new CustomEvent('lmd-agent-changed', { detail: { dramaId: props.dramaId } }))
}

function taskResult(data) {
  const raw = data?.result
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch (_) {
    return {}
  }
}

function watchTask(taskId, message) {
  const timer = setInterval(async () => {
    try {
      const task = await taskAPI.get(taskId)
      const data = task?.data ?? task
      if (!data || (data.status !== 'completed' && data.status !== 'failed')) return
      clearInterval(timer)
      timers.delete(timer)
      const result = taskResult(data)
      message.imageUrl = result.image_url || message.imageUrl
      message.localPath = result.local_path || message.localPath
      if (data.status === 'failed') {
        message.summary = data.error || data.message || '生成失败'
      } else if (result.count != null) {
        message.summary = `已完成，共 ${result.count} 个`
      } else {
        message.summary = '已完成'
      }
      notifyChanged('generate_image')
    } catch (_) {
      /* 下一轮再查 */
    }
  }, 3000)
  timers.add(timer)
}

function onEvent(event) {
  if (!event || !event.type) return
  if (event.type === 'text-delta') {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant' && last.streaming) last.text += event.text || ''
    else messages.value.push({ role: 'assistant', text: event.text || '', streaming: true })
  } else if (event.type === 'tool-call') {
    messages.value.push({ role: 'assistant', text: '', summary: `正在使用 ${event.toolName || '工具'}` })
  } else if (event.type === 'tool-result') {
    const message = {
      role: 'assistant',
      text: '',
      summary: event.summary || '',
      imageUrl: event.imageUrl,
      localPath: event.localPath,
      taskId: event.taskId,
    }
    messages.value.push(message)
    if (event.ok) notifyChanged(event.toolName)
    if (event.taskId) watchTask(event.taskId, message)
  } else if (event.type === 'tool-call-approval') {
    messages.value.push({
      role: 'assistant',
      text: '',
      approval: {
        pending: true,
        runId: event.runId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        label: event.label || '',
      },
    })
  } else if (event.type === 'error') {
    errorText.value = event.message || '对话失败'
  }
  scrollDown()
}

function chatBody(extra) {
  const body = { dramaId: props.dramaId, ...extra }
  if (agent.episodeId) body.episodeId = agent.episodeId
  return body
}

async function send() {
  const message = draft.value.trim()
  if (!message || busy.value) return
  draft.value = ''
  errorText.value = ''
  messages.value.push({ role: 'user', text: message })
  busy.value = true
  scrollDown()
  try {
    await agentAPI.chat(chatBody({ message }), onEvent)
  } catch (err) {
    errorText.value = err.message || '对话失败'
  } finally {
    busy.value = false
    for (const item of messages.value) item.streaming = false
  }
}

async function decide(message, approved) {
  const card = message.approval
  if (!card || !card.pending) return
  card.pending = false
  errorText.value = ''
  busy.value = true
  try {
    const call = approved ? agentAPI.approve : agentAPI.decline
    await call(chatBody({ runId: card.runId, toolCallId: card.toolCallId }), onEvent)
  } catch (err) {
    errorText.value = err.message || '确认失败'
    card.pending = true
  } finally {
    busy.value = false
  }
}

async function loadHistory() {
  errorText.value = ''
  try {
    const data = await agentAPI.history(props.dramaId)
    messages.value = (data?.messages || []).map((item) => ({ role: item.role || 'assistant', text: item.text || '' }))
    for (const pending of data?.pendingApprovals || []) {
      messages.value.push({
        role: 'assistant',
        text: '',
        approval: { pending: true, runId: pending.runId, toolCallId: pending.toolCallId, toolName: pending.toolName, label: pending.label || '' },
      })
    }
    scrollDown()
  } catch (err) {
    errorText.value = err.message || '助手未就绪'
  }
}

watch(() => props.open, (open) => {
  if (open) loadHistory()
})

watch(() => props.dramaId, () => {
  messages.value = []
  if (props.open) loadHistory()
})

onBeforeUnmount(() => {
  for (const timer of timers) clearInterval(timer)
  timers.clear()
})
</script>

<style scoped>
.agent-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}
.episode-picker { width: 100%; }
.log {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty, .summary, .error { margin: 0; color: var(--text-secondary, #6b7280); font-size: 13px; }
.error { color: #b42318; }
.bubble {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-card, #f4f4f5);
}
.bubble.user { align-self: flex-end; background: #e8f1ff; }
.bubble p { margin: 0; white-space: pre-wrap; }
.bubble img { display: block; width: 100%; margin-top: 8px; border-radius: 6px; }
.approval { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.composer { display: flex; flex-direction: column; gap: 8px; }
</style>
