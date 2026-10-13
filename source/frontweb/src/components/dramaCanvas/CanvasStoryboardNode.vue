<template>
  <div class="canvas-node-stack">
    <div class="canvas-sb-node" :class="{ selected: selected, highlighted: data.highlighted, dimmed: data.dimmed, processing: isProcessing || isNodeBusy, focused: showPanel }">
    <Handle id="chain-in" type="target" :position="Position.Top" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
    <Handle id="chain-out" type="source" :position="Position.Bottom" />
      <CanvasNodeStatusOverlay :node-id="id" />
      <div class="head">
        <span class="num">#{{ data.storyboard?.storyboard_number ?? data.index }}</span>
        <span v-if="data.workflowGroup?.title" class="wf-badge">{{ data.workflowGroup.title }}</span>
        <span v-if="data.storyboard?.segment_title" class="seg">{{ data.storyboard.segment_title }}</span>
      <span v-if="data.storyboard?.creation_mode === 'universal'" class="mode-badge">全能</span>
      </div>
      <div class="title">{{ data.storyboard?.title || '分镜' }}</div>
      <div class="chips">
        <span v-if="data.storyboard?.shot_type">{{ data.storyboard.shot_type }}</span>
        <span v-if="data.storyboard?.duration">{{ data.storyboard.duration }}s</span>
        <span :class="'st-' + (data.storyboard?.status || 'pending')">{{ statusLabel }}</span>
      </div>
      <div class="hint">{{ showPanel ? '下方可编辑与生成' : '单击展开操作 · 双击进列表' }}</div>
    </div>
    <CanvasStoryboardPanel
      v-if="showPanel"
      :storyboard="data.storyboard"
      :episode-id="data.episodeId"
      :node-id="id"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useCanvasContext } from '@/composables/useCanvasContext'
import CanvasStoryboardPanel from './CanvasStoryboardPanel.vue'
import CanvasNodeStatusOverlay from './CanvasNodeStatusOverlay.vue'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const ctx = useCanvasContext()
const showPanel = computed(() => ctx?.focusedNodeId?.value === props.id)

const statusLabel = computed(() => {
  const s = props.data.storyboard?.status || 'pending'
  const map = { pending: '待处理', processing: '生成中', completed: '已完成', failed: '失败' }
  return map[s] || s
})

const isProcessing = computed(() => props.data.storyboard?.status === 'processing')

const isNodeBusy = computed(() => {
  const map = ctx?.nodeStatus?.map
  return map ? !!map[props.id] : false
})
</script>

<style scoped>
.canvas-node-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.canvas-sb-node {
  position: relative;
  width: 200px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(129, 140, 248, 0.35);
  background: var(--bg-card, #18181b);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.canvas-sb-node:hover,
.canvas-sb-node.selected,
.canvas-sb-node.focused {
  border-color: #818cf8;
  box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.35), 0 8px 24px rgba(0, 0, 0, 0.35);
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.num {
  font-size: 12px;
  font-weight: 700;
  color: #a5b4fc;
}
.wf-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.18);
  color: #fcd34d;
  max-width: 88px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.seg {
  font-size: 10px;
  color: #71717a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mode-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(167, 139, 250, 0.2);
  color: #c4b5fd;
}
.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-bright, #fafafa);
  margin-bottom: 6px;
  line-height: 1.35;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.chips span {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #a1a1aa;
}
.st-completed { color: #34d399 !important; background: rgba(52, 211, 153, 0.12) !important; }
.st-processing { color: #60a5fa !important; }
.st-failed { color: #f87171 !important; }
.processing {
  animation: sb-pulse 1.4s ease-in-out infinite;
  border-color: #60a5fa;
}
.highlighted {
  box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.75), 0 8px 28px rgba(99, 102, 241, 0.25);
}
.dimmed {
  opacity: 0.28;
}
@keyframes sb-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.35); }
  50% { box-shadow: 0 0 0 6px rgba(96, 165, 250, 0.08); }
}
.hint {
  font-size: 10px;
  color: #52525b;
}
</style>
