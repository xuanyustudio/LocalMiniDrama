import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { propAPI } from '@/api/props'
import { propLibraryAPI } from '@/api/propLibrary'
import { uploadAPI } from '@/api/upload'
import { createLibraryMembershipState, hasAssetInLibrary, loadLibraryMembership, markAssetInLibrary } from './libraryMembership'

/**
 * 道具管理 Composable
 * @param {object} deps - 共享依赖
 * @param {object} deps.store - Pinia store
 * @param {import('vue').ComputedRef} deps.dramaId
 * @param {import('vue').ComputedRef} deps.currentEpisodeId
 * @param {Function} deps.getSelectedStyle
 * @param {Function} deps.loadDrama
 * @param {Function} deps.pollTask
 * @param {Function} deps.pollUntilResourceHasImage
 * @param {Function} deps.hasAssetImage
 * @param {Function} [deps.getAssetImageModel]
 */
export function useProps(deps) {
  const { store, dramaId, currentEpisodeId, getSelectedStyle, getAssetImageModel, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage } = deps

  function dataUrlToFile(dataUrl, filename) {
    const arr = dataUrl.split(',')
    const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/png'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) u8arr[n] = bstr.charCodeAt(n)
    return new File([u8arr], filename || 'reference.png', { type: mime })
  }

  // ── 道具弹窗状态 ──────────────────────────────────────
  const showAddProp = ref(false)
  const addPropSaving = ref(false)
  const addPropForm = ref({ name: '', type: '', description: '', prompt: '' })

  const showEditProp = ref(false)
  const editPropForm = ref(null)
  const editPropSaving = ref(false)
  const editPropPromptGenerating = ref(false)
  const extractingPropDesc = ref(false)
  const addPropRefImage = ref(null)   // { dataUrl, filename }
  const addPropRefFileInput = ref(null)
  let editPropPollTimer = null

  // 「添加道具」简单弹窗的独立参考图状态
  const addPropAddRefImage = ref(null)
  const addPropAddRefFileInput = ref(null)
  const extractingPropAddDesc = ref(false)

  // ── 道具生成状态 ──────────────────────────────────────
  const propsExtracting = ref(false)
  const generatingPropIds = reactive(new Set())

  // ── 道具库状态 ────────────────────────────────────────
  const showPropLibrary = ref(false)
  const propLibraryList = ref([])
  const propLibraryLoading = ref(false)
  const propLibraryPage = ref(1)
  const propLibraryPageSize = ref(20)
  const propLibraryTotal = ref(0)
  const propLibraryKeyword = ref('')
  const showEditPropLibrary = ref(false)
  const editPropLibraryForm = ref(null)
  const editPropLibrarySaving = ref(false)
  const addingPropToLibraryId = ref(null)
  const addingPropToMaterialId = ref(null)
  const addingPropFromLibraryId = ref(null)
  const propMembership = createLibraryMembershipState()
  let propLibraryKeywordTimer = null

  // ── 函数 ──────────────────────────────────────────────
  async function onExtractProps() {
    if (!currentEpisodeId.value) {
      ElMessage.warning('请先完成剧本并保存')
      return
    }
    propsExtracting.value = true
    try {
      const res = await propAPI.extractFromScript(currentEpisodeId.value)
      const taskId = res?.task_id
      if (taskId) {
        const pollRes = await pollTask(taskId, () => loadDrama())
        if (pollRes?.status !== 'failed') {
          ElMessage.success('道具提取完成')
        }
      } else {
        await loadDrama()
        ElMessage.success('道具提取任务已提交')
      }
    } catch (e) {
      ElMessage.error(e.message || '提取失败')
    } finally {
      propsExtracting.value = false
    }
  }

  function stopPropPromptPoll() {
    if (editPropPollTimer) { clearInterval(editPropPollTimer); editPropPollTimer = null }
  }

  function editProp(prop) {
    stopPropPromptPoll()
    editPropForm.value = {
      id: prop.id,
      name: prop.name || '',
      type: prop.type || '',
      description: prop.description || '',
      prompt: prop.prompt || '',
      image_url: prop.image_url || '',
      local_path: prop.local_path || '',
      ref_image: prop.ref_image || '',
      negative_prompt: prop.negative_prompt || '',
    }
    showEditProp.value = true
    if (!prop.prompt && prop.id && prop.description) {
      editPropPromptGenerating.value = true
      let elapsed = 0
      editPropPollTimer = setInterval(async () => {
        elapsed += 3
        try {
          const res = await propAPI.get(prop.id)
          const p = res?.prop?.prompt
          if (p) {
            if (editPropForm.value?.id === prop.id) editPropForm.value.prompt = p
            stopPropPromptPoll()
            editPropPromptGenerating.value = false
          } else if (elapsed >= 60) {
            stopPropPromptPoll()
            editPropPromptGenerating.value = false
          }
        } catch (_) {
          stopPropPromptPoll()
          editPropPromptGenerating.value = false
        }
      }, 3000)
    }
  }

  async function doGeneratePropPrompt() {
    const form = editPropForm.value
    if (!form?.id) return
    editPropPromptGenerating.value = true
    try {
      const res = await propAPI.generatePrompt(form.id)
      if (res?.prompt) {
        form.prompt = res.prompt
        ElMessage.success('提示词已生成')
        await loadDrama()
      }
    } catch (e) {
      ElMessage.error(e.message || '生成提示词失败')
    } finally {
      editPropPromptGenerating.value = false
    }
  }

  async function savePropRefImageIfAny(propId) {
    const refImg = addPropRefImage.value
    if (!refImg || !propId) return
    try {
      const file = dataUrlToFile(refImg.dataUrl, refImg.filename || 'reference.png')
      const uploadRes = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
      const refPath = uploadRes.local_path || uploadRes.url || ''
      await propAPI.putRefImage(propId, refPath)
    } catch (e) {
      console.warn('[savePropRefImage] 保存参考图失败:', e.message)
    }
  }

  async function clearPropRefImage() {
    const form = editPropForm.value
    if (!form?.id) return
    try {
      await propAPI.putRefImage(form.id, null)
      form.ref_image = ''
      ElMessage.success('参考图已移除')
    } catch (e) {
      ElMessage.error('移除失败')
    }
  }

  async function doExtractPropFromImage() {
    const form = editPropForm.value
    if (!form?.id) return
    extractingPropDesc.value = true
    try {
      const res = await propAPI.extractFromImage(form.id)
      if (res?.description) {
        form.description = res.description
        ElMessage.success('已从图片提取道具描述')
      }
    } catch (e) {
      ElMessage.error(e.message || '提取失败，请检查道具是否已上传参考图片')
    } finally {
      extractingPropDesc.value = false
    }
  }

  async function submitEditProp() {
    if (!editPropForm.value?.id) return
    editPropSaving.value = true
    try {
      await propAPI.update(editPropForm.value.id, {
        name: editPropForm.value.name?.trim(),
        type: editPropForm.value.type || undefined,
        description: editPropForm.value.description || undefined,
        prompt: editPropForm.value.prompt || undefined,
        negative_prompt: (editPropForm.value.negative_prompt || '').trim() || null,
      })
      await savePropRefImageIfAny(editPropForm.value.id)
      await loadDrama()
      showEditProp.value = false
      ElMessage.success('道具已保存')
    } catch (e) {
      ElMessage.error(e.message || '保存失败')
    } finally {
      editPropSaving.value = false
    }
  }

  async function submitAddProp() {
    const name = (addPropForm.value.name || '').trim()
    if (!name || !store.dramaId) return
    addPropSaving.value = true
    try {
      await propAPI.create({
        drama_id: store.dramaId,
        episode_id: currentEpisodeId.value ?? undefined,
        name,
        type: addPropForm.value.type?.trim() || undefined,
        description: addPropForm.value.description?.trim() || undefined,
        prompt: addPropForm.value.prompt?.trim() || undefined
      })
      showAddProp.value = false
      await loadDrama()
      ElMessage.success('道具已添加')
    } catch (e) {
      ElMessage.error(e.message || '添加失败')
    } finally {
      addPropSaving.value = false
    }
  }

  function onClosePropDialog() {
    showEditProp.value = false
    stopPropPromptPoll()
    editPropPromptGenerating.value = false
    addPropRefImage.value = null
  }

  async function onDeleteProp(prop) {
    try {
      await ElMessageBox.confirm(
        `确定要删除道具「${(prop.name || '未命名').slice(0, 20)}」吗？此操作不可恢复。`,
        '删除确认',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      await propAPI.delete(prop.id)
      await loadDrama()
      ElMessage.success('道具已删除')
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e.message || '删除失败')
    }
  }

  async function onGeneratePropImage(prop) {
    prop.errorMsg = ''
    prop.error_msg = ''
    generatingPropIds.add(prop.id)
    try {
      const res = await propAPI.generateImage(prop.id, getAssetImageModel?.(), getSelectedStyle())
      const taskId = res?.task_id
      if (taskId) {
        const pollRes = await pollTask(taskId, () => loadDrama())
        if (pollRes?.status === 'failed') {
          prop.errorMsg = pollRes.error || '生成失败'
        } else {
          ElMessage.success('道具图片已生成')
        }
      } else {
        await loadDrama()
        await pollUntilResourceHasImage(() => {
          const list = store.drama?.props ?? store.currentEpisode?.props ?? []
          const p = list.find((x) => Number(x.id) === Number(prop.id))
          return !!(p && (p.image_url || p.local_path))
        })
        ElMessage.success('道具图片已生成')
      }
    } catch (e) {
      console.error(e)
      prop.errorMsg = e.message || '生成失败'
      ElMessage.error(e.message || '提交失败')
    } finally {
      generatingPropIds.delete(prop.id)
    }
  }

  // ── 道具库函数 ────────────────────────────────────────
  async function loadPropLibraryList() {
    propLibraryLoading.value = true
    try {
      const res = await propLibraryAPI.list({
        drama_id: dramaId.value,
        page: propLibraryPage.value,
        page_size: propLibraryPageSize.value,
        keyword: propLibraryKeyword.value || undefined
      })
      propLibraryList.value = res?.items ?? []
      const pagination = res?.pagination ?? {}
      propLibraryTotal.value = pagination.total ?? 0
      if (pagination.page != null) propLibraryPage.value = pagination.page
      if (pagination.page_size != null) propLibraryPageSize.value = pagination.page_size
    } catch (e) {
      propLibraryList.value = []
    } finally {
      propLibraryLoading.value = false
    }
  }

  function debouncedLoadPropLibrary() {
    if (propLibraryKeywordTimer) clearTimeout(propLibraryKeywordTimer)
    propLibraryKeywordTimer = setTimeout(() => {
      propLibraryPage.value = 1
      loadPropLibraryList()
    }, 300)
  }

  function openEditPropLibrary(item) {
    editPropLibraryForm.value = {
      id: item.id,
      name: item.name ?? '',
      category: item.category ?? '',
      description: item.description ?? '',
      tags: item.tags ?? ''
    }
    showEditPropLibrary.value = true
  }

  async function submitEditPropLibrary() {
    if (!editPropLibraryForm.value?.id) return
    editPropLibrarySaving.value = true
    try {
      await propLibraryAPI.update(editPropLibraryForm.value.id, {
        name: editPropLibraryForm.value.name,
        category: editPropLibraryForm.value.category || null,
        description: editPropLibraryForm.value.description || null,
        tags: editPropLibraryForm.value.tags || null
      })
      ElMessage.success('已保存')
      showEditPropLibrary.value = false
      loadPropLibraryList()
    } catch (e) {
      ElMessage.error(e.message || '保存失败')
    } finally {
      editPropLibrarySaving.value = false
    }
  }

  async function onDeletePropLibrary(item) {
    try {
      await ElMessageBox.confirm(
        `确定删除公共道具「${(item.name || '未命名').slice(0, 20)}」吗？`,
        '删除确认',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      await propLibraryAPI.delete(item.id)
      ElMessage.success('已删除')
      loadPropLibraryList()
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e.message || '删除失败')
    }
  }

  async function onAddPropToLibrary(prop) {
    if (!hasAssetImage(prop)) { ElMessage.warning('请先为该道具生成或上传图片'); return }
    addingPropToLibraryId.value = prop.id
    try {
      await propAPI.addToLibrary(prop.id, {})
      markAssetInLibrary(propMembership.dramaSourceIds, prop)
      ElMessage.success('已加入本剧道具库')
      if (showPropLibrary.value) loadPropLibraryList()
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingPropToLibraryId.value = null
    }
  }

  async function onAddPropToMaterialLibrary(prop) {
    if (!hasAssetImage(prop)) { ElMessage.warning('请先为该道具生成或上传图片'); return }
    addingPropToMaterialId.value = prop.id
    try {
      await propAPI.addToMaterialLibrary(prop.id)
      markAssetInLibrary(propMembership.materialSourceIds, prop)
      ElMessage.success('已加入全局素材库')
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingPropToMaterialId.value = null
    }
  }

  async function loadPropLibraryMembership() {
    await loadLibraryMembership({
      api: propLibraryAPI,
      sourceType: 'prop',
      assets: store.props || [],
      dramaId: dramaId.value,
      dramaSourceIds: propMembership.dramaSourceIds,
      materialSourceIds: propMembership.materialSourceIds,
    })
  }

  function isPropInLibrary(prop) {
    return hasAssetInLibrary(propMembership.dramaSourceIds, prop)
  }

  function isPropInMaterialLibrary(prop) {
    return hasAssetInLibrary(propMembership.materialSourceIds, prop)
  }

  async function onAddPropFromLibrary(item) {
    if (!store.dramaId || !currentEpisodeId.value) return
    addingPropFromLibraryId.value = item.id
    try {
      const existingProp = (store.props || []).find((p) => p.name === item.name)
      if (existingProp) {
        await propAPI.update(existingProp.id, {
          name: item.name || existingProp.name,
          type: item.type || existingProp.type || undefined,
          description: item.description || existingProp.description || undefined,
          prompt: item.prompt || existingProp.prompt || undefined,
          image_url: item.image_url || existingProp.image_url || undefined,
          local_path: item.local_path || existingProp.local_path || undefined,
        })
        ElMessage.success(`「${item.name || '道具'}」已更新到本集`)
      } else {
        await propAPI.create({
          drama_id: store.dramaId,
          episode_id: currentEpisodeId.value,
          name: item.name || '',
          type: item.type || undefined,
          description: item.description || undefined,
          prompt: item.prompt || undefined,
          image_url: item.image_url || undefined,
          local_path: item.local_path || undefined,
        })
        ElMessage.success(`「${item.name || '道具'}」已加入本集`)
      }
      await loadDrama()
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingPropFromLibraryId.value = null
    }
  }

  // ── 添加道具简单弹窗的参考图 extract ─────────────────
  async function doExtractFromRef2(type) {
    if (type !== 'addProp') return
    const refImage = addPropAddRefImage.value
    if (!refImage) return
    extractingPropAddDesc.value = true
    try {
      const entityName = addPropForm.value?.name || ''
      const res = await uploadAPI.extractDescriptionFromImage('prop', refImage.dataUrl, entityName)
      if (res?.description) {
        addPropForm.value.description = res.description
        ElMessage.success('已从参考图提取特征描述')
      }
    } catch (e) {
      ElMessage.error(e.message || '提取失败，请检查 AI 配置中是否有支持视觉的模型')
    } finally {
      extractingPropAddDesc.value = false
    }
  }

  return {
    // 弹窗状态
    showAddProp,
    addPropSaving,
    addPropForm,
    showEditProp,
    editPropForm,
    editPropSaving,
    editPropPromptGenerating,
    extractingPropDesc,
    addPropRefImage,
    addPropRefFileInput,
    addPropAddRefImage,
    addPropAddRefFileInput,
    extractingPropAddDesc,
    // 生成状态
    propsExtracting,
    generatingPropIds,
    // 库状态
    showPropLibrary,
    propLibraryList,
    propLibraryLoading,
    propLibraryPage,
    propLibraryPageSize,
    propLibraryTotal,
    propLibraryKeyword,
    showEditPropLibrary,
    editPropLibraryForm,
    editPropLibrarySaving,
    addingPropToLibraryId,
    addingPropToMaterialId,
    addingPropFromLibraryId,
    // 函数
    onExtractProps,
    stopPropPromptPoll,
    editProp,
    doGeneratePropPrompt,
    savePropRefImageIfAny,
    clearPropRefImage,
    doExtractPropFromImage,
    submitEditProp,
    submitAddProp,
    onClosePropDialog,
    onDeleteProp,
    onGeneratePropImage,
    loadPropLibraryMembership,
    isPropInLibrary,
    isPropInMaterialLibrary,
    loadPropLibraryList,
    debouncedLoadPropLibrary,
    openEditPropLibrary,
    submitEditPropLibrary,
    onDeletePropLibrary,
    onAddPropToLibrary,
    onAddPropToMaterialLibrary,
    onAddPropFromLibrary,
    doExtractFromRef2,
  }
}
