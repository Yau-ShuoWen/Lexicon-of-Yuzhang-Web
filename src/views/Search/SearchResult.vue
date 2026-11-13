<script setup>
import { ref, computed, nextTick, onActivated, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { showError, showWarning } from "../../services/ToastService.js";
import { useI18n } from 'vue-i18n'
import { useHead } from '@vueuse/head'
import ideaIcon from "../../assets/icons/special/idea.svg"
import { request } from '../../services/request.js'

defineOptions({name: 'SearchResult'})

const {t} = useI18n()

const route = useRoute()

const searchQuery = ref('')
const results = ref([])
const loading = ref(true)
const randomSpinCount = ref(0)

const extraVisibleCount = ref(0)
const lastSearchKey = ref('')
const savedScrollTop = ref(0)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/dict/${path}`

const isRandom = computed(() => searchQuery.value === 'random')

const visibleExtraResults = computed(() => {
  return results.value?.[1]?.slice(0, extraVisibleCount.value) || []
})

const hasMoreExtraResults = computed(() => {
  const total = results.value?.[1]?.length || 0
  return extraVisibleCount.value < total
})

const hasResults = computed(() => {
  return (results.value?.[0]?.length || 0) + (results.value?.[1]?.length || 0) > 0
})
const mainHanziResults = computed(() => results.value?.[0]?.filter(result => result.tag === 'hanzi') || [])
const mainWordResults = computed(() => results.value?.[0]?.filter(result => result.tag !== 'hanzi') || [])

useHead({
  title: () => {
    if(isRandom.value) return `${t('common.search')}`
    if (searchQuery.value) return `${t('common.search')}：${searchQuery.value}`;
    else if (loading.value) return `${t('common.loading')}`
  }
})

const handleSearch = async (query, searchKey) => {
  if (!query.trim()) return

  loading.value = true
  results.value = []
  extraVisibleCount.value = 0
  savedScrollTop.value = 0
  lastSearchKey.value = searchKey

  try {
    const params = new URLSearchParams({
      query: query.trim()
    })

    results.value = await request(`/api/search/${language.value}/${dialect.value}/query?${params}`)

    const mainCount = results.value?.[0]?.length || 0
    const extraCount = results.value?.[1]?.length || 0

    if (mainCount + extraCount <= 0) {
      showWarning('沒有查詢到結果')
    }
  } catch (err) {
    console.error('查询失败:', err)
    showError('查询失败，请稍後再試')
  }
  finally {
    loading.value = false
  }
}

const shouldShowEndTip = computed(() => {
  const mainCount = results.value?.[0]?.length || 0
  const extraCount = results.value?.[1]?.length || 0
  if (mainCount + extraCount <= 0) return false
  if (extraCount > 0 && hasMoreExtraResults.value) return false

  return true
})

/**
 * 路由变化驱动搜索
 */
watch(
    () => [route.name, route.query.q, route.params.language, route.params.dialect],
    ([routeName, newQuery, newLanguage, newDialect]) => {
      if (routeName !== 'Search' || typeof newQuery !== 'string' || !newQuery.trim()) return

      const searchKey = `${newLanguage}/${newDialect}/${newQuery.trim()}`
      searchQuery.value = newQuery

      if (searchKey !== lastSearchKey.value) {
        handleSearch(newQuery, searchKey)
      }
    },
    {immediate: true}
)

onBeforeRouteLeave(() => {
  savedScrollTop.value = window.scrollY
})

onActivated(async () => {
  if (route.name !== 'Search' || !lastSearchKey.value) return

  await nextTick()
  requestAnimationFrame(() => {
    window.scrollTo({top: savedScrollTop.value, behavior: 'auto'})
  })
})

/**
 * 加载更多补充结果
 */
const loadMoreExtraResults = () => {
  extraVisibleCount.value += 10
}

/**
 * 重试
 */
const handleRetry = () => {
  if (searchQuery.value.trim()) {
    const searchKey = `${language.value}/${dialect.value}/${searchQuery.value.trim()}`
    handleSearch(searchQuery.value, searchKey)
  }
}

const handleRandomAgain = () => {
  randomSpinCount.value += 1
  handleRetry()
}

const getResultLink = (result) => {
  if (!result?.tag || !result?.info) {
    console.error('搜索结果结构异常:', result)
    return '/'
  }

  if (result.tag === 'hanzi') return `/${language.value}/${dialect.value}/dict/h/${encodeURIComponent(result.info.query)}`
  if (result.tag === 'ciyu') return `/${language.value}/${dialect.value}/dict/c/${encodeURIComponent(result.info.query)}`

  return '/'
}

const wordTitle = result => result.tag === 'ciyu' && result.info?.relatedWords?.some(word => Number(word.type) === 1)
  ? String(result.info.query) : result.title
const wordRelation = result => result.tag === 'ciyu' && result.info?.relatedWords?.some(word => Number(word.type) === 1)
  ? String(result.title).slice(String(result.info.query).length).trim() : ''
</script>

<template>
  <div class="narrow-layout search-results-layout">

    <div class="nav-button-wrapper">
      <router-link class="search-back-button" :to="getPath('home')">
        <span class="search-back-button__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m14 18-6-6 6-6"/>
          </svg>
        </span>
        <span v-formatted-text="$t('search_result.back_to_home')"/>
      </router-link>

      <button v-if="isRandom" type="button" class="search-action-button random-again-button" @click="handleRandomAgain">
        <span :key="randomSpinCount" class="search-action-button__icon" :class="{'random-icon-spin': randomSpinCount > 0}" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M8.624933333333333 13.666666666666666C8.624933333333333 14.011849999999999 8.345125 14.291666666666666 7.999933333333333 14.291666666666666C4.525166666666666 14.291666666666666 1.7082933333333332 11.474791666666665 1.7082933333333332 8C1.7082933333333332 6.013308333333333 2.629825 4.2414233333333335 4.066321666666667 3.089385C4.335603333333333 2.8734283333333335 4.728959999999999 2.9166533333333335 4.944915 3.1859349999999997C5.160871666666666 3.4552099999999997 5.1176466666666665 3.848573333333333 4.848366666666666 4.0645283333333335C3.694975 4.98953 2.9582933333333328 6.40852 2.9582933333333328 8C2.9582933333333328 10.784416666666667 5.215528333333333 13.041666666666666 7.999933333333333 13.041666666666666C8.345125 13.041666666666666 8.624933333333333 13.321483333333333 8.624933333333333 13.666666666666666zM11.060475 12.810558333333333C10.844225000000002 12.541558333333331 10.887033333333335 12.148125 11.156041666666667 11.931875C12.306858333333333 11.006775 13.041599999999999 9.589424999999999 13.041599999999999 8C13.041599999999999 5.215561666666666 10.784408333333332 2.958333333333333 7.999933333333333 2.958333333333333C7.6548083333333325 2.958333333333333 7.374933333333333 2.6785083333333333 7.374933333333333 2.333333333333333C7.374933333333333 1.9881533333333332 7.6548083333333325 1.7083333333333333 7.999933333333333 1.7083333333333333C11.474725000000001 1.7083333333333333 14.291599999999999 4.525206666666667 14.291599999999999 8C14.291599999999999 9.984108333333333 13.372483333333332 11.753958333333332 11.939225 12.906125C11.670166666666663 13.122375 11.276725 13.079625 11.060475 12.810558333333333z"/>
            <path d="M1.375 3.4130866666666666C1.375 3.0679066666666666 1.654825 2.7880866666666666 2 2.7880866666666666L4.333333333333333 2.7880866666666666C4.862608333333333 2.7880866666666666 5.291666666666666 3.2171449999999995 5.291666666666666 3.7464199999999996L5.291666666666666 6.079753333333334C5.291666666666666 6.424928333333334 5.011841666666666 6.704736666666666 4.666666666666666 6.704736666666666C4.321491666666667 6.704736666666666 4.041666666666666 6.424928333333334 4.041666666666666 6.079753333333334L4.041666666666666 4.038086666666667L2 4.038086666666667C1.654825 4.038086666666667 1.375 3.7582616666666664 1.375 3.4130866666666666z"/>
            <path d="M14.625 12.5864C14.625 12.931591666666666 14.345183333333333 13.2114 14 13.2114L11.666666666666666 13.2114C11.137408333333335 13.2114 10.708333333333332 12.782383333333332 10.708333333333332 12.253066666666665L10.708333333333332 9.919733333333333C10.708333333333332 9.574608333333334 10.98815 9.294733333333333 11.333333333333332 9.294733333333333C11.678516666666667 9.294733333333333 11.958333333333332 9.574608333333334 11.958333333333332 9.919733333333333L11.958333333333332 11.9614L14 11.9614C14.345183333333333 11.9614 14.625 12.241275000000002 14.625 12.5864z"/>
          </svg>
        </span>
        <span v-formatted-text="$t('search_result.random_again')"/>
      </button>
    </div>


    <div v-if="loading" class="results-section search-result-skeleton" aria-hidden="true">
      <div v-for="index in (isRandom ? 1 : 4)" :key="index" class="search-result-item skeleton-result-card">
        <div class="result-content">
          <div class="result-main">
            <div class="skeleton-line skeleton-title-line shimmer"/>
            <div class="skeleton-line skeleton-explain-line shimmer"/>
          </div>
          <svg class="result-arrow skeleton-result-arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
      </div>
    </div>

    <div v-else class="results-section results-ready">

      <!-- 主结果 -->
      <div v-if="results[0]?.length" class="results-group">

        <div v-if="mainHanziResults.length" class="results-list hanzi-results-list">
          <router-link v-for="(result, index) in mainHanziResults" :key="`hanzi-${index}`"
                       class="search-result-item hanzi-item" :to="getResultLink(result)">
            <div class="result-content">
              <div class="result-main">
                <h3 class="result-title" v-formatted-text="result.title"/>
                <p class="result-explain" v-formatted-text="result.explain"/>
              </div>
              <img v-if="result.special === true" :src="ideaIcon" class="result-icon" alt=""/>
              <svg class="result-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </router-link>
        </div>
        <div v-if="mainWordResults.length" class="results-list" :class="{'word-results-after-hanzi': mainHanziResults.length}">
          <router-link
              v-for="(result, index) in mainWordResults"
              :key="`main-${index}`"
              :class="['search-result-item', result.tag === 'hanzi'? 'hanzi-item': 'ciyu-item']"
              :to="getResultLink(result)"
          >
            <div class="result-content">

              <div class="result-main">
                <h3 class="result-title">
                  <span v-formatted-text="wordTitle(result)"/>
                  <span v-if="wordRelation(result)" class="result-relation" v-text="wordRelation(result)"/>
                </h3>
                <p class="result-explain" v-formatted-text="result.explain"/>
              </div>

              <img v-if="result.special === true" :src="ideaIcon" class="result-icon" alt=""/>

              <svg class="result-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 18 6-6-6-6"/>
              </svg>

            </div>
          </router-link>
        </div>
      </div>

      <!-- 补充结果 -->
      <div v-if="results[1]?.length" class="results-group extra-group">
        <div v-if="visibleExtraResults.length" class="extra-divider"><span>{{ $t('search_result.less_relevant') }}</span></div>

        <TransitionGroup v-if="visibleExtraResults.length" name="result-expand" tag="div" class="results-list">
          <router-link
              v-for="(result, index) in visibleExtraResults"
              :key="`extra-${index}`"
              :class="['search-result-item', 'extra-item', result.tag === 'hanzi' ? 'hanzi-item' : 'ciyu-item']"
              :style="{ '--result-order': index % 10 }"
              :to="getResultLink(result)"
          >
            <div class="result-content">

              <div class="result-main">
                <h3 class="result-title">
                  <span v-formatted-text="wordTitle(result)"/>
                  <span v-if="wordRelation(result)" class="result-relation" v-text="wordRelation(result)"/>
                </h3>
                <p class="result-explain" v-formatted-text="result.explain"/>
              </div>

              <img v-if="result.special === true"
                   :src="ideaIcon" class="result-icon" alt=""
              />

              <svg class="result-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 18 6-6-6-6"/>
              </svg>

            </div>
          </router-link>
        </TransitionGroup>

        <button
            v-if="hasMoreExtraResults"
            type="button"
            class="search-action-button load-more-btn"
            @click="loadMoreExtraResults"
        >
          <span class="search-action-button__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
          <span v-formatted-text="$t('search_result.more_result')"/>
        </button>

      </div>
      <div v-if="shouldShowEndTip&&!isRandom" class="search-end-tip">
        <div v-formatted-text="$t('search_result.no_more')"></div>

        <router-link class="normal-link" :to="getPath(`search?q=random`)"
                     v-formatted-text="$t('search_result.try_random')"/>
        <!--            还是和我们反馈  v-formatted-text="$t('search_result.try_feedback')-->
      </div>

      <div v-if="!hasResults" class="search-empty-state">
        <div class="search-empty-state__mark" aria-hidden="true">?</div>
        <div class="search-empty-state__text" v-formatted-text="$t('common.no_result')"/>
        <router-link class="normal-link" :to="getPath('search?q=random')"
                     v-formatted-text="$t('search_result.try_random')"/>
      </div>

    </div>
  </div>
</template>

<style>

.nav-button-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.search-back-button {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  padding: 5px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-background);
  font-weight: 500;
  text-decoration: none;
  transition: background-color .2s ease, border-color .2s ease;
}

.search-back-button:hover,
.search-back-button:focus-visible {
  background: var(--color-border-light);
  border-color: #bfcfc2;
}
.search-back-button:focus-visible,
.search-action-button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.search-back-button__icon {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  color: var(--color-primary-dark);
}

.search-back-button__icon svg {
  width: 19px;
  height: 19px;
}

.search-back-button__icon path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.search-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 36px;
  padding: 5px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-background);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background-color .2s ease, border-color .2s ease;
}

.search-action-button:hover,
.search-action-button:focus-visible {
  background: var(--color-border-light);
  border-color: #bfcfc2;
}

.search-action-button__icon {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: var(--color-primary-dark);
}

.search-action-button__icon svg {
  width: 18px;
  height: 18px;
}

.search-action-button__icon path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.random-again-button .search-action-button__icon path { fill: currentColor; stroke: none; }
.random-icon-spin svg { transform-box: view-box; transform-origin: 50% 50%; animation: randomIconFlick .8s cubic-bezier(.16, .82, .28, 1) both; }
@keyframes randomIconFlick { to { transform: rotate(360deg); } }

.results-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.hanzi-results-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.word-results-after-hanzi { margin-top: 22px; }

.search-result-item {
  --result-accent: #4f8e53;
  --result-icon-bg: rgba(255, 255, 255, .42);

  position: relative;
  border: 0;
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  box-shadow: 0 2px 7px rgba(31, 45, 36, .05);
  transition: background-color .2s ease;
  cursor: pointer;
}

.hanzi-item {
  --result-accent: #4f8e53;
  --result-bg: #c5dfa7;
  --result-hover-bg: #bed8a3;
  --result-icon-bg: rgba(244, 251, 239, .58);
  background: #c5dfa7;
}
.hanzi-item .result-content { min-height: 82px; padding: 13px 16px; gap: 8px; }
.hanzi-item .result-main { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.hanzi-item .result-title { margin: 0; }
.hanzi-item .result-explain { min-width: 0; margin: 0; color: #405c42; font-size: 18px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.hanzi-item .result-icon { margin-left: auto; }
.hanzi-item .result-arrow { margin-left: 0; }

.ciyu-item {
  --result-accent: #4f7fa9;
  --result-bg: #c9def1;
  --result-hover-bg: #c1d6e9;
  --result-icon-bg: rgba(245, 250, 255, .66);
  background: #c9def1;
}

.extra-item {
  box-shadow: 0 2px 7px rgba(31, 45, 36, .04);
}

.extra-item.hanzi-item {
  --result-accent: #277b7c;
  --result-bg: #d3eae7;
  --result-hover-bg: #c8e2df;
  --result-icon-bg: rgba(255, 255, 255, .5);
  background: var(--result-bg);
}

.extra-item.ciyu-item {
  --result-accent: #277b7c;
  --result-bg: #d3eae7;
  --result-hover-bg: #c8e2df;
  --result-icon-bg: rgba(245, 255, 253, .7);
  background: var(--result-bg);
}
.search-result-item:hover,
.search-result-item:focus-visible { background: var(--result-hover-bg); }

.results-section {
  padding-bottom: 100px;
}

.results-ready {
  animation: searchResultsReady .34s ease both;
}

.extra-group {
  margin-top: 34px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.extra-divider { display: flex; align-items: center; gap: 14px; color: #457a7b; font-size: 14px; }
.extra-divider::before, .extra-divider::after { content: ''; flex: 1; height: 1px; background: #a9cfcb; }
.extra-divider span { flex: 0 1 auto; text-align: center; }

.load-more-btn {
  align-self: center;
  min-width: 180px;
  margin-top: 2px;
  padding-right: 18px;
}

/* =========================
   内容
========================= */

.result-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 88px;
  padding: 18px 20px;
}

.result-main {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
  user-select: none;
  -webkit-user-select: none;
}
.result-relation { margin-left: .18em; color: #53636d; font-size: .78em; font-weight: 700; }

.result-explain {
  color: var(--color-text-light);
  font-size: 18px;
  margin: 0;
  line-height: 1.65;
  user-select: none;
  -webkit-user-select: none;
}

.result-icon {
  box-sizing: content-box;
  width: 22px;
  height: 22px;
  margin-left: 16px;
  padding: 5px;
  border-radius: 9px;
  background: var(--result-icon-bg);
  opacity: .86;
}

.result-arrow {
  width: 24px;
  height: 24px;
  margin-left: 12px;
  flex-shrink: 0;
  color: var(--result-accent);
  opacity: .5;
  transition: color .2s ease, opacity .2s ease, transform .2s ease;
}

.result-arrow path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.search-result-item:hover .result-arrow,
.search-result-item:focus-visible .result-arrow {
  color: #31575a;
  opacity: 1;
  transform: translateX(5px);
}

.search-end-tip {
  text-align: center;
  margin-top: 40px;
  padding: 20px;
  color: var(--color-text-light);
  line-height: 1.8;
}

.search-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 42px 24px;
  border-radius: var(--border-radius-lg);
  background: #eef3eb;
  color: var(--color-text-light);
  text-align: center;
  box-shadow: 0 2px 7px rgba(31, 62, 36, .04);
}

.search-empty-state__mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  margin-bottom: 3px;
  border-radius: 12px;
  color: var(--color-primary-dark);
  background: #cfdfc7;
  font-size: 24px;
  font-weight: 700;
}

.search-empty-state__text {
  color: var(--color-text);
  font-size: 18px;
  font-weight: 600;
}

.search-result-skeleton {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.skeleton-result-card {
  background: #edf2ea;
  pointer-events: none;
}

.skeleton-result-card:nth-child(even) {
  background: #f7f8f6;
}

.skeleton-line {
  overflow: hidden;
  position: relative;
  background: rgba(91, 118, 92, .14);
}

.skeleton-title-line {
  width: min(210px, 44%);
  height: 25px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.skeleton-explain-line {
  width: min(520px, 72%);
  height: 17px;
  border-radius: 7px;
}

.skeleton-result-arrow {
  opacity: .12;
}

.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .72), transparent);
  animation: searchSkeletonShimmer 1.25s ease-in-out infinite;
}

.result-expand-enter-active {
  transition: opacity .28s ease, filter .28s ease;
  transition-delay: calc(var(--result-order, 0) * 36ms);
}

.result-expand-enter-from {
  opacity: 0;
  filter: blur(2px);
}

@keyframes searchSkeletonShimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes searchResultsReady {
  from {
    opacity: 0;
    filter: blur(2px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}

@media (min-width: 1100px) {
  .search-results-layout { max-width: 900px; }
  .hanzi-results-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .hanzi-results-list { grid-template-columns: minmax(0, 1fr); }
  .hanzi-item .result-main { flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; }
  .hanzi-item .result-explain { font-size: 16px; }
  .hanzi-item .result-content { align-items: center; min-height: 68px; padding: 12px 16px; }
  .hanzi-item .result-icon, .hanzi-item .result-arrow { margin-top: 0; }
  .result-relation { display: block; margin: 4px 0 0; font-size: .72em; line-height: 1.3; }
  .nav-button-wrapper {
    margin-bottom: 18px;
  }

  .search-action-button {
    min-height: 40px;
  }

  .result-content {
    min-height: 78px;
    padding: 15px 16px;
    align-items: flex-start;
  }

  .result-title {
    font-size: 21px;
    line-height: 1.35;
  }

  .result-explain {
    font-size: 16px;
  }

  .result-icon {
    margin-left: 10px;
    margin-top: 20px;
  }

  .result-arrow {
    margin-left: 8px;
    margin-top: 25px;
  }

  .extra-group {
    margin-top: 26px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .random-icon-spin svg { animation: none; }
  .search-result-item,
  .search-action-button,
  .result-arrow,
  .result-expand-enter-active {
    transition: none;
  }

  .results-ready {
    animation: none;
  }

  .shimmer::after {
    animation: none;
  }
}
</style>
