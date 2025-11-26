<!-- FilterPage.vue -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'


const router = useRouter()

// 响应式数据
const searchText = ref('')
const searchResults = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

// 方法：执行搜索
const performSearch = async () => {
  if (!searchText.value.trim()) return

  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/edit/nam/byhanzi?hanzi=${encodeURIComponent(searchText.value)}`)
    if (!response.ok) throw new Error('网络请求失败')

    const data = await response.json()
    searchResults.value = data
  } catch (error) {
    errorMessage.value = '搜索失败：' + error.message
    searchResults.value = []
  } finally {
    isLoading.value = false
  }
}

const selectItem = (item) => {
  const route = router.resolve(`/edit/${item.id}`)
  window.open(route.href, '_blank')
}

const createNew = () => {
  const route = router.resolve(`/edit/new`)
  window.open(route.href, '_blank')
}
</script>

<template>
  <div class="filter-page">
    <div class="search-section">
      <input
          v-model="searchText"
          type="text"
          placeholder="输入简体或繁体汉字进行搜索"
          @keyup.enter="performSearch"
          @input="performSearch"
      />
      <button @click="performSearch" :disabled="isLoading">
        {{ isLoading ? '搜索中...' : '搜索' }}
      </button>
      <button @click="createNew">新增汉字</button>
    </div>

    <!-- 错误信息 -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- 搜索结果 -->
    <div v-if="searchResults.length > 0" class="results-section">
      <h3>搜索结果 (点击条目进行编辑)</h3>
      <div class="results-list">
        <div
            v-for="item in searchResults"
            :key="item.id"
            class="result-item"
            @click="selectItem(item)"
        >
          <div class="hanzi-display">
            <span class="simplified">{{ item.hanzi }}</span>
            <span class="traditional" v-if="item.hantz && item.hantz !== item.hanzi">
              / {{ item.hantz }}
            </span>
          </div>
          <div class="pinyin">{{ item.stdPy }}</div>
          <div class="id">序号: {{ item.id }}</div>
        </div>
      </div>
    </div>

    <div v-else-if="searchText && !isLoading" class="no-results">
      未找到相关汉字
    </div>
  </div>
</template>

<style scoped>
.filter-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.search-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-section input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.search-section button {
  padding: 8px 16px;
  border: 1px solid #007cba;
  background: #007cba;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.search-section button:disabled {
  background: #ccc;
  border-color: #ccc;
  cursor: not-allowed;
}

.error-message {
  color: #d32f2f;
  background: #ffebee;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.results-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.result-item:hover {
  background-color: #f5f5f5;
}

.hanzi-display {
  min-width: 100px;
  font-size: 18px;
}

.simplified {
  font-weight: bold;
}

.traditional {
 /* color: #666;*/
  font-weight: bold;
 /* margin-left: 5px;*/
}

.pinyin {
  min-width: 120px;
  color: #2196f3;
}

.id {
  color: #999;
  font-size: 14px;
}

.no-results {
  text-align: center;
  color: #666;
  padding: 40px;
}
</style>