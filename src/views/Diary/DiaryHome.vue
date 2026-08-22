<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import DiaryArchive from './DiaryArchive.vue'
import { showError } from '../../services/ToastService.js'
import { getBlogVisibilityLevel } from '../../utils/auth.js'
import {
  formatDateLabel,
  getDiaryCatalog,
  queryDiaries
} from './diaryApi.js'

const route = useRoute()
const router = useRouter()

const language = computed(() => String(route.params.language || 'sc'))
const dialect = computed(() => String(route.params.dialect || 'lac'))
const blogLevel = computed(() => getBlogVisibilityLevel())
const canSelfView = computed(() => blogLevel.value >= 3)
const canFriendView = computed(() => blogLevel.value >= 2)
const canStrangerView = computed(() => blogLevel.value >= 1)
const viewOptions = computed(() => {
  if (canSelfView.value) {
    return [
      { mode: 'self', label: text.value.self },
      { mode: 'friend', label: text.value.friend },
      { mode: 'stranger', label: text.value.stranger }
    ]
  }
  if (canFriendView.value) {
    return [
      { mode: 'friend', label: text.value.full },
      { mode: 'stranger', label: text.value.public }
    ]
  }
  return []
})

const viewMode = computed(() => {
  const raw = String(route.query.view || '').toLowerCase()
  if (raw === 'self' || raw === 'friend' || raw === 'stranger') {
    if (raw === 'self') {
      return canSelfView.value ? raw : (canFriendView.value ? 'friend' : 'stranger')
    }
    if (raw === 'friend') {
      return canFriendView.value ? raw : 'stranger'
    }
    return raw
  }
  return canSelfView.value ? 'self' : (canFriendView.value ? 'friend' : 'stranger')
})

const text = computed(() => (
    language.value === 'tc'
        ? {
          title: '日記',
          list: '日記列表',
          noSummary: '暫無摘要',
          noData: '暫無日記資料',
          view: '視角',
          self: '自己',
          friend: '朋友',
          stranger: '陌生人',
          full: '完整版',
          public: '公開版'
        }
        : {
          title: '日记',
          list: '日记列表',
          noSummary: '暂无摘要',
          noData: '暂无日记资料',
          view: '视角',
          self: '自己',
          friend: '朋友',
          stranger: '陌生人',
          full: '完整版',
          public: '公开版'
        }
))

useHead({
  title: () => `${text.value.title}`
})

const loadingCatalog = ref(false)
const loadingList = ref(false)
const showCatalogSkeleton = ref(false)
const showListSkeleton = ref(false)
const listRenderKey = ref(0)

const catalog = ref([])
const listItems = ref([])
let catalogSkeletonTimer = null
let listSkeletonTimer = null

const filters = ref({
  year: '',
  month: ''
})

const detailQuery = computed(() => {
  const query = {}
  if (viewMode.value) query.view = viewMode.value
  return query
})

const activeViewIndex = computed(() => {
  const index = viewOptions.value.findIndex(option => option.mode === viewMode.value)
  return index >= 0 ? index : 0
})

function setView(mode) {
  const nextMode = mode === 'self'
    ? (canSelfView.value ? 'self' : (canFriendView.value ? 'friend' : 'stranger'))
    : mode === 'friend'
      ? (canFriendView.value ? 'friend' : 'stranger')
      : 'stranger'
  router.replace({
    query: {
      ...(route.query.year ? { year: String(route.query.year) } : {}),
      ...(route.query.month ? { month: String(route.query.month) } : {}),
      view: nextMode
    }
  })
}

function startCatalogLoading() {
  loadingCatalog.value = true
  showCatalogSkeleton.value = false
  clearTimeout(catalogSkeletonTimer)
  catalogSkeletonTimer = setTimeout(() => {
    if (loadingCatalog.value) {
      showCatalogSkeleton.value = true
    }
  }, 180)
}

function stopCatalogLoading() {
  loadingCatalog.value = false
  showCatalogSkeleton.value = false
  clearTimeout(catalogSkeletonTimer)
}

async function loadCatalog() {
  startCatalogLoading()
  try {
    catalog.value = await getDiaryCatalog(viewMode.value)
  } catch (error) {
    console.error(error)
    showError(error.message || '加载目录失败')
    catalog.value = []
  }
  finally {
    stopCatalogLoading()
  }
}

function startListLoading() {
  loadingList.value = true
  showListSkeleton.value = false
  clearTimeout(listSkeletonTimer)
  listSkeletonTimer = setTimeout(() => {
    if (loadingList.value) {
      showListSkeleton.value = true
    }
  }, 180)
}

function stopListLoading() {
  loadingList.value = false
  showListSkeleton.value = false
  clearTimeout(listSkeletonTimer)
  listRenderKey.value += 1
}

async function loadList() {
  startListLoading()
  try {
    listItems.value = await queryDiaries(language.value, filters.value, viewMode.value)
  } catch (error) {
    console.error(error)
    showError(error.message || '加载日记列表失败')
    listItems.value = []
  }
  finally {
    stopListLoading()
  }
}

function syncFiltersFromQuery() {
  filters.value = {
    year: route.query.year ? String(route.query.year) : '',
    month: route.query.month ? String(route.query.month) : ''
  }
}

async function loadPage() {
  syncFiltersFromQuery()
  await Promise.all([loadCatalog(), loadList()])
}

// 标记本页主动推送的 query（由归档点击触发），避免 watcher 重复整页刷新
let skipNextWatch = false

// 点击归档的某年某月：筛选并刷新左侧列表，同时把筛选同步到 URL；
// 再次点击当前月份则清除筛选，URL 回到不带年份/月份的形式
function applyArchive({ year, month }) {
  if (filters.value.year === year && filters.value.month === month) {
    filters.value.year = ''
    filters.value.month = ''
  } else {
    filters.value.year = year
    filters.value.month = month
  }

  // 生成归档 URL：?year=2026&month=7（无筛选时为空 query）
  const query = {}
  if (filters.value.year) query.year = filters.value.year
  if (filters.value.month) query.month = filters.value.month
  if (viewMode.value) query.view = viewMode.value

  skipNextWatch = true
  router.replace({ query })

  loadList()
}

function getDetailHref(item) {
  if (!item) return '#'

  if (item.id === null || item.id === undefined) return '#'

  return router.resolve({
    name: 'DiaryDetail',
    params: {
      language: language.value,
      dialect: dialect.value,
      id: String(item.id)
    },
    query: detailQuery.value
  }).href
}

function openDetail(item) {
  if (!item) return

  if (item.id === null || item.id === undefined) return

  router.push({
    name: 'DiaryDetail',
    params: {
      language: language.value,
      dialect: dialect.value,
      id: String(item.id)
    },
    query: detailQuery.value
  })
}

watch(
  () => [
    language.value,
    viewMode.value,
    route.query.year,
    route.query.month
  ],
  () => {
    // 本页通过归档点击主动推送的 query：列表已在 applyArchive 中刷新，跳过整页重载
    if (skipNextWatch) {
      skipNextWatch = false
      return
    }
    loadPage()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearTimeout(catalogSkeletonTimer)
  clearTimeout(listSkeletonTimer)
})
</script>

<template>
  <div class="broaden-layout diary-page">
    <div class="diary-layout">
      <aside class="sidebar">
        <DiaryArchive
            :language="language"
            :catalog="catalog"
            :loading="showCatalogSkeleton"
            :active-year="filters.year"
            :active-month="filters.month"
            @select="applyArchive"
        />
      </aside>

      <section class="content">
        <section class="panel">
          <div class="panel-head">
            <div class="panel-title" v-formatted-text="text.list"/>
            <div v-if="viewOptions.length" class="view-switch" :aria-label="text.view">
              <span class="view-switch__label">{{ text.view }}</span>
              <div
                class="view-switch__track"
                :class="`is-${viewOptions.length}`"
                :style="{
                  '--segment-count': String(viewOptions.length),
                  '--active-index': String(activeViewIndex)
                }"
              >
                <button
                  v-for="option in viewOptions"
                  :key="option.mode"
                  class="view-switch__option"
                  :class="{ active: viewMode === option.mode }"
                  @click="setView(option.mode)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="showListSkeleton" class="diary-skeleton" aria-hidden="true">
            <div v-for="index in 5" :key="index" class="diary-skeleton__card">
              <div class="diary-skeleton__line diary-skeleton__line--summary shimmer" />
              <div class="diary-skeleton__line diary-skeleton__line--date shimmer" />
            </div>
          </div>

          <div
            v-else-if="listItems.length"
            :key="listRenderKey"
            class="card-list"
            :class="{ 'is-loading': loadingList }"
          >
            <article
                v-for="item in listItems"
                :key="item.id ?? item.date"
                class="diary-card recent-item"
            >
              <a
                  :href="getDetailHref(item)"
                  target="_blank"
                  rel="noopener"
                  class="diary-card__link"
              >
                <div class="diary-card__top">
                  <div
                      class="diary-card__summary"
                      v-formatted-text="item.intro || text.noSummary"
                  />

                  <div class="diary-card__date">
                    {{ formatDateLabel(item.date) }}
                  </div>
                </div>
              </a>
            </article>
          </div>

          <div v-else class="empty-box" v-formatted-text="text.noData"/>
        </section>
      </section>
    </div>
  </div>
</template>

<style scoped>
.diary-page {
  padding-bottom: 32px;
}

.diary-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
}

/*
 * 桌面端新布局：整页锁定为视口高度（扣除固定导航栏高度），
 * 内容列与归档边栏各自独立滚动，归档栏是固定区域，完全不会随页面滑动。
 * 窄屏（<=900px）仍回退为下方原有的单列堆叠布局。
 */
@media (min-width: 901px) {
  .diary-page {
    height: calc(100vh - var(--header-height));
    height: calc(100dvh - var(--header-height));
    padding-bottom: 10px;
  }

  .diary-layout {
    height: 100%;
    overflow: hidden;
    /* 关键：单行锁定为容器高度（minmax(0,1fr) 允许收缩），
       否则 auto 行会按内容高度撑开，列内容超出视口被裁剪 */
    grid-template-rows: minmax(0, 1fr);
  }

  .content,
  .sidebar {
    min-height: 0;
    overflow-y: auto;
    /* 隐藏滚动条 */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .content::-webkit-scrollbar,
  .sidebar::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  /* 面板边框固定占满所在列，内部内容独立滚动 */
  .panel {
    height: 100%;
    overflow-y: auto;
    /* 隐藏滚动条 */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .panel::-webkit-scrollbar {
    display: none;
  }
}

.sidebar,
.content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel {
  background: transparent;/*var(--color-background);*/
  /*border: 1px solid var(--color-border);*/
  /*border-radius: var(--border-radius-xl);*/
  padding:10px 5px;
  /*box-shadow: var(--shadow-sm);*/
  transition: box-shadow var(--transition-base), border-color var(--transition-base);
}
/*
.panel:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-light);
}*/

.panel-title {
  font-size: 22px;
  font-weight: 700;
  margin:0 5px 5px;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.view-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.view-switch__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-light);
}

.view-switch__track {
  position: relative;
  display: inline-grid;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, #f7fbf5 0%, #eaf4e5 100%);
  border: 1px solid #d8e7d1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.view-switch__track::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px - (var(--segment-count) - 1) * 4px) / var(--segment-count));
  border-radius: 999px;
  background: linear-gradient(135deg, #5aa84d 0%, #2f7d43 100%);
  box-shadow: 0 8px 18px rgba(46, 125, 67, 0.22);
  transform: translateX(calc(var(--active-index) * (100% + 4px)));
  transition: transform 0.28s ease;
}

.view-switch__track.is-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.view-switch__track.is-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.view-switch__option {
  position: relative;
  z-index: 1;
  border: 0;
  background: transparent;
  color: var(--color-text-light);
  min-width: 68px;
  padding: 8px 14px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.22s ease, transform 0.22s ease;
}

.view-switch__option.active {
  color: #fff;
}

.view-switch__option:hover {
  color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.view-switch__option.active:hover {
  color: #fff;
  transform: none;
}

.card-list.is-loading {
  opacity: 0.72;
  transition: opacity 0.18s ease;
}

/* 参考 PinyinTable 的左侧强调条 */
.panel-title::before {
  content: '';
  width: 6px;
  height: 22px;
  border-radius: 4px;
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.3);
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  opacity: 0;
  animation: diaryRiseIn 0.42s ease 0.04s both;
}

.diary-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.diary-skeleton__card {
  padding: 16px;
  border-radius: var(--border-radius-md);
  border: 1px solid #dce9d8;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbf6 100%);
}

.diary-skeleton__line {
  border-radius: 999px;
  background: #e7efe2;
}

.diary-skeleton__line--summary {
  width: 72%;
  height: 18px;
  margin-bottom: 16px;
}

.diary-skeleton__line--date {
  width: 112px;
  height: 14px;
  margin-left: auto;
}

.shimmer {
  position: relative;
  overflow: hidden;
}

.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.75), transparent);
  animation: diarySkeletonShimmer 1.2s ease-in-out infinite;
}

@keyframes diarySkeletonShimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes diaryRiseIn {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.diary-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #f7ffff 100%);
  border: 1.5px solid #d6e6d2;
  border-radius: var(--border-radius-md);
  padding: 16px;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}

.diary-card:hover {
  transform: translateY(-2px) scale(1.00);
  border-color: var(--color-primary);
  background: linear-gradient(180deg, #ffffff 0%, #eefbfb 100%);
  box-shadow: 0 8px 18px rgba(46, 125, 50, 0.12);
  z-index: 1;
}

.diary-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-top: 0px;
  margin-bottom: 0px;
}

.diary-card__date {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary-dark);
  flex-shrink: 0
}

.diary-card__link {
  display: block;
  color: inherit;
  text-decoration: none;
  width: 100%;
  height: 100%;
}

.diary-card__summary {
  margin: 0;
  color: var(--color-text);
  font-weight: bold;
  line-height: 1.8;
}

.empty-box {
  color: var(--color-text-light);
  line-height: 1.7;
}

@media (max-width: 800px) {
  .diary-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 500px) {
  .diary-card__top {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .diary-card__date {
    font-size: 16px;
    align-self: flex-end; /* 日期靠右对齐，如果想靠左可改为 flex-start */
  }
}
</style>
