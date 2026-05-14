import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { characterAPI } from '@/api/characters'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { dramaAPI } from '@/api/drama'
import { generationAPI } from '@/api/generation'
import { uploadAPI } from '@/api/upload'
import { createLibraryMembershipState, hasAssetInLibrary, loadLibraryMembership, markAssetInLibrary } from './libraryMembership'

/**
 * 角色管理 Composable
 * @param {object} deps - 共享依赖
 * @param {object} deps.store - Pinia store
 * @param {import('vue').ComputedRef} deps.dramaId
 * @param {import('vue').ComputedRef} deps.currentEpisodeId
 * @param {Function} deps.getSelectedStyle - 获取当前生成风格
 * @param {Function} deps.loadDrama - 重新加载剧集数据
 * @param {Function} deps.pollTask - 轮询异步任务
 * @param {Function} deps.pollUntilResourceHasImage - 等待资源有图片
 * @param {Function} deps.hasAssetImage - 判断资源是否有图片
 * @param {Function} [deps.getAssetImageModel] - 本集配置的资产生图模型 id（非空时与资产负面词一并传给后端）
 */
export function useCharacters(deps) {
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

  // ── 角色弹窗状态 ─────────────────────────────────────
  const showEditCharacter = ref(false)
  const editCharacterForm = ref(null)
  const editCharacterSaving = ref(false)
  const editCharacterPromptGenerating = ref(false)
  const extractingCharAppearance = ref(false)
  const extractingAnchors = ref(false)
  const addCharRefImage = ref(null)   // { dataUrl, filename }
  const addCharRefFileInput = ref(null)
  let editCharacterPollTimer = null

  // ── 角色生成状态 ──────────────────────────────────────
  const charactersGenerating = ref(false)
  const generatingCharIds = reactive(new Set())

  // ── 角色库状态 ────────────────────────────────────────
  const showCharLibrary = ref(false)
  const charLibraryList = ref([])
  const charLibraryLoading = ref(false)
  const charLibraryPage = ref(1)
  const charLibraryPageSize = ref(20)
  const charLibraryTotal = ref(0)
  const charLibraryKeyword = ref('')
  const showEditCharLibrary = ref(false)
  const editCharLibraryForm = ref(null)
  const editCharLibrarySaving = ref(false)
  const addingCharToLibraryId = ref(null)
  const addingCharToMaterialId = ref(null)
  const addingCharFromLibraryId = ref(null)
  const sd2CertifyingId = ref(null)
  const showCharSd2Cert = ref(false)
  const charSd2CertPayload = ref(null)
  const charMembership = createLibraryMembershipState()
  let charLibraryKeywordTimer = null

  // ── 常量 ──────────────────────────────────────────────
  const CHAR_ROLE_LABEL = { main: '主角', supporting: '配角', minor: '次要角色' }
  function charRoleLabel(role) { return CHAR_ROLE_LABEL[role] || role || '' }

  // ── 核心函数 ──────────────────────────────────────────
  async function onGenerateCharacters() {
    if (!store.dramaId) return
    charactersGenerating.value = true
    try {
      const outline =
        (store.scriptContent || '').toString().trim() || undefined
      const res = await generationAPI.generateCharacters(store.dramaId, {
        episode_id: store.currentEpisode?.id ?? undefined,
        outline: outline || undefined
      })
      const taskId = res?.task_id
      if (taskId) {
        await pollTask(taskId, () => loadDrama())
        ElMessage.success('角色生成完成')
      } else {
        await loadDrama()
      }
    } catch (e) {
      ElMessage.error(e.message || '生成失败')
    } finally {
      charactersGenerating.value = false
    }
  }

  function openAddCharacter() {
    editCharacterForm.value = {
      name: '',
      role: '',
      appearance: '',
      personality: '',
      description: '',
      polished_prompt: '',
      negative_prompt: '',
    }
    showEditCharacter.value = true
  }

  function stopCharacterPromptPoll() {
    if (editCharacterPollTimer) {
      clearInterval(editCharacterPollTimer)
      editCharacterPollTimer = null
    }
  }

  function editCharacter(char) {
    stopCharacterPromptPoll()
    editCharacterForm.value = {
      id: char.id,
      name: char.name || '',
      role: char.role || '',
      appearance: char.appearance || '',
      personality: char.personality || '',
      description: char.description || '',
      polished_prompt: char.polished_prompt || '',
      image_url: char.image_url || '',
      local_path: char.local_path || '',
      ref_image: char.ref_image || '',
      identity_anchors: char.identity_anchors || '',
      stages: char.stages ? (typeof char.stages === 'string' ? char.stages : JSON.stringify(char.stages, null, 2)) : '',
      negative_prompt: char.negative_prompt || '',
    }
    showEditCharacter.value = true
    if (!char.polished_prompt && char.id && (char.appearance || char.description)) {
      editCharacterPromptGenerating.value = true
      let elapsed = 0
      editCharacterPollTimer = setInterval(async () => {
        elapsed += 3
        try {
          const res = await characterAPI.get(char.id)
          const prompt = res?.character?.polished_prompt
          if (prompt) {
            if (editCharacterForm.value?.id === char.id) {
              editCharacterForm.value.polished_prompt = prompt
            }
            stopCharacterPromptPoll()
            editCharacterPromptGenerating.value = false
          } else if (elapsed >= 60) {
            stopCharacterPromptPoll()
            editCharacterPromptGenerating.value = false
          }
        } catch (_) {
          stopCharacterPromptPoll()
          editCharacterPromptGenerating.value = false
        }
      }, 3000)
    }
  }

  async function saveCharRefImageIfAny(characterId) {
    const refImg = addCharRefImage.value
    if (!refImg || !characterId) return
    try {
      const file = dataUrlToFile(refImg.dataUrl, refImg.filename || 'reference.png')
      const uploadRes = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
      const refPath = uploadRes.local_path || uploadRes.url || ''
      await characterAPI.putRefImage(characterId, refPath)
    } catch (e) {
      console.warn('[saveCharRefImage] 保存参考图失败:', e.message)
    }
  }

  async function submitEditCharacter() {
    const form = editCharacterForm.value
    if (!form?.name?.trim() || !store.dramaId) return
    editCharacterSaving.value = true
    try {
      if (form.id) {
        await characterAPI.update(form.id, {
          name: form.name.trim(),
          role: form.role || undefined,
          appearance: form.appearance || undefined,
          personality: form.personality || undefined,
          description: form.description || undefined,
          polished_prompt: form.polished_prompt || undefined,
          stages: form.stages ? form.stages.trim() || undefined : undefined,
          negative_prompt: (form.negative_prompt || '').trim() || null,
        })
        await saveCharRefImageIfAny(form.id)
        ElMessage.success('角色已保存')
      } else {
        const existing = (store.drama?.characters || []).map((c) => ({
          id: c.id,
          name: c.name || '',
          role: c.role || undefined,
          description: c.description || undefined,
          personality: c.personality || undefined,
          appearance: c.appearance || undefined,
          image_url: c.image_url || undefined,
          local_path: c.local_path || undefined
        }))
        await dramaAPI.saveCharacters(store.dramaId, {
          characters: [...existing, {
            name: form.name.trim(),
            role: form.role || undefined,
            appearance: form.appearance || undefined,
            personality: form.personality || undefined,
            description: form.description || undefined,
            negative_prompt: (form.negative_prompt || '').trim() || null,
          }],
          episode_id: currentEpisodeId.value ?? undefined
        })
        await loadDrama()
        if (addCharRefImage.value) {
          const newChar = (store.drama?.characters || []).find(c => c.name === form.name.trim())
          if (newChar?.id) await saveCharRefImageIfAny(newChar.id)
        }
        ElMessage.success('角色已添加')
      }
      await loadDrama()
      showEditCharacter.value = false
    } catch (e) {
      ElMessage.error(e.message || (form.id ? '保存失败' : '添加失败'))
    } finally {
      editCharacterSaving.value = false
    }
  }

  async function doGenerateCharacterPrompt() {
    const form = editCharacterForm.value
    if (!form?.id) return
    editCharacterPromptGenerating.value = true
    try {
      const res = await characterAPI.generatePrompt(form.id)
      if (res?.polished_prompt) {
        form.polished_prompt = res.polished_prompt
        ElMessage.success('提示词已生成')
        await loadDrama()
      }
    } catch (e) {
      ElMessage.error(e.message || '生成提示词失败')
    } finally {
      editCharacterPromptGenerating.value = false
    }
  }

  async function doExtractCharFromImage() {
    const form = editCharacterForm.value
    if (!form?.id) return
    extractingCharAppearance.value = true
    try {
      const res = await characterAPI.extractFromImage(form.id)
      if (res?.appearance) {
        form.appearance = res.appearance
        ElMessage.success('已从图片提取外貌描述')
      }
    } catch (e) {
      ElMessage.error(e.message || '提取失败，请检查角色是否已上传参考图片')
    } finally {
      extractingCharAppearance.value = false
    }
  }

  async function clearCharRefImage() {
    const form = editCharacterForm.value
    if (!form?.id) return
    try {
      await characterAPI.putRefImage(form.id, null)
      form.ref_image = ''
      ElMessage.success('参考图已移除')
    } catch (e) {
      ElMessage.error('移除失败')
    }
  }

  function onCloseCharDialog() {
    showEditCharacter.value = false
    stopCharacterPromptPoll()
    editCharacterPromptGenerating.value = false
    addCharRefImage.value = null
  }

  async function onDeleteCharacter(char) {
    try {
      await ElMessageBox.confirm(
        `确定要删除角色「${(char.name || '未命名').slice(0, 20)}」吗？此操作不可恢复。`,
        '删除确认',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      await characterAPI.delete(char.id)
      await loadDrama()
      ElMessage.success('角色已删除')
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e.message || '删除失败')
    }
  }

  async function onGenerateCharacterImage(char) {
    char.errorMsg = ''
    char.error_msg = ''
    generatingCharIds.add(char.id)
    try {
      const res = await characterAPI.generateImage(char.id, getAssetImageModel?.(), getSelectedStyle())
      const taskId = res?.image_generation?.task_id ?? res?.task_id
      if (taskId) {
        const pollRes = await pollTask(taskId, () => loadDrama())
        if (pollRes?.status === 'failed') {
          char.errorMsg = pollRes.error || '生成失败'
        } else {
          ElMessage.success('角色图片已生成')
        }
      } else {
        await loadDrama()
        await pollUntilResourceHasImage(() => {
          const list = store.drama?.characters ?? store.currentEpisode?.characters ?? []
          const c = list.find((x) => Number(x.id) === Number(char.id))
          return !!(c && (c.image_url || c.local_path))
        })
        ElMessage.success('角色图片已生成')
      }
    } catch (e) {
      console.error(e)
      char.errorMsg = e.message || '生成失败'
      ElMessage.error(e.message || '提交失败')
    } finally {
      generatingCharIds.delete(char.id)
    }
  }

  // ── 角色库函数 ────────────────────────────────────────
  async function loadCharLibraryList() {
    charLibraryLoading.value = true
    try {
      const res = await characterLibraryAPI.list({
        drama_id: dramaId.value,
        page: charLibraryPage.value,
        page_size: charLibraryPageSize.value,
        keyword: charLibraryKeyword.value || undefined
      })
      charLibraryList.value = res?.items ?? []
      const pagination = res?.pagination ?? {}
      charLibraryTotal.value = pagination.total ?? 0
      if (pagination.page != null) charLibraryPage.value = pagination.page
      if (pagination.page_size != null) charLibraryPageSize.value = pagination.page_size
    } catch (e) {
      charLibraryList.value = []
    } finally {
      charLibraryLoading.value = false
    }
  }

  function debouncedLoadCharLibrary() {
    if (charLibraryKeywordTimer) clearTimeout(charLibraryKeywordTimer)
    charLibraryKeywordTimer = setTimeout(() => {
      charLibraryPage.value = 1
      loadCharLibraryList()
    }, 300)
  }

  function openEditCharLibrary(item) {
    editCharLibraryForm.value = {
      id: item.id,
      name: item.name ?? '',
      category: item.category ?? '',
      description: item.description ?? '',
      tags: item.tags ?? ''
    }
    showEditCharLibrary.value = true
  }

  async function submitEditCharLibrary() {
    if (!editCharLibraryForm.value?.id) return
    editCharLibrarySaving.value = true
    try {
      await characterLibraryAPI.update(editCharLibraryForm.value.id, {
        name: editCharLibraryForm.value.name,
        category: editCharLibraryForm.value.category || null,
        description: editCharLibraryForm.value.description || null,
        tags: editCharLibraryForm.value.tags || null
      })
      ElMessage.success('已保存')
      showEditCharLibrary.value = false
      loadCharLibraryList()
    } catch (e) {
      ElMessage.error(e.message || '保存失败')
    } finally {
      editCharLibrarySaving.value = false
    }
  }

  async function onDeleteCharLibrary(item) {
    try {
      await ElMessageBox.confirm(
        `确定删除公共角色「${(item.name || '未命名').slice(0, 20)}」吗？`,
        '删除确认',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      await characterLibraryAPI.delete(item.id)
      ElMessage.success('已删除')
      loadCharLibraryList()
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e.message || '删除失败')
    }
  }

  async function onAddCharacterToLibrary(char) {
    if (!hasAssetImage(char)) { ElMessage.warning('请先为该角色生成或上传图片'); return }
    addingCharToLibraryId.value = char.id
    try {
      await characterAPI.addToLibrary(char.id, {})
      markAssetInLibrary(charMembership.dramaSourceIds, char)
      ElMessage.success('已加入本剧角色库')
      if (showCharLibrary.value) loadCharLibraryList()
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingCharToLibraryId.value = null
    }
  }

  async function onAddCharacterToMaterialLibrary(char) {
    if (!hasAssetImage(char)) { ElMessage.warning('请先为该角色生成或上传图片'); return }
    addingCharToMaterialId.value = char.id
    try {
      await characterAPI.addToMaterialLibrary(char.id)
      markAssetInLibrary(charMembership.materialSourceIds, char)
      ElMessage.success('已加入全局素材库')
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingCharToMaterialId.value = null
    }
  }

  function charSd2TagType(char) {
    const s = char?.seedance2_asset?.status
    if (s === 'active') return 'success'
    if (s === 'failed') return 'danger'
    if (s === 'processing') return 'info'
    return 'warning'
  }

  function charSd2TagText(char) {
    const s = char?.seedance2_asset?.status
    if (s === 'active') return '已 SD2 认证'
    if (s === 'failed') return 'SD2 认证失败'
    if (s === 'processing') return 'SD2 处理中'
    return '未 SD2 认证'
  }

  async function onSd2CertifyCharacter(char) {
    if (!hasAssetImage(char)) { ElMessage.warning('请先为该角色生成或上传图片'); return }
    sd2CertifyingId.value = char.id
    try {
      const res = await characterAPI.sd2Certify(char.id)
      const asset = res?.seedance2_asset
      if (asset?.status === 'active') {
        ElMessage.success('SD2 素材认证已完成')
      } else if (asset?.poll_timed_out) {
        ElMessage.success('已提交认证，即梦素材库仍在处理中，可稍后「刷新认证状态」')
      } else {
        ElMessage.success(res?.message || '认证状态已更新')
      }
      await loadDrama()
    } catch (e) {
      ElMessage.error(e.message || '认证失败')
    } finally {
      sd2CertifyingId.value = null
    }
  }

  async function onSd2CertifyRefresh(char) {
    sd2CertifyingId.value = char.id
    try {
      await characterAPI.sd2CertifyRefresh(char.id)
      ElMessage.success('认证状态已刷新')
      await loadDrama()
    } catch (e) {
      ElMessage.error(e.message || '刷新失败')
    } finally {
      sd2CertifyingId.value = null
    }
  }

  function openCharSd2CertDialog(char) {
    charSd2CertPayload.value = char.seedance2_asset ? { ...char.seedance2_asset } : null
    showCharSd2Cert.value = true
  }

  async function loadCharLibraryMembership() {
    await loadLibraryMembership({
      api: characterLibraryAPI,
      sourceType: 'character',
      assets: store.characters || [],
      dramaId: dramaId.value,
      dramaSourceIds: charMembership.dramaSourceIds,
      materialSourceIds: charMembership.materialSourceIds,
    })
  }

  function isCharInLibrary(char) {
    return hasAssetInLibrary(charMembership.dramaSourceIds, char)
  }

  function isCharInMaterialLibrary(char) {
    return hasAssetInLibrary(charMembership.materialSourceIds, char)
  }

  async function onAddCharFromLibrary(item) {
    if (!store.dramaId) return
    addingCharFromLibraryId.value = item.id
    try {
      const existing = (store.characters || []).map((c) => ({
        id: c.id,
        name: c.name || '',
        role: c.role || undefined,
        appearance: c.appearance || undefined,
        personality: c.personality || undefined,
        description: c.description || undefined,
        image_url: c.image_url || undefined,
        local_path: c.local_path || undefined,
      }))
      const newCharacters = [...existing]
      const existingChar = newCharacters.find(c => c.name === (item.name || '未命名'))
      if (existingChar) {
        existingChar.description = item.description || existingChar.description
        existingChar.appearance = item.appearance || existingChar.appearance
        existingChar.image_url = item.image_url || existingChar.image_url
        existingChar.local_path = item.local_path || existingChar.local_path
      } else {
        newCharacters.push({
          name: item.name || '未命名',
          description: item.description || undefined,
          appearance: item.appearance || undefined,
          image_url: item.image_url || undefined,
          local_path: item.local_path || undefined,
        })
      }
      await dramaAPI.saveCharacters(store.dramaId, {
        characters: newCharacters,
        episode_id: currentEpisodeId.value ?? undefined,
      })
      await loadDrama()
      ElMessage.success(`「${item.name || '角色'}」已加入本集`)
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingCharFromLibraryId.value = null
    }
  }

  async function extractIdentityAnchors() {
    const form = editCharacterForm.value
    if (!form?.id) return
    if (!form.appearance) {
      ElMessage.warning('请先填写角色外貌描述')
      return
    }
    extractingAnchors.value = true
    try {
      await characterAPI.extractAnchors(form.id)
      ElMessage.success('视觉锚点提炼已启动，请稍后查看')
      // 轮询等待锚点写入
      let elapsed = 0
      const timer = setInterval(async () => {
        elapsed += 3
        try {
          const res = await characterAPI.get(form.id)
          const anchors = res?.character?.identity_anchors
          if (anchors && editCharacterForm.value?.id === form.id) {
            editCharacterForm.value.identity_anchors = anchors
            clearInterval(timer)
            extractingAnchors.value = false
          } else if (elapsed >= 60) {
            clearInterval(timer)
            extractingAnchors.value = false
          }
        } catch (_) {
          clearInterval(timer)
          extractingAnchors.value = false
        }
      }, 3000)
    } catch (e) {
      ElMessage.error(e.message || '提炼失败')
      extractingAnchors.value = false
    }
  }

  return {
    // 弹窗状态
    showEditCharacter,
    editCharacterForm,
    editCharacterSaving,
    editCharacterPromptGenerating,
    extractingCharAppearance,
    extractingAnchors,
    addCharRefImage,
    addCharRefFileInput,
    // 生成状态
    charactersGenerating,
    generatingCharIds,
    // 库状态
    showCharLibrary,
    charLibraryList,
    charLibraryLoading,
    charLibraryPage,
    charLibraryPageSize,
    charLibraryTotal,
    charLibraryKeyword,
    showEditCharLibrary,
    editCharLibraryForm,
    editCharLibrarySaving,
    addingCharToLibraryId,
    addingCharToMaterialId,
    addingCharFromLibraryId,
    sd2CertifyingId,
    showCharSd2Cert,
    charSd2CertPayload,
    charSd2TagType,
    charSd2TagText,
    // 函数
    charRoleLabel,
    onGenerateCharacters,
    openAddCharacter,
    stopCharacterPromptPoll,
    editCharacter,
    saveCharRefImageIfAny,
    submitEditCharacter,
    doGenerateCharacterPrompt,
    doExtractCharFromImage,
    extractIdentityAnchors,
    clearCharRefImage,
    onCloseCharDialog,
    onDeleteCharacter,
    onGenerateCharacterImage,
    loadCharLibraryMembership,
    isCharInLibrary,
    isCharInMaterialLibrary,
    loadCharLibraryList,
    debouncedLoadCharLibrary,
    openEditCharLibrary,
    submitEditCharLibrary,
    onDeleteCharLibrary,
    onAddCharacterToLibrary,
    onAddCharacterToMaterialLibrary,
    onSd2CertifyCharacter,
    onSd2CertifyRefresh,
    openCharSd2CertDialog,
    onAddCharFromLibrary,
  }
}
