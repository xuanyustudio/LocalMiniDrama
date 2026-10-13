<template>
  <div class="omni-at-wrap" ref="wrapRef">
    <div
      ref="editorRef"
      class="omni-at-editor"
      contenteditable="true"
      spellcheck="false"
      data-placeholder="输入 @ 选择素材；编辑区显示 @场景名 / @角色名，保存与提交仍为 @图片N"
      @input="onInput"
      @blur="onBlur"
      @keydown="onKeydown"
      @paste="onPaste"
      @compositionstart="composing = true"
      @compositionend="composing = false"
    />
    <teleport to="body">
      <div
        v-show="menuOpen"
        class="omni-at-menu"
        :style="menuStyle"
        role="listbox"
        @mousedown.prevent
      >
        <div v-if="!slots.length" class="omni-at-menu-empty">当前没有可用的参考图（请为场景 / 角色 / 物品选择带图素材）</div>
        <button
          v-for="s in slots"
          :key="s.index"
          type="button"
          class="omni-at-menu-item"
          role="option"
          @click="onPickSlot(s.index)"
        >
          <span class="omni-at-menu-thumb-wrap">
            <img v-if="s.thumbUrl" :src="s.thumbUrl" class="omni-at-menu-thumb" alt="" />
            <span v-else class="omni-at-menu-thumb-ph">{{ (s.name || '?')[0] }}</span>
          </span>
          <span class="omni-at-menu-meta">
            <span class="omni-at-menu-tag" :class="'omni-at-menu-tag--' + s.kind">{{ kindLabel(s.kind) }}</span>
            <span class="omni-at-menu-name">{{ s.name }}</span>
            <span class="omni-at-menu-at">{{ menuPrimaryAt(s) }}</span>
            <span class="omni-at-menu-at-sub">提交 {{ canonicalAt(s.index) }}</span>
          </span>
        </button>
      </div>
    </teleport>
    <div class="omni-at-footer">
      <el-tooltip content="复制为 @图片N 格式（与提交视频一致）" placement="top">
        <el-button type="default" text size="small" class="omni-at-copy-btn" @click="onCopyCanonical">
          <el-icon><DocumentCopy /></el-icon>
          复制提示词
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentCopy } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** { index: number, kind: 'scene'|'character'|'prop', name: string, thumbUrl: string }[] */
  slots: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'blur'])

const wrapRef = ref(null)
const editorRef = ref(null)
const menuOpen = ref(false)
const menuStyle = ref({ top: '0px', left: '0px' })
const composing = ref(false)

/** 'insert' at lone @ | 'replace' chip */
let menuMode = 'insert'
let insertAtOffset = 0
let replaceChipEl = null

let skipNextModelWatch = false

const CHIP_CLASS = 'omni-at-chip'

function kindLabel(kind) {
  if (kind === 'scene') return '场景'
  if (kind === 'character') return '角色'
  if (kind === 'prop') return '物品'
  return '参考'
}

function slotByIndex(index) {
  const list = props.slots || []
  return list.find((s) => Number(s.index) === Number(index))
}

function canonicalAt(index) {
  const n = Number(index)
  if (!Number.isFinite(n) || n < 1) return '@图片1'
  return `@图片${n}`
}

/** 编辑区展示用 @token；与存库/提交的 @图片N 一一对应 */
function makeDisplayAtToken(index) {
  const n = Number(index)
  const slot = slotByIndex(n)
  const name = slot && slot.name != null ? String(slot.name).trim() : ''
  if (!name) return canonicalAt(n)
  const list = props.slots || []
  const dup = list.filter((x) => String(x.name || '').trim() === name).length > 1
  if (!dup) return `@${name}`
  const prefix = slot.kind === 'scene' ? '场景' : slot.kind === 'prop' ? '物品' : '角色'
  return `@${prefix}·${name}`
}

function menuPrimaryAt(s) {
  return makeDisplayAtToken(s.index)
}

function applyPlainTextToEditor(el, text) {
  if (!el) return
  const raw = text == null ? '' : String(text)
  el.innerHTML = ''
  if (!raw) {
    el.appendChild(document.createTextNode(''))
    return
  }
  const re = /@图片(\d+)/g
  let last = 0
  let m
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) el.appendChild(document.createTextNode(raw.slice(last, m.index)))
    const span = document.createElement('span')
    span.className = CHIP_CLASS
    span.contentEditable = 'false'
    span.dataset.n = m[1]
    const disp = makeDisplayAtToken(m[1])
    span.textContent = disp
    span.setAttribute('role', 'button')
    span.setAttribute('tabindex', '0')
    span.setAttribute('aria-label', `${disp}（提交为 ${canonicalAt(m[1])}），点击可更换`)
    span.addEventListener('mousedown', onChipMouseDown)
    span.addEventListener('click', onChipClick)
    el.appendChild(span)
    last = m.index + m[0].length
  }
  if (last < raw.length) el.appendChild(document.createTextNode(raw.slice(last)))
}

/** 规范串：仅含 @图片N，供 v-model / 存库 / 提交视频 / 复制 */
function serializeEditor(el) {
  if (!el) return ''
  let out = ''
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue || ''
      return
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList?.contains(CHIP_CLASS)) {
        out += canonicalAt(node.dataset?.n)
        return
      }
      for (const c of node.childNodes) walk(c)
    }
  }
  walk(el)
  return out.replace(/\u00a0/g, ' ')
}

function chipCanonicalLength(node) {
  if (!node?.classList?.contains(CHIP_CLASS)) return 0
  return canonicalAt(node.dataset?.n).length
}

/** 光标在「规范串」中的偏移（与 serializeEditor 一致） */
function getCaretCanonicalOffset(el) {
  const win = el?.ownerDocument?.defaultView || window
  const sel = win.getSelection()
  if (!sel || sel.rangeCount === 0 || !el) return 0
  const range = sel.getRangeAt(0)
  const r = el.ownerDocument.createRange()
  r.selectNodeContents(el)
  r.setEnd(range.endContainer, range.endOffset)
  let len = 0
  function measure(n) {
    if (n.nodeType === Node.TEXT_NODE) len += (n.textContent || '').length
    else if (n.nodeType === Node.ELEMENT_NODE) {
      if (n.classList?.contains(CHIP_CLASS)) len += chipCanonicalLength(n)
      else n.childNodes.forEach(measure)
    }
  }
  const frag = r.cloneContents()
  frag.childNodes.forEach(measure)
  return len
}

function setCaretCanonicalOffset(el, target) {
  if (!el || target < 0) return
  const doc = el.ownerDocument
  const sel = (doc.defaultView || window).getSelection()
  const range = doc.createRange()
  let seen = 0
  let placed = false

  function walk(node) {
    if (placed) return
    if (node.nodeType === Node.TEXT_NODE) {
      const L = (node.nodeValue || '').length
      if (seen + L >= target) {
        range.setStart(node, Math.min(target - seen, L))
        range.collapse(true)
        placed = true
        return
      }
      seen += L
      return
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains(CHIP_CLASS)) {
      const L = chipCanonicalLength(node)
      if (seen + L >= target) {
        if (target <= seen) range.setStartBefore(node)
        else range.setStartAfter(node)
        range.collapse(true)
        placed = true
        return
      }
      seen += L
      return
    }
    for (const c of node.childNodes) walk(c)
  }

  for (const c of el.childNodes) walk(c)
  if (!placed) {
    range.selectNodeContents(el)
    range.collapse(false)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

function positionMenuNearRect(rect) {
  const pad = 4
  const w = 280
  const maxH = 320
  let top = rect.bottom + pad + window.scrollY
  let left = rect.left + window.scrollX
  const vw = window.innerWidth
  if (left + w > vw - 8) left = Math.max(8, vw - w - 8)
  if (top + maxH > window.innerHeight + window.scrollY - 8) {
    top = rect.top + window.scrollY - maxH - pad
  }
  menuStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${w}px`,
    maxHeight: `${maxH}px`,
  }
}

function positionMenuAtCaret() {
  const el = editorRef.value
  if (!el) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    const r = el.getBoundingClientRect()
    positionMenuNearRect({ left: r.left, top: r.top, bottom: r.top + 24, right: r.right })
    return
  }
  const range = sel.getRangeAt(0).cloneRange()
  range.collapse(true)
  const rects = range.getClientRects()
  const rect = rects.length ? rects[0] : range.getBoundingClientRect()
  positionMenuNearRect(rect)
}

function closeMenu() {
  menuOpen.value = false
  menuMode = 'insert'
  replaceChipEl = null
}

function maybeOpenAtMenu() {
  if (composing.value) return
  const el = editorRef.value
  if (!el) return
  const s = serializeEditor(el)
  const off = getCaretCanonicalOffset(el)
  if (off < 1 || s[off - 1] !== '@') return
  const before = s.slice(0, off)
  if (/@图片\d+$/.test(before)) return
  if (before.endsWith('@@')) return
  insertAtOffset = off
  menuMode = 'insert'
  replaceChipEl = null
  nextTick(() => {
    positionMenuAtCaret()
    menuOpen.value = true
  })
}

function onInput() {
  const el = editorRef.value
  if (!el) return
  const next = serializeEditor(el)
  skipNextModelWatch = true
  emit('update:modelValue', next)
  maybeOpenAtMenu()
}

function onBlur(e) {
  const rel = e.relatedTarget
  if (rel && rel.closest?.('.omni-at-menu')) return
  closeMenu()
  emit('blur', e)
}

function onKeydown(e) {
  if (e.key === 'Escape' && menuOpen.value) {
    e.preventDefault()
    closeMenu()
    return
  }
  if (menuOpen.value && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault()
  }
}

function onPaste(e) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') ?? ''
  try {
    document.execCommand('insertText', false, text)
  } catch (_) {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }
  onInput()
}

function onChipMouseDown(e) {
  e.preventDefault()
}

function onChipClick(e) {
  const chip = e.currentTarget
  if (!(chip instanceof HTMLElement) || !chip.classList.contains(CHIP_CLASS)) return
  e.preventDefault()
  e.stopPropagation()
  editorRef.value?.focus()
  menuMode = 'replace'
  replaceChipEl = chip
  const r = chip.getBoundingClientRect()
  positionMenuNearRect(r)
  menuOpen.value = true
}

function onPickSlot(index) {
  const el = editorRef.value
  if (!el) return
  if (menuMode === 'replace' && replaceChipEl) {
    replaceChipEl.dataset.n = String(index)
    const disp = makeDisplayAtToken(index)
    replaceChipEl.textContent = disp
    replaceChipEl.setAttribute('aria-label', `${disp}（提交为 ${canonicalAt(index)}），点击可更换`)
    const next = serializeEditor(el)
    skipNextModelWatch = true
    emit('update:modelValue', next)
    closeMenu()
    return
  }
  const s = serializeEditor(el)
  const at = Math.max(1, insertAtOffset)
  if (s[at - 1] !== '@') {
    closeMenu()
    return
  }
  const newS = s.slice(0, at - 1) + `@图片${index}` + s.slice(at)
  applyPlainTextToEditor(el, newS)
  const next = serializeEditor(el)
  skipNextModelWatch = true
  emit('update:modelValue', next)
  nextTick(() => {
    const pos = at - 1 + (`@图片${index}`).length
    setCaretCanonicalOffset(el, pos)
    el.focus()
  })
  closeMenu()
}

watch(
  () => props.modelValue,
  (v) => {
    if (skipNextModelWatch) {
      skipNextModelWatch = false
      return
    }
    const el = editorRef.value
    if (!el) return
    const next = v == null ? '' : String(v)
    const cur = serializeEditor(el)
    if (cur === next) return
    const hadFocus = document.activeElement === el
    applyPlainTextToEditor(el, next)
    if (hadFocus) {
      setCaretCanonicalOffset(el, next.length)
    }
  }
)

watch(
  () => props.slots,
  () => {
    const el = editorRef.value
    if (!el) return
    el.querySelectorAll(`.${CHIP_CLASS}`).forEach((chip) => {
      if (!(chip instanceof HTMLElement)) return
      const n = chip.dataset?.n
      if (n == null) return
      const disp = makeDisplayAtToken(n)
      chip.textContent = disp
      chip.setAttribute('aria-label', `${disp}（提交为 ${canonicalAt(n)}），点击可更换`)
    })
  },
  { deep: true }
)

function onDocClick(ev) {
  if (!menuOpen.value) return
  const t = ev.target
  if (wrapRef.value?.contains(t)) return
  if (t.closest?.('.omni-at-menu')) return
  closeMenu()
}

async function onCopyCanonical() {
  const el = editorRef.value
  const text = serializeEditor(el)
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制（@图片N 格式，与提交一致）')
  } catch (_) {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      ElMessage.success('已复制（@图片N 格式）')
    } catch (e2) {
      ElMessage.error(e2?.message || '复制失败')
    }
  }
}

onMounted(() => {
  const el = editorRef.value
  if (el) applyPlainTextToEditor(el, props.modelValue == null ? '' : String(props.modelValue))
  document.addEventListener('click', onDocClick, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
})
</script>

<style scoped>
.omni-at-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.omni-at-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 6px 2px 0;
  flex-shrink: 0;
}
.omni-at-copy-btn {
  color: #a78bfa !important;
}
.omni-at-copy-btn:hover {
  color: #c4b5fd !important;
}
html.light .omni-at-copy-btn {
  color: #6d28d9 !important;
}
.omni-at-editor {
  flex: 1;
  min-height: 220px;
  max-height: 520px;
  overflow-y: auto;
  padding: 8px 11px;
  font-size: 13px;
  line-height: 1.55;
  color: #e5e7eb;
  background: var(--omni-editor-bg, #141414);
  border: 1px solid #4c4d4f;
  border-radius: 4px;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
}
.omni-at-editor:focus {
  border-color: #a78bfa;
  box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.25) inset;
}
.omni-at-editor:empty::before {
  content: attr(data-placeholder);
  color: #6b7280;
  pointer-events: none;
}
:deep(.omni-at-chip) {
  display: inline-flex;
  align-items: center;
  vertical-align: baseline;
  margin: 0 1px;
  padding: 0 5px;
  border-radius: 4px;
  font-weight: 600;
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.22);
  border: 1px solid rgba(167, 139, 250, 0.45);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
:deep(.omni-at-chip:hover) {
  background: rgba(139, 92, 246, 0.38);
  border-color: #a78bfa;
}
html.light .omni-at-editor {
  color: #1f2937;
  background: var(--el-fill-color-blank, #fff);
  border-color: var(--el-border-color, #dcdfe6);
}
html.light .omni-at-editor:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.2) inset;
}
html.light :deep(.omni-at-chip) {
  color: #5b21b6;
  background: rgba(124, 58, 237, 0.12);
  border-color: rgba(124, 58, 237, 0.35);
}
html.light :deep(.omni-at-chip:hover) {
  background: rgba(124, 58, 237, 0.2);
}
</style>

<style>
.omni-at-menu {
  position: absolute;
  z-index: 5000;
  overflow-y: auto;
  padding: 8px;
  border-radius: 8px;
  background: #1e293b;
  border: 1px solid rgba(248, 250, 252, 0.18);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
html.light .omni-at-menu {
  background: #fff;
  border-color: #e2e8f0;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}
.omni-at-menu-empty {
  font-size: 12px;
  color: #94a3b8;
  padding: 8px 6px;
  max-width: 260px;
  line-height: 1.45;
}
html.light .omni-at-menu-empty {
  color: #64748b;
}
.omni-at-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0 0 6px;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #f1f5f9;
  cursor: pointer;
  text-align: left;
}
.omni-at-menu-item:last-child {
  margin-bottom: 0;
}
.omni-at-menu-item:hover {
  background: rgba(148, 163, 184, 0.15);
}
html.light .omni-at-menu-item {
  color: #0f172a;
}
html.light .omni-at-menu-item:hover {
  background: #f1f5f9;
}
.omni-at-menu-thumb-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
html.light .omni-at-menu-thumb-wrap {
  background: #f8fafc;
  border-color: #e2e8f0;
}
.omni-at-menu-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.omni-at-menu-thumb-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
}
.omni-at-menu-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.omni-at-menu-tag {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  width: fit-content;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}
.omni-at-menu-tag--scene {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
}
.omni-at-menu-tag--character {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}
.omni-at-menu-tag--prop {
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
}
html.light .omni-at-menu-tag {
  color: #475569;
  background: #e2e8f0;
}
html.light .omni-at-menu-tag--scene {
  color: #166534;
  background: #dcfce7;
}
html.light .omni-at-menu-tag--character {
  color: #1e40af;
  background: #dbeafe;
}
html.light .omni-at-menu-tag--prop {
  color: #92400e;
  background: #fef3c7;
}
.omni-at-menu-name {
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
html.light .omni-at-menu-name {
  color: #334155;
}
.omni-at-menu-at {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: #a78bfa;
}
.omni-at-menu-at-sub {
  font-size: 10px;
  font-family: ui-monospace, monospace;
  color: #94a3b8;
}
html.light .omni-at-menu-at {
  color: #6d28d9;
}
html.light .omni-at-menu-at-sub {
  color: #64748b;
}
</style>
