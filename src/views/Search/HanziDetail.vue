<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";
import { showError } from "../../services/ToastService.js";

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const data = ref(null)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const query = computed(() => route.params.query)

// 读取搜索配置
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
 * 获取汉字详情
 */
const fetchHanzi = async () => {
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
    const response = await fetch(`/api/search/${language.value}/${dialect.value}/hanzi?${params}`)
    const json = await response.json().catch(() => null)

    if (!response.ok) throw new Error(json?.message || `HTTP错误: ${response.status}`)
    if (!json.success) throw new Error(json.message || '查询失败')

    data.value = json.data
  } catch (e) {
    loading.value = false
    if (e.message.includes("not found")) {
      showError('未找到资料，请确认是否是从结果页正确跳转的')
    } else {
      console.error(e)
      showError(e.message)
    }
  }
  finally {
    loading.value = false
  }
}
/**
 * 路由变化重新加载
 */
watch(
    () => route.params.query,
    () => {
      fetchHanzi()
    },
    {immediate: true}
)
</script>
<template>
  <div class="middle-layout">

    <LoadingIcon v-if="loading"/>

    <div v-else-if="data" class="detail-content">
      <div class="hanzi-header">
        <h1 class="hanzi-char">{{ data.hanzi }}</h1>
      </div>

      <!-- 每个读音 -->
      <div
          v-for="(info,index) in data.info"
          :key="index"
          class="pronunciation-block"
      >
        <div class="group-header">
          <h2 class="pinyin-title" v-formatted-text="$t(info.mainPy)"/>
        </div>

        <p class="special">{{ info.special }}</p>

        <div class="detail-grid">

          <div class="left-block">
            <h3 class="section-title">所有讀音</h3>
            <table
                v-if="info.variantPy && info.variantPy.length"
                class="table"
            >
              <tr v-for="(v,i) in info.variantPy" :key="'v'+i">
                <td class="cell-label" v-formatted-text="v.left"/>
                <td class="cell-value" v-formatted-text="v.right"/>
              </tr>
            </table>
          </div>

          <div
              v-if="info.mdrInfo && info.mdrInfo.length"
              class="right-block"
          >
            <h3 class="section-title">对应普通话</h3>
            <table class="table">
              <tr v-for="(m,i) in info.mdrInfo" :key="'m'+i">
                <td class="cell-equal" v-formatted-text="$t(m.left)"/>
                <td class="cell-equal" v-formatted-text="$t(m.right)"/>
              </tr>
            </table>
          </div>
        </div>

<!--        &lt;!&ndash; IPA &ndash;&gt;-->
<!--        <div-->
<!--            v-if="info.ipa && info.ipa.length"-->
<!--            class="section"-->
<!--        >-->
<!--          <h3 class="section-title">-->
<!--            国际音标-->
<!--          </h3>-->
<!--          <div v-for="(ipa,i) in info.ipa" :key="i" class="ipa-row">-->
<!--            <span class="ipa-dict">{{ ipa.left }}</span>-->
<!--            <span class="ipa-value" v-formatted-text="$t(ipa.right)"/>-->
<!--          </div>-->
<!--        </div>-->



        <div
            v-if="info.note && info.note.length"
            class="section"
        >
          <div class="group-header">

          </div>
          <h3 class="pinyin-title">
            注释
          </h3>
          <div
              v-for="(n,i) in info.note"
              :key="i"
              class="note-row"
          >
            <div class="note-title" v-formatted-text="n.left"/>
            <div class="note-content" v-formatted-text="n.right"/>
          </div>
        </div>
      </div>

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
  margin-left: 5px;
  margin-bottom: 0;
}

.special {
  color: var(--color-text-light);
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  table-layout: fixed;
}

.table td {
  border: 1px solid #ddd;
  padding: 6px 8px;
}

/* variantPy 左侧标签 */
.cell-label {
  background: #f7f7f7;
  width: 50%;
  font-weight: 500;
}

/* variantPy 右侧拼音 */
.cell-value {
  width: 50%;
}

/* mdrInfo 两边等宽 */
.cell-equal {
  width: 50%;
}

/* 横向布局 */
.detail-grid {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.detail-grid {
  display: grid;

  /* 关键：10等分布局 */
  grid-template-columns: 3fr 1fr 3fr 3fr;

  align-items: start;
}

/* 左块占第1列 */
.left-block {
  grid-column: 1;
}

/* 右块占第3列 */
.right-block {
  grid-column: 3;
}

.ipa-row {
  display: flex;
  justify-content: space-between;
}

.ipa-dict {
  color: var(--color-text-light);
}

.ipa-value {
  font-family: monospace;
}

.note-row {
  margin-bottom: 10px;
}

.note-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.note-content {
  line-height: 1.5;
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

@media (max-width: 768px) {
  .detail-grid {
    display: block; /* 直接取消 grid */
  }

  .table {
    width: 70%;
  }
}
</style>