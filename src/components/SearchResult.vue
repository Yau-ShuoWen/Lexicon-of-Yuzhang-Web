<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackButton from "./Button/BackButton.vue";
import StatusDisplay from "./Status/StatusDisplay.vue";

const route = useRoute()
const router = useRouter()

const searchQuery = ref('')
const results = ref([])  // 现在存储 SearchResult 列表
const loading = ref(false)
const error = ref('')
const searched = ref(false)

// 计算当前状态类型
const currentStatus = computed(() => {
  if (loading.value) return 'loading'
  if (error.value) return 'error'
  if (searched.value && results.value.length === 0) return 'empty'
  if (!searched.value) return 'initial'
  return null
})

// 获取当前语言
const getCurrentLanguage = () => {
  return localStorage.getItem('user-locale') || 'sc'
}

// 获取搜索配置
const getSearchConfig = () => {
  try {
    const cachedConfig = localStorage.getItem('search_page_config')
    if (cachedConfig) {
      return JSON.parse(cachedConfig)
    }
  } catch (err) {
    console.error('获取搜索配置失败:', err)
  }

  // 默认配置
  return {
    vague: false
  }
}

const searchAll = async (query) => {
  if (!query.trim()) return

  loading.value = true
  error.value = ''
  searched.value = true
  results.value = []

  try {
    const config = getSearchConfig()
    const currentLang = getCurrentLanguage()

    // 构建查询参数 - 使用 GET 请求
    const params = new URLSearchParams({
      query: query.trim(),
      lang: currentLang,
      vague: config.vague
    })

    const response = await fetch(`/api/search/nam/search-query?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('查询失败，请稍后重试')
    }

    const data = await response.json()
    results.value = data
  } catch (err) {
    console.error('查询失败:', err)
    error.value = err.message || '查询失败，请检查网络连接'
  } finally {
    loading.value = false
  }
}

// 处理结果项点击
const handleResultClick = (result) => {
  if (!result.tag || !result.info) {
    console.error('结果项缺少必要信息:', result)
    return
  }

  // 根据 tag 动态跳转
  if (result.tag === 'hanzi') {
    const hanzi = result.info.hanzi
    const lang = result.info.lang

    router.push({
      path: `/h/${encodeURIComponent(hanzi)}`,
      state: {
        lang: lang,
        searchResult: result
      }
    })
  }

  if (result.tag === 'ciyu') {
    const ciyu = result.info.ciyu
    const lang = result.info.lang

    router.push({
      path: `/c/${encodeURIComponent(ciyu)}`,
      state: {
        lang: lang,
        searchResult: result
      }
    })
  }

}

// 重试搜索
const handleRetry = () => {
  if (searchQuery.value.trim()) {
    searchAll(searchQuery.value)
  }
}

// 监听语言变化
const handleLanguageChange = () => {
  if (searchQuery.value.trim()) {
    searchAll(searchQuery.value)
  }
}

// 设置语言变化监听器
const setupLanguageListener = () => {
  window.addEventListener('languageChanged', handleLanguageChange)
}

// 移除语言变化监听器
const removeLanguageListener = () => {
  window.removeEventListener('languageChanged', handleLanguageChange)
}

watch(() => route.query.q, (newQuery) => {
  if (newQuery) {
    searchQuery.value = newQuery
    searchAll(newQuery)
  }
})

onMounted(() => {
  if (route.query.q) {
    searchQuery.value = route.query.q
    searchAll(route.query.q)
  }
  setupLanguageListener()
})

onUnmounted(() => {
  removeLanguageListener()
})
</script>

<template>
  <div class="search-results-page">
    <div class="results-container">
      <BackButton target-route="/" button-text="← 返回首页" />

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