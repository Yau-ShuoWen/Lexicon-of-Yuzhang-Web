<template>
  <div ref="viewHost" :style="{minHeight: retainedHeight}">
    <nav v-if="isBlog" class="ysw-nav" :aria-label="$t('nav.ysw_navigation')">
      <router-link class="ysw-brand" :to="base + '/home'" :class="{active: route.path === base + '/home'}"><img :src="siteLogo" alt="" /><span class="ysw-brand-mark">𝕐</span><span>{{ $t('nav.ysw_home') }}</span></router-link>
      <div class="ysw-links">
        <router-link v-for="item in items" :key="item.path" :to="base + '/' + item.path" class="ysw-link" :class="{active: route.path.startsWith(base + '/' + item.path)}">
          <Notebook v-if="item.path === 'diary'" aria-hidden="true" /><span v-else class="ysw-icon" :class="`ysw-icon--${item.path}`" aria-hidden="true" /><span>{{ $t(item.label) }}</span>
        </router-link>
      </div>
      <router-link class="ysw-dictionary" :to="dictionaryPath">
        <span>{{ $t('nav.dialect_dictionary') }}</span>
        <span class="ysw-external-icon" aria-hidden="true" />
      </router-link>
    </nav>
    <router-view v-slot="{ Component }">
      <KeepAlive include="SearchResult">
        <component :is="Component" :key="pinyinSchemeRevision" />
      </KeepAlive>
    </router-view>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
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
const retainedHeight = ref('')

watch(pinyinSchemeRevision, async () => {
  const scrollY = window.scrollY
  retainedHeight.value = `${viewHost.value?.offsetHeight || 0}px`
  await nextTick()
  window.scrollTo({top: scrollY, behavior: 'instant'})
})

watch(() => route.fullPath, () => { retainedHeight.value = '' })
</script>

<style scoped>
.ysw-nav { position: sticky; z-index: 100; top: 0; display: flex; align-items: center; gap: 44px; height: 64px; padding: 0 32px; border-bottom: 1px solid #dce5dc; background: var(--color-background); box-shadow: 0 3px 10px rgba(24, 51, 31, .09); }
.ysw-brand { display: inline-flex; align-items: center; gap: 5px; flex: none; color: #287442; font-size: 22px; font-weight: 500; text-decoration: none; }
.ysw-brand.active { font-weight: 750; }
.ysw-brand img { width: 25px; height: 25px; margin-right: 3px; }
.ysw-brand-mark { display: inline-grid; place-items: center; width: 20px; height: 20px; font-size: 18px; line-height: 1; }
.ysw-links { display: flex; align-items: center; gap: 38px; flex: 1; min-width: 0; overflow-x: auto; }
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
.ysw-dictionary { display: inline-flex; align-items: center; gap: 7px; flex: none; margin-left: auto; color: var(--color-text); text-decoration: none; white-space: nowrap; }
.ysw-dictionary:hover { color: #287442; }
.ysw-external-icon { width: 17px; height: 17px; background: currentColor; -webkit-mask: url('../../assets/icons/外链.svg') center / contain no-repeat; mask: url('../../assets/icons/外链.svg') center / contain no-repeat; }
@media (max-width: 768px) { .ysw-nav { gap: 22px; height: 58px; padding: 0 16px; } .ysw-brand { font-size: 19px; } .ysw-links { gap: 24px; } }
</style>
