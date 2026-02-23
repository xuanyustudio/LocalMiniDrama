import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'lmd-theme'
const isDark = ref(localStorage.getItem(STORAGE_KEY) !== 'light')

function apply() {
  if (isDark.value) {
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  }
  localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
}

// 初始立即应用一次
apply()

watchEffect(apply)

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
  }
  return { isDark, toggle }
}
