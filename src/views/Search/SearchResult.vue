<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";
import { showError, showWarning } from "../../services/ToastService.js";
import { useI18n } from 'vue-i18n'
import { useHead } from '@vueuse/head'
import ideaIcon from "../../assets/icons/special/idea.svg"

const {t} = useI18n()

const route = useRoute()
const router = useRouter()

const searchQuery = ref('')
const results = ref([])
const loading = ref(true)

const extraVisibleCount = ref(0)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/${path}`

const isRandom = computed(() => searchQuery.value === 'random')

const visibleExtraResults = computed(() => {
  return results.value?.[1]?.slice(0, extraVisibleCount.value) || []
})

const hasMoreExtraResults = computed(() => {
  const total = results.value?.[1]?.length || 0
  return extraVisibleCount.value < total
})

useHead({
  title: () => {
    if(isRandom) return `${t('common.search')}`
    if (searchQuery.value) return `${t('common.search')}：${searchQuery.value}`;
    else if (loading.value) return `${t('common.loading')}`
  }
})

const handleSearch = async (query) => {
  if (!query.trim()) return

  loading.value = true
  results.value = []
  extraVisibleCount.value = 0

  try {
    const params = new URLSearchParams({
      query: query.trim()
    })

    const res = await fetch(`/api/search/${language.value}/${dialect.value}/query?${params}`)
    if (!res.ok) throw new Error('查询失败，请稍后重试')

    results.value = await res.json()

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
    () => [route.query.q, route.params.language],
    ([newQuery]) => {
      if (newQuery) {
        searchQuery.value = newQuery
        handleSearch(newQuery)
      }
    },
    {immediate: true}
)

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
    handleSearch(searchQuery.value)
  }
}

const getResultLink = (result) => {
  if (!result?.tag || !result?.info) {
    console.error('搜索结果结构异常:', result)
    return '/'
  }

  if (result.tag === 'hanzi') return `/${language.value}/${dialect.value}/h/${encodeURIComponent(result.info.query)}`
  if (result.tag === 'ciyu') return `/${language.value}/${dialect.value}/c/${encodeURIComponent(result.info.query)}`

  return '/'
}
</script>

<template>
  <div class="narrow-layout">

    <div class="nav-button-wrapper">
      <router-link class="dev-normal-button dev-btn-middle router-middle" :to="getPath('home')"
                   v-formatted-text="$t('search_result.back_to_home')"/>

      <button v-if="isRandom" @click="handleRetry"
              class="dev-btn-middle dev-add-btn"
              v-formatted-text="$t('search_result.random_again')"
      />
    </div>


    <LoadingIcon v-if="loading"/>

    <div v-else class="results-section">

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

              <img v-if="result.special === true" :src="ideaIcon" class="result-icon" alt="special"/>

            </div>
          </router-link>
        </div>
      </div>

      <!-- 补充结果 -->
      <div v-if="results[1]?.length" class="results-group extra-group">

        <div v-if="visibleExtraResults.length" class="results-list">
          <router-link
              v-for="(result, index) in visibleExtraResults"
              :key="`extra-${index}`"
              class="search-result-item extra-item"
              :to="getResultLink(result)"
          >
            <div class="result-content">

              <div class="result-main">
                <h3 class="result-title" v-formatted-text="result.title"/>
                <p class="result-explain" v-formatted-text="result.explain"/>
              </div>

              <img v-if="result.special === true"
                   :src="ideaIcon" class="result-icon" alt="special"
              />

            </div>
          </router-link>
        </div>

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

    </div>
  </div>
</template>

<style>

.nav-button-wrapper {
  margin-bottom: 20px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-result-item {
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.search-result-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.hanzi-item {
  background: #b7d397; /*c8dfa6*/
}

.hanzi-item:hover {
  border-color: #889f60;
}

.ciyu-item {
  background: var(--card-bg-color);
}

.ciyu-item:hover {
  border-color: var(--color-primary);
}

.extra-item {
  background: #e4e4e4;
  border: 1px solid #b6b6b6;
}

.extra-item:hover {
  border-color: #999999;
}

.results-section {
  padding-bottom: 100px;
}

.extra-group {
  padding-top: 12px;
  margin-top: 50px;

  display: flex;
  flex-direction: column;
  gap: 20px;
}

.load-more-btn {
  align-self: center;
  min-width: 180px;
}

.load-more-btn {
  align-self: center;
  margin-top: 4px;
}

/* =========================
   内容
========================= */

.result-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
}

.result-main {
  flex: 1;
}

.result-title {
  font-size: 24px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 8px;
}

.result-explain {
  color: var(--color-text-light);
  font-size: 18px;
  margin: 0;
}

.result-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
}

.result-icon {
  width: 28px;
  height: 28px;
  margin-left: 16px;
  opacity: 0.8;
}

.search-end-tip {
  text-align: center;
  margin-top: 50px;
  color: var(--color-text-light);
  line-height: 1.8;
}
</style>