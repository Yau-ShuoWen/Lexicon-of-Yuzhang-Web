<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import BackButton from "../../components/Button/BackButton.vue"
import LoadingIcon from "../../components/Status/LoadingIcon.vue"
import { showError } from "../../services/ToastService.js"
import { useI18n } from 'vue-i18n'
import { useHead } from '@vueuse/head'

const {t} = useI18n()
const route = useRoute()

const loading = ref(false)
const data = ref(null)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const query = computed(() => route.params.query)

useHead({
  title: () =>
  {
    if(data.value) return `${t('linguistic.ciyu')}：${data.value.ciyu}`;
    else if(loading.value) return `${t('common.loading')}`
  }
})

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

const fetchCiyu = async () => {
  loading.value = true
  data.value = null

  try {
    const config = getSearchConfig()

    const params = new URLSearchParams({
      query: query.value,
      phonogram: config.phonogram,
      syllableStyle: config.syllableStyle,
      toneStyle: config.toneStyle
    })

    const response = await fetch(`/api/search/${language.value}/${dialect.value}/ciyu?${params}`)
    const json = await response.json().catch(() => null)

    if (!response.ok) throw new Error(json?.message || `HTTP错误: ${response.status}`)
    if (!json.success) throw new Error(json.message || '查询失败')

    data.value = json.data
  } catch (e) {
    if (e.message.includes('not found')) {
      showError('未找到词语资料')
    } else {
      console.error(e)
      showError(e.message)
    }
  }
  finally {
    loading.value = false
  }
}

watch(
    () => route.params.query,
    () => {
      fetchCiyu()
    },
    {immediate: true}
)
</script>

<template>
  <div class="middle-layout">

    <LoadingIcon v-if="loading"/>

    <div v-else-if="data" class="detail-content">

      <!-- 词语标题 -->
      <div class="hanzi-header">
        <h1 class="hanzi-char" v-formatted-text="data.ciyu"/>
      </div>

      <!-- 主块 -->
      <div class="pronunciation-block">

        <!-- 主拼音 -->
        <div class="group-header">
          <h2 class="pinyin-title" v-formatted-text="data.mainPy"/>
        </div>

        <!-- special -->
        <p class="special" v-formatted-text="data.special"/>

        <!-- variantPy -->
        <div class="section" v-if="data.variantPy && data.variantPy.length">
          <h3 class="section-title">其他读音</h3>
          <table class="table">
            <tr>
              <td
                  v-for="(v, i) in data.variantPy"
                  :key="i"
                  class="cell-value"
                  v-formatted-text="v"
              />
            </tr>
          </table>
        </div>

        <!-- mean -->
        <div class="section" v-if="data.mean && data.mean.length">
          <h3 class="section-title">释义</h3>
          <ul class="mean-list">
            <li v-for="(m, i) in data.mean" :key="i" v-formatted-text="m"/>
          </ul>
        </div>

        <!-- similar -->
        <div class="section" v-if="data.similar && data.similar.length">
          <h3 class="section-title">相似词</h3>
          <table class="table">
            <tr v-for="(s, i) in data.similar" :key="i">
              <td class="cell-label" v-formatted-text="s.left"/>
              <td class="cell-value" v-formatted-text="s.right"/>
            </tr>
          </table>
        </div>
      </div>

      <!-- ref 单独块 -->
      <div
          class="pronunciation-block"
          v-if="data.ref && data.ref.length"
      >
        <div class="group-header">
          <h3 class="pinyin-title">辞书</h3>
        </div>

        <div
            v-for="(r, i) in data.ref"
            :key="i"
            class="ref-row"
        >
          <div class="ref-content" v-formatted-text="r.content"/>
          <div class="ref-source" v-formatted-text="r.source"/>
        </div>
      </div>

    </div>
  </div>
</template>

<style>
.hanzi-header {
  text-align: center;
  margin: 20px;
}

.hanzi-char {
  font-size: 60px;
  font-weight: 400;
  color: var(--color-text);
}

.pronunciation-block {
  background: var(--color-background);
  border: 2px solid var(--color-primary-light);
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

.pinyin-title {
  font-size: 26px;
  font-weight: 700;
}

.special {
  color: var(--color-text-light);
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}

.table td {
  border: 1px solid #ddd;
  padding: 6px 8px;
}

.cell-label {
  background: #f7f7f7;
  width: 50%;
}

.cell-value {
  width: 50%;
}

.mean-list {
  padding-left: 20px;
}

.ref-row {
  margin-bottom: 12px;
}

.ref-content {
  margin-bottom: 4px;
}

.ref-source {
  font-size: 12px;
  color: var(--color-text-light);
}
</style>