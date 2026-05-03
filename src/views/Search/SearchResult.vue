<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import JumpButton from "../../components/Button/JumpButton.vue";
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

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

useHead({
  title: () =>
  {
    if(searchQuery.value) return `${t('common.search')}：${searchQuery.value}`;
    else if(loading.value) return `${t('common.loading')}`
  }
})

const getSearchConfig = () => {
  try {
    const cached = localStorage.getItem('search_page_config')
    if (cached) return JSON.parse(cached)
  } catch (e) {
    console.error('读取搜索配置失败:', e)
  }

  return {vague: false}
}

/**
 * 执行搜索
 */
const handleSearch = async (query) => {
  if (!query.trim()) return

  loading.value = true
  results.value = []

  try {
    const config = getSearchConfig()

    const params = new URLSearchParams({
      query: query.trim(), vague: config.vague
    })

    const res = await fetch(`/api/search/${language.value}/${dialect.value}/query?${params}`)
    if (!res.ok) throw new Error('查询失败，请稍后重试')

    results.value = await res.json()

    if (results.value.length <= 0) showWarning('沒有查詢到結果')
  } catch (err) {
    console.error('查询失败:', err)
    showError('查询失败，请稍後再試')
  }
  finally {
    loading.value = false
  }
}

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

const handleResultClick = (result) => {
  if (!result?.tag || !result?.info) {
    console.error('搜索结果结构异常:', result)
    return
  }

  let path = ''

  if (result.tag === 'hanzi') path = `/${language.value}/${dialect.value}/h/${encodeURIComponent(result.info.query)}`
  if (result.tag === 'ciyu') path = `/${language.value}/${dialect.value}/c/${encodeURIComponent(result.info.query)}`


  if (path) {
    const routeData = router.resolve(path)
    window.open(routeData.href, '_blank')
  }
}
</script>

<template>
  <div class="narrow-layout">

    <JumpButton to="/home" button-text="← 返回首页" size="middle"/>

    <LoadingIcon v-if="loading"/>

    <div v-else class="results-section">

      <div class="results-list">
        <div class="results-list">
          <router-link
              v-for="(result, index) in results"
              :key="index"
              class="search-result-item"
              :to="getResultLink(result)"
          >
            <div class="result-content">
              <div class="result-main">
                <h3 class="result-title" v-formatted-text="result.title"/>
                <p class="result-explain" v-formatted-text="`{b ${result.explain}}`"/>
              </div>

              <!-- ✅ 新增：右侧图片 -->
              <img
                  v-if="result.special === true"
                  :src="ideaIcon"
                  class="result-icon"
                  alt="special"
              />
            </div>
          </router-link>
        </div>
      </div>

    </div>
  </div>
</template>

<style>
.results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-result-item {
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.search-result-item:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

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
  font-weight: 700;
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
</style>