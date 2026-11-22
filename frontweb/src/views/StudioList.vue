<template>
  <div v-loading="loading" class="studio-list">
    <header class="studio-list-header">
      <div>
        <el-button text @click="router.push('/')">返回项目</el-button>
        <h1>自由画布</h1>
      </div>
      <el-button v-if="canvases.length" type="primary" :loading="creating" @click="onCreate">新建画布</el-button>
    </header>

    <p v-if="error" class="studio-list-error">{{ error }}</p>

    <div v-else-if="!loading && canvases.length === 0" class="studio-list-empty">
      <p>还没有画布</p>
      <el-button type="primary" :loading="creating" @click="onCreate">新建画布</el-button>
    </div>

    <div v-else class="studio-list-grid">
      <button
        v-for="canvas in canvases"
        :key="canvas.id"
        type="button"
        class="studio-card"
        @click="router.push('/studio/' + canvas.id)"
      >
        <span class="studio-card-title">{{ canvas.title || '未命名画布' }}</span>
        <span class="studio-card-time">{{ formatTime(canvas.updated_at) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { create, list } from '@/api/freeCanvas'

const router = useRouter()
const loading = ref(true)
const creating = ref(false)
const error = ref('')
const canvases = ref([])

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const rows = await list()
    canvases.value = Array.isArray(rows) ? rows : []
  } catch (err) {
    canvases.value = []
    error.value = err?.message || '画布列表加载失败'
  } finally {
    loading.value = false
  }
}

async function onCreate() {
  if (creating.value) return
  creating.value = true
  try {
    const canvas = await create('未命名画布')
    if (canvas?.id == null) return
    await router.push('/studio/' + canvas.id)
  } catch {
    // 拦截器已提示
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.studio-list {
  min-height: 100vh;
  padding: 24px 20px 48px;
  background: var(--bg-page);
  color: var(--text-primary);
}
.studio-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1080px;
  margin: 0 auto 24px;
}
.studio-list-header h1 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 650;
}
.studio-list-error,
.studio-list-empty {
  max-width: 1080px;
  margin: 48px auto;
  text-align: center;
  color: var(--text-muted, #a1a1aa);
}
.studio-list-empty p {
  margin: 0 0 16px;
  font-size: 1rem;
}
.studio-list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  max-width: 1080px;
  margin: 0 auto;
}
.studio-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 18px 16px;
  text-align: left;
  border: 1px solid var(--border-muted, #3f3f46);
  border-radius: 12px;
  background: var(--bg-card, #18181b);
  color: var(--text-primary);
  cursor: pointer;
}
.studio-card:hover {
  border-color: rgba(99, 102, 241, 0.65);
}
.studio-card-title {
  font-size: 1rem;
  font-weight: 600;
}
.studio-card-time {
  font-size: 0.8rem;
  color: var(--text-muted, #a1a1aa);
}
</style>
