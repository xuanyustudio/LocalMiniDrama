<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="canvas-context-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
      @mousedown.stop
      @contextmenu.prevent
    >
      <div class="ctx-title">在此添加</div>
      <button type="button" class="ctx-item" @click="pick('storyboard')">分镜</button>
      <button type="button" class="ctx-item" @click="pick('character')">角色</button>
      <button type="button" class="ctx-item" @click="pick('scene')">场景</button>
      <button type="button" class="ctx-item" @click="pick('prop')">道具</button>
      <div class="ctx-divider" />
      <button type="button" class="ctx-item" @click="pick('episode')">新集</button>
    </div>
    <div v-if="visible" class="canvas-context-backdrop" @mousedown="close" @contextmenu.prevent="close" />
  </Teleport>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
})

const emit = defineEmits(['select', 'close'])

function pick(type) {
  emit('select', type)
  emit('close')
}

function close() {
  emit('close')
}
</script>

<style scoped>
.canvas-context-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2999;
}
.canvas-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 140px;
  padding: 6px 0;
  border-radius: 8px;
  border: 1px solid #3f3f46;
  background: #18181b;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
.ctx-title {
  padding: 4px 12px 6px;
  font-size: 10px;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ctx-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #e4e4e7;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.ctx-item:hover {
  background: rgba(129, 140, 248, 0.15);
  color: #c7d2fe;
}
.ctx-divider {
  height: 1px;
  margin: 4px 0;
  background: #3f3f46;
}
</style>
