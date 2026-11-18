<template>
  <div ref="viewHost" :style="{minHeight: retainedHeight}">
    <nav v-if="isBlog" ref="navElement" class="ysw-nav" :class="`ysw-nav--${navMode}`" :aria-label="$t('nav.ysw_navigation')">
      <router-link class="ysw-logo" :to="base + '/home'" :aria-label="$t('nav.ysw_home')"><img :src="siteLogo" alt="" /></router-link>
      <router-link class="ysw-brand" :to="base + '/home'" :class="{active: route.path === base + '/home'}"><span class="ysw-brand-mark">𝕐</span><span class="ysw-brand-text">{{ $t('nav.ysw_home') }}</span></router-link>
      <div class="ysw-links">
        <router-link v-for="item in items" :key="item.path" :to="base + '/' + item.path" class="ysw-link" :class="{active: route.path.startsWith(base + '/' + item.path)}" :aria-label="$t(item.label)" :title="$t(item.label)">
          <Notebook v-if="item.path === 'diary'" aria-hidden="true" /><span v-else class="ysw-icon" :class="`ysw-icon--${item.path}`" aria-hidden="true" /><span class="ysw-link-text">{{ $t(item.label) }}</span>
        </router-link>
      </div>
      <router-link class="ysw-dictionary" :to="dictionaryPath">
        <span>{{ $t('nav.dialect_dictionary') }}</span>
        <span class="ysw-external-icon" aria-hidden="true" />
      </router-link>
      <button class="ysw-menu-button" type="button" :aria-label="$t('nav.more')" :aria-expanded="menuOpen" aria-controls="ysw-menu" @click="menuOpen = !menuOpen"><span /><span /><span /></button>
      <div v-if="menuOpen" id="ysw-menu" class="ysw-menu">
        <router-link :to="base + '/home'" :class="{active: route.path === base + '/home'}" @click="menuOpen = false"><span class="ysw-brand-mark" aria-hidden="true">𝕐</span>{{ $t('nav.ysw_home') }}</router-link>
        <router-link v-for="item in items" :key="item.path" :to="base + '/' + item.path" :class="{active: route.path.startsWith(base + '/' + item.path)}" @click="menuOpen = false"><Notebook v-if="item.path === 'diary'" aria-hidden="true" /><span v-else class="ysw-icon" :class="`ysw-icon--${item.path}`" aria-hidden="true" />{{ $t(item.label) }}</router-link>
        <router-link :to="dictionaryPath" @click="menuOpen = false"><span class="ysw-external-icon" aria-hidden="true" />{{ $t('nav.dialect_dictionary') }}</router-link>
      </div>
    </nav>
    <router-view v-slot="{ Component }">
      <KeepAlive include="SearchResult">
        <component :is="Component" :key="pinyinSchemeRevision" />
      </KeepAlive>
    </router-view>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { pinyinSchemeRevision } from '../../utils/accountSettings.js'
import siteLogo from '../../assets/images/logov2/yuzhangci2-transparent.svg'
import { Notebook } from '@element-plus/icons-vue'

const route = useRoute()
const isBlog = computed(() => route.path.includes('/ysw/'))
const base = computed(() => `/${route.params.language}/${route.params.dialect}/ysw`)
const dictionaryPath = computed(() => `/${route.params.language}/${route.params.dialect}/dict/home`)
const items = [
  { path: 'alphabet', label: 'nav.alphabet' },
  { path: 'diary', label: 'nav.diary' },
  { path: 'catchphrase', label: 'nav.catchphrase' },
  { path: 'sketch', label: 'nav.sketch' },
  { path: 'meme', label: 'nav.meme' },
  { path: 'columns', label: 'nav.columns' }
]
const viewHost = ref(null)
const navElement = ref(null)
const menuOpen = ref(false)
const navMode = ref('full')
const retainedHeight = ref('')
let resizeObserver
let measureFrame = 0
let measureRevision = 0

function requiredWidth(nav) {
  const style = getComputedStyle(nav)
  const links = nav.querySelector('.ysw-links')
  const linkStyle = getComputedStyle(links)
  const itemsWidth = [...links.children].reduce((sum, item) => sum + item.getBoundingClientRect().width, 0)
  const gaps = (links.children.length - 1) * parseFloat(linkStyle.columnGap || linkStyle.gap || 0)
  const fixed = ['.ysw-logo', '.ysw-brand', '.ysw-dictionary'].reduce((sum, selector) => sum + nav.querySelector(selector).getBoundingClientRect().width, 0)
  return fixed + itemsWidth + gaps + 3 * parseFloat(style.columnGap || style.gap || 0)
    + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
}

async function measureNav() {
  const revision = ++measureRevision
  const nav = navElement.value
  if (!nav) return
  navMode.value = 'full'
  await nextTick()
  if (revision !== measureRevision || !navElement.value) return
  if (requiredWidth(nav) <= nav.clientWidth + 1) return
  navMode.value = 'compact'
  await nextTick()
  if (revision !== measureRevision || !navElement.value) return
  if (requiredWidth(nav) > nav.clientWidth + 1) { navMode.value = 'menu'; menuOpen.value = false }
}

function scheduleMeasure() {
  cancelAnimationFrame(measureFrame)
  measureFrame = requestAnimationFrame(measureNav)
}

function closeMenu(event) {
  if (event.key === 'Escape' || (event.type === 'pointerdown' && !navElement.value?.contains(event.target))) menuOpen.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', closeMenu)
  document.addEventListener('keydown', closeMenu)
  if (navElement.value) {
    resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(navElement.value)
    document.fonts?.ready.then(scheduleMeasure)
    scheduleMeasure()
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeMenu)
  document.removeEventListener('keydown', closeMenu)
  resizeObserver?.disconnect()
  cancelAnimationFrame(measureFrame)
})

watch(pinyinSchemeRevision, async () => {
  const scrollY = window.scrollY
  retainedHeight.value = `${viewHost.value?.offsetHeight || 0}px`
  await nextTick()
  window.scrollTo({top: scrollY, behavior: 'instant'})
})

watch(() => route.fullPath, () => { retainedHeight.value = ''; menuOpen.value = false })
watch(() => route.params.language, scheduleMeasure)
</script>

<style scoped>
.ysw-nav { position: sticky; z-index: 100; top: 0; display: flex; align-items: center; gap: 26px; height: 64px; padding: 0 32px; border-bottom: 1px solid #dce5dc; background: var(--color-background); box-shadow: 0 3px 10px rgba(24, 51, 31, .09); }
.ysw-logo { display: inline-flex; flex: none; }
.ysw-logo img { width: 25px; height: 25px; }
.ysw-brand { display: inline-flex; align-items: center; gap: 5px; flex: none; color: #287442; font-size: inherit; font-weight: 500; text-decoration: none; }
.ysw-brand.active { font-weight: 750; }
.ysw-brand-mark { display: inline-grid; place-items: center; width: 20px; height: 20px; font-size: 18px; line-height: 1; }
.ysw-links { display: flex; align-items: center; gap: 38px; flex: 1; min-width: 0; overflow: hidden; }
.ysw-link { display: inline-flex; align-items: center; gap: 8px; flex: none; padding: 16px 0; color: var(--color-text); text-decoration: none; white-space: nowrap; }
.ysw-link:hover, .ysw-link.active { color: #287442; }
.ysw-link.active { font-weight: 750; }
.ysw-link svg, .ysw-icon { width: 18px; height: 18px; flex: none; }
.ysw-icon { background: currentColor; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
.ysw-icon--alphabet { -webkit-mask-image: url('../../assets/icons/字母.svg'); mask-image: url('../../assets/icons/字母.svg'); }
.ysw-icon--catchphrase { -webkit-mask-image: url('../../assets/icons/blockquoteTag/聊天.svg'); mask-image: url('../../assets/icons/blockquoteTag/聊天.svg'); }
.ysw-icon--sketch { -webkit-mask-image: url('../../assets/书写.svg'); mask-image: url('../../assets/书写.svg'); }
.ysw-icon--meme { -webkit-mask-image: url('../../assets/icons/search.svg'); mask-image: url('../../assets/icons/search.svg'); }
.ysw-icon--columns { -webkit-mask-image: url('../../assets/icons/blockquoteTag/代码.svg'); mask-image: url('../../assets/icons/blockquoteTag/代码.svg'); }
.ysw-icon--meme, .ysw-icon--columns { width: 21px; height: 21px; }
.ysw-dictionary { display: inline-flex; align-items: center; gap: 7px; flex: none; margin-left: auto; color: var(--color-text); text-decoration: none; white-space: nowrap; }
.ysw-dictionary:hover { color: #287442; }
.ysw-external-icon { width: 17px; height: 17px; background: currentColor; -webkit-mask: url('../../assets/icons/外链.svg') center / contain no-repeat; mask: url('../../assets/icons/外链.svg') center / contain no-repeat; }
.ysw-menu-button, .ysw-menu { display: none; }
.ysw-nav--compact { gap: 16px; padding: 0 18px; }
.ysw-nav--compact .ysw-brand { flex-direction: column; gap: 3px; min-width: 48px; font-size: 12px; line-height: 1.2; }
.ysw-nav--compact .ysw-brand-mark { width: 21px; height: 21px; font-size: 20px; }
.ysw-nav--compact .ysw-links { justify-content: flex-start; gap: 12px; }
.ysw-nav--compact .ysw-link { flex-direction: column; gap: 3px; min-width: 48px; padding: 8px 3px; font-size: 12px; line-height: 1.2; }
.ysw-nav--compact .ysw-link svg, .ysw-nav--compact .ysw-icon { width: 21px; height: 21px; }
.ysw-nav--compact .ysw-icon--meme, .ysw-nav--compact .ysw-icon--columns { width: 24px; height: 24px; }
.ysw-nav--menu { height: 58px; padding: 0 16px; }
.ysw-nav--menu .ysw-brand { font-size: inherit; }
.ysw-nav--menu .ysw-links, .ysw-nav--menu .ysw-dictionary { display: none; }
.ysw-nav--menu .ysw-menu-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: 38px; height: 38px; margin-left: auto; padding: 0; border: 0; background: transparent; color: var(--color-text); cursor: pointer; }
.ysw-menu-button span { width: 21px; height: 2px; border-radius: 2px; background: currentColor; }
.ysw-nav--menu .ysw-menu { position: absolute; top: 100%; right: 12px; display: flex; flex-direction: column; min-width: 180px; padding: 7px; border: 1px solid #dce5dc; border-radius: 8px; background: var(--color-background); box-shadow: 0 8px 20px rgba(24, 51, 31, .13); }
.ysw-menu a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 5px; color: var(--color-text); text-decoration: none; }
.ysw-menu a .ysw-icon, .ysw-menu a svg, .ysw-menu a .ysw-brand-mark, .ysw-menu a .ysw-external-icon { flex: none; width: 19px; height: 19px; }
.ysw-menu a:hover, .ysw-menu a.active { color: #287442; background: #eef5ef; }
.ysw-menu a.active { font-weight: 750; }
</style>
