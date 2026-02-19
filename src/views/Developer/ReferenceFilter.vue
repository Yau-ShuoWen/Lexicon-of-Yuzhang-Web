<!-- src/views/ref/RefFilter.vue -->

<script setup>
import {ref, computed, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import DictSelect from '../../components/Select/DictSelect.vue'
import JumpButton from "../../components/Button/JumpButton.vue";

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
const selectedDictionary = ref('')


// 执行搜索
const performSearch = async () => {
  if (!searchText.value.trim() || !selectedDictionary.value) return

  hasSearched.value = true
  isLoading.value = true
  errorMessage.value = ''
  searchResults.value = []

  try {
    const response = await fetch(`/api/ref/find-content/${selectedDictionary.value}?query=${encodeURIComponent(searchText.value)}`)
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message)

    searchResults.value = json.data;
  } catch (error) {
    errorMessage.value = '搜索失败：' + error.message
    searchResults.value = []
  } finally {
    isLoading.value = false
  }
}

// 跳转特殊页面（第一页/最后一页/随机页）
const jumpSpecialPage = async (type) => {
  if (!selectedDictionary.value) return

  try {
    const response = await fetch(
        `/api/ref/get-page-special/${selectedDictionary.value}?query=${type}`
    )
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message)

    const sort = json.data.frontSort   // RefPage 的开头序号
    await router.push(getPath(`ref-editor/${selectedDictionary.value}/${sort}`))

  } catch (error) {
    errorMessage.value = '跳转失败：' + error.message
  }
}


// 监听搜索输入
watch(searchText, (newValue) => {
  if (!newValue.trim()) {
    searchResults.value = []
    errorMessage.value = ''
    hasSearched.value = false
  }
})

// 监听词典变化
watch(selectedDictionary, () => {
  searchResults.value = []
  searchText.value = ''
})
</script>

<template>
  <div class="narrow-layout">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <h4>参考文献管理</h4>

    <!-- 词典选择 -->
    <div class="dict-section">
      <DictSelect
          v-model="selectedDictionary"
          :dialect="dialect"
          cache-key="ref-dict"
          placeholder="请选择词典"
          :show-label="true"
          label-text="词典选择"
          width="300px"
      />
    </div>

    <!-- 快速跳转按钮 -->
    <div class="nav-buttons">
      <button
          class="dev-btn-small dev-nav-button"
          :disabled="!selectedDictionary"
          @click="jumpSpecialPage('first-page')"
      >
        第一页
      </button>

      <button
          class="dev-btn-small dev-nav-button"
          :disabled="!selectedDictionary"
          @click="jumpSpecialPage('last-page')"
      >
        最后一页
      </button>

      <button
          class="dev-btn-small dev-nav-button"
          :disabled="!selectedDictionary"
          @click="jumpSpecialPage('random')"
      >
        随机页
      </button>
    </div>

    <div class="search-section">
      <input
          v-model="searchText"
          type="text"
          placeholder="输入关键词，按下回车键搜索"
          @keyup.enter="performSearch"
          :disabled="!selectedDictionary"
          class="ordinary-input"
      />
      <button class="dev-btn-small dev-nav-button" @click="performSearch">查询</button>
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
            @click="router.push(getPath(`ref-editor/${item.info.dict}/${item.info.sort}`))"
        >
          <div class="item-display">{{ item.title }}</div>
          <div class="tag">序号: {{ item.tag }}</div>
        </div>
      </div>
    </div>

    <div v-else-if="hasSearched && !isLoading" class="no-results-high">
      未找到相关内容
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

.tag {
  color: #999;
  font-size: 14px;
}
</style>