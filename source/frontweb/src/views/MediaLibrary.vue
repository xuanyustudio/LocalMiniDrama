<template>
  <div class="media-library-page">
    <div class="page-header">
      <div class="header-left">
        <el-button text @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="page-title">媒体素材库</h2>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="triggerUpload">
          <el-icon><Upload /></el-icon>
          上传素材
        </el-button>
        <input ref="uploadInput" type="file" accept="image/*,video/*" multiple style="display:none" @change="onUpload" />
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-radio-group v-model="mediaType" class="type-filter" @change="loadMedia">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="image">图片</el-radio-button>
        <el-radio-button value="video">视频</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="keyword"
        placeholder="搜索素材..."
        class="search-input"
        clearable
        @input="debouncedLoad"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <!-- 上传进度 -->
    <div v-if="uploading" class="upload-progress">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在上传 {{ uploadProgress.current }}/{{ uploadProgress.total }}...</span>
    </div>

    <!-- 媒体网格 -->
    <div v-loading="loading" class="media-grid">
      <div
        v-for="item in mediaItems"
        :key="item.id"
        class="media-card"
        :class="{ selected: selectedIds.has(item.id) }"
        @click="toggleSelect(item)"
      >
        <div class="media-thumb">
          <video v-if="item.type === 'video'" :src="itemUrl(item)" class="thumb-video" muted />
          <img v-else :src="itemUrl(item)" class="thumb-img" />
          <div class="media-overlay">
            <el-icon v-if="selectedIds.has(item.id)" class="check-icon"><CircleCheck /></el-icon>
            <div class="overlay-actions" @click.stop>
              <el-button
                size="small"
                plain
                class="preview-btn"
                @click.stop="openPreview(item)"
              >
                <el-icon><ZoomIn /></el-icon>
              </el-button>
              <el-button
                size="small"
                type="danger"
                plain
                @click.stop="deleteItem(item)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
        <div class="media-info">
          <span class="media-name" :title="item.name">{{ item.name || '未命名' }}</span>
          <span class="media-meta">{{ formatSize(item.size) }}</span>
        </div>
      </div>

      <div v-if="!loading && mediaItems.length === 0" class="empty-media">
        <el-icon class="empty-icon"><Files /></el-icon>
        <p>暂无素材，点击上传按钮添加</p>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="loadMedia"
      />
    </div>

    <!-- 批量操作 -->
    <div v-if="selectedIds.size > 0" class="batch-bar">
      <span>已选 {{ selectedIds.size }} 项</span>
      <el-button size="small" @click="selectedIds.clear()">取消选择</el-button>
      <el-button size="small" type="danger" plain @click="batchDelete">批量删除</el-button>
    </div>

    <!-- 预览弹窗 -->
    <el-dialog v-model="showPreview" title="素材预览" width="800px" destroy-on-close>
      <div class="preview-content">
        <video
          v-if="previewItem?.type === 'video'"
          :src="itemUrl(previewItem)"
          controls
          class="preview-video"
          autoplay
        />
        <img v-else-if="previewItem" :src="itemUrl(previewItem)" class="preview-image" />
      </div>
      <div class="preview-meta">
        <div class="meta-row"><span>名称：</span>{{ previewItem?.name || '未命名' }}</div>
        <div class="meta-row"><span>大小：</span>{{ formatSize(previewItem?.size) }}</div>
        <div class="meta-row"><span>创建时间：</span>{{ previewItem?.created_at }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, Upload, Search, Loading, CircleCheck,
  ZoomIn, Delete, Files
} from '@element-plus/icons-vue'
import { uploadAPI } from '@/api/upload'
import request from '@/utils/request'

const loading = ref(false)
const uploading = ref(false)
const uploadProgress = ref({ current: 0, total: 0 })
const mediaItems = ref([])
const mediaType = ref('all')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(30)
const total = ref(0)
const selectedIds = reactive(new Set())
const showPreview = ref(false)
const previewItem = ref(null)
const uploadInput = ref(null)
let keywordTimer = null

function triggerUpload() {
  uploadInput.value?.click()
}

async function onUpload(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  uploading.value = true
  uploadProgress.value = { current: 0, total: files.length }
  for (const file of files) {
    try {
      await uploadAPI.uploadImage(file)
      uploadProgress.value.current++
    } catch (err) {
      ElMessage.warning(`${file.name} 上传失败: ${err.message}`)
    }
  }
  uploading.value = false
  e.target.value = ''
  ElMessage.success(`${files.length} 个素材上传完成`)
  loadMedia()
}

function debouncedLoad() {
  clearTimeout(keywordTimer)
  keywordTimer = setTimeout(loadMedia, 400)
}

async function loadMedia() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
    }
    if (mediaType.value !== 'all') params.type = mediaType.value
    if (keyword.value) params.keyword = keyword.value
    const res = await request.get('/assets', { params })
    mediaItems.value = (res?.items || []).map(normalizeItem)
    total.value = res?.total || 0
  } catch (err) {
    mediaItems.value = []
  } finally {
    loading.value = false
  }
}

function normalizeItem(item) {
  const url = item.url || item.image_url || item.video_url || ''
  const isVideo = url.match(/\.(mp4|webm|mov)$/i) || item.type === 'video'
  return {
    ...item,
    type: isVideo ? 'video' : 'image',
    name: item.name || item.filename || (url.split('/').pop()),
  }
}

function itemUrl(item) {
  if (!item) return ''
  const lp = item.local_path || item.image_local_path || item.video_local_path
  if (lp) return '/static/' + lp.replace(/^\//, '')
  return item.url || item.image_url || item.video_url || ''
}

function formatSize(size) {
  if (!size) return ''
  if (size > 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB'
  if (size > 1024) return (size / 1024).toFixed(0) + ' KB'
  return size + ' B'
}

function toggleSelect(item) {
  if (selectedIds.has(item.id)) {
    selectedIds.delete(item.id)
  } else {
    selectedIds.add(item.id)
  }
}

function openPreview(item) {
  previewItem.value = item
  showPreview.value = true
}

async function deleteItem(item) {
  await ElMessageBox.confirm('确定删除该素材？', '删除确认', { type: 'warning' })
  try {
    await request.delete(`/assets/${item.id}`)
    ElMessage.success('已删除')
    loadMedia()
  } catch (err) {
    ElMessage.error(err.message || '删除失败')
  }
}

async function batchDelete() {
  const count = selectedIds.size
  await ElMessageBox.confirm(`确定删除选中的 ${count} 个素材？`, '批量删除', { type: 'warning' })
  let failed = 0
  for (const id of selectedIds) {
    try {
      await request.delete(`/assets/${id}`)
    } catch (_) { failed++ }
  }
  selectedIds.clear()
  if (failed > 0) ElMessage.warning(`${count - failed} 个删除成功，${failed} 个失败`)
  else ElMessage.success(`${count} 个素材已删除`)
  loadMedia()
}

onMounted(loadMedia)
</script>

<style scoped>
.media-library-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-input {
  width: 240px;
}

.upload-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #409eff;
  font-size: 14px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  min-height: 200px;
}

.media-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all .2s;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}

.media-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
}

.media-card.selected {
  border-color: #409eff;
}

.media-thumb {
  aspect-ratio: 1;
  background: #f3f4f6;
  overflow: hidden;
  position: relative;
}

.thumb-img,
.thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.35);
  opacity: 0;
  transition: opacity .2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-card:hover .media-overlay {
  opacity: 1;
}

.media-card.selected .media-overlay {
  opacity: 1;
}

.check-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 20px;
  color: #409eff;
  background: #fff;
  border-radius: 50%;
}

.overlay-actions {
  display: flex;
  gap: 6px;
}

.media-info {
  padding: 8px;
}

.media-name {
  display: block;
  font-size: 12px;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-meta {
  font-size: 11px;
  color: #9ca3af;
}

.empty-media {
  grid-column: 1 / -1;
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

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.batch-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a1a2e;
  color: #fff;
  padding: 10px 20px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  box-shadow: 0 4px 16px rgba(0,0,0,.2);
}

.preview-content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
}

.preview-video {
  max-width: 100%;
  max-height: 60vh;
}

.preview-meta {
  margin-top: 16px;
}

.meta-row {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.meta-row span {
  font-weight: 500;
  color: #374151;
}
</style>
