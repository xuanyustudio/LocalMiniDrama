import { ref, onMounted, onBeforeUnmount } from 'vue'

const NAV_AUTO_COLLAPSE_WIDTH = 960

/**
 * 左侧导航折叠/展开逻辑
 */
export function useNavigation() {
  const navCollapsed = ref(false)
  const storyboardMenuExpanded = ref(false)
  let _navAutoCollapsed = false

  function _syncNavCollapse() {
    const narrow = window.innerWidth < NAV_AUTO_COLLAPSE_WIDTH
    if (narrow && !_navAutoCollapsed && !navCollapsed.value) {
      _navAutoCollapsed = true
      navCollapsed.value = true
    } else if (!narrow && _navAutoCollapsed) {
      _navAutoCollapsed = false
      navCollapsed.value = false
    }
  }

  function toggleNav() {
    navCollapsed.value = !navCollapsed.value
    _navAutoCollapsed = false
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function scrollToAnchor(id) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  onMounted(() => {
    _syncNavCollapse()
    window.addEventListener('resize', _syncNavCollapse)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', _syncNavCollapse)
  })

  return {
    navCollapsed,
    storyboardMenuExpanded,
    toggleNav,
    scrollToTop,
    scrollToAnchor,
  }
}
