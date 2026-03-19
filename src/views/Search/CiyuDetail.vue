<!--  CiyuDetail.vue  -->

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusDisplay from '../../components/Status/StatusDisplay.vue'
import BackButton from "../../components/Button/BackButton.vue";

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const data = ref(null)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const query = computed(() => route.params.query)

const currentStatus = computed(() => {
  if (loading.value) return 'loading'
  if (error.value) return 'error'
  if (!data.value) return 'empty'
  return null
})

/**
 * 读取搜索配置
 */
const getSearchConfig = () => {
  try {
    const cached = localStorage.getItem('search_page_config')
    if (cached) return JSON.parse(cached)
  } catch (e) {
    console.error('读取搜索配置失败', e)
  }
  return {
    phonogram: 1,
    toneStyle: 1,
    syllableStyle: 1
  }
}

/**
 * 获取词语详情
 */
const fetchCiyu = async () => {
  loading.value = true
  error.value = ''
  data.value = null
  try {
    const config = getSearchConfig()
    const params = new URLSearchParams({
      query: query.value,
      phonogram: config.phonogram,
      syllableStyle: config.syllableStyle,
      toneStyle: config.toneStyle
    })
    const res = await fetch(`/api/search/${language.value}/${dialect.value}/ciyu?${params}`)
    if (!res.ok) throw new Error('请求失败')
    const json = await res.json()
    if (!json.success) throw new Error(json.message || '查询失败')
    data.value = json.data
  } catch (err) {
    console.error(err)
    error.value = err.message || '查询失败'
  }
  finally {
    loading.value = false
  }
}

const mainPyStr = computed(() => {
  if (!data.value?.mainPy) return ''
  return data.value.mainPy.join('')  // 每个拼音用空格分隔
})

/**
 * 路由变化重新加载
 */
watch(
    () => route.params.query,
    () => {
      fetchCiyu()
    },
    { immediate: true }
)
</script>

<template>
  <div class="ciyu-detail-page">
    <div class="detail-container">
      <BackButton button-text="← 返回" size="middle"/>

      <StatusDisplay
          v-if="currentStatus"
          :type="currentStatus"
          :message="error"
          :show-retry="currentStatus === 'error'"
          @retry="fetchCiyu"
      />

      <div v-else class="detail-content">
        <!-- 词语标题 -->
        <div class="ciyu-header">
          <h1 class="ciyu-text">{{ data.ciyu }}</h1>
        </div>

        <!-- 每个主要读音 -->
        <div class="pronunciation-block">
          <h2 class="pinyin" v-formatted-text="$t(mainPyStr)"/>


          <!-- 读音变体 -->
          <div v-if="data.variantPy && data.variantPy.length" class="section">
            <h3 class="section-title">异读</h3>
            <div v-for="(row, i) in data.variantPy" :key="i" class="variant-row">
              <span v-for="(v, j) in row" :key="j" v-formatted-text="$t(v)"/>
            </div>
          </div>

          <!-- 释义 -->
          <div v-if="data.mean && data.mean.length" class="section">
            <h3 class="section-title">释义</h3>
            <ul class="mean-list">
              <li v-for="(m, i) in data.mean" :key="i" v-formatted-text="m"/>
            </ul>
          </div>

          <!-- 特殊标记 -->
          <div v-if="data.special" class="section">
            <h3 class="section-title">特殊标记</h3>
            <span>{{ data.special }}</span>
          </div>

          <!-- 近似词 -->
          <div v-if="data.similar && data.similar.length" class="section">
            <h3 class="section-title">近似词</h3>
            <div v-for="(s, i) in data.similar" :key="i">
              <span v-formatted-text="s.left"/> ({{ s.right }})
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.ciyu-detail-page {
  min-height: 100vh;
}

.detail-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px 20px;
}

.ciyu-header {
  text-align: center;
  margin-bottom: 30px;
}

.ciyu-text {
  font-size: 56px;
  font-weight: 700;
  color: var(--color-text);
}

.pronunciation-block {
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 24px;
  margin-bottom: 20px;
}

.section {
  margin-bottom: 18px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}

.pinyin {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 6px;
}

.mean-list {
  padding-left: 20px;
}

.variant-row {
  display: flex;
  gap: 10px;
}
</style>