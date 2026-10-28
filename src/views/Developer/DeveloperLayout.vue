<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Collection, DataAnalysis, Document, Headset, House, Monitor, Reading, Setting } from '@element-plus/icons-vue'
import exitDictionaryIcon from '../../assets/icons/exit-dictionary.svg'

const route = useRoute()
const menuOpen = ref(false)
const base = computed(() => `/${route.params.language}/${route.params.dialect}`)
const devPath = path => `${base.value}/dev/${path}`

const groups = [
  { title: '用前须知', icon: Reading, items: [
    { label: '简繁转换框', path: 'tool/sc-tc-lab' },
    { label: '富文本使用方法', path: 'test/pinyin-ipa' },
    { label: '特殊符号复制栏', path: 'tool/special-symbol' },
  ] },
  { title: '运行监控', icon: Monitor, items: [
    { label: '用户信息', path: 'pending/users' },
    { label: '用户连胜管理', path: 'streak-admin' },
  ] },
  { title: '语言学', icon: Collection, items: [
    { label: '编辑汉字', path: 'hanzi-filter', matches: ['hanzi-filter', 'hanzi-editor', 'hanzi-creator'] },
    { label: '导入汉字', path: 'reference-tsv' },
    { label: '编辑词语', path: 'ciyu-filter', matches: ['ciyu-filter', 'ciyu-editor', 'ciyu-creator'] },
    { label: '导入词语', path: 'pending/import-ciyu' },
    { label: '编辑例句', path: 'pending/examples' },
    { label: '编辑拼音表', path: 'pinyin-editor' },
    { label: '编辑辞书', path: 'ref-filter', matches: ['ref-filter', 'ref-editor'] },
  ] },
  { title: '学习区域', icon: Document, items: [
    { label: '编辑学习词卡', path: 'study-word-card', matches: ['study-word-card', 'study-word-card-editor'] },
  ] },
  { title: '杂项', icon: Setting, items: [
    { label: '编辑加载提示语', path: 'loading-text' },
    { label: '关卡编辑器', path: 'study-curriculum', matches: ['study-curriculum'] },
    { label: 'OSS / 音频上传测试', path: 'test/oss' },
    { label: '图片存储测试', path: 'test/image' },
    { label: '字符串差异工具', path: 'tool/text-diff' },
  ] },
]

const activePath = computed(() => route.path.slice(`${base.value}/dev/`.length))
const isActive = item => (item.matches || [item.path]).some(path => activePath.value === path || activePath.value.startsWith(`${path}/`))
const isGroupActive = group => group.items.some(isActive)

watch(() => route.fullPath, () => { menuOpen.value = false })
</script>

<template>
  <div class="developer-layout">
    <button class="developer-menu-toggle" type="button" :aria-expanded="menuOpen" aria-controls="developer-sidebar" @click="menuOpen = !menuOpen">
      {{ menuOpen ? '关闭导航' : '打开导航' }}
    </button>
    <aside id="developer-sidebar" class="developer-sidebar" :class="{ 'developer-sidebar--open': menuOpen }" aria-label="开发者导航">
      <router-link class="developer-sidebar__brand" :to="devPath('home')">
        <span class="developer-sidebar__brand-mark" aria-hidden="true"><el-icon><DataAnalysis /></el-icon></span>
        开发者工作台
      </router-link>
      <nav class="developer-sidebar__nav" aria-label="功能目录">
        <router-link class="developer-sidebar__home" :class="{ 'developer-sidebar__heading--active': activePath === 'home' }" :to="devPath('home')" :aria-current="activePath === 'home' ? 'page' : undefined">
          <el-icon aria-hidden="true"><House /></el-icon><span>首页</span>
        </router-link>
        <section v-for="group in groups" :key="group.title" class="developer-sidebar__group" :class="{ 'developer-sidebar__group--active': isGroupActive(group) }">
          <h2>
            <router-link class="developer-sidebar__heading" :class="{ 'developer-sidebar__heading--active': isGroupActive(group) }" :to="devPath(group.items[0].path)">
              <el-icon aria-hidden="true"><component :is="group.icon" /></el-icon><span>{{ group.title }}</span>
            </router-link>
          </h2>
          <div class="developer-sidebar__children">
            <router-link v-for="item in group.items" :key="item.path" :to="devPath(item.path)" class="developer-sidebar__link" :class="{ 'developer-sidebar__link--active': isActive(item) }" :aria-current="isActive(item) ? 'page' : undefined">
              <span class="developer-sidebar__bullet" aria-hidden="true"></span>{{ item.label }}
            </router-link>
          </div>
        </section>
      </nav>
      <div class="developer-sidebar__footer">
        <router-link :to="devPath('pending/support')"><el-icon aria-hidden="true"><Headset /></el-icon>客服</router-link>
        <router-link :to="`${base}/dict/home`"><img class="developer-sidebar__exit-icon" :src="exitDictionaryIcon" alt="" />返回词典</router-link>
      </div>
    </aside>
    <div v-if="menuOpen" class="developer-sidebar__backdrop" @click="menuOpen = false"></div>
    <div class="developer-layout__content"><router-view /></div>
  </div>
</template>

<style scoped>
.developer-layout { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; }
.developer-sidebar { position: sticky; top: 0; display: flex; flex-direction: column; height: 100vh; overflow-y: auto; scrollbar-width: none; padding: 26px 14px 18px; border-right: 1px solid var(--color-border); background: var(--color-background-alt); }
.developer-sidebar::-webkit-scrollbar { display: none; }
.developer-sidebar__brand { display: flex; align-items: center; gap: 11px; padding: 7px 12px 26px; color: var(--color-text); font-size: 18px; font-weight: 700; text-decoration: none; }
.developer-sidebar__brand-mark { display: inline-flex; font-size: 24px; }
.developer-sidebar__nav { flex: 1; }
.developer-sidebar__home, .developer-sidebar__heading { display: flex; align-items: center; gap: 11px; min-height: 43px; padding: 9px 12px; border-radius: 10px; color: var(--color-text); font-size: 14px; font-weight: 650; text-decoration: none; }
.developer-sidebar__home { margin-bottom: 12px; }
.developer-sidebar__home .el-icon, .developer-sidebar__heading .el-icon, .developer-sidebar__footer .el-icon { flex: none; font-size: 19px; }
.developer-sidebar__group { margin-bottom: 9px; padding: 3px; border-radius: 16px; }
.developer-sidebar__group--active { background: #e5f0e7; }
.developer-sidebar__group h2 { margin: 0; }
.developer-sidebar__heading--active { background: var(--color-primary-dark); color: #fff; }
.developer-sidebar__children { padding: 4px 0 5px 34px; }
.developer-sidebar__link { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 7px 10px; border-radius: 8px; color: var(--color-text-light); font-size: 13px; text-decoration: none; }
.developer-sidebar__bullet { flex: none; width: 5px; height: 5px; border-radius: 50%; background: var(--color-text-lighter); }
.developer-sidebar__link:hover, .developer-sidebar__footer a:hover { background: #d9eadc; color: var(--color-text); }
.developer-sidebar__link--active { background: #fff; color: var(--color-text); font-weight: 650; }
.developer-sidebar__link--active .developer-sidebar__bullet { background: var(--color-primary); }
.developer-sidebar__footer { padding-top: 12px; border-top: 1px solid var(--color-border); }
.developer-sidebar__footer a { display: flex; align-items: center; gap: 11px; padding: 9px 12px; border-radius: 8px; color: var(--color-text); font-size: 14px; text-decoration: none; }
.developer-sidebar__exit-icon { flex: none; width: 19px; height: 19px; }
.developer-layout__content { min-width: 0; }
.developer-menu-toggle, .developer-sidebar__backdrop { display: none; }
@media (max-width: 768px) {
  .developer-layout { display: block; }
  .developer-menu-toggle { position: sticky; top: 0; z-index: 21; display: block; width: 100%; padding: 12px 16px; border: 0; border-bottom: 1px solid var(--color-border); background: var(--color-background-alt); color: var(--color-text); text-align: left; }
  .developer-sidebar { position: fixed; top: 0; bottom: 0; left: 0; z-index: 23; width: min(280px, 85vw); height: auto; transform: translateX(-100%); transition: transform .2s ease; }
  .developer-sidebar--open { transform: translateX(0); }
  .developer-sidebar__backdrop { position: fixed; inset: 0; z-index: 22; display: block; background: rgb(0 0 0 / 35%); }
}
</style>
