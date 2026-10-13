<template>
  <div class="canvas-floating-toolbar nodrag nopan">
    <span class="toolbar-label">快速新建</span>
    <el-button size="small" @click="create('storyboard')">分镜</el-button>
    <el-button size="small" @click="create('character')">角色</el-button>
    <el-button size="small" @click="create('scene')">场景</el-button>
    <el-button size="small" @click="create('prop')">道具</el-button>
    <el-button size="small" @click="create('episode')">集</el-button>
  </div>
</template>

<script setup>
import { useCanvasContext } from '@/composables/useCanvasContext'

const ctx = useCanvasContext()

function create(type) {
  ctx?.openCreateDialog?.(type)
}
</script>

<style scoped>
.canvas-floating-toolbar {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #3f3f46;
  background: rgba(24, 24, 27, 0.94);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  flex-wrap: wrap;
  max-width: calc(100% - 24px);
}
.toolbar-label {
  font-size: 11px;
  color: #71717a;
  margin-right: 4px;
  white-space: nowrap;
}
</style>
