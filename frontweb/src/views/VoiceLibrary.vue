<template>
  <div class="voice-library-page">
    <header class="page-header">
      <div class="header-left">
        <el-button text @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="page-title">配音管理</h2>
      </div>
    </header>

    <el-tabs v-model="activeTab" class="voice-tabs">
      <el-tab-pane label="语音库" name="library">
        <div class="filter-bar">
          <el-select v-model="filterGender" placeholder="性别" clearable style="width: 120px" @change="loadVoices">
            <el-option label="男" value="male" />
            <el-option label="女" value="female" />
            <el-option label="中性" value="neutral" />
          </el-select>
          <el-select v-model="filterSource" placeholder="来源" clearable style="width: 140px" @change="loadVoices">
            <el-option label="ElevenLabs 克隆" value="elevenlabs" />
            <el-option label="语音设计" value="design" />
            <el-option label="上传" value="upload" />
          </el-select>
        </div>
        <div v-loading="voicesLoading" class="voice-grid">
          <div v-for="v in voices" :key="v.id" class="voice-card">
            <div class="voice-card-name">{{ v.name }}</div>
            <div class="voice-card-meta">
              <el-tag v-if="v.gender" size="small">{{ v.gender }}</el-tag>
              <el-tag v-if="v.age_range" size="small" type="info">{{ v.age_range }}</el-tag>
              <el-tag size="small" type="success">{{ sourceLabel(v.source) }}</el-tag>
            </div>
            <div class="voice-card-desc">{{ v.description }}</div>
            <div class="voice-card-actions">
              <el-button size="small" @click="playAudio(v.sample_url)">
                <el-icon><VideoPlay /></el-icon>试听
              </el-button>
              <el-button size="small" type="danger" plain @click="confirmDeleteVoice(v)">删除</el-button>
            </div>
          </div>
          <div v-if="!voicesLoading && voices.length === 0" class="voice-empty">暂无语音，请前往「克隆导入」或「语音设计」添加</div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="克隆导入（ElevenLabs）" name="import">
        <el-form :model="importForm" label-width="90px" class="voice-form">
          <el-form-item label="Voice ID"><el-input v-model="importForm.voice_id" placeholder="ElevenLabs voice_id" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="importForm.name" placeholder="展示名，如 Rachel（英式温柔）" /></el-form-item>
          <el-form-item label="描述"><el-input v-model="importForm.description" type="textarea" :rows="2" placeholder="自由描述，供 AI 匹配角色时参考" /></el-form-item>
          <el-form-item label="性别">
            <el-select v-model="importForm.gender" placeholder="选择性别" style="width: 160px">
              <el-option label="男" value="male" />
              <el-option label="女" value="female" />
              <el-option label="中性" value="neutral" />
            </el-select>
          </el-form-item>
          <el-form-item label="年龄段">
            <el-select v-model="importForm.age_range" placeholder="选择年龄段" style="width: 160px">
              <el-option label="儿童" value="child" />
              <el-option label="青年" value="young" />
              <el-option label="成年" value="adult" />
              <el-option label="老年" value="elderly" />
            </el-select>
          </el-form-item>
          <el-form-item label="标签"><el-input v-model="importForm.tagsInput" placeholder="逗号分隔，如 gentle,mature" /></el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="importing" @click="doImport">导入并克隆</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="语音设计" name="design">
        <el-form :model="designForm" label-width="90px" class="voice-form">
          <el-form-item label="Attributes">
            <el-input v-model="designForm.instruct" type="textarea" :rows="2" placeholder='例如："female, low pitch, gentle, british accent"' />
          </el-form-item>
          <el-form-item label="试听文本"><el-input v-model="designForm.sample_text" placeholder="留空使用默认试听文本" /></el-form-item>
          <el-form-item>
            <el-button :loading="designPreviewing" @click="doDesignPreview">生成试听</el-button>
          </el-form-item>
          <template v-if="designPreview">
            <el-form-item label="试听结果">
              <el-button @click="playAudio(designPreview.sample_url)"><el-icon><VideoPlay /></el-icon>播放</el-button>
            </el-form-item>
            <el-form-item label="名称"><el-input v-model="designForm.name" placeholder="展示名" /></el-form-item>
            <el-form-item label="描述"><el-input v-model="designForm.description" type="textarea" :rows="2" /></el-form-item>
            <el-form-item label="性别">
              <el-select v-model="designForm.gender" placeholder="选择性别" style="width: 160px">
                <el-option label="男" value="male" />
                <el-option label="女" value="female" />
                <el-option label="中性" value="neutral" />
              </el-select>
            </el-form-item>
            <el-form-item label="年龄段">
              <el-select v-model="designForm.age_range" placeholder="选择年龄段" style="width: 160px">
                <el-option label="儿童" value="child" />
                <el-option label="青年" value="young" />
                <el-option label="成年" value="adult" />
                <el-option label="老年" value="elderly" />
              </el-select>
            </el-form-item>
            <el-form-item label="标签"><el-input v-model="designForm.tagsInput" placeholder="逗号分隔" /></el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="designSaving" @click="doDesignSave">保存到语音库</el-button>
            </el-form-item>
          </template>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="语音测试台" name="test">
        <el-form label-width="90px" class="voice-form">
          <el-form-item label="选择语音">
            <el-select v-model="testVoiceId" placeholder="选择要试听的语音" style="width: 280px">
              <el-option v-for="v in voices" :key="v.id" :label="v.name" :value="v.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="测试文本"><el-input v-model="testText" type="textarea" :rows="3" placeholder="输入任意文本" /></el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="testing" @click="doTest">试听</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, VideoPlay } from '@element-plus/icons-vue'
import { voiceLibraryAPI } from '@/api/voiceLibrary'

const activeTab = ref('library')

const voices = ref([])
const voicesLoading = ref(false)
const filterGender = ref('')
const filterSource = ref('')

function sourceLabel(source) {
  if (source === 'elevenlabs') return 'ElevenLabs 克隆'
  if (source === 'design') return '语音设计'
  return '上传'
}

async function loadVoices() {
  voicesLoading.value = true
  try {
    const data = await voiceLibraryAPI.list({ gender: filterGender.value || undefined, source: filterSource.value || undefined })
    voices.value = data?.items || []
  } catch (e) {
    ElMessage.error(e.message || '加载语音库失败')
  } finally {
    voicesLoading.value = false
  }
}

let previewAudio = null

function playAudio(url) {
  if (!url) return
  if (previewAudio) {
    previewAudio.pause()
    previewAudio = null
  }
  const a = new Audio(url)
  previewAudio = a
  a.addEventListener('ended', () => {
    if (previewAudio === a) previewAudio = null
  })
  a.play().catch(() => {
    ElMessage.error('播放失败')
    if (previewAudio === a) previewAudio = null
  })
}

async function confirmDeleteVoice(voice) {
  try {
    await ElMessageBox.confirm(`确定删除语音「${voice.name}」吗？`, '删除确认', { type: 'warning' })
  } catch (_) { return }
  try {
    await voiceLibraryAPI.delete(voice.id)
    ElMessage.success('已删除')
    loadVoices()
  } catch (e) {
    const detail = e.response?.data?.error
    if (detail?.code === 'IN_USE') {
      try {
        await ElMessageBox.confirm(detail.message, '语音正在使用中', { type: 'warning', confirmButtonText: '仍然删除' })
      } catch (_) { return }
      try {
        await voiceLibraryAPI.delete(voice.id, true)
        ElMessage.success('已删除，相关角色的配音绑定已清除')
        loadVoices()
      } catch (e2) {
        ElMessage.error(e2.message || '删除失败')
      }
      return
    }
    ElMessage.error(e.message || '删除失败')
  }
}

const importForm = ref({ voice_id: '', name: '', description: '', gender: '', age_range: '', tagsInput: '' })
const importing = ref(false)

async function doImport() {
  if (!importForm.value.voice_id?.trim()) { ElMessage.warning('请输入 ElevenLabs voice_id'); return }
  if (!importForm.value.name?.trim()) { ElMessage.warning('请输入名称'); return }
  importing.value = true
  try {
    await voiceLibraryAPI.importElevenLabs({
      voice_id: importForm.value.voice_id.trim(),
      name: importForm.value.name.trim(),
      description: importForm.value.description || null,
      gender: importForm.value.gender || null,
      age_range: importForm.value.age_range || null,
      tags: importForm.value.tagsInput ? importForm.value.tagsInput.split(',').map((s) => s.trim()).filter(Boolean) : [],
    })
    ElMessage.success('导入成功')
    importForm.value = { voice_id: '', name: '', description: '', gender: '', age_range: '', tagsInput: '' }
    activeTab.value = 'library'
    loadVoices()
  } catch (e) {
    ElMessage.error(e.message || '导入失败')
  } finally {
    importing.value = false
  }
}

const designForm = ref({ instruct: '', sample_text: '', name: '', description: '', gender: '', age_range: '', tagsInput: '' })
const designPreviewing = ref(false)
const designSaving = ref(false)
const designPreview = ref(null)

async function doDesignPreview() {
  if (!designForm.value.instruct?.trim()) { ElMessage.warning('请输入 attributes 描述'); return }
  designPreviewing.value = true
  designPreview.value = null
  try {
    const data = await voiceLibraryAPI.designPreview({
      instruct: designForm.value.instruct.trim(),
      sample_text: designForm.value.sample_text || undefined,
    })
    designPreview.value = data
    playAudio(data.sample_url)
  } catch (e) {
    ElMessage.error(e.message || '生成试听失败')
  } finally {
    designPreviewing.value = false
  }
}

async function doDesignSave() {
  if (!designPreview.value) { ElMessage.warning('请先生成试听'); return }
  if (!designForm.value.name?.trim()) { ElMessage.warning('请输入名称'); return }
  designSaving.value = true
  try {
    await voiceLibraryAPI.designSave({
      temp_path: designPreview.value.temp_path,
      instruct: designPreview.value.instruct,
      sample_text: designPreview.value.sample_text,
      name: designForm.value.name.trim(),
      description: designForm.value.description || null,
      gender: designForm.value.gender || null,
      age_range: designForm.value.age_range || null,
      tags: designForm.value.tagsInput ? designForm.value.tagsInput.split(',').map((s) => s.trim()).filter(Boolean) : [],
    })
    ElMessage.success('已保存到语音库')
    designForm.value = { instruct: '', sample_text: '', name: '', description: '', gender: '', age_range: '', tagsInput: '' }
    designPreview.value = null
    activeTab.value = 'library'
    loadVoices()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    designSaving.value = false
  }
}

const testVoiceId = ref(null)
const testText = ref('')
const testing = ref(false)

async function doTest() {
  if (!testVoiceId.value) { ElMessage.warning('请选择语音'); return }
  if (!testText.value?.trim()) { ElMessage.warning('请输入测试文本'); return }
  testing.value = true
  try {
    const data = await voiceLibraryAPI.test(testVoiceId.value, testText.value.trim())
    playAudio(data.sample_url)
  } catch (e) {
    ElMessage.error(e.message || '试听失败')
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadVoices()
})
</script>

<style scoped>
.voice-library-page { min-height: 100vh; padding: 20px 32px; }
.page-header { display: flex; align-items: center; margin-bottom: 16px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { margin: 0; font-size: 20px; }
.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.voice-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.voice-card { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 14px; }
.voice-card-name { font-weight: 600; margin-bottom: 6px; }
.voice-card-meta { display: flex; gap: 6px; margin-bottom: 8px; }
.voice-card-desc { color: var(--el-text-color-secondary); font-size: 13px; min-height: 36px; margin-bottom: 10px; }
.voice-card-actions { display: flex; gap: 8px; }
.voice-empty { grid-column: 1 / -1; text-align: center; color: var(--el-text-color-secondary); padding: 40px 0; }
.voice-form { max-width: 480px; }
</style>
