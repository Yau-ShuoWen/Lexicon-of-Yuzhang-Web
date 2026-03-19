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
 * 获取汉字详情
 */
const fetchHanzi = async () => {
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
    const res = await fetch(`/api/search/${language.value}/${dialect.value}/hanzi?${params}`)
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
  <div class="hanzi-detail-page">
    <div class="detail-container">
      <BackButton
          button-text="← 返回"
          size="middle"
      />

      <StatusDisplay
          v-if="currentStatus"
          :type="currentStatus"
          :message="error"
          :show-retry="currentStatus === 'error'"
          @retry="fetchHanzi"
      />

      <div v-else class="detail-content">
        <!-- 汉字标题 -->
        <div class="hanzi-header">
          <h1 class="hanzi-char">
            {{ data.hanzi }}
          </h1>
        </div>

        <!-- 每个读音 -->
        <div
            v-for="(info,index) in data.info"
            :key="index"
            class="pronunciation-block"
        >
          <h2 class="pinyin" v-formatted-text="$t(info.mainPy)"/>

          <p class="special">{{ info.special }}</p>

          <!-- 读音变体 -->
          <div v-if="info.variantPy && info.variantPy.length" class="section">
            <h3 class="section-title">
              异读
            </h3>
            <div
                v-for="(v,i) in info.variantPy"
                :key="i"
                class="variant-row"
            >
              <span v-formatted-text="v.left"/>
              <span class="variant-py" v-formatted-text="$t(v.right)"/>
            </div>
          </div>

          <!-- 普通话参考 -->
          <div
              v-if="info.mdrInfo && info.mdrInfo.length"
              class="section"
          >
            <h3 class="section-title">
              普通话讀音對應
            </h3>
            <div
                v-for="(m,i) in info.mdrInfo"
                :key="i"
                class="mdr-row"
                v-formatted-text="$t(m)"
            />
          </div>

          <!-- 释义 -->
          <div
              v-if="info.mean && info.mean.length"
              class="section"
          >
            <h3 class="section-title">释义</h3>
            <ul class="mean-list">
              <li
                  v-for="(m,i) in info.mean"
                  :key="i"
                  v-formatted-text="m"
              />
            </ul>
          </div>

          <!-- IPA -->
          <div
              v-if="info.ipa && info.ipa.length"
              class="section"
          >
            <h3 class="section-title">
              国际音标
            </h3>
            <div
                v-for="(ipa,i) in info.ipa"
                :key="i"
                class="ipa-row"
            >
              <span class="ipa-dict">{{ ipa.left }}</span>
              <span class="ipa-value" v-formatted-text="$t(ipa.right)"/>
            </div>
          </div>

          <div
              v-if="info.note && info.note.length"
              class="section"
          >
            <h3 class="section-title">
              注释
            </h3>
            <div
                v-for="(n,i) in info.note"
                :key="i"
                class="note-row"
            >
              <strong v-formatted-text="n.left"/>
              <span v-formatted-text="n.right"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.hanzi-detail-page {
  min-height: 100vh;
}

.detail-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px 20px;
}

.hanzi-header {
  text-align: center;
  margin-bottom: 30px;
}

.hanzi-char {
  font-size: 72px;
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

.special {
  color: var(--color-text-light);
}

.mean-list {
  padding-left: 20px;
}

.variant-row {
  display: flex;
  gap: 10px;
}

.variant-py {
  font-weight: 600;
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

.mdr-row {
  margin-bottom: 4px;
}

.note-row {
  display: flex;
  gap: 8px;
}
</style>