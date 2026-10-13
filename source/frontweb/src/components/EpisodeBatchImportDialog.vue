<template>
  <div class="episode-batch-import-trigger">
    <el-button size="small" @click="openDialog">
      <el-icon><Upload /></el-icon>批量导入剧集
    </el-button>

    <el-dialog
      v-model="visible"
      title="批量导入剧集"
      width="920px"
      append-to-body
      destroy-on-close
      @close="resetState"
    >
      <div class="batch-import-dialog">
        <el-tabs v-model="activeTab" class="batch-import-tabs">
          <el-tab-pane label="1. 导入设置" name="config">
            <div class="batch-import-panel">
              <div class="batch-import-toolbar">
                <input ref="fileInputRef" type="file" accept=".txt,text/plain" style="display:none" @change="onFileChange" />
                <el-button @click="fileInputRef?.click()">
                  <el-icon><Upload /></el-icon>选择 TXT 文件
                </el-button>
                <span class="batch-import-file" :class="{ 'is-empty': !fileName }">
                  {{ fileName || '未选择文件' }}
                </span>
              </div>

              <el-form label-width="120px" class="batch-import-form">
                <el-form-item label="章节正则">
                  <el-input v-model="chapterPattern" placeholder="例如：^\s*(第\d+章[^\n]*)" />
                </el-form-item>
                <el-form-item label="每集章节数">
                  <el-input-number v-model="chaptersPerEpisode" :min="1" :max="100" />
                </el-form-item>
              </el-form>

              <div class="batch-import-tip-block">
                <div class="batch-import-tip">将提前准备好的小说原文或者剧本内容的.txt文件导入系统</div>
                <div class="batch-import-tip">请正确输入用于匹配章节标题的正则表达式。</div>
                <div class="batch-import-tip">示例：<code class="batch-import-code">^\s*(第\d+章[^\n]*)</code>、<code class="batch-import-code">^\s*(第\d+集[^\n]*)</code></div>
                <div class="batch-import-tip">点击“确认导入配置”后，会先解析章节并切换到预览页。</div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="2. 预览确认" name="preview" :disabled="!previewReady">
            <div class="batch-import-panel">
              <template v-if="previewEpisodes.length">
                <div class="batch-import-preview-header">
                  <span>共识别 {{ previewChapters.length }} 章，预计导入 {{ previewEpisodes.length }} 集</span>
                </div>
                <el-table :data="previewEpisodes" border stripe height="420" class="batch-import-preview-table">
                  <el-table-column prop="episode_number" label="集数" width="80" align="center" />
                  <el-table-column prop="title" label="集标题" min-width="220" show-overflow-tooltip />
                  <el-table-column label="包含章节" min-width="260" show-overflow-tooltip>
                    <template #default="scope">
                      {{ scope.row.chapter_titles.join('、') || '未识别章节标题' }}
                    </template>
                  </el-table-column>
                  <el-table-column label="内容预览" min-width="320" show-overflow-tooltip>
                    <template #default="scope">
                      <div class="batch-import-preview-cell batch-import-preview-cell--single-line">
                        {{ scope.row.script_content || '暂无内容' }}
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </template>
              <div v-else class="batch-import-empty">请先在上一步确认导入配置</div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button v-if="activeTab === 'preview'" @click="activeTab = 'config'">上一步</el-button>
        <el-button
          v-if="activeTab === 'config'"
          type="primary"
          :disabled="!rawText.trim()"
          @click="confirmConfig"
        >确认导入配置</el-button>
        <el-button
          v-else
          type="primary"
          :disabled="!previewEpisodes.length"
          :loading="importing"
          @click="confirmImport"
        >确认导入集数</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'

const props = defineProps({
  startEpisodeNumber: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['import'])

const visible = ref(false)
const activeTab = ref('config')
const previewReady = ref(false)
const importing = ref(false)
const fileInputRef = ref(null)
const fileName = ref('')
const rawText = ref('')
const chapterPattern = ref('^\\s*(第[0-9０-９零一二三四五六七八九十百千万]+[章回节][^\\n\\r]*)')
const chaptersPerEpisode = ref(1)
const previewChapters = ref([])
const previewEpisodes = ref([])

function openDialog() {
  visible.value = true
  activeTab.value = 'config'
}

defineExpose({
  openDialog,
})

function resetState() {
  visible.value = false
  activeTab.value = 'config'
  previewReady.value = false
  importing.value = false
  fileName.value = ''
  rawText.value = ''
  chapterPattern.value = '^\\s*(第[0-9０-９零一二三四五六七八九十百千万]+[章回节][^\\n\\r]*)'
  chaptersPerEpisode.value = 1
  previewChapters.value = []
  previewEpisodes.value = []
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function onFileChange(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  fileName.value = file.name
  previewReady.value = false
  previewChapters.value = []
  previewEpisodes.value = []
  const reader = new FileReader()
  reader.onload = (ev) => {
    rawText.value = String(ev.target?.result || '')
  }
  reader.onerror = () => {
    ElMessage.error('读取文件失败')
  }
  reader.readAsText(file, 'utf-8')
}

function createChapterRegex(pattern) {
  const source = String(pattern || '').trim()
  if (!source) throw new Error('请输入章节正则')
  try {
    return new RegExp(source, 'gm')
  } catch {
    throw new Error('章节正则格式不正确')
  }
}

function splitNovelChapters(text, pattern) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const regex = createChapterRegex(pattern)
  const matches = [...normalized.matchAll(regex)]
  if (!matches.length) throw new Error('未匹配到任何章节，请调整章节正则')
  return matches.map((match, index) => {
    const title = String(match[1] || match[0] || '').trim()
    const titleStart = match.index ?? 0
    const contentStart = titleStart + String(match[0] || '').length
    const nextTitleStart = index + 1 < matches.length
      ? (matches[index + 1].index ?? normalized.length)
      : normalized.length
    const content = normalized.slice(contentStart, nextTitleStart).trim()
    return {
      title: title || `第${index + 1}章`,
      content,
    }
  }).filter((chapter) => chapter.title || chapter.content)
}

function buildEpisodesFromChapters(chapters, sizeValue) {
  const size = Math.max(1, Number(sizeValue) || 1)
  return chapters.reduce((list, chapter, index) => {
    const groupIndex = Math.floor(index / size)
    if (!list[groupIndex]) {
      list[groupIndex] = {
        title: '',
        script_content: '',
        chapter_titles: [],
      }
    }
    list[groupIndex].chapter_titles.push(chapter.title)
    list[groupIndex].script_content = [list[groupIndex].script_content, `${chapter.title}\n${chapter.content}`].filter(Boolean).join('\n\n')
    return list
  }, []).map((episode, index) => ({
    episode_number: props.startEpisodeNumber + index,
    title: episode.chapter_titles.length === 1
      ? episode.chapter_titles[0]
      : `${episode.chapter_titles[0]} - ${episode.chapter_titles[episode.chapter_titles.length - 1]}`,
    script_content: episode.script_content,
    chapter_titles: episode.chapter_titles,
  }))
}

function confirmConfig() {
  if (!rawText.value.trim()) {
    ElMessage.warning('请先选择 TXT 文件')
    return
  }
  try {
    const chapters = splitNovelChapters(rawText.value, chapterPattern.value)
    const episodes = buildEpisodesFromChapters(chapters, chaptersPerEpisode.value)
    if (!episodes.length) {
      ElMessage.warning('未生成可导入的集数')
      return
    }
    previewChapters.value = chapters
    previewEpisodes.value = episodes
    previewReady.value = true
    activeTab.value = 'preview'
    ElMessage.success(`已识别 ${chapters.length} 章，可导入 ${episodes.length} 集`)
  } catch (e) {
    previewReady.value = false
    previewChapters.value = []
    previewEpisodes.value = []
    ElMessage.error(e.message || '章节预览失败')
  }
}

async function confirmImport() {
  if (!previewEpisodes.value.length) {
    ElMessage.warning('请先完成预览')
    return
  }
  importing.value = true
  try {
    await emit('import', previewEpisodes.value.map((episode) => ({
      episode_number: episode.episode_number,
      title: episode.title,
      script_content: episode.script_content,
      description: null,
      duration: 0,
    })))
    ElMessage.success(`已导入 ${previewEpisodes.value.length} 集`)
    resetState()
  } catch (e) {
    ElMessage.error(e.message || '批量导入失败')
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.episode-batch-import-trigger { display: inline-flex; }
.batch-import-dialog { display: flex; flex-direction: column; }
.batch-import-tabs { width: 100%; }
.batch-import-panel { display: flex; flex-direction: column; gap: 16px; min-height: 420px; }
.batch-import-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.batch-import-file { font-size: 0.85rem; color: #a1a1aa; }
.batch-import-file.is-empty { color: #71717a; }
.batch-import-form { margin-bottom: 0; }
.batch-import-tip-block { display: flex; flex-direction: column; gap: 8px; }
.batch-import-tip { font-size: 0.82rem; color: #71717a; }
.batch-import-code { color: #c084fc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace; }
.batch-import-empty { min-height: 320px; display: flex; align-items: center; justify-content: center; color: #71717a; border: 1px dashed #3f3f46; border-radius: 12px; }
.batch-import-preview-header { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-bottom: 12px; color: #c084fc; font-size: 0.85rem; flex-wrap: wrap; }
.batch-import-preview-table :deep(.el-table) { --el-table-bg-color: transparent; --el-table-tr-bg-color: transparent; --el-table-border-color: #3f3f46; --el-table-header-bg-color: rgba(39, 39, 42, 0.9); --el-table-row-hover-bg-color: rgba(139, 92, 246, 0.08); color: #e4e4e7; }
.batch-import-preview-table :deep(.el-table__inner-wrapper::before) { display: none; }
.batch-import-preview-table :deep(th.el-table__cell) { color: #fafafa; }
.batch-import-preview-table :deep(td.el-table__cell) { vertical-align: top; }
.batch-import-preview-cell { line-height: 1.6; white-space: pre-wrap; color: #d4d4d8; }
.batch-import-preview-cell--single-line { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; }
</style>
