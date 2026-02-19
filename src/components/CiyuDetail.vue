<script setup>
import {ref, onMounted, watch, computed, onUnmounted} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {formatRichText} from '../utils/textFormatter.js'
import BackButton from "./Button/BackButton.vue";
import StatusDisplay from "./Status/StatusDisplay.vue";

const route = useRoute()
const router = useRouter()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const ciyu = ref('')
const ciyuData = ref(null)
const loading = ref(false)
const error = ref('')

// 计算当前状态类型
const currentStatus = computed(() => {
  if (loading.value) return 'loading'
  if (error.value) return 'error'
  if (!ciyuData.value && !loading.value) return 'empty'
  return null
})



// 获取搜索配置
const getSearchConfig = () => {
  try {
    const cachedConfig = localStorage.getItem('search_page_config')
    if (cachedConfig) {
      const config = JSON.parse(cachedConfig)
      return {
        toneStyle: config.tone || 1,
        syllableStyle: config.syllable || 0
      }
    }
  } catch (err) {
    console.error('获取搜索配置失败:', err)
  }

  return {
    toneStyle: 1,
    syllableStyle: 0
  }
}

// 获取词语详情
const loadCiyu = async (query) => {
  if (!query.trim()) return

  loading.value = true
  error.value = ''
  ciyuData.value = null

  try {
    const config = getSearchConfig()

    const params = new URLSearchParams({
      query: query.trim(),
      lang: language.value,
      phonogram: config.phonogram || 1,
      toneStyle: config.toneStyle || 1,
      syllableStyle: config.syllableStyle || 1
    })

    const response = await fetch(`/api/search/${dialect.value}/by-ciyu?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('获取词语详情失败，请稍后重试')
    const responseData = await response.json()

    // 检查 API 响应是否成功
    if (responseData.success) {
      ciyuData.value = responseData.data
    } else {
      // 处理失败情况
      if (responseData.message && responseData.message.toLowerCase().includes('not found')) {
        // 如果消息中包含 "not found"，设置空状态
        error.value = '' // 清空错误信息，让 empty 状态显示
        ciyuData.value = null
      } else {
        // 其他错误情况
        error.value = responseData.message || '获取词语详情失败'
      }
    }
  } catch (err) {
    console.error('获取词语详情失败:', err)
    error.value = err.message || '获取词语详情失败，请检查网络连接'
  } finally {
    loading.value = false
  }
}

const formatText = formatRichText

// 生成读音变体描述
const generateMulPyDescription = (pinyinArray, mulPyArray) => {
  if (!mulPyArray || mulPyArray.length === 0) return []

  const descriptions = []

  // 遍历每个字的读音变体
  for (let i = 0; i < mulPyArray.length; i++) {
    const charMulPy = mulPyArray[i]
    const charPinyin = pinyinArray[i]

    // 只显示有变体的情况（长度>1）
    if (charMulPy && charMulPy.length > 1) {
      // 找出与标准拼音不同的变体
      const otherReadings = charMulPy
          .filter(item => item.right !== charPinyin)
          .map(item => item.right)

      if (otherReadings.length > 0) {
        const char = ciyuData.value.ciyu[i]
        const description = `${char}又读作${otherReadings.join('、')}`
        descriptions.push(description)
      }
    }
  }

  return descriptions
}

// 重试获取
const handleRetry = () => {
  if (ciyu.value.trim()) {
    loadCiyu(ciyu.value)
  }
}


watch(
    () => [route.params.ciyu, route.params.language],
    ([newCiyu]) => {
      if (newCiyu) {
        ciyu.value = newCiyu
        loadCiyu(newCiyu)
      }
    },
    {immediate: true}
)


onMounted(() => {
  // 从路由参数获取词语
  if (route.params.ciyu) {
    ciyu.value = route.params.ciyu
    loadCiyu(route.params.ciyu)
  }
})

onUnmounted(() => {
  removeLanguageListener()
})
</script>

<template>
  <div class="ciyu-detail-page page-container">
    <div class="detail-container container">
      <BackButton target-route="/search" :target-query="{ q: ciyu }" button-text="← 返回搜索结果"/>

      <!-- 状态显示组件 -->
      <StatusDisplay
          v-if="currentStatus"
          :type="currentStatus"
          :message="error"
          :show-retry="currentStatus === 'error'"
          @retry="handleRetry"
      />

      <!-- 词语详情展示 -->
      <div v-else-if="ciyuData" class="detail-section">
        <!-- 词语和拼音展示 -->
        <div class="ciyu-display-section card text-center mb-5">
          <div class="card-body">
            <!-- 拼音行 -->
            <div class="pinyin-row mb-3">
              <div class="pinyin-container d-flex justify-center gap-4">
                <div
                    v-for="(pinyin, index) in ciyuData.pinyin"
                    :key="index"
                    class="pinyin-item"
                >
                  <span v-html="formatText(pinyin)"></span>
                </div>
              </div>
            </div>

            <!-- 词语行 -->
            <div class="ciyu-row">
              <div class="ciyu-char-large">{{ ciyuData.ciyu }}</div>
            </div>
          </div>
        </div>

        <!-- 详细信息 -->
        <div class="detail-info-section card">
          <!-- 读音变体 -->
          <div
              v-if="ciyuData.mulPy && generateMulPyDescription(ciyuData.pinyin, ciyuData.mulPy).length > 0"
              class="info-row d-flex mb-4 pb-4 border-bottom"
          >
            <div class="info-label font-semibold">读音变体</div>
            <div class="info-value">
              <ul class="variant-list">
                <li
                    v-for="(desc, idx) in generateMulPyDescription(ciyuData.pinyin, ciyuData.mulPy)"
                    :key="idx"
                    class="variant-item mb-2"
                >
                  {{ desc }}
                </li>
              </ul>
            </div>
          </div>

          <!-- 含义 -->
          <div
              v-if="ciyuData.mean && ciyuData.mean.length > 0"
              class="info-row d-flex mb-4 pb-4 border-bottom"
          >
            <div class="info-label font-semibold">含义</div>
            <div class="info-value">
              <ul class="meaning-list">
                <li v-for="(meaning, idx) in ciyuData.mean" :key="idx">
                  {{ meaning }}
                </li>
              </ul>
            </div>
          </div>

          <!-- 空状态提示 -->
          <div
              v-if="(!ciyuData.mulPy || generateMulPyDescription(ciyuData.pinyin, ciyuData.mulPy).length === 0) &&
                  (!ciyuData.mean || ciyuData.mean.length === 0)"
              class="empty-info text-center py-4"
          >
            暂无其他信息
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ciyu-detail-page {
  background: var(--color-background);
}

.detail-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px 20px;
}

/* 词语展示区域 */
.ciyu-display-section {
  border: 1px solid var(--color-border);
}

.ciyu-char-large {
  font-size: 64px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}

/* 拼音容器 */
.pinyin-container {
  flex-wrap: wrap;
}

.pinyin-item {
  font-size: 20px;
  color: var(--color-text);
  font-family: 'Cambria', 'Microsoft YaHei', serif;
  min-width: 60px;
  text-align: center;
}

/* 详细信息区域 */
.detail-info-section {
  border: 1px solid var(--color-border);
  padding: 30px;
}

.info-row {
  align-items: flex-start;
}

.info-label {
  flex: 0 0 120px;
  color: var(--color-text);
  font-size: 16px;
  padding-top: 4px;
}

.info-value {
  flex: 1;
  color: var(--color-text);
  font-size: 16px;
  line-height: 1.6;
}

/* 读音变体列表 */
.variant-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.variant-item {
  color: var(--color-text);
}

/* 含义列表 */
.meaning-list {
  margin: 0;
  padding-left: 20px;
}

.meaning-list li {
  margin-bottom: 8px;
  color: var(--color-text);
}

.meaning-list li:last-child {
  margin-bottom: 0;
}

/* 空状态 */
.empty-info {
  color: var(--color-text-light);
  font-style: italic;
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 767px) {
  .ciyu-char-large {
    font-size: 48px;
  }

  .pinyin-item {
    font-size: 16px;
    min-width: 50px;
  }

  .detail-info-section {
    padding: 20px;
  }

  .info-row {
    flex-direction: column;
    gap: 8px;
  }

  .info-label {
    flex: none;
  }
}

@media (max-width: 480px) {
  .ciyu-char-large {
    font-size: 36px;
  }

  .pinyin-item {
    font-size: 14px;
    min-width: 40px;
  }

  .detail-container {
    padding: 20px 15px;
  }
}
</style>