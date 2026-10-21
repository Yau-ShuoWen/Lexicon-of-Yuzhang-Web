<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Grid, House, Monitor, Notebook, User } from '@element-plus/icons-vue'
import { isAdminUser } from '../../utils/auth.js'

// 路由
const route = useRoute()

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/${path}`
const shouldShowNav = computed(() => !route.meta?.hideNav)

// 当前站点形态：dict / study / dev / ysw，决定渲染哪一套导航
const navType = computed(() => {
  if (route.path.includes('/dict/')) return 'dict'
  if (route.path.includes('/study/')) return 'study'
  if (route.path.includes('/ysw/')) return 'ysw'
  if (route.path.includes('/dev/')) return 'dev'
  else return 'normal'
})

// ===== 导航滑动指示条 =====
// 同时只渲染一套导航，共用同一个 ref
const navRef = ref(null)
const indicator = ref({x: 0, width: 0})

// 读取当前激活链接的位置，驱动指示条滑动
function updateIndicator() {
  if (!navRef.value) return
  const active = navRef.value.querySelector('.nav-link.router-link-active')
  if (!active) {
    indicator.value = {x: 0, width: 0}
    return
  }
  indicator.value = {
    x: active.offsetLeft,
    width: active.offsetWidth,
  }
}

const currentUser = ref(null)
const loadCurrentUser = () => {
  try {
    const raw = localStorage.getItem('auth-user')
    currentUser.value = raw ? JSON.parse(raw) : null
  } catch {
    currentUser.value = null
  }
}
const isAdmin = computed(() => isAdminUser(currentUser.value))
const isEditing = ref(false)
let normalViewportHeight = 0

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

onMounted(() => {
  loadCurrentUser()
  normalViewportHeight = viewportHeight()
  isEditing.value = isTextEntry(document.activeElement)
  // 等 DOM 渲染完成后再定位指示条，避免首屏位置错误
  nextTick(updateIndicator)
  // 窗口尺寸变化（含字体加载完成后宽度变化）时重新对齐
  window.addEventListener('resize', updateIndicator)
  window.addEventListener('resize', handleViewportResize)
  window.visualViewport?.addEventListener('resize', handleViewportResize)
  document.addEventListener('focusin', handleFocusIn)
  document.addEventListener('focusout', handleFocusOut)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateIndicator)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIndicator)
  window.removeEventListener('resize', handleViewportResize)
  window.visualViewport?.removeEventListener('resize', handleViewportResize)
  document.removeEventListener('focusin', handleFocusIn)
  document.removeEventListener('focusout', handleFocusOut)
})

// 路由切换后重新对齐指示条
watch(route, async () => {
  await nextTick()
  updateIndicator()
})
</script>

<template>
  <nav ref="navRef" v-if="shouldShowNav && navType === 'dict'" class="main-nav" :class="{ 'keyboard-hidden': isEditing }">
    <span class="nav-indicator" :style="{ transform: `translateX(${indicator.x}px)`, width: `${indicator.width}px` }"/>
    <router-link :to="getPath(`dict/home`)" class="nav-link">
      <span v-formatted-text="$t('nav.search')"/>
      <span class="nav-icon nav-icon--asset nav-icon--search" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`dict/pinyin`)" class="nav-link">
      <span v-formatted-text="$t('nav.pinyin')"/>
      <span class="nav-icon nav-icon--asset nav-icon--pinyin" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`dict/about`)" class="nav-link">
      <span v-formatted-text="$t('nav.about')"/>
      <span class="nav-icon nav-icon--asset nav-icon--about" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`study/me`)" class="nav-link">
      <span v-formatted-text="$t('nav.study')"/>
      <span class="nav-icon nav-icon--asset nav-icon--study" aria-hidden="true"/>
    </router-link>
    <router-link v-if="isAdmin" :to="getPath(`dev`)" class="nav-link">
      <span v-formatted-text="$t('nav.developer')"/>
      <Monitor class="nav-icon" aria-hidden="true"/>
    </router-link>
  </nav>

  <nav ref="navRef" v-if="shouldShowNav && navType === 'study'" class="main-nav" :class="{ 'keyboard-hidden': isEditing }">
    <span class="nav-indicator" :style="{ transform: `translateX(${indicator.x}px)`, width: `${indicator.width}px` }"/>
    <router-link :to="getPath(`study/me`)" class="nav-link">
      <span v-formatted-text="$t('nav.start_study')"/>
      <span class="nav-icon nav-icon--asset nav-icon--study" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`study/profile`)" class="nav-link">
      <span v-formatted-text="$t('nav.profile_center')"/>
      <User class="nav-icon" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`dict/home`)" class="nav-link">
      <span v-formatted-text="$t('nav.dictionary')"/>
      <span class="nav-icon nav-icon--asset nav-icon--search" aria-hidden="true"/>
    </router-link>
  </nav>

  <nav ref="navRef" v-if="shouldShowNav && navType === 'dev'" class="main-nav" :class="{ 'keyboard-hidden': isEditing }">
    <span class="nav-indicator" :style="{ transform: `translateX(${indicator.x}px)`, width: `${indicator.width}px` }"/>
    <router-link :to="getPath(`dev/home`)" class="nav-link">
      <span v-formatted-text="$t('nav.developer_home')"/>
      <Monitor class="nav-icon" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`home`)" class="nav-link">
      <span v-formatted-text="$t('nav.dictionary')"/>
      <span class="nav-icon nav-icon--asset nav-icon--search" aria-hidden="true"/>
    </router-link>
  </nav>

  <nav ref="navRef" v-if="shouldShowNav && navType === 'ysw'" class="main-nav" :class="{ 'keyboard-hidden': isEditing }">
    <span class="nav-indicator" :style="{ transform: `translateX(${indicator.x}px)`, width: `${indicator.width}px` }"/>
    <router-link :to="{ name: 'YswHome', params: { language: language } }" class="nav-link">
      <span v-formatted-text="$t('nav.ysw_home')"/>
      <House class="nav-icon" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`ysw/alphabet`)" class="nav-link">
      <span v-formatted-text="$t('personal.alphabet_table.title_short')"/>
      <Grid class="nav-icon" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`ysw/diary`)" class="nav-link">
      <span v-formatted-text="$t('nav.diary')"/>
      <Notebook class="nav-icon" aria-hidden="true"/>
    </router-link>
    <router-link :to="getPath(`home`)" class="nav-link">
      <span v-formatted-text="$t('nav.dictionary')"/>
      <span class="nav-icon nav-icon--asset nav-icon--search" aria-hidden="true"/>
    </router-link>
  </nav>

  <div v-if="shouldShowNav" class="nav-fade" :class="{ 'keyboard-hidden': isEditing }" aria-hidden="true"></div>
</template>

<style scoped>
/* 平面导航：用细边框、轻阴影和稍深的选中色区分层级。 */
.main-nav {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: calc(100vw - 24px);
  padding: 4px;
  user-select: none;
  -webkit-user-select: none;
  overflow-x: auto;
  scrollbar-width: none;
  background: #f5faf5;
  border: 1px solid #cbdccd;
  border-radius: 17px;
  box-shadow: 0 2px 6px rgba(37, 84, 45, 0.05),
    0 12px 28px rgba(37, 84, 45, 0.11);
}

.main-nav::-webkit-scrollbar {
  display: none;
}

.nav-link {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  color: #4b5c50;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.02em;

  padding: 10px 16px;
  border-radius: 13px;
  white-space: nowrap;

  transition: color 0.3s ease;
}

.nav-icon {
  order: 1;
  width: 17px;
  height: 17px;
  flex: none;
}

.nav-icon--asset {
  background: currentColor;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.nav-icon--search {
  -webkit-mask-image: url('../../assets/icons/search.svg');
  mask-image: url('../../assets/icons/search.svg');
}

.nav-icon--pinyin {
  -webkit-mask-image: url('../../assets/icons/settings/pinyin.svg');
  mask-image: url('../../assets/icons/settings/pinyin.svg');
}

.nav-icon--about {
  -webkit-mask-image: url('../../assets/icons/about.svg');
  mask-image: url('../../assets/icons/about.svg');
}

.nav-icon--study {
  -webkit-mask-image: url('../../assets/icons/nav-study.svg');
  mask-image: url('../../assets/icons/nav-study.svg');
  transform: scale(1.2);
}

.nav-link:hover {
  color: #1c5924;
}

.nav-link.router-link-active {
  color: #1c5924;
  font-weight: 650;
}

.nav-link.router-link-active:hover {
  color: #1c5924;
}

/* 沿用原有的位置计算和滑动缓动，只替换指示块的外观。 */
.nav-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  border-radius: 13px;
  background: #c7e4ca;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, width;
}

/* 用页面底色淡化导航附近的内容，保留清晰轮廓。 */
.nav-fade {
  position: fixed;
  z-index: 990;
  top: 0;
  right: 0;
  left: 0;
  height: 104px;
  pointer-events: none;
  background: var(--app-bg-color);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.82) 0%, rgba(0, 0, 0, 0.64) 48%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.82) 0%, rgba(0, 0, 0, 0.64) 48%, transparent 100%);
}

@media (max-width: 768px) {
  .keyboard-hidden {
    visibility: hidden;
  }

  .main-nav {
    top: auto;
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    width: calc(100vw - 20px);
    max-width: 440px;
    justify-content: space-around;
  }

  .nav-link {
    flex: 1;
    flex-direction: column;
    gap: 4px;
    padding: 7px 4px 6px;
    text-align: center;
    font-size: 11px;
    line-height: 1.2;
  }

  .nav-icon {
    order: -1;
    width: 23px;
    height: 23px;
  }

  .nav-fade {
    top: auto;
    bottom: 0;
    height: calc(90px + env(safe-area-inset-bottom, 0px));
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.64) 52%, rgba(0, 0, 0, 0.82) 100%);
    mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.64) 52%, rgba(0, 0, 0, 0.82) 100%);
  }
}
</style>
