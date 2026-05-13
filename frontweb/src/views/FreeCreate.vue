<template>
  <div class="free-create-page">
    <div class="page-header">
      <div class="header-left">
        <el-button text @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="page-title">自由创作</h2>
      </div>
      <p class="page-desc">不绑定剧集，直接输入文字生成图片或视频</p>
    </div>

    <div class="create-layout">
      <!-- 左侧：输入面板 -->
      <div class="input-panel">
        <el-tabs v-model="mode" class="mode-tabs">
          <el-tab-pane label="🎨 生成图片" name="image" />
          <el-tab-pane label="🎬 生成视频" name="video" />
        </el-tabs>

        <div class="form-section">
          <div class="form-label">提示词 <span class="required">*</span></div>
          <el-input
            v-model="prompt"
            type="textarea"
            :rows="5"
            placeholder="描述你想要生成的画面内容..."
            class="prompt-input"
          />
        </div>

        <div v-if="mode === 'video'" class="form-section">
          <div class="form-label">参考图（可选）</div>
          <div class="ref-image-zone" @click="triggerRefImageUpload" @dragover.prevent @drop.prevent="onRefImageDrop">
            <template v-if="refImageDataUrl">
              <img :src="refImageDataUrl" class="ref-preview" />
              <div class="ref-actions">
                <el-button size="small" type="danger" plain @click.stop="clearRefImage">移除</el-button>
              </div>
            </template>
            <template v-else>
              <el-icon class="upload-icon"><Picture /></el-icon>
              <div class="upload-tip">点击或拖拽上传参考图</div>
            </template>
          </div>
          <input ref="refImageInput" type="file" accept="image/*" style="display:none" @change="onRefImageChange" />
        </div>

        <div class="form-section form-row">
          <div class="form-item">
            <div class="form-label">风格</div>
            <el-input v-model="style" placeholder="例如: cinematic, anime..." />
          </div>
          <div v-if="mode === 'image'" class="form-item">
            <div class="form-label">比例</div>
            <el-select v-model="aspectRatio">
              <el-option label="16:9" value="16:9" />
              <el-option label="9:16" value="9:16" />
              <el-option label="1:1" value="1:1" />
              <el-option label="4:3" value="4:3" />
            </el-select>
          </div>
          <div v-if="mode === 'video'" class="form-item">
            <div class="form-label">时长</div>
            <el-select v-model="duration">
              <el-option label="3秒" :value="3" />
              <el-option label="5秒" :value="5" />
              <el-option label="8秒" :value="8" />
              <el-option label="10秒" :value="10" />
            </el-select>
          </div>
        </div>

        <el-button
          type="primary"
          size="large"
          :loading="generating"
          :disabled="!prompt.trim()"
          class="generate-btn"
          @click="generate"
        >
          {{ generating ? '生成中...' : (mode === 'image' ? '生成图片' : '生成视频') }}
        </el-button>
      </div>

      <!-- 右侧：结果展示 -->
      <div class="result-panel">
        <div class="result-header">
          <span class="result-title">生成结果</span>
          <el-button v-if="results.length > 0" size="small" plain @click="clearResults">清空</el-button>
        </div>

        <div v-if="results.length === 0 && !generating" class="empty-result">
          <el-icon class="empty-icon"><MagicStick /></el-icon>
          <p>生成的内容将显示在这里</p>
        </div>

        <div v-if="generating" class="generating-tip">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在生成，请稍候...</span>
        </div>

        <div class="result-grid">
          <div v-for="(item, idx) in results" :key="idx" class="result-item">
            <div class="result-media">
              <video
                v-if="item.type === 'video' && item.url"
                :src="item.url"
                controls
                class="result-video"
                loop
              />
              <img
                v-else-if="item.type === 'image' && item.url"
                :src="item.url"
                class="result-image"
                @click="previewUrl = item.url"
              />
              <div v-else-if="item.status === 'pending' || item.status === 'processing'" class="media-loading">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>{{ item.status === 'processing' ? '生成中...' : '排队中...' }}</span>
              </div>
              <div v-else-if="item.status === 'failed'" class="media-error">
                <el-icon><CircleClose /></el-icon>
                <span>{{ item.error || '生成失败' }}</span>
              </div>
            </div>
            <div class="result-meta">
              <span class="result-prompt">{{ item.prompt }}</span>
              <div class="result-actions">
                <el-button v-if="item.url" size="small" plain @click="downloadItem(item)">下载</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片预览 -->
    <div v-if="previewUrl" class="image-preview-overlay" @click="previewUrl = null">
      <img :src="previewUrl" class="preview-img" @click.stop />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Picture, MagicStick, Loading, CircleClose } from '@element-plus/icons-vue'
import { imagesAPI } from '@/api/images'
import { videosAPI } from '@/api/videos'
import { uploadAPI } from '@/api/upload'
import { generationSettingsAPI } from '@/api/prompts'

const mode = ref('image')
const prompt = ref('')
const style = ref('')
const aspectRatio = ref('16:9')
const duration = ref(5)
const generating = ref(false)
const results = ref([])
const previewUrl = ref(null)
const refImageDataUrl = ref(null)
const refImageLocalPath = ref(null)
const refImageInput = ref(null)
/** 与后端视频异步超时一致（分钟 → 毫秒） */
const videoPollMaxMs = ref(30 * 60 * 1000)

onMounted(async () => {
  try {
    const res = await generationSettingsAPI.get()
    const m = Math.max(1, Number(res?.video_generation_timeout_minutes) || 30)
    videoPollMaxMs.value = m * 60 * 1000
  } catch (_) {}
})
  refImageInput.value?.click()
}

function clearRefImage() {
  refImageDataUrl.value = null
  refImageLocalPath.value = null
}

async function onRefImageChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  processRefImageFile(file)
  e.target.value = ''
}

function onRefImageDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) processRefImageFile(file)
}

async function processRefImageFile(file) {
  const reader = new FileReader()
  reader.onload = async (ev) => {
    refImageDataUrl.value = ev.target.result
    try {
      const res = await uploadAPI.uploadImage(file)
      refImageLocalPath.value = res?.local_path || null
    } catch (_) {}
  }
  reader.readAsDataURL(file)
}

function clearResults() {
  results.value = []
}

function downloadItem(item) {
  if (!item.url) return
  const a = document.createElement('a')
  a.href = item.url
  a.download = `free_create_${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`
  a.click()
}

async function generate() {
  if (!prompt.value.trim()) return
  generating.value = true
  const newItem = {
    type: mode.value,
    prompt: prompt.value,
    style: style.value,
    status: 'processing',
    url: null,
    error: null,
  }
  results.value.unshift(newItem)
  try {
    if (mode.value === 'image') {
      const res = await imagesAPI.create({
        prompt: prompt.value,
        style: style.value || undefined,
        aspect_ratio: aspectRatio.value,
      })
      if (res?.task_id) {
        await pollImageTask(res.task_id, newItem)
      } else if (res?.image_url || res?.local_path) {
        newItem.url = res.image_url || ('/static/' + res.local_path)
        newItem.status = 'completed'
      }
    } else {
      const body = {
        prompt: prompt.value,
        style: style.value || undefined,
        aspect_ratio: aspectRatio.value,
        duration: duration.value,
      }
      if (refImageLocalPath.value) {
        body.first_frame_url = refImageLocalPath.value
        body.image_url = '/static/' + refImageLocalPath.value
      }
      const res = await videosAPI.create(body)
      if (res?.task_id) {
        await pollVideoTask(res.task_id, newItem)
      } else {
        newItem.status = 'failed'
        newItem.error = '提交失败'
      }
    }
  } catch (e) {
    newItem.status = 'failed'
    newItem.error = e.message || '生成失败'
    ElMessage.error(newItem.error)
  } finally {
    generating.value = false
  }
}

async function pollImageTask(taskId, item, maxMs = 180000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 3000))
    try {
      const res = await imagesAPI.getTask ? imagesAPI.getTask(taskId) : null
      if (!res) break
      if (res.status === 'completed' && res.result) {
        const r = res.result
        item.url = r.image_url ? r.image_url : (r.local_path ? '/static/' + r.local_path : null)
        item.status = 'completed'
        return
      }
      if (res.status === 'failed') {
        item.status = 'failed'
        item.error = res.error || '生成失败'
        return
      }
    } catch (_) {}
  }
  item.status = 'failed'
  item.error = '超时'
}

async function pollVideoTask(taskId, item) {
  const maxMs = videoPollMaxMs.value
  const start = Date.now()
  const { taskAPI } = await import('@/api/task')
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 4000))
    try {
      const res = await taskAPI.get(taskId)
      if (res?.status === 'completed' && res?.result) {
        const r = res.result
        const vgId = r.video_generation_id
        if (vgId) {
          const vRes = await videosAPI.get(vgId)
          item.url = vRes?.local_path ? '/static/' + vRes.local_path : vRes?.video_url
        }
        item.status = 'completed'
        return
      }
      if (res?.status === 'failed') {
        item.status = 'failed'
        item.error = res.error || '生成失败'
        return
      }
    } catch (_) {}
  }
  item.status = 'failed'
  item.error = '超时'
}
</script>

<style scoped>
.free-create-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.page-desc {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.create-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.input-panel {
  width: 380px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}

.mode-tabs {
  margin-bottom: 16px;
}

.form-section {
  margin-bottom: 16px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.required {
  color: #ef4444;
}

.prompt-input :deep(.el-textarea__inner) {
  font-size: 14px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-item {
  flex: 1;
}

.form-item .el-select {
  width: 100%;
}

.ref-image-zone {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color .2s;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
}

.ref-image-zone:hover {
  border-color: #409eff;
}

.ref-preview {
  max-width: 100%;
  max-height: 150px;
  border-radius: 6px;
}

.ref-actions {
  margin-top: 8px;
}

.upload-icon {
  font-size: 28px;
  color: #9ca3af;
}

.upload-tip {
  font-size: 12px;
  color: #9ca3af;
}

.generate-btn {
  width: 100%;
  margin-top: 4px;
}

.result-panel {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
  min-height: 400px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #9ca3af;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
}

.generating-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #409eff;
  font-size: 14px;
  margin-bottom: 12px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.result-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.result-media {
  background: #f9fafb;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.result-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: zoom-in;
}

.result-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-loading,
.media-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  font-size: 12px;
}

.media-error {
  color: #ef4444;
}

.result-meta {
  padding: 8px 10px;
}

.result-prompt {
  font-size: 12px;
  color: #6b7280;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-actions {
  margin-top: 6px;
  display: flex;
  gap: 6px;
}

.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
}
</style>
