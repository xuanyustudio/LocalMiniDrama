import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { characterAPI } from '@/api/characters'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { dramaAPI } from '@/api/drama'
import { generationAPI } from '@/api/generation'
import { uploadAPI } from '@/api/upload'
import { useGenerationTaskStore, GEN_RESOURCE } from '@/stores/generationTaskStore'
import { buildExtractTaskMeta, isEpisodeExtractRunning } from '@/composables/useGenerationTaskSync'

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
 */
export function useCharacters(deps) {
  const { store, dramaId, currentEpisodeId, getSelectedStyle, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage } = deps
  const genStore = useGenerationTaskStore()

  function buildCharImageMeta(char) {
    const dramaTitle = store.drama?.title || ''
    const epNum = store.currentEpisode?.episode_number
    const epLabel = dramaTitle ? `${dramaTitle} · 第${epNum ?? ''}集` : `第${epNum ?? ''}集`
    return {
      dramaId: dramaId.value,
      episodeId: currentEpisodeId.value,
      dramaTitle,
      episodeNumber: epNum,
      resourceType: GEN_RESOURCE.CHAR_IMAGE,
      resourceId: char.id,
      label: `${epLabel} 角色图: ${char.name || char.id}`,
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
  /** 仅当前集「提取角色」进行中时为 true（按集隔离，切集不误显示 loading） */
  const charactersGenerating = computed(() =>
    isEpisodeExtractRunning(genStore, dramaId.value, currentEpisodeId.value, GEN_RESOURCE.EXTRACT_CHARACTERS)
  )
  const generatingCharIds = reactive(new Set())
  const sd2CertifyingId = ref(null)
  const showCharSd2Cert = ref(false)
  const charSd2CertPayload = ref(null)
  const sd2VoiceUploadingId = ref(null)

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
  let charLibraryKeywordTimer = null

  /** 角色库弹窗 Tab：library | drama | team */
  const charLibraryTab = ref('library')
  const dramaAllCharList = ref([])
  const dramaAllCharLoading = ref(false)
  const dramaAllCharPage = ref(1)
  const dramaAllCharPageSize = ref(20)
  const dramaAllCharTotal = ref(0)
  const dramaAllCharKeyword = ref('')
  let dramaAllCharKeywordTimer = null


  // ── 常量 ──────────────────────────────────────────────
  const CHAR_ROLE_LABEL = { main: '主角', supporting: '配角', minor: '次要角色' }
  function charRoleLabel(role) { return CHAR_ROLE_LABEL[role] || role || '' }

  // ── 核心函数 ──────────────────────────────────────────
  async function onGenerateCharacters() {
    if (!store.dramaId) return
    const epId = currentEpisodeId.value
    if (!epId) {
      ElMessage.warning('请先选择集次')
      return
    }
    const meta = buildExtractTaskMeta(store, dramaId.value, epId, GEN_RESOURCE.EXTRACT_CHARACTERS, '提取角色')
    genStore.markRunning(meta)
    try {
      const outline =
        (store.scriptContent || '').toString().trim() || undefined
      const res = await generationAPI.generateCharacters(store.dramaId, {
        episode_id: epId,
        outline: outline || undefined
      })
      const taskId = res?.task_id
      if (taskId) {
        await pollTask(taskId, () => loadDrama(), meta)
        ElMessage.success('角色生成完成')
      } else {
        await loadDrama()
      }
    } catch (e) {
      ElMessage.error(e.message || '生成失败')
    } finally {
      genStore.markDone(meta)
    }
  }

  function openAddCharacter() {
    editCharacterForm.value = {
      name: '',
      role: '',
      appearance: '',
      personality: '',
      description: '',
      polished_prompt: ''
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
          stages: form.stages ? form.stages.trim() || undefined : undefined
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
            description: form.description || undefined
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
    const meta = buildCharImageMeta(char)
    generatingCharIds.add(char.id)
    genStore.markRunning(meta)
    try {
      const res = await characterAPI.generateImage(char.id, undefined, getSelectedStyle())
      const taskId = res?.image_generation?.task_id ?? res?.task_id
      if (taskId) {
        const pollRes = await pollTask(taskId, () => loadDrama(), meta)
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
      genStore.markDone(meta)
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

  async function loadDramaAllCharList() {
    if (!dramaId.value) {
      dramaAllCharList.value = []
      dramaAllCharTotal.value = 0
      return
    }
    dramaAllCharLoading.value = true
    try {
      const res = await dramaAPI.getCharacters(dramaId.value)
      let list = Array.isArray(res) ? res : (res?.characters ?? res?.items ?? [])
      const kw = (dramaAllCharKeyword.value || '').trim().toLowerCase()
      if (kw) {
        list = list.filter((c) => {
          const name = (c.name || '').toLowerCase()
          const desc = (c.description || '').toLowerCase()
          const app = (c.appearance || '').toLowerCase()
          return name.includes(kw) || desc.includes(kw) || app.includes(kw)
        })
      }
      dramaAllCharTotal.value = list.length
      const start = (dramaAllCharPage.value - 1) * dramaAllCharPageSize.value
      dramaAllCharList.value = list.slice(start, start + dramaAllCharPageSize.value)
    } catch {
      dramaAllCharList.value = []
      dramaAllCharTotal.value = 0
    } finally {
      dramaAllCharLoading.value = false
    }
  }

  function debouncedLoadDramaAllCharList() {
    if (dramaAllCharKeywordTimer) clearTimeout(dramaAllCharKeywordTimer)
    dramaAllCharKeywordTimer = setTimeout(() => {
      dramaAllCharPage.value = 1
      loadDramaAllCharList()
    }, 300)
  }

  function onCharLibraryDialogOpen() {
    if (charLibraryTab.value === 'library') loadCharLibraryList()
    else if (charLibraryTab.value === 'drama') loadDramaAllCharList()
  }

  function onCharLibraryTabChange() {
    if (charLibraryTab.value === 'library') {
      charLibraryPage.value = 1
      loadCharLibraryList()
    } else if (charLibraryTab.value === 'drama') {
      dramaAllCharPage.value = 1
      loadDramaAllCharList()
    }
  }

  function charAddToEpisodeLoadingKey(scope, id) {
    return `${scope}-${id}`
  }

  function isCharAddToEpisodeLoading(scope, id) {
    return addingCharFromLibraryId.value === charAddToEpisodeLoadingKey(scope, id)
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
      ElMessage.success('已加入全局素材库')
    } catch (e) {
      ElMessage.error(e.message || '加入失败')
    } finally {
      addingCharToMaterialId.value = null
    }
  }

  async function addCharToEpisode(item, scope) {
    if (!store.dramaId) return
    if (!currentEpisodeId.value) {
      ElMessage.warning('请先选择本集')
      return
    }
    const loadingKey = charAddToEpisodeLoadingKey(scope, item.id)
    addingCharFromLibraryId.value = loadingKey
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
      const existingChar = newCharacters.find((c) => c.name === (item.name || '未命名'))
      if (existingChar) {
        existingChar.description = item.description || existingChar.description
        existingChar.appearance = item.appearance || existingChar.appearance
        existingChar.image_url = item.image_url || existingChar.image_url
        existingChar.local_path = item.local_path || existingChar.local_path
        if (item.role && !existingChar.role) existingChar.role = item.role
      } else {
        newCharacters.push({
          name: item.name || '未命名',
          role: item.role || undefined,
          description: item.description || undefined,
          appearance: item.appearance || undefined,
          personality: item.personality || undefined,
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

  function onAddCharFromLibrary(item) {
    return addCharToEpisode(item, 'library')
  }

  function onAddDramaCharToEpisode(item) {
    return addCharToEpisode(item, 'drama')
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

  async function onSd2CertifyCharacter(char) {
    if (!char?.id) return
    if (!hasAssetImage(char)) {
      ElMessage.warning('请先为该角色生成或上传图片')
      return
    }
    sd2CertifyingId.value = char.id
    try {
      await characterAPI.sd2Certify(char.id)
      await loadDrama()
      ElMessage.success('SD2 认证请求已提交')
    } catch (e) {
      const msg = e?.message || ''
      if (/已存在|已认证|already/i.test(msg)) {
        try {
          await characterAPI.sd2CertifyRefresh(char.id)
          await loadDrama()
          ElMessage.success('SD2 认证状态已刷新')
          return
        } catch (_) {
          // fall through
        }
      }
      ElMessage.error(msg || 'SD2 认证失败')
    } finally {
      sd2CertifyingId.value = null
    }
  }

  async function onSd2CertifyRefresh(char) {
    if (!char?.id) return
    sd2CertifyingId.value = char.id
    try {
      await characterAPI.sd2CertifyRefresh(char.id)
      await loadDrama()
      ElMessage.success('SD2 认证状态已刷新')
    } catch (e) {
      ElMessage.error(e?.message || '刷新失败')
    } finally {
      sd2CertifyingId.value = null
    }
  }

  function sd2ActionLabel(char) {
    const status = String(char?.seedance2_asset?.status || '').toLowerCase()
    if (status === 'active') return '查看认证'
    if (status === 'processing') return '刷新认证'
    if (status === 'failed') return '重新认证'
    return 'sd2认证'
  }

  async function onSd2PrimaryAction(char) {
    const status = String(char?.seedance2_asset?.status || '').toLowerCase()
    if (status === 'active') {
      openCharSd2CertDialog(char)
      return
    }
    if (status === 'processing') {
      await onSd2CertifyRefresh(char)
      return
    }
    await onSd2CertifyCharacter(char)
  }

  function openCharSd2CertDialog(char) {
    charSd2CertPayload.value = char?.seedance2_asset ? { ...char.seedance2_asset } : null
    showCharSd2Cert.value = true
  }

  function sd2VoiceActionLabel(char) {
    const status = String(char?.seedance2_voice_asset?.status || '').toLowerCase()
    if (status === 'active') return '音色参考'
    if (status === 'processing') return '刷新音色'
    if (status === 'failed') return '重新上传'
    return '上传音色'
  }

  async function onSd2VoicePrimaryAction(char) {
    const status = String(char?.seedance2_voice_asset?.status || '').toLowerCase()
    if (status === 'active') {
      ElMessage.info('音色参考已设置，将在 Seedance 2.0 模型中使用')
      return
    }
    if (status === 'processing' || status === 'stale') {
      await onSd2VoiceRefresh(char)
      return
    }
    // 触发文件选择上传
    await triggerSd2VoiceUpload(char)
  }

  // 专门用于“更换”：无论当前是否 active，都直接触发文件选择上传（覆盖）
  async function onSd2VoiceReplace(char) {
    await triggerSd2VoiceUpload(char)
  }

  async function onSd2VoiceRefresh(char) {
    if (!char?.id) return
    sd2VoiceUploadingId.value = char.id
    try {
      const res = await characterAPI.sd2VoiceRefresh(char.id)
      await loadDrama()
      ElMessage.success(res?.data?.message || '音色状态已刷新')
    } catch (e) {
      ElMessage.error(e?.message || '刷新失败')
    } finally {
      sd2VoiceUploadingId.value = null
    }
  }

  async function triggerSd2VoiceUpload(char) {
    if (!char?.id) return
    // 创建隐藏的 file input
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.onchange = async () => {
      const file = input.files && input.files[0]
      if (!file) return
      sd2VoiceUploadingId.value = char.id
      try {
        const res = await characterAPI.sd2VoiceUpload(char.id, file)
        ElMessage.success('Seedance 2.0 音色参考已上传')
        // 强制重新加载整个剧本数据，确保 seedance2_voice_asset 被正确解析并更新到 store
        await loadDrama()
      } catch (e) {
        ElMessage.error(e?.message || '音色上传失败')
      } finally {
        sd2VoiceUploadingId.value = null
      }
    }
    input.click()
  }

  // 播放 Seedance 2.0 音色参考（仅 active 状态）
  function playSd2Voice(char) {
    const url = char?.seedance2_voice_asset?.url
    if (!url) {
      ElMessage.warning('该角色暂无音色参考音频')
      return
    }
    try {
      // 统一使用相对 /static/...（与图片 assetImageUrl 一致），由当前页面 origin + Vite/后端代理或静态服务处理
      const audio = new Audio(url)
      audio.onerror = () => {
        // 常见原因：文件不在 static 根目录下（后端写盘路径与 express.static(storageRoot) 不一致）、404、格式不支持
        ElMessage.error('音频播放失败：文件可能不存在或路径不匹配，请尝试重新上传该音色参考')
      }
      audio.play().catch((err) => {
        ElMessage.error('音频播放失败，请检查文件或稍后重试')
      })
    } catch (e) {
      ElMessage.error('无法播放音频')
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
    sd2CertifyingId,
    showCharSd2Cert,
    charSd2CertPayload,
    sd2VoiceUploadingId,
    // 库状态
    showCharLibrary,
    charLibraryList,
    charLibraryLoading,
    charLibraryPage,
    charLibraryPageSize,
    charLibraryTotal,
    charLibraryKeyword,
    charLibraryTab,
    dramaAllCharList,
    dramaAllCharLoading,
    dramaAllCharPage,
    dramaAllCharPageSize,
    dramaAllCharTotal,
    dramaAllCharKeyword,







    showEditCharLibrary,
    editCharLibraryForm,
    editCharLibrarySaving,
    addingCharToLibraryId,
    addingCharToMaterialId,

    addingCharFromLibraryId,
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
    onSd2CertifyCharacter,
    onSd2CertifyRefresh,
    sd2ActionLabel,
    onSd2PrimaryAction,
    openCharSd2CertDialog,
    onSd2VoicePrimaryAction,
    onSd2VoiceReplace,
    sd2VoiceActionLabel,
    playSd2Voice,
    loadCharLibraryList,
    debouncedLoadCharLibrary,
    loadDramaAllCharList,
    debouncedLoadDramaAllCharList,


    onCharLibraryDialogOpen,
    onCharLibraryTabChange,
    isCharAddToEpisodeLoading,
    openEditCharLibrary,
    submitEditCharLibrary,
    onDeleteCharLibrary,
    onAddCharacterToLibrary,
    onAddCharacterToMaterialLibrary,


    onAddCharFromLibrary,
    onAddDramaCharToEpisode,

  }
}
