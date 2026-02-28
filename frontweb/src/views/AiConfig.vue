<template>
  <div class="ai-config">
    <header class="header">
      <div class="header-inner">
        <h1 class="logo" @click="goList">LocalMiniDrama.ai</h1>
        <span class="page-title">AI 配置</span>
        <el-button class="btn-back" @click="goList">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
    </header>

    <main class="main">
      <AIConfigContent />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import AIConfigContent from '@/components/AIConfigContent.vue'

const router = useRouter()

function goList() {
  router.push({ name: 'list' })
}
</script>

<style scoped>
.ai-config {
  min-height: 100vh;
  background: var(--bg-page);
}
.header {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  cursor: pointer;
  color: var(--text-bright);
}
.logo:hover {
  color: var(--el-color-primary);
}
.page-title {
  flex: 1;
  font-size: 16px;
  color: var(--text-muted);
}
.main {
  max-width: 1200px;
  margin: 24px auto;
  padding: 0 24px;
  background: var(--bg-card);
  border-radius: 8px;
  padding: 20px;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
</style>
