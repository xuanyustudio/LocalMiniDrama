<template>
  <div class="canvas-label-node">{{ data.label }}</div>
</template>

<script setup>
defineProps({
  data: { type: Object, required: true },
})
</script>

<style scoped>
.canvas-label-node {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #a1a1aa);
  letter-spacing: 0.02em;
  user-select: none;
  pointer-events: none;
}
</style>
