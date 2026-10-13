<template>
  <div
    class="canvas-add-node"
    :class="'kind-' + data.assetType"
    @click.stop="onClick"
  >
    <span class="add-icon">+</span>
    <span class="add-label">{{ data.label || defaultLabel }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCanvasContext } from '@/composables/useCanvasContext'

const props = defineProps({
  data: { type: Object, required: true },
})

const ctx = useCanvasContext()

const defaultLabel = computed(() => {
  const map = { character: '新建角色', scene: '新建场景', prop: '新建道具', storyboard: '新建分镜' }
  return map[props.data.assetType] || '新建'
})

function onClick() {
  ctx?.openCreateDialog?.(props.data.assetType)
}
</script>

<style scoped>
.canvas-add-node {
  width: 176px;
  padding: 14px 12px;
  border-radius: 10px;
  border: 1px dashed rgba(129, 140, 248, 0.45);
  background: rgba(24, 24, 27, 0.65);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: border-color 0.15s, background 0.15s;
}
.canvas-add-node:hover {
  border-color: #818cf8;
  background: rgba(129, 140, 248, 0.12);
}
.add-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(129, 140, 248, 0.2);
  color: #a5b4fc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}
.add-label {
  font-size: 12px;
  color: #a1a1aa;
}
.kind-character { border-color: rgba(52, 211, 153, 0.4); }
.kind-character .add-icon { background: rgba(52, 211, 153, 0.18); color: #6ee7b7; }
.kind-scene { border-color: rgba(96, 165, 250, 0.4); }
.kind-scene .add-icon { background: rgba(96, 165, 250, 0.18); color: #93c5fd; }
.kind-prop { border-color: rgba(251, 191, 36, 0.4); }
.kind-prop .add-icon { background: rgba(251, 191, 36, 0.18); color: #fcd34d; }
.kind-storyboard { border-color: rgba(167, 139, 250, 0.45); width: 200px; }
</style>
