<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Grid, House, Monitor, Notebook, Setting, User } from '@element-plus/icons-vue'
import { isAdminUser } from '../../utils/auth.js'

const route = useRoute()
const router = useRouter()
const ready = ref(false)
const moreOpen = ref(false)
const navContainer = ref(null)
const currentUser = ref(null)
const isEditing = ref(false)
let normalViewportHeight = 0

const language = computed(() => route.params.language || 'sc')
const dialect = computed(() => route.params.dialect || 'lac')
const pathTo = (path) => `/${language.value}/${dialect.value}/${path}`
const shouldShowNav = computed(() => !route.meta?.hideNav)
const isAdmin = computed(() => isAdminUser(currentUser.value))

// 开发者和作者博客沿用各自的导航；统一导航只负责进入这两个区域。
const navMode = computed(() => {
  if (route.path.includes('/dev/')) return 'developer'
  if (route.path.includes('/ysw/')) return 'blog'
  return 'main'
})

const navItems = computed(() => {
  if (navMode.value === 'developer') return [
    { id: 'developer-home', label: 'nav.developer_home', to: pathTo('dev/home'), icon: Monitor },
    { id: 'dictionary', label: 'nav.dictionary', to: pathTo('dict/home'), asset: 'search' },
  ]
  if (navMode.value === 'blog') return [
    { id: 'blog-home', label: 'nav.ysw_home', to: pathTo('ysw/home'), icon: House },
    { id: 'alphabet', label: 'personal.alphabet_table.title_short', to: pathTo('ysw/alphabet'), icon: Grid },
    { id: 'diary', label: 'nav.diary', to: pathTo('ysw/diary'), icon: Notebook },
    { id: 'dictionary', label: 'nav.dictionary', to: pathTo('dict/home'), asset: 'search' },
  ]
  return [
    { id: 'search', label: 'nav.search', to: pathTo('dict/home'), asset: 'search' },
    { id: 'pinyin', label: 'nav.pinyin', to: pathTo('dict/pinyin'), asset: 'pinyin' },
    { id: 'study', label: 'nav.study', to: pathTo('study/me'), asset: 'study' },
    { id: 'more', label: 'nav.more' },
  ]
})

const routeTab = computed(() => {
  const path = route.path
  if (navMode.value === 'developer') return path.endsWith('/dev/home') ? 'developer-home' : ''
  if (navMode.value === 'blog') {
    if (path.includes('/ysw/alphabet')) return 'alphabet'
    if (path.includes('/ysw/diary')) return 'diary'
    return path.endsWith('/ysw/home') ? 'blog-home' : ''
  }
  if (path.includes('/dict/pinyin')) return 'pinyin'
  if (path.includes('/study/') && !path.includes('/study/profile')) return 'study'
  if (path.includes('/dict/') && !path.includes('/dict/settings') && !path.includes('/dict/about')) return 'search'
  return 'more'
})

const selectedTab = computed(() => navMode.value === 'main' && moreOpen.value ? 'more' : routeTab.value)
const selectedIndex = computed(() => navItems.value.findIndex(item => item.id === selectedTab.value))
const selectedMoreItem = computed(() => {
  const path = route.path
  if (path.includes('/study/profile')) return 'profile'
  if (path.includes('/dict/settings')) return 'settings'
  if (path.includes('/dict/about')) return 'about'
  return ''
})
const moreItems = computed(() => [
  { id: 'profile', label: 'nav.profile_center', to: pathTo('study/profile'), icon: User },
  { id: 'settings', label: 'nav.settings', to: pathTo('dict/settings'), icon: Setting },
  { id: 'about', label: 'nav.about', to: pathTo('dict/about'), asset: 'about' },
  ...(isAdmin.value ? [{ id: 'developer', label: 'nav.developer', to: pathTo('dev/home'), icon: Monitor }] : []),
  { id: 'blog', label: 'nav.author_blog', to: pathTo('ysw/home'), icon: House },
])

function loadCurrentUser() {
  try {
    const raw = localStorage.getItem('auth-user')
    currentUser.value = raw ? JSON.parse(raw) : null
  } catch {
    currentUser.value = null
  }
}

function selectMoreItem(path) {
  // 同一路由不会触发路由监听，直接收起面板即可。
  if (route.path === path) moreOpen.value = false
}

function closeOnOutsideClick(event) {
  if (moreOpen.value && !navContainer.value?.contains(event.target)) moreOpen.value = false
}

function closeOnEscape(event) {
  if (event.key === 'Escape') moreOpen.value = false
}

function viewportHeight() {
  return window.visualViewport?.height ?? window.innerHeight
}

function isTextEntry(target) {
  if (!(target instanceof Element)) return false
  const field = target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
  if (!field) return false
  if (field.matches('textarea, [contenteditable="true"], [contenteditable=""]')) return true
  return !['button', 'checkbox', 'radio', 'file', 'hidden', 'range', 'color', 'submit', 'reset'].includes(field.type)
}

function handleFocusIn(event) {
  if (!isEditing.value) normalViewportHeight = viewportHeight()
  isEditing.value = isTextEntry(event.target)
  if (isEditing.value) moreOpen.value = false
}

function handleFocusOut() {
  requestAnimationFrame(() => {
    isEditing.value = isTextEntry(document.activeElement)
    if (!isEditing.value) normalViewportHeight = viewportHeight()
  })
}

function handleViewportResize() {
  const height = viewportHeight()
  if (!isTextEntry(document.activeElement)) {
    normalViewportHeight = height
    isEditing.value = false
  } else if (normalViewportHeight - height > 120) {
    isEditing.value = true
  } else if (normalViewportHeight - height < 60) {
    isEditing.value = false
  }
}

watch(() => route.fullPath, () => {
  // 路由更新后再关闭面板，避免跨区域跳转前滑块退回原位置。
  moreOpen.value = false
  loadCurrentUser()
})

onMounted(async () => {
  loadCurrentUser()
  normalViewportHeight = viewportHeight()
  isEditing.value = isTextEntry(document.activeElement)
  window.addEventListener('storage', loadCurrentUser)
  window.addEventListener('resize', handleViewportResize)
  window.visualViewport?.addEventListener('resize', handleViewportResize)
  document.addEventListener('focusin', handleFocusIn)
  document.addEventListener('focusout', handleFocusOut)
  document.addEventListener('pointerdown', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
  await router.isReady()
  ready.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', loadCurrentUser)
  window.removeEventListener('resize', handleViewportResize)
  window.visualViewport?.removeEventListener('resize', handleViewportResize)
  document.removeEventListener('focusin', handleFocusIn)
  document.removeEventListener('focusout', handleFocusOut)
  document.removeEventListener('pointerdown', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <div v-if="ready && shouldShowNav" ref="navContainer" class="nav-container" :class="{ 'keyboard-hidden': isEditing }">
    <nav :key="navMode" class="main-nav" :class="{ 'main-nav--two': navItems.length === 2 }" :aria-label="$t('nav.main_navigation')">
      <span v-if="selectedIndex >= 0" class="nav-indicator" :style="{ transform: `translateX(${selectedIndex * 100}%)` }" aria-hidden="true" />
      <template v-for="item in navItems" :key="item.id">
        <button v-if="item.id === 'more'" type="button" class="nav-link" :class="{ 'nav-link--active': selectedTab === item.id }" :aria-expanded="moreOpen" aria-controls="main-nav-more" @click="moreOpen = !moreOpen">
          <span v-formatted-text="$t(item.label)" />
          <svg class="nav-icon nav-icon--more" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M4 5h16M4 12h16M4 19h16" />
          </svg>
        </button>
        <router-link v-else :to="item.to" class="nav-link" :class="{ 'nav-link--active': selectedTab === item.id }" :aria-current="routeTab === item.id ? 'page' : undefined" @click="moreOpen = false">
          <span v-formatted-text="$t(item.label)" />
          <span v-if="item.asset" class="nav-icon nav-icon--asset" :class="`nav-icon--${item.asset}`" aria-hidden="true" />
          <component :is="item.icon" v-else class="nav-icon" aria-hidden="true" />
        </router-link>
      </template>
    </nav>

    <section v-if="navMode === 'main' && moreOpen" id="main-nav-more" class="more-panel" :aria-label="$t('nav.more')">
      <div class="more-grid">
        <router-link v-for="item in moreItems" :key="item.id" :to="item.to" class="more-item" :class="{ 'more-item--active': selectedMoreItem === item.id }" :aria-current="selectedMoreItem === item.id ? 'page' : undefined" @click="selectMoreItem(item.to)">
          <span v-if="item.asset === 'about'" class="more-icon more-icon--about" aria-hidden="true" />
          <component :is="item.icon" v-else class="more-icon" aria-hidden="true" />
          <span>{{ $t(item.label) }}</span>
        </router-link>
      </div>
    </section>
  </div>
  <div v-if="ready && shouldShowNav" class="nav-fade" :class="{ 'keyboard-hidden': isEditing }" aria-hidden="true" />
</template>

<style scoped>
.nav-container {
  position: fixed;
  z-index: 1000;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100vw - 24px);
}

.main-nav {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  box-sizing: border-box;
  width: 100%;
  padding: 4px;
  border: 1px solid #cbdccd;
  border-radius: 17px;
  background: #f5faf5;
  box-shadow: 0 2px 6px rgba(37, 84, 45, .05), 0 12px 28px rgba(37, 84, 45, .11);
}
.main-nav--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.nav-link {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  padding: 10px 16px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: #4b5c50;
  font: inherit;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: .02em;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: color .2s ease;
}
.nav-link:hover, .nav-link--active { color: #1c5924; }
.nav-link--active { font-weight: 650; }

.nav-icon { order: 1; width: 17px; height: 17px; flex: none; }
.nav-icon--more { width: 19px; height: 19px; }
.nav-icon--asset { background: currentColor; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
.nav-icon--search { -webkit-mask-image: url('../../assets/icons/search.svg'); mask-image: url('../../assets/icons/search.svg'); }
.nav-icon--pinyin { -webkit-mask-image: url('../../assets/icons/settings/pinyin.svg'); mask-image: url('../../assets/icons/settings/pinyin.svg'); }
.nav-icon--study { -webkit-mask-image: url('../../assets/icons/nav-study.svg'); mask-image: url('../../assets/icons/nav-study.svg'); transform: scale(1.2); }

.nav-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 5px;
  width: calc((100% - 10px) / 4);
  border-radius: 13px;
  background: #c7e4ca;
  pointer-events: none;
  transition: transform .35s cubic-bezier(.22, 1, .36, 1);
}
.main-nav--two .nav-indicator { width: calc((100% - 10px) / 2); }

.more-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  box-sizing: border-box;
  width: 100%;
  padding: 15px 16px;
  border: 1px solid #cbdccd;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(37, 84, 45, .13);
}
.more-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
.more-item { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 64px; padding: 4px 2px; border-radius: 12px; color: #4b5c50; font-size: 16px; text-align: center; text-decoration: none; }
.more-item:hover, .more-item--active { background: #e7f1e8; color: #1c5924; }
.more-icon { width: 23px; height: 23px; }
.more-icon--about { display: block; background: currentColor; -webkit-mask: url('../../assets/icons/about.svg') center / contain no-repeat; mask: url('../../assets/icons/about.svg') center / contain no-repeat; }

.nav-fade {
  position: fixed;
  z-index: 990;
  top: 0;
  right: 0;
  left: 0;
  height: 104px;
  pointer-events: none;
  background: var(--app-bg-color);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, .82) 0%, rgba(0, 0, 0, .64) 48%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, .82) 0%, rgba(0, 0, 0, .64) 48%, transparent 100%);
}

@media (max-width: 768px) {
  .keyboard-hidden { visibility: hidden; }
  .nav-container { top: auto; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); width: calc(100vw - 20px); max-width: 440px; }
  .nav-link { flex-direction: column; gap: 4px; padding: 7px 4px 6px; text-align: center; font-size: 11px; }
  .nav-icon { order: -1; width: 23px; height: 23px; }
  .nav-icon--more { width: 25px; height: 25px; }
  .more-panel { top: auto; bottom: calc(100% + 8px); }
  .nav-fade { top: auto; bottom: 0; height: calc(90px + env(safe-area-inset-bottom, 0px)); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, .64) 52%, rgba(0, 0, 0, .82) 100%); mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, .64) 52%, rgba(0, 0, 0, .82) 100%); }
}
</style>
