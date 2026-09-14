<template>
  <div class="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
</script>

<style>
* {
  box-sizing: border-box;
}
html, body, #app, .app {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  transition: background 0.25s, color 0.25s;
}

:focus-visible {
  outline: 2px solid var(--el-color-primary, #6d4ae8);
  outline-offset: 3px;
}

button:focus-visible,
a:focus-visible,
[role='button']:focus-visible,
.el-button:focus-visible,
.el-input__wrapper:has(input:focus-visible),
.el-textarea__inner:focus-visible {
  outline: 2px solid var(--el-color-primary, #6d4ae8);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  html:focus-within {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
