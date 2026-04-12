<!-- src/views/ref/RefFilter.vue -->

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DictSelect from '../../../components/Select/DictSelect.vue'
import JumpButton from "../../../components/Button/JumpButton.vue";
import { showError } from "../../../services/ToastService.js";
import LoadingIcon from "../../../components/Status/LoadingIcon.vue";

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
const hasSearched = ref(false)
const selectedDictionary = ref('')

// 分页选择
const pageOptions = ref([])
const selectedPage = ref('')
const isLoadingPages = ref(false)


// 搜索
const performSearch = async () => {
  if (!searchText.value.trim() || !selectedDictionary.value) return

  hasSearched.value = true
  isLoading.value = true
  searchResults.value = []

  try {
    const response = await fetch(`/api/ref/find-content/${selectedDictionary.value}?query=${encodeURIComponent(searchText.value)}`)
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message)

    searchResults.value = json.data;
  } catch (e) {
    showError('搜索失败：' + e.message)
    searchResults.value = []
  }
  finally {
    isLoading.value = false
  }
}

// 获取分页
const fetchPageOptions = async () => {
  if (!selectedDictionary.value) return

  isLoadingPages.value = true
  pageOptions.value = []
  selectedPage.value = ''

  try {
    const response = await fetch(`/api/ref/get-catalog/${selectedDictionary.value}`)
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message)

    pageOptions.value = json.data.map(item => ({
      label: item.right,
      value: item.left
    }))
  } catch (e) {
    showError('获取分页失败：' + e.message)
  }
  finally {
    isLoadingPages.value = false
  }
}


watch(selectedPage, async (val) => {
  if (!val || !selectedDictionary.value) return
  window.open(getPath(`ref-editor/${selectedDictionary.value}/${val}`), '_blank')
})


// 输入监听
watch(searchText, (newValue) => {
  if (!newValue.trim()) {
    searchResults.value = []
    hasSearched.value = false
  }
})

// 词典变化
watch(selectedDictionary, () => {
  searchResults.value = []
  searchText.value = ''
  fetchPageOptions()
})
</script>

<template>
  <div class="middle-layout">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <h4>参考文献管理</h4>

    <!-- 词典选择 -->
    <div class="dict-section">
      <DictSelect
          v-model="selectedDictionary"
          :dialect="dialect.toString()"
          cache-key="ref-dict"
          placeholder="请选择词典"
          :show-label="true"
          label-text="词典选择"
          width="300px"
      />
    </div>

    <!-- 快速跳转 -->
    <div class="nav-buttons">

      <div class="small-input">
        <select
            v-model="selectedPage"
            :disabled="!selectedDictionary || isLoadingPages"
            class="dev-btn-small"
        >
          <option value="">選擇跳轉頁面</option>
          <option
              v-for="item in pageOptions"
              :key="item.value"
              :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- 搜索 -->
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

    <LoadingIcon v-if="isLoading"/>

    <div v-if="searchResults.length > 0" class="results-section">
      <h4>搜索结果（点击编辑）</h4>
      <div class="results-list">
        <router-link
            v-for="item in searchResults"
            :key="item.tag"
            :to="getPath(`ref-editor/${item.info.dict}/${item.info.sort}`)"
            class="result-item"
            target="_blank"
        >
          <div class="item-title" v-formatted-text="item.title" />
          <div class="item-explain" v-formatted-text="item.explain" />
          <div class="item-tag" v-formatted-text="item.tag" />
        </router-link>
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
  border: 1px solid #bababa;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.1s;
}

.result-item:hover {
  background-color: #ffffff;
}

/* 左边 title —— 固定宽度 */
.item-title {
  flex: 0 0 200px;   /* ⭐ 关键：固定宽度 */
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 中间 explain */
.item-explain {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右边 tag */
.item-tag {
  flex: 0 0 5em;
  text-align: right;
  white-space: nowrap;
}
</style>