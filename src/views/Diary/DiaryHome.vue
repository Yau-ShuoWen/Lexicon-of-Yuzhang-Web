<script setup>
import { computed, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import LoadingIcon from '../../components/Status/LoadingIcon.vue'
import DiaryArchive from './DiaryArchive.vue'
import { showError } from '../../services/ToastService.js'
import {
  formatDateLabel,
  getDiaryCatalog,
  queryDiaries
} from './diaryApi.js'

const route = useRoute()
const router = useRouter()

const language = computed(() => String(route.params.language || 'sc'))
const dialect = computed(() => String(route.params.dialect || 'lac'))

const text = computed(() => (
    language.value === 'tc'
        ? {
          title: '日記',
          list: '日記列表',
          noSummary: '暫無摘要',
          noData: '暫無日記資料'
        }
        : {
          title: '日记',
          list: '日记列表',
          noSummary: '暂无摘要',
          noData: '暂无日记资料'
        }
))

useHead({
  title: () => `${text.value.title}`
})

const loadingCatalog = ref(false)
const loadingList = ref(false)

const catalog = ref([])
const listItems = ref([])

const filters = ref({
  year: '',
  month: '',
  startDate: '',
  endDate: '',
  limit: 50
})

const currentQuery = computed(() => {
  const query = {}
  if (filters.value.year) query.year = String(filters.value.year)
  if (filters.value.month) query.month = String(filters.value.month)
  if (filters.value.startDate) query.startDate = filters.value.startDate
  if (filters.value.endDate) query.endDate = filters.value.endDate
  if (filters.value.limit) query.limit = String(filters.value.limit)
  return query
})

async function loadCatalog() {
  loadingCatalog.value = true
  try {
    catalog.value = await getDiaryCatalog()
  } catch (error) {
    console.error(error)
    showError(error.message || '加载目录失败')
    catalog.value = []
  }
  finally {
    loadingCatalog.value = false
  }
}

async function loadList() {
  loadingList.value = true
  try {
    listItems.value = await queryDiaries(language.value, filters.value)
  } catch (error) {
    console.error(error)
    showError(error.message || '加载日记列表失败')
    listItems.value = []
  }
  finally {
    loadingList.value = false
  }
}

function syncFiltersFromQuery() {
  filters.value = {
    year: route.query.year ? String(route.query.year) : '',
    month: route.query.month ? String(route.query.month) : '',
    startDate: route.query.startDate ? String(route.query.startDate) : '',
    endDate: route.query.endDate ? String(route.query.endDate) : '',
    limit: route.query.limit ? Number(route.query.limit) : 50
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
  filters.value.startDate = ''
  filters.value.endDate = ''
  filters.value.limit = 50

  // 生成归档 URL：?year=2026&month=7（无筛选时为空 query）
  const query = {}
  if (filters.value.year) query.year = filters.value.year
  if (filters.value.month) query.month = filters.value.month

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
    //query: currentQuery.value
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
    query: currentQuery.value
  })
}

watch(
  () => [
    language.value,
    route.query.year,
    route.query.month,
    route.query.startDate,
    route.query.endDate,
    route.query.limit
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
</script>

<template>
  <div class="broaden-layout diary-page">
    <div class="diary-layout">

      <section class="content">
        <section class="panel">
          <div class="panel-title" v-formatted-text="text.list"/>

          <LoadingIcon v-if="loadingList"/>

          <div v-else-if="listItems.length" class="card-list">
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

      <aside class="sidebar">
        <DiaryArchive
            :language="language"
            :catalog="catalog"
            :loading="loadingCatalog"
            :active-year="filters.year"
            :active-month="filters.month"
            @select="applyArchive"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.diary-page {
  /* padding-top: 10px;*/
  padding-bottom: 32px;
}

.diary-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  /* 侧边栏（归档栏）随内容列拉伸，保证内部 sticky 有滚动空间 */
  align-items: stretch;
}

.sidebar,
.content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel {
  background: var(--color-background);
  border: 2px solid var(--color-primary-light);
  border-radius: var(--border-radius-md);
  padding: 18px;
}

.panel-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-text);
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.diary-card {
  border: 1.5px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 16px;
  background: #f7ffff;
  transition: all 0.2s ease;
}

.diary-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
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

@media (max-width: 900px) {
  .diary-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 500px) {
  .diary-card__date {
    font-size: 16px;
  }
}
</style>
