<!-- HanziEditFilter.vue -->

<script setup>
import {ref, watch} from 'vue'
import {useRouter} from 'vue-router'
import JumpButton from "../../components/Button/JumpButton.vue";

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
    const response = await fetch(`/api/edit/nam/by-hanzi?hanzi=${encodeURIComponent(searchText.value)}`)
    if (!response.ok) throw new Error('网络请求失败')

    searchResults.value = await response.json()
  } catch (error) {
    errorMessage.value = '搜索失败：' + error.message
    searchResults.value = []
  } finally {
    isLoading.value = false
  }
}

watch(searchText, (newValue) => {
  if (!newValue.trim()) {
    searchResults.value = []
    errorMessage.value = ''
  }
})

const selectItem = (item) => {
  const route = router.resolve(`/edit/${item.id}`)
  window.open(route.href, '_blank')
}

const createNew = () => {
  const route = router.resolve(`/edit/new`)
  window.open(route.href, '_blank')
}

// 格式化汉字显示
const formatHanzi = (item) => {
  if (item.hantz === item.hanzi) return item.hanzi
  return `${item.hanzi} / ${item.hantz}`
}
</script>

<template>
  <div class="narrow-layout">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <h4>回车和「搜索」都可以刷新结果</h4>
    <div class="search-section">
      <input
          v-model="searchText"
          type="text"
          placeholder="输入简体或繁体汉字进行搜索"
          @keyup.enter="performSearch"
          @input="performSearch"
      />
      <button class="dev-btn-small dev-nav-button" @click="performSearch" :disabled="isLoading">
        {{ isLoading ? '搜索中...' : '搜索' }}
      </button>
      <button class="dev-btn-small dev-add-btn" @click="createNew">新增汉字</button>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div v-if="searchResults.length > 0" class="results-section">
      <h4>搜索结果（点击编辑）</h4>
      <div class="results-list">
        <div
            v-for="item in searchResults"
            :key="item.id"
            class="result-item"
            @click="selectItem(item)"
        >
          <div class="hanzi-display">
            {{ formatHanzi(item) }}
          </div>
          <div class="pinyin">{{ item.stdPy }}</div>
          <div class="id">序号: {{ item.id }}</div>
        </div>
      </div>
    </div>

    <div v-else-if="searchText && !isLoading" class="no-results-high">
      未找到相关汉字
    </div>
  </div>
</template>

<style>
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
  font-weight: bold;
}

.pinyin {
  min-width: 120px;
  color: #2196f3;
}

.id {
  color: #999;
  font-size: 14px;
}
</style>