<script setup>
import { computed, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import LoadingIcon from '../../components/Status/LoadingIcon.vue'
import LanguageSelector from '../../components/Select/LanguageSelector.vue'
import { showError } from '../../services/ToastService.js'
import {
  formatDateLabel,
  formatDateTimeLabel,
  getDiaryCatalog,
  getRecentDiaries,
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
      subtitle: '按月份歸檔、按條件篩選，並直接查看最近更新。',
      recent: '最近更新',
      archive: '目錄歸檔',
      filters: '篩選列表',
      list: '日記列表',
      year: '年份',
      month: '月份',
      startDate: '起始日期',
      endDate: '結束日期',
      limit: '條數',
      reset: '重設',
      query: '查詢',
      all: '全部',
      noSummary: '暫無摘要',
      noData: '暫無日記資料',
      noRecent: '暫無最近更新',
      noArchive: '暫無歸檔資料',
      openDetail: '查看詳情',
      createdRange: '寫作時間',
      updatedTime: '最後更新',
      monthSuffix: '月',
      countSuffix: '篇'
    }
    : {
      title: '日记',
      subtitle: '按月份归档、按条件筛选，并直接查看最近更新。',
      recent: '最近更新',
      archive: '目录归档',
      filters: '筛选列表',
      list: '日记列表',
      year: '年份',
      month: '月份',
      startDate: '起始日期',
      endDate: '结束日期',
      limit: '条数',
      reset: '重置',
      query: '查询',
      all: '全部',
      noSummary: '暂无摘要',
      noData: '暂无日记资料',
      noRecent: '暂无最近更新',
      noArchive: '暂无归档资料',
      openDetail: '查看详情',
      createdRange: '写作时间',
      updatedTime: '最后更新',
      monthSuffix: '月',
      countSuffix: '篇'
    }
))

useHead({
  title: () => `${text.value.title}`
})

const loadingCatalog = ref(false)
const loadingRecent = ref(false)
const loadingList = ref(false)

const catalog = ref([])
const recentItems = ref([])
const listItems = ref([])

const filters = ref({
  year: '',
  month: '',
  startDate: '',
  endDate: '',
  limit: 50
})

const availableYears = computed(() => catalog.value.map(item => item.year).filter(Boolean))

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
  } finally {
    loadingCatalog.value = false
  }
}

async function loadRecent() {
  loadingRecent.value = true
  try {
    recentItems.value = await getRecentDiaries(language.value, 6)
  } catch (error) {
    console.error(error)
    showError(error.message || '加载最近更新失败')
    recentItems.value = []
  } finally {
    loadingRecent.value = false
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
  } finally {
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
  await Promise.all([loadCatalog(), loadRecent(), loadList()])
}

function applyArchive(year, month) {
  filters.value.year = year ? String(year) : ''
  filters.value.month = month ? String(month) : ''
  filters.value.startDate = ''
  filters.value.endDate = ''
  filters.limit = 50
  loadList()
}

function resetFilters() {
  filters.value = {
    year: '',
    month: '',
    startDate: '',
    endDate: '',
    limit: 50
  }
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
    query: currentQuery.value
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
  loadPage,
  { immediate: true }
)
</script>

<template>
  <div class="broaden-layout diary-page">
    <div class="diary-page__header">
      <div>
        <h1 class="diary-title" v-formatted-text="text.title" />
        <p class="diary-subtitle" v-formatted-text="text.subtitle" />
      </div>
      <LanguageSelector />
    </div>

    <div class="diary-layout">
      <aside class="sidebar">
<!--        <section class="panel">-->
<!--          <div class="panel-title" v-formatted-text="text.recent" />-->
<!--          <LoadingIcon v-if="loadingRecent" />-->

<!--          <div v-else-if="recentItems.length" class="recent-list">-->
<!--            <button-->
<!--              v-for="item in recentItems"-->
<!--              :key="`recent-${item.id ?? item.date}`"-->
<!--              class="recent-item"-->
<!--              type="button"-->
<!--              @click="openDetail(item)"-->
<!--            >-->
<!--              <div class="recent-item__title" v-formatted-text="item.abridge || item.date || text.noSummary" />-->
<!--              <div class="recent-item__date">{{ formatDateLabel(item.date) }}</div>-->
<!--            </button>-->
<!--          </div>-->

<!--          <div v-else class="empty-box" v-formatted-text="text.noRecent" />-->
<!--        </section>-->

        <section class="panel">
          <div class="panel-title" v-formatted-text="text.archive" />
          <LoadingIcon v-if="loadingCatalog" />

          <div v-else-if="catalog.length" class="archive-list">
            <div
              v-for="yearItem in catalog"
              :key="`year-${yearItem.year}`"
              class="archive-year"
            >
              <div class="archive-year__title">
                <span>{{ yearItem.year }}</span>
                <span>{{ yearItem.total }}{{ text.countSuffix }}</span>
              </div>

              <div class="archive-months">
                <button
                  v-for="monthItem in yearItem.months"
                  :key="`month-${yearItem.year}-${monthItem.month}`"
                  type="button"
                  class="archive-month"
                  @click="applyArchive(yearItem.year, monthItem.month)"
                >
                  <span>{{ monthItem.month }}{{ text.monthSuffix }}：{{ monthItem.total }}{{ text.countSuffix }}</span>
                </button>
              </div>
            </div>
          </div>

          <div v-else class="empty-box" v-formatted-text="text.noArchive" />
        </section>
      </aside>

      <section class="content">
        <section class="panel">
          <div class="panel-title" v-formatted-text="text.filters" />

          <div class="filter-grid">
            <label class="field">
              <span>{{ text.year }}</span>
              <select v-model="filters.year" class="field-input">
                <option value="">{{ text.all }}</option>
                <option v-for="year in availableYears" :key="year" :value="String(year)">{{ year }}</option>
              </select>
            </label>

            <label class="field">
              <span>{{ text.month }}</span>
              <select v-model="filters.month" class="field-input">
                <option value="">{{ text.all }}</option>
                <option v-for="month in 12" :key="month" :value="String(month)">{{ month }}</option>
              </select>
            </label>

            <label class="field">
              <span>{{ text.startDate }}</span>
              <input v-model="filters.startDate" class="field-input" type="date">
            </label>

            <label class="field">
              <span>{{ text.endDate }}</span>
              <input v-model="filters.endDate" class="field-input" type="date">
            </label>

            <label class="field">
              <span>{{ text.limit }}</span>
              <select v-model="filters.limit" class="field-input">
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </label>
          </div>

          <div class="filter-actions">
            <button type="button" class="action-button action-button--muted" @click="resetFilters">
              {{ text.reset }}
            </button>
            <button type="button" class="action-button" @click="loadList">
              {{ text.query }}
            </button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title" v-formatted-text="text.list" />

          <LoadingIcon v-if="loadingList" />

<!--          recent-item-->

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
                  <div class="diary-card__date">
                    {{ formatDateLabel(item.date) }}
                  </div>

                  <div
                      class="diary-card__summary"
                      v-formatted-text="item.abridge || text.noSummary"
                  />
                </div>
              </a>
            </article>
          </div>

          <div v-else class="empty-box" v-formatted-text="text.noData" />
        </section>
      </section>
    </div>
  </div>
</template>

<style scoped>
.diary-page {
  padding-bottom: 32px;
}

.diary-page__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.diary-title {
  margin: 0 0 8px;
  font-size: 32px;
  color: var(--color-text);
}

.diary-subtitle {
  margin: 0;
  color: var(--color-text-light);
  line-height: 1.7;
}

.diary-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 18px;
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

.recent-list,
.archive-list,
.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recent-item,
.archive-month,
.card-link,
.action-button {
  transition: all 0.2s ease;
}

.recent-item {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 12px;
  background: #f8fff6;
  text-align: left;
  cursor: pointer;
}

.recent-item:hover,
.archive-month:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.recent-item__title {
  color: var(--color-text);
  line-height: 1.6;
}

.recent-item__date {
  margin-top: 8px;
  font-size: 14px;
  color: var(--color-text-light);
}

.archive-year {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.archive-year:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.archive-year__title {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--color-text);
}

.archive-months {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.archive-month {
  border: 1px solid var(--color-border);
  background: #ffffff;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--color-text);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--color-text);
}

.field-input {
  min-height: 42px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 0 12px;
  background: #ffffff;
  color: var(--color-text);
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.action-button {
  border: none;
  border-radius: var(--border-radius-md);
  padding: 10px 18px;
  background: var(--gradient-primary);
  color: #ffffff;
  cursor: pointer;
}

.action-button--muted {
  background: #8ca18d;
}

.action-button:hover,
.card-link:hover {
  opacity: 0.92;
}

.diary-card {
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 16px;
  background: #fcfffb;
}

.diary-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.diary-card__date {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-primary-dark);
}

.diary-card__link {
  display: block;
  color: inherit;
  text-decoration: none;
  width: 100%;
  height: 100%;
}

.card-link {
  border: none;
  border-radius: 999px;
  padding: 8px 14px;
  background: #eaf7ea;
  color: var(--color-primary-dark);
  cursor: pointer;
}

.diary-card__summary {
  color: var(--color-text);
  font-weight: bold;
  line-height: 1.8;
}

.diary-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 14px;
  font-size: 14px;
  color: var(--color-text-light);
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

@media (max-width: 640px) {
  .diary-page__header,
  .diary-card__top {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-content: stretch;
  }

  .action-button {
    flex: 1;
  }
}
</style>
