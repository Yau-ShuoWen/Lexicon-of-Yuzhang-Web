<!-- HanziFilter.vue -->

<script setup>
import {computed, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import JumpButton from "../../components/Button/JumpButton.vue"

// 路由
const router = useRouter()
const route = useRoute()

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/${path}`

// 响应式数据
const searchText = ref('')
const searchResults = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const hasSearched = ref(false)

// 方法：执行搜索
const performSearch = async () => {
  if (!searchText.value.trim()) return

  hasSearched.value = true
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/edit/${dialect.value}/by-hanzi?hanzi=${encodeURIComponent(searchText.value)}`)
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
    hasSearched.value = false
  }
})
</script>

<template>
  <div class="narrow-layout">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <h4>筛选需要编辑的内容、回车搜索</h4>
    <div class="search-section">
      <input
          v-model="searchText"
          type="text"
          placeholder="按下回车键搜索"
          @keyup.enter="performSearch"
          class="ordinary-input"
      />
      <button class="dev-btn-small dev-nav-button" @click="performSearch">查询</button>
      <button class="dev-btn-small dev-add-btn" @click="router.push(getPath(`hanzi-editor/new`))">新增汉字</button>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div v-if="searchResults.length > 0" class="results-section">
      <h4>搜索结果（点击编辑）</h4>
      <div class="results-list">
        <div
            v-for="item in searchResults"
            :key="item.tag"
            class="result-item"
            @click="router.push(getPath(`hanzi-editor/${item.tag}`))"
        >
          <div class="item-display">{{ item.title }}</div>
          <div class="pinyin">{{ item.explain }}</div>
          <div class="tag">序号: {{ item.tag }}</div>
        </div>
      </div>
    </div>

    <div v-else-if="hasSearched && !isLoading" class="no-results-high">
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

.item-display {
  min-width: 100px;
  font-size: 18px;
  font-weight: bold;
}

.pinyin {
  min-width: 120px;
  color: #2196f3;
}

.tag {
  color: #999;
  font-size: 14px;
}
</style>