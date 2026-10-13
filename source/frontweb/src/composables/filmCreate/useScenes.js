import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { sceneAPI } from '@/api/scenes'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { uploadAPI } from '@/api/upload'
import { useGenerationTaskStore, GEN_RESOURCE } from '@/stores/generationTaskStore'
import { buildExtractTaskMeta, isEpisodeExtractRunning } from '@/composables/useGenerationTaskSync'

/**
 * 场景管理 Composable
 * @param {object} deps - 共享依赖
 * @param {object} deps.store - Pinia store
 * @param {import('vue').ComputedRef} deps.dramaId
 * @param {import('vue').ComputedRef} deps.currentEpisodeId
 * @param {Function} deps.getSelectedStyle
 * @param {Function} deps.scriptLanguage - ref
 * @param {Function} deps.loadDrama
 * @param {Function} deps.pollTask
 * @param {Function} deps.pollUntilResourceHasImage
 * @param {Function} deps.hasAssetImage
 * @param {object} deps.dramaAPI
 */
export function useScenes(deps) {
  const { store, dramaId, currentEpisodeId, getSelectedStyle, scriptLanguage, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage, dramaAPI } = deps
  const genStore = useGenerationTaskStore()

  function buildSceneImageMeta(scene) {
    const dramaTitle = store.drama?.title || ''
    const epNum = store.currentEpisode?.episode_number
    const epLabel = dramaTitle ? `${dramaTitle} · 第${epNum ?? ''}集` : `第${epNum ?? ''}集`
    return {
      dramaId: dramaId.value,
      episodeId: currentEpisodeId.value,
      dramaTitle,
      episodeNumber: epNum,
      resourceType: GEN_RESOURCE.SCENE_IMAGE,
      resourceId: scene.id,
      label: `${epLabel} 场景图: ${scene.location || scene.id}`,
    }
  }

  function dataUrlToFile(dataUrl, filename) {
    const arr = dataUrl.split(',')
    const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/png'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) u8arr[n] = bstr.charCodeAt(n)
    return new File([u8arr], filename || 'reference.png', { type: mime })
  }

  // ── 场景弹窗状态 ──────────────────────────────────────
  const showEditScene = ref(false)
  const editSceneForm = ref(null)
  const editSceneSaving = ref(false)
  const editScenePromptGenerating = ref(false)
  const extractingSceneDesc = ref(false)
  const addSceneRefImage = ref(null)   // { dataUrl, filename }
  const addSceneRefFileInput = ref(null)
  let editScenePollTimer = null

  // ── 场景生成状态 ──────────────────────────────────────
  const scenesExtracting = computed(() =>
    isEpisodeExtractRunning(genStore, dramaId.value, currentEpisodeId.value, GEN_RESOURCE.EXTRACT_SCENES)
  )
  const generatingSceneIds = reactive(new Set())

  // ── 场景库状态 ────────────────────────────────────────
  const showSceneLibrary = ref(false)
  const sceneLibraryList = ref([])
  const sceneLibraryLoading = ref(false)
  const sceneLibraryPage = ref(1)
  const sceneLibraryPageSize = ref(20)
  const sceneLibraryTotal = ref(0)
  const sceneLibraryKeyword = ref('')
  const showEditSceneLibrary = ref(false)
  const editSceneLibraryForm = ref(null)
  const editSceneLibrarySaving = ref(false)
  const addingSceneToLibraryId = ref(null)
  const addingSceneToMaterialId = ref(null)
  const addingSceneFromLibraryId = ref(null)
  let sceneLibraryKeywordTimer = null

  const sceneLibraryTab = ref('library')
  const dramaAllSceneList = ref([])
  const dramaAllSceneLoading = ref(false)
  const dramaAllScenePage = ref(1)
  const dramaAllScenePageSize = ref(20)
  const dramaAllSceneTotal = ref(0)
  const dramaAllSceneKeyword = ref('')
  let dramaAllSceneKeywordTimer = null


  // ── 函数 ──────────────────────────────────────────────
  async function onExtractScenes() {
    if (!currentEpisodeId.value) return
    const epId = currentEpisodeId.value
    const meta = buildExtractTaskMeta(store, dramaId.value, epId, GEN_RESOURCE.EXTRACT_SCENES, '提取场景')
    genStore.markRunning(meta)
    try {
      const res = await dramaAPI.extractBackgrounds(epId, {
        model: undefined,
        style: getSelectedStyle(),
        language: scriptLanguage.value
      })
      const taskId = res?.task_id
      if (taskId) {
        const pollRes = await pollTask(taskId, () => loadDrama(), meta)
        if (pollRes?.status !== 'failed') {
          ElMessage.success('场景提取完成')
        }
      } else {
        await loadDrama()
        ElMessage.success('场景提取任务已提交')
      }
    } catch (e) {
      ElMessage.error(e.message || '提取失败')
    } finally {
      genStore.markDone(meta)
    }
  }

  function openAddScene() {
    editSceneForm.value = { location: '', time: '', prompt: '' }
    showEditScene.value = true
  }

  function stopScenePromptPoll() {
    if (editScenePollTimer) { clearInterval(editScenePollTimer); editScenePollTimer = null }
  }

  function editScene(scene) {
    stopScenePromptPoll()
    editSceneForm.value = {
      id: scene.id,
      location: scene.location || '',
      time: scene.time || '',
      prompt: scene.prompt || '',
      polished_prompt: scene.polished_prompt || '',
      polished_prompt_single: scene.polished_prompt_single || '',
      image_url: scene.image_url || '',
      local_path: scene.local_path || '',
      ref_image: scene.ref_image || '',
    }
    showEditScene.value = true
    if (!scene.polished_prompt && scene.id && (scene.location || scene.time)) {
      editScenePromptGenerating.value = true
      let elapsed = 0
      editScenePollTimer = setInterval(async () => {
        elapsed += 3
        try {
          const res = await sceneAPI.get(scene.id)
          const p = res?.scene?.polished_prompt
          if (p) {
            if (editSceneForm.value?.id === scene.id) editSceneForm.value.polished_prompt = p
            stopScenePromptPoll()
            editScenePromptGenerating.value = false
          } else if (elapsed >= 60) {
            stopScenePromptPoll()
            editScenePromptGenerating.value = false
          }
        } catch (_) {
          stopScenePromptPoll()
          editScenePromptGenerating.value = false
        }
      }, 3000)
    }
  }

  async function doGenerateScenePrompt() {
    const form = editSceneForm.value
    if (!form?.id) return
    editScenePromptGenerating.value = true
    try {
      const res = await sceneAPI.generatePrompt(form.id)
      if (res?.polished_prompt) {
        form.polished_prompt = res.polished_prompt
        ElMessage.success('提示词已生成')
        await loadDrama()
      }
    } catch (e) {
      ElMessage.error(e.message || '生成提示词失败')
    } finally {
      editScenePromptGenerating.value = false
    }
  }

  async function doGenerateSceneSinglePrompt() {
    const form = editSceneForm.value
    if (!form?.id) return
    editScenePromptGenerating.value = true
    try {
      const res = await sceneAPI.generatePrompt(form.id, undefined, undefined, 'single')
      if (res?.polished_prompt_single) {
        form.polished_prompt_single = res.polished_prompt_single
        ElMessage.success('单图提示词已生成')
        await loadDrama()
      }
    } catch (e) {
      ElMessage.error(e.message || '生成提示词失败')
    } finally {
      editScenePromptGenerating.value = false
    }
  }

  async function saveSceneRefImageIfAny(sceneId) {
    const refImg = addSceneRefImage.value
    if (!refImg || !sceneId) return
    try {
      const file = dataUrlToFile(refImg.dataUrl, refImg.filename || 'reference.png')
      const uploadRes = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
      const refPath = uploadRes.local_path || uploadRes.url || ''
      await sceneAPI.putRefImage(sceneId, refPath)
    } catch (e) {
      console.warn('[saveSceneRefImage] 保存参考图失败:', e.message)
    }
  }

  async function clearSceneRefImage() {
    const form = editSceneForm.value
    if (!form?.id) return
    try {
      await sceneAPI.putRefImage(form.id, null)
      form.ref_image = ''
      ElMessage.success('参考图已移除')
    } catch (e) {
      ElMessage.error('移除失败')
    }
  }

  async function doExtractSceneFromImage() {
    const form = editSceneForm.value
    if (!form?.id) return
    extractingSceneDesc.value = true
    try {
      const res = await sceneAPI.extractFromImage(form.id)
      if (res?.prompt) {
        form.prompt = res.prompt
        ElMessage.success('已从图片提取场景描述')
      }
    } catch (e) {
      ElMessage.error(e.message || '提取失败，请检查场景是否已上传参考图片')
    } finally {
      extractingSceneDesc.value = false
    }
  }

  async function submitEditScene() {
    const form = editSceneForm.value
    if (!form?.location?.trim() || !store.dramaId) return
    editSceneSaving.value = true
    try {
      if (form.id) {
        await sceneAPI.update(form.id, {
          location: form.location.trim(),
          time: form.time || undefined,
          prompt: form.prompt || undefined,
          polished_prompt: form.polished_prompt || undefined,
          polished_prompt_single: form.polished_prompt_single || undefined
        })
        await saveSceneRefImageIfAny(form.id)
        ElMessage.success('场景已保存')
      } else {
        await sceneAPI.create({
          drama_id: store.dramaId,
          episode_id: currentEpisodeId.value || undefined,
          location: form.location.trim(),
          time: form.time || undefined,
          prompt: form.prompt || undefined
        })
        await loadDrama()
        if (addSceneRefImage.value) {
          const newScene = (store.drama?.scenes || []).find(
            s => s.location === form.location.trim() && (s.time || '') === (form.time || '')
          )
          if (newScene?.id) await saveSceneRefImageIfAny(newScene.id)
        }
        ElMessage.success('场景已添加')
      }
      await loadDrama()
      showEditScene.value = false
    } catch (e) {
      ElMessage.error(e.message || (form.id ? '保存失败' : '添加失败'))
    } finally {
      editSceneSaving.value = false
    }
  }

  function onCloseSceneDialog() {
    showEditScene.value = false
    stopScenePromptPoll()
    editScenePromptGenerating.value = false
    addSceneRefImage.value = null
  }

  async function onDeleteScene(scene) {
    try {
      await ElMessageBox.confirm(
        `确定要删除场景「${(scene.location || scene.time || '未命名').slice(0, 20)}」吗？此操作不可恢复。`,
        '删除确认',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      await sceneAPI.delete(scene.id)
      await loadDrama()
      ElMessage.success('场景已删除')
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e.message || '删除失败')
    }
  }

  async function onGenerateSceneImage(scene, useQuadGrid = false) {
    scene.errorMsg = ''
    scene.error_msg = ''
    const meta = buildSceneImageMeta(scene)
    generatingSceneIds.add(scene.id)
    genStore.markRunning(meta)
    try {
      const res = await sceneAPI.generateImage({
        scene_id: scene.id,
        model: undefined,
        style: getSelectedStyle(),
        use_quad_grid: !!useQuadGrid
      })
      const taskId = res?.image_generation?.task_id ?? res?.task_id
      if (taskId) {
        const pollRes = await pollTask(taskId, () => loadDrama(), meta)
        if (pollRes?.status === 'failed') {
          scene.errorMsg = pollRes.error || '生成失败'
        } else {
          ElMessage.success('场景图片已生成')
        }
      } else {
        await loadDrama()
        await pollUntilResourceHasImage(() => {
          const list = store.drama?.scenes ?? store.currentEpisode?.scenes ?? []
          const s = list.find((x) => Number(x.id) === Number(scene.id))
          return !!(s && (s.image_url || s.local_path))
        })
        ElMessage.success('场景图片已生成')
      }
    } catch (e) {
      console.error(e)
      scene.errorMsg = e.message || '生成失败'
      ElMessage.error(e.message || '提交失败')
    } finally {
      generatingSceneIds.delete(scene.id)
      genStore.markDone(meta)
    }
  }

  // ── 场景库函数 ────────────────────────────────────────
  async function loadSceneLibraryList() {
    sceneLibraryLoading.value = true
    try {
      const res = await sceneLibraryAPI.list({
        drama_id: dramaId.value,
        page: sceneLibraryPage.value,
        page_size: sceneLibraryPageSize.value,
        keyword: sceneLibraryKeyword.value || undefined
      })
      sceneLibraryList.value = res?.items ?? []
      const pagination = res?.pagination ?? {}
      sceneLibraryTotal.value = pagination.total ?? 0
      if (pagination.page != null) sceneLibraryPage.value = pagination.page
      if (pagination.page_size != null) sceneLibraryPageSize.value = pagination.page_size
    } catch (e) {
      sceneLibraryList.value = []
    } finally {
      sceneLibraryLoading.value = false
    }
  }

  function debouncedLoadSceneLibrary() {
    if (sceneLibraryKeywordTimer) clearTimeout(sceneLibraryKeywordTimer)
    sceneLibraryKeywordTimer = setTimeout(() => {
      sceneLibraryPage.value = 1
      loadSceneLibraryList()
    }, 300)
  }

  async function loadDramaAllSceneList() {
    if (!dramaId.value) {
      dramaAllSceneList.value = []
      dramaAllSceneTotal.value = 0
      return
    }
    dramaAllSceneLoading.value = true
    try {
      const res = await sceneAPI.list(dramaId.value)
      let list = Array.isArray(res) ? res : (res?.items ?? res?.scenes ?? [])
      const kw = (dramaAllSceneKeyword.value || '').trim().toLowerCase()
      if (kw) {
        list = list.filter((s) => {
          const loc = (s.location || '').toLowerCase()
          const time = (s.time || '').toLowerCase()
          const desc = (s.description || '').toLowerCase()
          const prompt = (s.prompt || '').toLowerCase()
          return loc.includes(kw) || time.includes(kw) || desc.includes(kw) || prompt.includes(kw)
        })
      }
      dramaAllSceneTotal.value = list.length
      const start = (dramaAllScenePage.value - 1) * dramaAllScenePageSize.value
      dramaAllSceneList.value = list.slice(start, start + dramaAllScenePageSize.value)
    } catch {
      dramaAllSceneList.value = []
      dramaAllSceneTotal.value = 0
    } finally {
      dramaAllSceneLoading.value = false
    }
  }

  function debouncedLoadDramaAllSceneList() {
    if (dramaAllSceneKeywordTimer) clearTimeout(dramaAllSceneKeywordTimer)
    dramaAllSceneKeywordTimer = setTimeout(() => {
      dramaAllScenePage.value = 1
      loadDramaAllSceneList()
    }, 300)
  }

  function onSceneLibraryDialogOpen() {
    if (sceneLibraryTab.value === 'library') loadSceneLibraryList()
    else if (sceneLibraryTab.value === 'drama') loadDramaAllSceneList()
  }

  function onSceneLibraryTabChange() {
    if (sceneLibraryTab.value === 'library') {
      sceneLibraryPage.value = 1
      loadSceneLibraryList()
    } else if (sceneLibraryTab.value === 'drama') {
      dramaAllScenePage.value = 1
      loadDramaAllSceneList()
    }
  }

  function sceneAddToEpisodeLoadingKey(scope, id) {
    return `${scope}-${id}`
  }

  function isSceneAddToEpisodeLoading(scope, id) {
    return addingSceneFromLibraryId.value === sceneAddToEpisodeLoadingKey(scope, id)
  }

  function openEditSceneLibrary(item) {
    editSceneLibraryForm.value = {
      id: item.id,
      location: item.location ?? '',
      time: item.time ?? '',
      category: item.category ?? '',
      description: item.description ?? '',
      tags: item.tags ?? ''
    }
    showEditSceneLibrary.value = true
  }

  async function submitEditSceneLibrary() {
    if (!editSceneLibraryForm.value?.id) return
    editSceneLibrarySaving.value = true
    try {
      await sceneLibraryAPI.update(editSceneLibraryForm.value.id, {
        location: editSceneLibraryForm.value.location,
        time: editSceneLibraryForm.value.time || null,
        category: editSceneLibraryForm.value.category || null,
        description: editSceneLibraryForm.value.description || null,
        tags: editSceneLibraryForm.value.tags || null
      })
      ElMessage.success('已保存')
      showEditSceneLibrary.value = false
      loadSceneLibraryList()
    } catch (e) {
      ElMessage.error(e.message || '保存失败')
    } finally {
      editSceneLibrarySaving.value = false
    }
  }

  async function onDeleteSceneLibrary(item) {
    try {
      const name = (item.location || item.time || '未命名').slice(0, 20)
      await ElMessageBox.confirm(
        `确定删除公共场景「${name}」吗？`,
        '删除确认',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      await sceneLibraryAPI.delete(item.id)
      ElMessage.success('已删除')
      loadSceneLibraryList()
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e.message || '删除失败')
    }
  }

  async function onAddSceneToLibrary(scene) {
    if (!hasAssetImage(scene)) { ElMessage.warning('请先为该场景生成或上传图片'); return }
    addingSceneToLibraryId.value = scene.id
    try {
      await sceneAPI.addToLibrary(scene.id, {})
      ElMessage.success('已加入本剧场景库')
      if (showSceneLibrary.value) loadSceneLibraryList()
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingSceneToLibraryId.value = null
    }
  }

  async function onAddSceneToMaterialLibrary(scene) {
    if (!hasAssetImage(scene)) { ElMessage.warning('请先为该场景生成或上传图片'); return }
    addingSceneToMaterialId.value = scene.id
    try {
      await sceneAPI.addToMaterialLibrary(scene.id)
      ElMessage.success('已加入全局素材库')
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingSceneToMaterialId.value = null
    }
  }

  async function addSceneToEpisode(item, scope) {
    if (!store.dramaId || !currentEpisodeId.value) {
      ElMessage.warning('请先选择本集')
      return
    }
    const loadingKey = sceneAddToEpisodeLoadingKey(scope, item.id)
    addingSceneFromLibraryId.value = loadingKey
    try {
      const existingScene = (store.scenes || []).find((s) => s.location === item.location)
      if (existingScene) {
        await sceneAPI.update(existingScene.id, {
          location: item.location || existingScene.location,
          time: item.time || existingScene.time,
          prompt: existingScene.prompt || item.prompt || '',
          image_url: item.image_url || existingScene.image_url || undefined,
          local_path: item.local_path || existingScene.local_path || undefined,
        })
        ElMessage.success(`「${item.location || '场景'}」已更新到本集`)
      } else {
        await sceneAPI.create({
          drama_id: store.dramaId,
          episode_id: currentEpisodeId.value,
          location: item.location || '',
          time: item.time || '',
          prompt: item.prompt || '',
          image_url: item.image_url || undefined,
          local_path: item.local_path || undefined,
        })
        ElMessage.success(`「${item.location || '场景'}」已加入本集`)
      }
      await loadDrama()
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingSceneFromLibraryId.value = null
    }
  }

  function onAddSceneFromLibrary(item) {
    return addSceneToEpisode(item, 'library')
  }

  function onAddDramaSceneToEpisode(item) {
    return addSceneToEpisode(item, 'drama')
  }

  function onAddTeamSceneToEpisode(item) {
    return addSceneToEpisode(item, 'team')
  }

  return {
    // 弹窗状态
    showEditScene,
    editSceneForm,
    editSceneSaving,
    editScenePromptGenerating,
    extractingSceneDesc,
    addSceneRefImage,
    addSceneRefFileInput,
    // 生成状态
    scenesExtracting,
    generatingSceneIds,
    // 库状态
    showSceneLibrary,
    sceneLibraryList,
    sceneLibraryLoading,
    sceneLibraryPage,
    sceneLibraryPageSize,
    sceneLibraryTotal,
    sceneLibraryKeyword,
    sceneLibraryTab,
    dramaAllSceneList,
    dramaAllSceneLoading,
    dramaAllScenePage,
    dramaAllScenePageSize,
    dramaAllSceneTotal,
    dramaAllSceneKeyword,






    showEditSceneLibrary,
    editSceneLibraryForm,
    editSceneLibrarySaving,
    addingSceneToLibraryId,
    addingSceneToMaterialId,

    addingSceneFromLibraryId,
    // 函数
    onExtractScenes,
    openAddScene,
    stopScenePromptPoll,
    editScene,
    doGenerateScenePrompt,
    doGenerateSceneSinglePrompt,
    saveSceneRefImageIfAny,
    clearSceneRefImage,
    doExtractSceneFromImage,
    submitEditScene,
    onCloseSceneDialog,
    onDeleteScene,
    onGenerateSceneImage,
    loadSceneLibraryList,
    debouncedLoadSceneLibrary,
    loadDramaAllSceneList,
    debouncedLoadDramaAllSceneList,


    onSceneLibraryDialogOpen,
    onSceneLibraryTabChange,
    isSceneAddToEpisodeLoading,
    openEditSceneLibrary,
    submitEditSceneLibrary,
    onDeleteSceneLibrary,
    onAddSceneToLibrary,
    onAddSceneToMaterialLibrary,



    onAddSceneFromLibrary,
    onAddDramaSceneToEpisode,

  }
}
