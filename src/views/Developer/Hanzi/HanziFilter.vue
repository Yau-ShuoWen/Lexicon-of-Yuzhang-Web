<!-- HanziFilter.vue -->

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showError } from "../../../services/ToastService.js";
import { useHead } from "@vueuse/head";

// 路由
const router = useRouter()
const route = useRoute()

useHead({title: () => `漢字編輯器：查找`})

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/dev/${path}`

// 响应式数据
const searchText = ref('')
const searchResults = ref([])
const isLoading = ref(false)
const hasSearched = ref(false)

// 方法：执行搜索
const performSearch = async () => {
  if (!searchText.value.trim()) return

  hasSearched.value = true
  isLoading.value = true

  try {
    const response = await fetch(`/api/edit/hanzi/filter/${dialect.value}?hanzi=${encodeURIComponent(searchText.value)}`)
    if (!response.ok) throw new Error('網絡請求失敗')

    searchResults.value = await response.json()
  } catch (error) {
    showError('搜索失敗：' + error.message)
    searchResults.value = []
  }
  finally {
    isLoading.value = false
  }
}

watch(searchText, (newValue) => {
  if (!newValue.trim()) {
    searchResults.value = []
    hasSearched.value = false
  }
})
</script>

<template>
  <div class="narrow-layout">

    <div class="search-section">
      <input
          v-model="searchText"
          type="text"
          placeholder="篩選需要編輯的內容、回車搜索"
          @keyup.enter="performSearch"
          class="mid-input"
      />
      <button class="dev-btn-middle dev-nav-button" @click="performSearch">查询</button>
      <router-link :to="getPath(`hanzi-creator`)" target="_blank"
                   class="dev-btn-middle dev-add-btn">
        新增漢字
      </router-link>
    </div>

    <div v-if="searchResults.length > 0" class="results-section">
      <h4>搜索结果（点击编辑）</h4>
      <router-link
          v-for="item in searchResults"
          :key="item.tag"
          :to="getPath(`hanzi-editor/${item.info.query}`)"
          class="result-item"
          target="_blank"
      >
        <div class="item-display">{{ item.title }}</div>
        <div class="item-display">{{ item.explain }}</div>
      </router-link>
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
  margin-top: 40px;
  margin-bottom: 20px;
}

.results-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 20px;
  border: 1px solid var(--color-text-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.result-item:hover {
  background-color: #d3dfd5;
}

.item-display {
  min-width: 100px;
  font-size: 20px;
  font-weight: bold;
}
</style>