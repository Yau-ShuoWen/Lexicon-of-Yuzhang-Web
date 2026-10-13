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

const getResultLink = (result) => {
  if (!result?.tag || !result?.info) {
    console.error('搜索结果结构异常:', result)
    return '/'
  }

  if (result.tag === 'hanzi') return `/${language.value}/${dialect.value}/dict/h/${encodeURIComponent(result.info.query)}`
  if (result.tag === 'ciyu') return `/${language.value}/${dialect.value}/dict/c/${encodeURIComponent(result.info.query)}`

  return '/'
}
</script>

<template>
  <div class="narrow-layout">

    <div class="nav-button-wrapper">
      <router-link class="search-back-button" :to="getPath('home')">
        <span class="search-back-button__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m14 18-6-6 6-6"/>
          </svg>
        </span>
        <span v-formatted-text="$t('search_result.back_to_home')"/>
      </router-link>

      <button v-if="isRandom" @click="handleRetry"
              class="dev-btn-middle dev-add-btn"
              v-formatted-text="$t('search_result.random_again')"
      />
    </div>


    <div v-if="loading" class="results-section search-result-skeleton" aria-hidden="true">
      <div v-for="index in 4" :key="index" class="search-result-item skeleton-result-card">
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

        <div class="results-list">
          <router-link
              v-for="(result, index) in results[0]"
              :key="`main-${index}`"
              :class="['search-result-item', result.tag === 'hanzi'? 'hanzi-item': 'ciyu-item']"
              :to="getResultLink(result)"
          >
            <div class="result-content">

              <div class="result-main">
                <h3 class="result-title" v-formatted-text="result.title"/>
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
                <h3 class="result-title" v-formatted-text="result.title"/>
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
            class="dev-btn-middle dev-nav-button load-more-btn"
            @click="loadMoreExtraResults"
            v-formatted-text="$t('search_result.more_result')"
        />

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
  min-height: 42px;
  padding: 5px 14px 5px 6px;
  border-radius: 13px;
  color: var(--color-text);
  background: #fff;
  box-shadow: 0 6px 18px rgba(46, 91, 52, .09), 0 2px 6px rgba(31, 62, 36, .05);
  font-weight: 600;
  text-decoration: none;
  transition: background-color .22s ease, box-shadow .22s ease;
}

.search-back-button:hover,
.search-back-button:focus-visible {
  outline: none;
  background: #f8fbf6;
  box-shadow: 0 9px 23px rgba(46, 91, 52, .14), 0 3px 8px rgba(31, 62, 36, .06);
}

.search-back-button__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  color: var(--color-primary-dark);
  background: #dcebd3;
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

.results-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.search-result-item {
  --result-accent: #4f8e53;
  --result-icon-bg: rgba(255, 255, 255, .42);

  position: relative;
  border: 0;
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--result-accent) 10%, transparent),
    0 2px 7px rgba(31, 45, 36, .045);
  transition: background-color .22s ease, box-shadow .22s ease, filter .22s ease;
  cursor: pointer;
}

.search-result-item:hover,
.search-result-item:focus-visible {
  outline: none;
  filter: saturate(1.035) brightness(.985);
  box-shadow: 0 11px 28px color-mix(in srgb, var(--result-accent) 16%, transparent),
    0 3px 9px rgba(31, 45, 36, .06);
}

.hanzi-item {
  --result-accent: #4f8e53;
  --result-icon-bg: rgba(244, 251, 239, .58);
  background: #c5dfa7;
}

.ciyu-item {
  --result-accent: #4f7fa9;
  --result-icon-bg: rgba(245, 250, 255, .66);
  background: #c9def1;
}

.extra-item {
  box-shadow: 0 6px 18px color-mix(in srgb, var(--result-accent) 9%, transparent),
    0 2px 6px rgba(31, 45, 34, .04);
}

.extra-item.hanzi-item {
  --result-accent: #72945c;
  --result-icon-bg: rgba(255, 255, 255, .5);
  background: #e1eed5;
}

.extra-item.ciyu-item {
  --result-accent: #a27b49;
  --result-icon-bg: rgba(255, 251, 244, .62);
  background: #f0e0c7;
}

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

.load-more-btn {
  align-self: center;
  min-width: 180px;
  margin-top: 2px;
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
  width: 20px;
  height: 20px;
  margin-left: 12px;
  flex-shrink: 0;
  color: var(--result-accent);
  opacity: .28;
  transition: opacity .22s ease;
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
  opacity: .72;
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
  box-shadow: 0 8px 22px rgba(46, 91, 52, .07), 0 2px 7px rgba(31, 62, 36, .04);
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

@media (max-width: 600px) {
  .nav-button-wrapper {
    margin-bottom: 18px;
  }

  .result-content {
    min-height: 78px;
    padding: 15px 16px;
  }

  .result-title {
    font-size: 21px;
  }

  .result-explain {
    font-size: 16px;
  }

  .result-icon {
    margin-left: 10px;
  }

  .result-arrow {
    margin-left: 8px;
  }

  .extra-group {
    margin-top: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .search-result-item,
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
