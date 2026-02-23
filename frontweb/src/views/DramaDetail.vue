<template>
  <div class="drama-detail">
    <header class="header">
      <div class="header-inner">
        <h1 class="logo" @click="router.push('/')">LocalMiniDrama.ai</h1>
        <span class="page-title">{{ drama?.title || '剧集管理' }}</span>
        <div class="header-actions">
          <el-button class="btn-theme" :title="isDark ? '切换到白天模式' : '切换到暗色模式'" @click="toggleTheme">
            <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
            {{ isDark ? '白天' : '暗色' }}
          </el-button>
          <el-button @click="router.push('/')">
            <el-icon><ArrowLeft /></el-icon>返回列表
          </el-button>
          <el-button type="primary" @click="goCreate">
            <el-icon><VideoPlay /></el-icon>进入制作
          </el-button>
        </div>
      </div>
    </header>

    <main class="main" v-loading="loading">
      <!-- 基本信息 + 设置 -->
      <section class="section card">
        <div class="section-title">剧集信息</div>
        <el-form :model="infoForm" label-width="110px" label-position="left" class="info-form">
          <el-row :gutter="24">
            <el-col :span="12">
              <el-form-item label="标题">
                <el-input v-model="infoForm.title" placeholder="剧集标题" @blur="saveInfo" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="图片/视频风格">
                <el-select v-model="infoForm.style" placeholder="选择全剧统一风格" clearable style="width: 100%" @change="saveInfo">
                  <el-option label="日本动漫" value="anime style" />
                  <el-option label="写实" value="realistic" />
                  <el-option label="电影感" value="cinematic" />
                  <el-option label="赛博朋克" value="cyberpunk" />
                  <el-option label="水彩" value="watercolor" />
                  <el-option label="油画" value="oil painting" />
                  <el-option label="3D 渲染" value="3d render" />
                  <el-option label="像素风" value="pixel art" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="故事梗概">
                <el-input v-model="infoForm.description" type="textarea" :rows="3" placeholder="一句话描述故事梗概" @blur="saveInfo" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </section>

      <!-- 分集列表 -->
      <section class="section card">
        <div class="section-header">
          <div class="section-title">分集列表</div>
          <span class="section-count">共 {{ episodes.length }} 集</span>
          <el-button size="small" type="primary" :loading="addingEpisode" @click="onAddEpisode" style="margin-left: auto">
            <el-icon><Plus /></el-icon>新增一集
          </el-button>
        </div>
        <div v-if="episodes.length === 0" class="empty-tip">暂无分集，点击「新增一集」开始创作</div>
        <div v-else class="episode-grid">
          <div v-for="ep in episodes" :key="ep.id" class="episode-card" @click="goEpisode(ep.id)">
            <div class="episode-card-header">
              <span class="episode-num">第 {{ ep.episode_number ?? ep.number ?? '?' }} 集</span>
              <el-button
                size="small"
                type="danger"
                plain
                circle
                :icon="Delete"
                :loading="deletingEpisodeId === ep.id"
                @click.stop="onDeleteEpisode(ep)"
              />
            </div>
            <div class="episode-title">{{ ep.title || '未命名' }}</div>
            <div class="episode-preview">{{ (ep.script_content || '').slice(0, 20) || '暂无剧本' }}</div>
          </div>
        </div>
      </section>

      <!-- 本剧资源库（Tab 切换） -->
      <section class="section card">
        <div class="section-header">
          <div class="section-title">本剧资源库</div>
          <el-radio-group v-model="libraryTab" size="small">
            <el-radio-button value="char">角色</el-radio-button>
            <el-radio-button value="scene">场景</el-radio-button>
            <el-radio-button value="prop">道具</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 角色库 -->
        <template v-if="libraryTab === 'char'">
          <div class="library-toolbar">
            <el-input v-model="charKw" placeholder="搜索角色" clearable style="width: 200px" @input="onCharKwInput" />
            <el-button size="small" @click="openImport('char')">从素材库导入</el-button>
          </div>
          <div v-loading="charLoading" class="library-list">
            <div v-for="item in charList" :key="item.id" class="library-item">
              <div class="library-item-cover" @click="openPreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-placeholder">暂无图</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.name || '未命名' }}</div>
                <div class="library-item-desc">{{ (item.description || '').slice(0, 60) }}</div>
                <div class="library-item-actions">
                  <el-button size="small" @click="openEditChar(item)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteChar(item)">删除</el-button>
                </div>
              </div>
            </div>
            <div v-if="!charLoading && charList.length === 0" class="library-empty">暂无本剧角色库记录，可在制作页面「加入本剧库」</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="charPage" v-model:page-size="charPageSize" :total="charTotal" :page-sizes="[10,20,50]" layout="total, sizes, prev, pager, next" @current-change="loadCharList" @size-change="loadCharList" />
          </div>
        </template>

        <!-- 场景库 -->
        <template v-if="libraryTab === 'scene'">
          <div class="library-toolbar">
            <el-input v-model="sceneKw" placeholder="搜索场景" clearable style="width: 200px" @input="onSceneKwInput" />
            <el-button size="small" @click="openImport('scene')">从素材库导入</el-button>
          </div>
          <div v-loading="sceneLoading" class="library-list">
            <div v-for="item in sceneList" :key="item.id" class="library-item">
              <div class="library-item-cover" @click="openPreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-placeholder">暂无图</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.location || item.time || '未命名' }}</div>
                <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}</div>
                <div class="library-item-actions">
                  <el-button size="small" @click="openEditScene(item)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteScene(item)">删除</el-button>
                </div>
              </div>
            </div>
            <div v-if="!sceneLoading && sceneList.length === 0" class="library-empty">暂无本剧场景库记录，可在制作页面「加入本剧库」</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="scenePage" v-model:page-size="scenePageSize" :total="sceneTotal" :page-sizes="[10,20,50]" layout="total, sizes, prev, pager, next" @current-change="loadSceneList" @size-change="loadSceneList" />
          </div>
        </template>

        <!-- 道具库 -->
        <template v-if="libraryTab === 'prop'">
          <div class="library-toolbar">
            <el-input v-model="propKw" placeholder="搜索道具" clearable style="width: 200px" @input="onPropKwInput" />
            <el-button size="small" @click="openImport('prop')">从素材库导入</el-button>
          </div>
          <div v-loading="propLoading" class="library-list">
            <div v-for="item in propList" :key="item.id" class="library-item">
              <div class="library-item-cover" @click="openPreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-placeholder">暂无图</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.name || '未命名' }}</div>
                <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}</div>
                <div class="library-item-actions">
                  <el-button size="small" @click="openEditProp(item)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteProp(item)">删除</el-button>
                </div>
              </div>
            </div>
            <div v-if="!propLoading && propList.length === 0" class="library-empty">暂无本剧道具库记录，可在制作页面「加入本剧库」</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="propPage" v-model:page-size="propPageSize" :total="propTotal" :page-sizes="[10,20,50]" layout="total, sizes, prev, pager, next" @current-change="loadPropList" @size-change="loadPropList" />
          </div>
        </template>
      </section>
    </main>

    <!-- 编辑角色 -->
    <el-dialog v-model="editCharVisible" title="编辑角色库" width="480px" @close="editCharForm = null">
      <el-form v-if="editCharForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editCharForm))">
              <img v-if="editCharForm.image_url || editCharForm.local_path" :src="assetImageUrl(editCharForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editCharForm.imgUploading" @click="charFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editCharForm.imgGenerating" @click="doGenerateLibImg(editCharForm, (editCharForm.name + (editCharForm.description ? ', ' + editCharForm.description : '')), characterLibraryAPI, loadCharList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="charFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editCharForm, characterLibraryAPI, loadCharList)" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editCharForm.name" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editCharForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editCharForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editCharForm.tags" placeholder="逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editCharVisible = false">取消</el-button>
        <el-button type="primary" :loading="editCharSaving" @click="saveChar">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑场景 -->
    <el-dialog v-model="editSceneVisible" title="编辑场景库" width="480px" @close="editSceneForm = null">
      <el-form v-if="editSceneForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editSceneForm))">
              <img v-if="editSceneForm.image_url || editSceneForm.local_path" :src="assetImageUrl(editSceneForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editSceneForm.imgUploading" @click="sceneFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editSceneForm.imgGenerating" @click="doGenerateLibImg(editSceneForm, ([editSceneForm.location, editSceneForm.time, editSceneForm.description].filter(Boolean).join(', ')), sceneLibraryAPI, loadSceneList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="sceneFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editSceneForm, sceneLibraryAPI, loadSceneList)" />
        </el-form-item>
        <el-form-item label="地点"><el-input v-model="editSceneForm.location" /></el-form-item>
        <el-form-item label="时间"><el-input v-model="editSceneForm.time" placeholder="如：白天/夜晚" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editSceneForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editSceneForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editSceneForm.tags" placeholder="逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editSceneVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSceneSaving" @click="saveScene">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑道具 -->
    <el-dialog v-model="editPropVisible" title="编辑道具库" width="480px" @close="editPropForm = null">
      <el-form v-if="editPropForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openPreview(assetImageUrl(editPropForm))">
              <img v-if="editPropForm.image_url || editPropForm.local_path" :src="assetImageUrl(editPropForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editPropForm.imgUploading" @click="propFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editPropForm.imgGenerating" @click="doGenerateLibImg(editPropForm, (editPropForm.name + (editPropForm.description ? ', ' + editPropForm.description : '')), propLibraryAPI, loadPropList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="propFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editPropForm, propLibraryAPI, loadPropList)" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editPropForm.name" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editPropForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editPropForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editPropForm.tags" placeholder="逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editPropVisible = false">取消</el-button>
        <el-button type="primary" :loading="editPropSaving" @click="saveProp">保存</el-button>
      </template>
    </el-dialog>

    <!-- 从素材库导入 -->
    <el-dialog
      v-model="importVisible"
      :title="`从素材库导入${importType === 'char' ? '角色' : importType === 'scene' ? '场景' : '道具'}`"
      width="760px"
      destroy-on-close
      @open="loadImportList"
    >
      <div class="library-toolbar">
        <el-input v-model="importKw" placeholder="搜索关键词" clearable style="width: 220px" @input="onImportKwInput" />
        <span class="import-tip">点击「导入」将素材复制到本剧资源库</span>
      </div>
      <div v-loading="importLoading" class="library-list import-list">
        <div v-for="item in importList" :key="item.id" class="library-item">
          <div class="library-item-cover" @click="openPreview(assetImageUrl(item))">
            <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
            <span v-else class="library-placeholder">暂无图</span>
          </div>
          <div class="library-item-info">
            <div class="library-item-name">
              {{ importType === 'scene' ? (item.location || item.time || '未命名') : (item.name || '未命名') }}
            </div>
            <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 80) }}</div>
            <div class="library-item-actions">
              <el-button size="small" type="primary" :loading="importingId === item.id" @click="doImport(item)">导入</el-button>
            </div>
          </div>
        </div>
        <div v-if="!importLoading && importList.length === 0" class="library-empty">素材库暂无内容</div>
      </div>
      <div class="library-pagination">
        <el-pagination
          v-model:current-page="importPage"
          v-model:page-size="importPageSize"
          :total="importTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadImportList"
          @size-change="loadImportList"
        />
      </div>
      <template #footer>
        <el-button @click="importVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <Teleport to="body">
      <div v-if="previewUrl" class="image-preview-overlay" @click="previewUrl = null">
        <img :src="previewUrl" alt="" class="image-preview-img" @click.stop="previewUrl = null" />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, VideoPlay, Plus, Delete, Sunny, Moon, PictureFilled } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
import { dramaAPI } from '@/api/drama'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import { uploadAPI } from '@/api/upload'
import { imagesAPI } from '@/api/images'
import { taskAPI } from '@/api/task'

const route = useRoute()
const { isDark, toggle: toggleTheme } = useTheme()
const router = useRouter()
const dramaId = Number(route.params.id)

// 图片编辑 – 文件输入 refs（各资源类型独立）
const charFileRef  = ref(null)
const sceneFileRef = ref(null)
const propFileRef  = ref(null)

// 共享：上传图片到库条目
async function doUploadLibImg(event, form, api, reloadFn) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  if (!file || !form?.id) return
  form.imgUploading = true
  try {
    const res = await uploadAPI.uploadImage(file)
    const data = res?.data ?? res
    const url = data?.url || data?.path || data?.local_path
    if (!url) { ElMessage.error('上传未返回地址'); return }
    form.image_url = url
    form.local_path = data?.local_path ?? null
    await api.update(form.id, { image_url: url, local_path: null })
    reloadFn()
    ElMessage.success('图片已更新')
  } catch (e) { ElMessage.error(e.message || '上传失败') }
  finally { form.imgUploading = false }
}

// 共享：AI 生成图片到库条目
async function doGenerateLibImg(form, prompt, api, reloadFn) {
  if (!prompt?.trim()) { ElMessage.warning('请先填写名称或描述'); return }
  form.imgGenerating = true
  try {
    const res = await imagesAPI.create({ prompt: prompt.trim(), drama_id: dramaId || null })
    const imgData = res?.data ?? res
    const taskId = imgData?.task_id
    if (!taskId) throw new Error('未返回任务ID')
    let task = null
    for (let i = 0; i < 300; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const tr = await taskAPI.get(taskId)
      task = tr?.data ?? tr
      if (task.status === 'completed') break
      if (task.status === 'failed') throw new Error(task.error || '生成失败')
    }
    if (!task || task.status !== 'completed') throw new Error('生成超时')
    const result = task.result
    const imageUrl = result?.image_url
    const localPath = result?.local_path ?? null
    if (!imageUrl && !localPath) throw new Error('未获取到图片地址')
    form.image_url = imageUrl || ''
    form.local_path = localPath
    await api.update(form.id, { image_url: imageUrl || null, local_path: localPath })
    reloadFn()
    ElMessage.success('AI 图片已生成')
  } catch (e) { ElMessage.error(e.message || '生成失败') }
  finally { form.imgGenerating = false }
}

const loading = ref(false)
const drama = ref(null)
const episodes = ref([])

const infoForm = reactive({ title: '', description: '', genre: '', style: '' })

function assetImageUrl(item) {
  if (!item) return ''
  const lp = item.local_path && String(item.local_path).trim()
  if (lp) return '/static/' + lp.replace(/^\//, '')
  return item.image_url || ''
}

function formatDate(val) {
  if (!val) return ''
  return new Date(val).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function loadDrama() {
  loading.value = true
  try {
    const d = await dramaAPI.get(dramaId)
    drama.value = d
    episodes.value = d.episodes || []
    infoForm.title = d.title || ''
    infoForm.description = d.description || ''
    infoForm.genre = d.genre || ''
    infoForm.style = d.style || ''
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

let infoSaveTimer = null
function saveInfo() {
  if (infoSaveTimer) clearTimeout(infoSaveTimer)
  infoSaveTimer = setTimeout(async () => {
    try {
      await dramaAPI.update(dramaId, { title: infoForm.title, description: infoForm.description })
      await dramaAPI.saveOutline(dramaId, { genre: infoForm.genre || undefined, style: infoForm.style || undefined })
    } catch (e) {
      console.error('saveInfo failed', e)
    }
  }, 600)
}

function goCreate() {
  router.push(`/film/${dramaId}`)
}

function goEpisode(epId) {
  router.push(`/film/${dramaId}?episode=${epId}`)
}

const addingEpisode = ref(false)
const deletingEpisodeId = ref(null)

async function onDeleteEpisode(ep) {
  const label = `第 ${ep.episode_number ?? '?'} 集「${ep.title || '未命名'}」`
  try {
    await ElMessageBox.confirm(`确定删除 ${label}？此操作不可恢复。`, '删除确认', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
  } catch { return }
  deletingEpisodeId.value = ep.id
  try {
    const remaining = episodes.value
      .filter((e) => e.id !== ep.id)
      .map((e, i) => ({
        episode_number: e.episode_number ?? i + 1,
        title: e.title || '第' + (e.episode_number ?? i + 1) + '集',
        script_content: e.script_content || '',
        description: e.description ?? null,
        duration: e.duration ?? 0,
      }))
    await dramaAPI.saveEpisodes(dramaId, remaining)
    ElMessage.success(`${label} 已删除`)
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  } finally {
    deletingEpisodeId.value = null
  }
}

async function onAddEpisode() {
  addingEpisode.value = true
  try {
    const list = episodes.value
    const nextNum = list.length > 0
      ? Math.max(...list.map((e) => Number(e.episode_number) || 0), 0) + 1
      : 1
    const updated = list.map((ep, i) => ({
      episode_number: ep.episode_number ?? i + 1,
      title: ep.title || '第' + (ep.episode_number ?? i + 1) + '集',
      script_content: ep.script_content || '',
      description: ep.description ?? null,
      duration: ep.duration ?? 0
    }))
    updated.push({ episode_number: nextNum, title: '第' + nextNum + '集', script_content: '', description: null, duration: 0 })
    await dramaAPI.saveEpisodes(dramaId, updated)
    ElMessage.success('已添加第' + nextNum + '集')
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  } finally {
    addingEpisode.value = false
  }
}

// ---------- 资源库 Tab ----------
const libraryTab = ref('char')
const previewUrl = ref(null)
function openPreview(url) { if (url) previewUrl.value = url }

// 角色
const charList = ref([]), charLoading = ref(false), charPage = ref(1), charPageSize = ref(20), charTotal = ref(0), charKw = ref('')
let charKwTimer = null
async function loadCharList() {
  charLoading.value = true
  try {
    const res = await characterLibraryAPI.list({ drama_id: dramaId, page: charPage.value, page_size: charPageSize.value, keyword: charKw.value || undefined })
    charList.value = res?.items ?? []; charTotal.value = res?.pagination?.total ?? 0
  } catch { charList.value = [] } finally { charLoading.value = false }
}
function onCharKwInput() { if (charKwTimer) clearTimeout(charKwTimer); charKwTimer = setTimeout(() => { charPage.value = 1; loadCharList() }, 300) }
const editCharVisible = ref(false), editCharForm = ref(null), editCharSaving = ref(false)
function openEditChar(item) {
  editCharForm.value = { id: item.id, name: item.name ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  editCharVisible.value = true
}
async function saveChar() {
  if (!editCharForm.value?.id) return; editCharSaving.value = true
  try {
    await characterLibraryAPI.update(editCharForm.value.id, { name: editCharForm.value.name, category: editCharForm.value.category || null, description: editCharForm.value.description || null, tags: editCharForm.value.tags || null, image_url: editCharForm.value.image_url || null, local_path: editCharForm.value.local_path ?? null })
    ElMessage.success('已保存'); editCharVisible.value = false; loadCharList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editCharSaving.value = false }
}
async function deleteChar(item) {
  try { await ElMessageBox.confirm(`确定删除「${(item.name || '未命名').slice(0, 20)}」？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await characterLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadCharList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// 场景
const sceneList = ref([]), sceneLoading = ref(false), scenePage = ref(1), scenePageSize = ref(20), sceneTotal = ref(0), sceneKw = ref('')
let sceneKwTimer = null
async function loadSceneList() {
  sceneLoading.value = true
  try {
    const res = await sceneLibraryAPI.list({ drama_id: dramaId, page: scenePage.value, page_size: scenePageSize.value, keyword: sceneKw.value || undefined })
    sceneList.value = res?.items ?? []; sceneTotal.value = res?.pagination?.total ?? 0
  } catch { sceneList.value = [] } finally { sceneLoading.value = false }
}
function onSceneKwInput() { if (sceneKwTimer) clearTimeout(sceneKwTimer); sceneKwTimer = setTimeout(() => { scenePage.value = 1; loadSceneList() }, 300) }
const editSceneVisible = ref(false), editSceneForm = ref(null), editSceneSaving = ref(false)
function openEditScene(item) {
  editSceneForm.value = { id: item.id, location: item.location ?? '', time: item.time ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  editSceneVisible.value = true
}
async function saveScene() {
  if (!editSceneForm.value?.id) return; editSceneSaving.value = true
  try {
    await sceneLibraryAPI.update(editSceneForm.value.id, { location: editSceneForm.value.location, time: editSceneForm.value.time || null, category: editSceneForm.value.category || null, description: editSceneForm.value.description || null, tags: editSceneForm.value.tags || null, image_url: editSceneForm.value.image_url || null, local_path: editSceneForm.value.local_path ?? null })
    ElMessage.success('已保存'); editSceneVisible.value = false; loadSceneList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editSceneSaving.value = false }
}
async function deleteScene(item) {
  const n = (item.location || item.time || '未命名').slice(0, 20)
  try { await ElMessageBox.confirm(`确定删除「${n}」？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await sceneLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadSceneList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// 道具
const propList = ref([]), propLoading = ref(false), propPage = ref(1), propPageSize = ref(20), propTotal = ref(0), propKw = ref('')
let propKwTimer = null
async function loadPropList() {
  propLoading.value = true
  try {
    const res = await propLibraryAPI.list({ drama_id: dramaId, page: propPage.value, page_size: propPageSize.value, keyword: propKw.value || undefined })
    propList.value = res?.items ?? []; propTotal.value = res?.pagination?.total ?? 0
  } catch { propList.value = [] } finally { propLoading.value = false }
}
function onPropKwInput() { if (propKwTimer) clearTimeout(propKwTimer); propKwTimer = setTimeout(() => { propPage.value = 1; loadPropList() }, 300) }
const editPropVisible = ref(false), editPropForm = ref(null), editPropSaving = ref(false)
function openEditProp(item) {
  editPropForm.value = { id: item.id, name: item.name ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  editPropVisible.value = true
}
async function saveProp() {
  if (!editPropForm.value?.id) return; editPropSaving.value = true
  try {
    await propLibraryAPI.update(editPropForm.value.id, { name: editPropForm.value.name, category: editPropForm.value.category || null, description: editPropForm.value.description || null, tags: editPropForm.value.tags || null, image_url: editPropForm.value.image_url || null, local_path: editPropForm.value.local_path ?? null })
    ElMessage.success('已保存'); editPropVisible.value = false; loadPropList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editPropSaving.value = false }
}
async function deleteProp(item) {
  try { await ElMessageBox.confirm(`确定删除「${(item.name || '未命名').slice(0, 20)}」？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await propLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadPropList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// ---------- 从素材库导入 ----------
const importVisible = ref(false)
const importType = ref('char') // 'char' | 'scene' | 'prop'
const importList = ref([])
const importLoading = ref(false)
const importPage = ref(1)
const importPageSize = ref(20)
const importTotal = ref(0)
const importKw = ref('')
const importingId = ref(null)
let importKwTimer = null

function openImport(type) {
  importType.value = type
  importKw.value = ''
  importPage.value = 1
  importVisible.value = true
}

async function loadImportList() {
  importLoading.value = true
  try {
    const api = importType.value === 'char' ? characterLibraryAPI
      : importType.value === 'scene' ? sceneLibraryAPI : propLibraryAPI
    // 不传 drama_id，获取全局素材库（所有记录）
    const res = await api.list({ page: importPage.value, page_size: importPageSize.value, keyword: importKw.value || undefined, global: 1 })
    importList.value = res?.items ?? []
    importTotal.value = res?.pagination?.total ?? 0
  } catch { importList.value = [] } finally { importLoading.value = false }
}

function onImportKwInput() {
  if (importKwTimer) clearTimeout(importKwTimer)
  importKwTimer = setTimeout(() => { importPage.value = 1; loadImportList() }, 300)
}

async function doImport(item) {
  importingId.value = item.id
  try {
    if (importType.value === 'char') {
      await characterLibraryAPI.create({
        drama_id: dramaId,
        name: item.name || '',
        image_url: item.image_url || null,
        local_path: item.local_path || null,
        description: item.description || null,
        category: item.category || null,
        tags: item.tags || null,
        source_type: 'imported',
      })
      loadCharList()
    } else if (importType.value === 'scene') {
      await sceneLibraryAPI.create({
        drama_id: dramaId,
        location: item.location || '',
        time: item.time || null,
        prompt: item.prompt || null,
        description: item.description || null,
        image_url: item.image_url || null,
        local_path: item.local_path || null,
        category: item.category || null,
        tags: item.tags || null,
        source_type: 'imported',
      })
      loadSceneList()
    } else {
      await propLibraryAPI.create({
        drama_id: dramaId,
        name: item.name || '',
        description: item.description || null,
        prompt: item.prompt || null,
        image_url: item.image_url || null,
        local_path: item.local_path || null,
        category: item.category || null,
        tags: item.tags || null,
        source_type: 'imported',
      })
      loadPropList()
    }
    ElMessage.success('已导入到本剧资源库')
  } catch (e) {
    ElMessage.error(e.message || '导入失败')
  } finally {
    importingId.value = null
  }
}

watch(libraryTab, (tab) => {
  if (tab === 'char') loadCharList()
  else if (tab === 'scene') loadSceneList()
  else if (tab === 'prop') loadPropList()
})

onMounted(() => {
  loadDrama()
  loadCharList()
})
</script>

<style scoped>
.drama-detail { min-height: 100vh; background: #0f0f12; color: #e4e4e7; }
.header { background: #18181b; border-bottom: 1px solid #27272a; padding: 12px 24px; }
.header-inner { max-width: min(1200px, 96vw); margin: 0 auto; display: flex; align-items: center; gap: 16px; }
.logo { font-size: 1.2rem; font-weight: 600; color: #fafafa; margin: 0; cursor: pointer; }
.page-title { color: #a1a1aa; font-size: 0.95rem; }
.header-actions { margin-left: auto; display: flex; gap: 8px; }
.main { max-width: min(1200px, 96vw); margin: 0 auto; padding: 24px 16px 48px; display: flex; flex-direction: column; gap: 20px; }
.section.card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px 24px; }
.section-title { font-size: 1rem; font-weight: 600; color: #fafafa; margin-bottom: 16px; }
.section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.section-header .section-title { margin-bottom: 0; }
.section-count { color: #71717a; font-size: 0.85rem; }
.info-form { max-width: 100%; }
.empty-tip { color: #71717a; text-align: center; padding: 32px; }

/* 分集卡片 */
.episode-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.episode-card { background: #1c1c1e; border: 1px solid #27272a; border-radius: 8px; padding: 16px; cursor: pointer; transition: border-color 0.2s; }
.episode-card:hover { border-color: var(--el-color-primary); }
.episode-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.episode-num { font-size: 0.8rem; color: #71717a; }
.episode-title { font-weight: 500; color: #fafafa; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.episode-preview { font-size: 0.78rem; color: #71717a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 资源库 */
.library-toolbar { margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
.import-tip { font-size: 0.8rem; color: #71717a; }
.import-list { max-height: 480px; }
.library-list { min-height: 120px; display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; }
.library-item { display: flex; gap: 12px; padding: 10px; background: #1c1c1e; border: 1px solid #27272a; border-radius: 8px; }
.library-item-cover { width: 72px; height: 72px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #27272a; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.library-item-cover img { width: 100%; height: 100%; object-fit: cover; }
.library-placeholder { font-size: 0.8rem; color: #71717a; }
.library-item-info { flex: 1; min-width: 0; }
.library-item-name { font-weight: 500; color: #fafafa; margin-bottom: 4px; }
.library-item-desc { font-size: 0.85rem; color: #a1a1aa; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.library-item-actions { display: flex; gap: 8px; }
.library-empty { text-align: center; color: #71717a; padding: 40px 20px; }
.library-pagination { margin-top: 12px; display: flex; justify-content: center; }

/* 编辑弹框内图片区 */
.lib-img-editor { display: flex; align-items: center; gap: 14px; }
.lib-img-thumb { width: 88px; height: 88px; border-radius: 8px; overflow: hidden; cursor: zoom-in; background: var(--bg-inner, #1c1c1e); border: 1px solid var(--border-color, #27272a); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.lib-img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.lib-img-empty { color: var(--text-faint, #52525b); font-size: 26px; }
.lib-img-btns { display: flex; flex-direction: column; gap: 8px; }

/* 图片预览 */
.image-preview-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; z-index: 9999; cursor: zoom-out; }
.image-preview-img { max-width: 90vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }

/* 主题切换按钮 */
.btn-theme {
  --el-button-bg-color: rgba(148, 163, 184, 0.1);
  --el-button-border-color: rgba(148, 163, 184, 0.3);
  --el-button-text-color: #94a3b8;
  --el-button-hover-bg-color: rgba(148, 163, 184, 0.2);
  --el-button-hover-border-color: rgba(148, 163, 184, 0.5);
  --el-button-hover-text-color: #cbd5e1;
  transition: all 0.2s;
}
html.light .btn-theme {
  --el-button-bg-color: rgba(99, 102, 241, 0.08);
  --el-button-border-color: rgba(99, 102, 241, 0.3);
  --el-button-text-color: #6366f1;
  --el-button-hover-bg-color: rgba(99, 102, 241, 0.15);
  --el-button-hover-border-color: rgba(99, 102, 241, 0.5);
  --el-button-hover-text-color: #4f46e5;
}
</style>
