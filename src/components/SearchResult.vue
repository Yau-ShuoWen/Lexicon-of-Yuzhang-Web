<script setup>
import {ref, computed, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import StatusDisplay from './Status/StatusDisplay.vue'
import JumpButton from "./Button/JumpButton.vue";

const route = useRoute()
const router = useRouter()

/** 状态 */
const searchQuery = ref('')
const results = ref([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)


const language = computed(() => {
  return route.params.language || 'sc'
})

const dialect = computed(() => {
  return route.params.dialect || 'nam'
})

/**
 * 当前页面状态
 */
const currentStatus = computed(() => {
  if (loading.value) return 'loading'
  if (error.value) return 'error'
  if (searched.value && results.value.length === 0) return 'empty'
  if (!searched.value) return 'initial'
  return null
})

/**
 * 搜索配置（仍使用 localStorage）
 */
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
const searchAll = async (query) => {
  if (!query.trim()) return

  loading.value = true
  error.value = ''
  searched.value = true
  results.value = []

  try {
    const config = getSearchConfig()

    const params = new URLSearchParams({
      query: query.trim(),
      lang: language.value,
      vague: config.vague
    })

    const res = await fetch(`/api/search/${dialect.value}/search-query?${params}`)
    if (!res.ok) throw new Error('查询失败，请稍后重试')

    results.value = await res.json()
  } catch (err) {
    console.error('查询失败:', err)
    error.value = err.message || '查询失败，请检查网络'
  } finally {
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
        searchAll(newQuery)
      }
    },
    {immediate: true}
)

/**
 * 重试
 */
const handleRetry = () => {
  if (searchQuery.value.trim()) {
    searchAll(searchQuery.value)
  }
}

const handleResultClick = (result) => {
  if (!result?.tag || !result?.info) {
    console.error('搜索结果结构异常:', result)
    return
  }

  if (result.tag === 'hanzi') router.push(`/${language.value}/${dialect.value}/h/${encodeURIComponent(result.info.hanzi)}`)
  if (result.tag === 'ciyu') router.push(`/${language.value}/${dialect.value}/c/${encodeURIComponent(result.info.ciyu)}`)
}
</script>

<template>
  <div class="search-results-page">
    <div class="results-container">
      <JumpButton to="/home" button-text="← 返回首页" size="middle"/>

      <!-- 状态显示组件 -->
      <StatusDisplay
          v-if="currentStatus"
          :type="currentStatus"
          :message="error"
          :show-retry="currentStatus === 'error'"
          @retry="handleRetry"
      />

      <!-- 通用搜索结果展示 -->
      <div v-else-if="results.length > 0" class="results-section">
        <div class="results-header">
          <h2 class="section-title">查询结果</h2>
          <p class="results-count">找到 {{ results.length }} 个相关结果</p>
        </div>

        <div class="results-list">
          <div
              v-for="(result, index) in results"
              :key="index"
              class="result-item"
              @click="handleResultClick(result)"
          >
            <div class="result-content">
              <div class="result-main">
                <h3 class="result-title">{{ result.title }}</h3>
                <p class="result-explain">{{ result.explain }}</p>
              </div>
              <div class="result-meta">
                <span class="result-tag">{{ result.tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-results-page {
  min-height: 100vh;
  background: var(--color-background);
}

.results-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px 20px;
}

.results-header {
  margin-bottom: 30px;
}

.section-title {
  font-size: 24px;
  color: var(--color-text);
  margin-bottom: 8px;
}

.results-count {
  color: var(--color-text-light);
  font-size: 14px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-item {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.result-item:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
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
  color: var(--color-primary);
  margin-bottom: 8px;
}

.result-explain {
  color: var(--color-text-light);
  font-size: 14px;
  margin: 0;
}

.result-meta {
  display: flex;
  align-items: center;
}

.result-tag {
  background: var(--color-background-alt);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>