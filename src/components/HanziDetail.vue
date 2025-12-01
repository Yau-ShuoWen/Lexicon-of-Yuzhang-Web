<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatTextWithFont } from '../utils/textFormatter.js'
import BackButton from "./Button/BackButton.vue";
import StatusDisplay from "./StatusDisplay.vue";

const route = useRoute()
const router = useRouter()

const hanzi = ref('')
const hanziData = ref(null)
const loading = ref(false)
const error = ref('')
const selectedPinyin = ref('') // 当前选中的拼音按钮

// 计算当前状态类型
const currentStatus = computed(() => {
  if (loading.value) return 'loading'
  if (error.value) return 'error'
  if (!hanziData.value && !loading.value) return 'empty'
  return null
})

// 从路由状态获取语言
const getLang = () => {
  if (route.state && route.state.lang) {
    return route.state.lang
  }
  return localStorage.getItem('user-locale') || 'sc'
}

// 获取搜索配置
const getSearchConfig = () => {
  try {
    const cachedConfig = localStorage.getItem('search_page_config')
    if (cachedConfig) {
      const config = JSON.parse(cachedConfig)
      return {
        phonogram: config.phonogram || 1,
        toneStyle: config.tone || 1,
        syllableStyle: config.syllable || 0
      }
    }
  } catch (err) {
    console.error('获取搜索配置失败:', err)
  }

  return {
    phonogram: 1,
    toneStyle: 1,
    syllableStyle: 0
  }
}

// 获取汉字详情
const fetchHanziDetail = async (query) => {
  if (!query.trim()) return

  loading.value = true
  error.value = ''
  hanziData.value = null
  selectedPinyin.value = '' // 重置选中状态

  try {
    const config = getSearchConfig()
    const currentLang = getLang()

    const params = new URLSearchParams({
      hanzi: query.trim(),
      lang: currentLang,
      phonogram: config.phonogram,
      toneStyle: config.toneStyle,
      syllableStyle: config.syllableStyle
    })

    const response = await fetch(`/api/search/nam/by-hanzi?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('获取汉字详情失败，请稍后重试')
    }

    const responseData = await response.json()

    // 检查 API 响应是否成功
    if (responseData.success) {
      hanziData.value = responseData.data

      // 默认选择第一个拼音
      if (hanziData.value && hanziData.value.infoMap && Object.keys(hanziData.value.infoMap).length > 0) {
        selectedPinyin.value = Object.keys(hanziData.value.infoMap)[0]
      }
    } else {
      // 处理失败情况
      if (responseData.message && responseData.message.toLowerCase().includes('not found')) {
        // 如果消息中包含 "not found"，设置空状态
        error.value = '' // 清空错误信息，让 empty 状态显示
        hanziData.value = null
      } else {
        // 其他错误情况
        error.value = responseData.message || '获取汉字详情失败'
      }
    }
  } catch (err) {
    console.error('获取汉字详情失败:', err)
    error.value = err.message || '获取汉字详情失败，请检查网络连接'
  } finally {
    loading.value = false
  }
}

// 复用 textFormatter.js 中的函数
const formatText = formatTextWithFont

// 格式化显示文本（不包含HTML标签）- 用于纯文本显示
const formatDisplayText = (text) => {
  if (!text) return ''
  return text.replace(/\/\/(.*?)\/\//g, '$1')
      .replace(/--(.*?)--/g, '$1')
}

// 选择拼音
const selectPinyin = (pinyinKey) => {
  selectedPinyin.value = pinyinKey
}

// 获取当前选中的拼音信息
const currentInfo = computed(() => {
  if (!hanziData.value || !selectedPinyin.value) return null
  return hanziData.value.infoMap[selectedPinyin.value]
})

// 重试获取
const handleRetry = () => {
  if (hanzi.value.trim()) {
    fetchHanziDetail(hanzi.value)
  }
}

// 监听语言变化
const handleLanguageChange = () => {
  if (hanzi.value.trim()) {
    fetchHanziDetail(hanzi.value)
  }
}

// 设置语言变化监听器
const setupLanguageListener = () => {
  window.addEventListener('languageChanged', handleLanguageChange)
}

// 移除语言变化监听器
const removeLanguageListener = () => {
  window.removeEventListener('languageChanged', handleLanguageChange)
}

watch(() => route.query.q, (newQuery) => {
  if (newQuery) {
    hanzi.value = newQuery
    fetchHanziDetail(newQuery)
  }
})

onMounted(() => {
  if (route.query.q) {
    hanzi.value = route.query.q
    fetchHanziDetail(route.query.q)
  }
  setupLanguageListener()
})

onUnmounted(() => {
  removeLanguageListener()
})
</script>

<template>
  <div class="hanzi-detail-page">
    <div class="detail-container">
      <BackButton target-route="/search" :target-query="{ q: hanzi }" button-text="← 返回搜索结果" />

      <!-- 状态显示组件 -->
      <StatusDisplay
          v-if="currentStatus"
          :type="currentStatus"
          :message="error"
          :show-retry="currentStatus === 'error'"
          @retry="handleRetry"
      />

      <!-- 汉字详情展示 -->
      <div v-else-if="hanziData" class="detail-section">
        <!-- 大字显示汉字 -->
        <div class="hanzi-display-section">
          <div class="hanzi-char-large">{{ hanziData.hanzi }}</div>
        </div>

        <!-- 拼音按钮组 -->
        <div class="pinyin-buttons" v-if="hanziData.infoMap && Object.keys(hanziData.infoMap).length > 0">
          <button
              v-for="(info, pinyinKey) in hanziData.infoMap"
              :key="pinyinKey"
              class="pinyin-button"
              :class="{ active: selectedPinyin === pinyinKey }"
              @click="selectPinyin(pinyinKey)"
          >
            <span v-html="formatText(info.stdPy)"></span>
          </button>
        </div>

        <!-- 详细信息 -->
        <div v-if="currentInfo" class="detail-info-section">
          <!-- 特殊性 -->
          <div v-if="currentInfo.special !== undefined" class="info-row">
            <div class="info-label">特殊性：</div>
            <div class="info-value">
              {{ currentInfo.special ? '方言特有' : '同普通话' }}
            </div>
          </div>

          <!-- 读音变体 -->
          <div v-if="currentInfo.mulPy && currentInfo.mulPy.length > 0" class="info-row">
            <div class="info-label">读音变体：</div>
            <div class="info-value">
              <div v-for="(pair, idx) in currentInfo.mulPy" :key="idx" class="variant-item">
                <span class="variant-left">{{ pair.left }}：</span>
                <span class="variant-right" v-html="formatText(pair.right)"></span>
              </div>
            </div>
          </div>

          <!-- 参考资料 -->
          <div v-if="currentInfo.ipaExp && currentInfo.ipaExp.length > 0" class="info-row">
            <div class="info-label">参考资料：</div>
            <div class="info-value">
              <div v-for="(triple, idx) in currentInfo.ipaExp" :key="idx" class="reference-item">
                <span class="reference-left">{{ triple.left }}（{{ triple.middle }}）：</span>
                <span class="reference-right" v-html="formatText(triple.right)"></span>
              </div>
            </div>
          </div>

          <!-- 含义 -->
          <div v-if="currentInfo.mean && currentInfo.mean.length > 0" class="info-row">
            <div class="info-label">含义：</div>
            <div class="info-value">
              <ul class="meaning-list">
                <li v-for="(meaning, idx) in currentInfo.mean" :key="idx">
                  {{ meaning }}
                </li>
              </ul>
            </div>
          </div>

          <!-- 注释 -->
          <div v-if="currentInfo.note && currentInfo.note.length > 0" class="info-row">
            <div class="info-label">注释：</div>
            <div class="info-value">
              <div v-for="(note, idx) in currentInfo.note" :key="idx" class="note-item">
                <span class="note-left">{{ note.left }}：</span>
                <span class="note-right">{{ note.right }}</span>
              </div>
            </div>
          </div>

          <!-- 空状态提示 -->
          <div v-if="!currentInfo.special &&
                     (!currentInfo.mulPy || currentInfo.mulPy.length === 0) &&
                     (!currentInfo.ipaExp || currentInfo.ipaExp.length === 0) &&
                     (!currentInfo.mean || currentInfo.mean.length === 0) &&
                     (!currentInfo.note || currentInfo.note.length === 0)"
               class="empty-info">
            暂无其他信息
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hanzi-detail-page {
  min-height: 100vh;
  background: var(--color-background);
  padding: 20px;
}

.detail-container {
  max-width: 800px;
  margin: 0 auto;
}

/* 大字显示 */
.hanzi-display-section {
  text-align: center;
  margin: 40px 0 30px;
}

.hanzi-char-large {
  font-size: 96px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
  margin-bottom: 20px;
}

/* 拼音按钮组 */
.pinyin-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-bottom: 40px;
}

.pinyin-button {
  padding: 12px 24px;
  background: var(--color-background-alt);
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
  text-align: center;
}

.pinyin-button:hover {
  background: var(--color-background);
  border-color: var(--color-primary-light);
}

.pinyin-button.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
  font-weight: 600;
}

/* 详细信息区域 */
.detail-info-section {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 30px;
}

.info-row {
  display: flex;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border-light);
}

.info-row:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.info-label {
  flex: 0 0 120px;
  font-weight: 600;
  color: var(--color-text-dark);
  font-size: 16px;
}

.info-value {
  flex: 1;
  color: var(--color-text);
  font-size: 16px;
  line-height: 1.6;
}

/* 读音变体 */
.variant-item {
  margin-bottom: 8px;
  display: flex;
}

.variant-item:last-child {
  margin-bottom: 0;
}

.variant-left {
  font-weight: 500;
  color: var(--color-text-dark);
  min-width: 60px;
}

.variant-right {
  font-family: 'Cambria', 'Microsoft YaHei', serif;
  color: var(--color-primary);
}

/* 参考资料 */
.reference-item {
  margin-bottom: 8px;
}

.reference-item:last-child {
  margin-bottom: 0;
}

.reference-left {
  font-weight: 500;
  color: var(--color-text-dark);
}

.reference-right {
  font-family: 'Cambria', 'Microsoft YaHei', serif;
  color: var(--color-primary);
  margin-left: 4px;
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

/* 注释 */
.note-item {
  margin-bottom: 12px;
}

.note-item:last-child {
  margin-bottom: 0;
}

.note-left {
  font-weight: 500;
  color: var(--color-text-dark);
}

.note-right {
  color: var(--color-text);
  margin-left: 4px;
}

/* 空状态 */
.empty-info {
  text-align: center;
  color: var(--color-text-light);
  font-style: italic;
  padding: 20px;
}

@media (max-width: 768px) {
  .hanzi-detail-page {
    padding: 16px;
  }

  .hanzi-char-large {
    font-size: 72px;
  }

  .pinyin-buttons {
    gap: 8px;
  }

  .pinyin-button {
    padding: 10px 16px;
    font-size: 16px;
    min-width: 100px;
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
  .hanzi-char-large {
    font-size: 56px;
  }

  .pinyin-button {
    padding: 8px 12px;
    font-size: 14px;
    min-width: 80px;
  }
}
</style>