<script setup>
import {ref, onMounted, watch, computed, onUnmounted} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {formatRichText} from '../utils/textFormatter.js'
import BackButton from "./Button/BackButton.vue";
import StatusDisplay from "./Status/StatusDisplay.vue";

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
const loadHanzi = async (query) => {
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

    if (!response.ok) throw new Error('获取汉字详情失败，请稍后重试')
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

const formatText = formatRichText

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
    loadHanzi(hanzi.value)
  }
}

// 监听语言变化
const handleLanguageChange = () => {
  if (hanzi.value.trim()) {
    loadHanzi(hanzi.value)
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
    loadHanzi(newQuery)
  }
})

// 使用方法
const formatSpecial = (specialArray) => {
  if (!specialArray || specialArray.length === 0) {
    return ''
  }

  const labels = []

  if (specialArray.includes(0)) {
    labels.push('用法同普通话')
  }
  if (specialArray.includes(1)) {
    labels.push('特殊汉字')
  }
  if (specialArray.includes(2)) {
    labels.push('占位字')
  }
  if (specialArray.includes(3)) {
    labels.push('不使用')
  }

  return labels.join('、')
}
// 监听路由参数变化
watch(() => route.params.hanzi, (newHanzi) => {
  if (newHanzi) {
    hanzi.value = newHanzi
    loadHanzi(newHanzi)
  }
})

onMounted(() => {
  // 从路由参数获取汉字
  if (route.params.hanzi) {
    hanzi.value = route.params.hanzi
    loadHanzi(route.params.hanzi)
  }
  setupLanguageListener()
})
</script>

<template>
  <div class="hanzi-detail-page page-container">
    <div class="detail-container container">
      <BackButton target-route="/search" :target-query="{ q: hanzi }" button-text="← 返回搜索结果"/>
<!--      <BackButton target-route="/"  button-text="← 返回首页"/>-->

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
        <!-- 电脑端左右布局容器 -->
        <div class="detail-layout">
          <!-- 左侧固定区域：汉字 + 拼音选项 -->
          <div class="left-panel">
            <!-- 大字显示汉字 -->
            <div class="hanzi-display-section">
              <div class="hanzi-char-large text-center">{{ hanziData.hanzi }}</div>
            </div>

            <!-- 拼音按钮组（垂直排列） -->
            <div class="pinyin-buttons-vertical" v-if="hanziData.infoMap && Object.keys(hanziData.infoMap).length > 0">
              <button
                  v-for="(info, pinyinKey) in hanziData.infoMap"
                  :key="pinyinKey"
                  class="pinyin-button-vertical btn-ghost"
                  :class="{ active: selectedPinyin === pinyinKey }"
                  @click="selectPinyin(pinyinKey)"
              >
                <span v-html="formatText(info.stdPy)"></span>
              </button>
            </div>
          </div>

          <!-- 右侧自适应区域：详细信息 -->
          <div class="right-panel">
            <!-- 手机端拼音按钮组（横向） -->
            <div class="pinyin-buttons-horizontal d-flex flex-wrap justify-center gap-3 mb-5"
                 v-if="hanziData.infoMap && Object.keys(hanziData.infoMap).length > 0">
              <button
                  v-for="(info, pinyinKey) in hanziData.infoMap"
                  :key="pinyinKey"
                  class="pinyin-button-horizontal btn-ghost"
                  :class="{ active: selectedPinyin === pinyinKey }"
                  @click="selectPinyin(pinyinKey)"
              >
                <span v-html="formatText(info.stdPy)"></span>
              </button>
            </div>

            <!-- 详细信息 -->
            <div v-if="currentInfo" class="detail-info-section card">
              <!-- 特殊性 -->
              <div v-if="currentInfo.special && currentInfo.special.length > 0"
                   class="info-row d-flex mb-4 pb-4 border-bottom">
                <div class="info-label font-semibold">特殊性</div>
                <div class="info-value">
                  {{ formatSpecial(currentInfo.special) }}
                </div>
              </div>

              <div v-if="currentInfo.mulPy && currentInfo.mulPy.length > 0"
                   class="info-row d-flex mb-4 pb-4 border-bottom">
                <div class="info-label font-semibold">读音变体</div>
                <div class="info-value">
                  <div v-for="(pair, idx) in currentInfo.mulPy" :key="idx" class="variant-item d-flex mb-2">
                    <span class="variant-left font-medium">{{ pair.left }}：</span>
                    <span class="variant-right" v-html="formatText(pair.right)"></span>
                  </div>
                </div>
              </div>

              <div v-if="currentInfo.ipaExp && currentInfo.ipaExp.length > 0"
                   class="info-row d-flex mb-4 pb-4 border-bottom">
                <div class="info-label font-semibold">参考资料</div>
                <div class="info-value">
                  <div v-for="(pair, idx) in currentInfo.ipaExp" :key="idx" class="reference-item mb-2">
                    <span class="reference-left font-medium">{{ pair.left }}</span>
                    <span class="reference-right" v-html="formatText(pair.right)"></span>
                  </div>
                </div>
              </div>

              <!-- 含义 -->
              <div v-if="currentInfo.mean && currentInfo.mean.length > 0"
                   class="info-row d-flex mb-4 pb-4 border-bottom">
                <div class="info-label font-semibold">含义</div>
                <div class="info-value">
                  <ul class="meaning-list">
                    <li v-for="(meaning, idx) in currentInfo.mean" :key="idx">
                      {{ meaning }}
                    </li>
                  </ul>
                </div>
              </div>

              <!-- 注释 -->
              <div v-if="currentInfo.note && currentInfo.note.length > 0" class="info-row d-flex flex-column mb-4">
                <div class="info-value">
                  <div v-for="(note, idx) in currentInfo.note" :key="idx" class="note-item d-flex mb-3">
                    <div class="info-label font-semibold mb-3" style="min-width: 80px;">{{ note.left }}</div>
                    <div class="note-right flex-1" v-html="formatText(note.right)"/>
                  </div>
                </div>
              </div>

              <!-- 空状态提示 -->
              <div v-if="!currentInfo.special &&
                         (!currentInfo.mulPy || currentInfo.mulPy.length === 0) &&
                         (!currentInfo.ipaExp || currentInfo.ipaExp.length === 0) &&
                         (!currentInfo.mean || currentInfo.mean.length === 0) &&
                         (!currentInfo.note || currentInfo.note.length === 0)"
                   class="empty-info text-center py-4">
                暂无其他信息
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hanzi-detail-page {
  background: var(--color-background);
}

/* 电脑端左右布局 */
.detail-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* 左侧面板 - 固定宽度 */
.left-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30px;
}

/* 右侧面板 - 自适应 */
.right-panel {
  width: 100%;
}

/* 大字显示 */
.hanzi-display-section {
  margin: 30px 0 30px;
}

.hanzi-char-large {
  font-size: 96px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
  margin-bottom: 20px;
}

/* 手机端拼音按钮组（横向） */
.pinyin-buttons-horizontal {
  display: flex;
}

.pinyin-button-horizontal {
  padding: 12px 24px;
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: 18px;
  color: var(--color-text);
  min-width: 120px;
  text-align: center;
  transition: all 0.3s ease;
}

.pinyin-button-horizontal:hover {
  border-color: var(--color-primary-light);
}

.pinyin-button-horizontal.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
  font-weight: 600;
}

/* 电脑端拼音按钮组（垂直） */
.pinyin-buttons-vertical {
  display: none; /* 默认隐藏，在大屏幕显示 */
  flex-direction: column;
  align-items: center;
  gap: 15px;
  width: 100%;
}

.pinyin-button-vertical {
  padding: 12px 24px;
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: 18px;
  color: var(--color-text);
  width: 100%;
  max-width: 200px;
  text-align: center;
  transition: all 0.3s ease;
}

.pinyin-button-vertical:hover {
  border-color: var(--color-primary-light);
}

.pinyin-button-vertical.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
  font-weight: 600;
}

/* 详细信息区域 */
.detail-info-section {
  border: 1px solid var(--color-border);
  padding: 30px;
}

.info-label {
  flex: 0 0 120px;
  color: var(--color-text);
  font-size: 16px;
}

.info-value {
  flex: 1;
  color: var(--color-text);
  font-size: 16px;
  line-height: 1.6;
}

/* 读音变体 */
.variant-left {
  min-width: 60px;
}

.variant-right {
  font-family: 'Cambria', 'Microsoft YaHei', serif;
  color: var(--color-primary);
}

/* 参考资料 */
.reference-left {
  color: var(--color-text);
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
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 12px;
}

.note-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.note-left {
  color: var(--color-text);
}

.note-right {
  color: var(--color-text);
  line-height: 1.6;
}

/* 空状态 */
.empty-info {
  color: var(--color-text-light);
  font-style: italic;
}

/* ==================== 响应式设计 ==================== */
/* 手机端：768px以下，保持原布局 */
@media (max-width: 767px) {
  .hanzi-char-large {
    font-size: 72px;
  }

  .pinyin-button-horizontal {
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

  /* 手机端隐藏垂直拼音按钮 */
  .pinyin-buttons-vertical {
    display: none;
  }

  /* 手机端显示横向拼音按钮 */
  .pinyin-buttons-horizontal {
    display: flex;
  }
}

/* 电脑端：768px以上，启用左右布局 */
@media (min-width: 768px) {
  .detail-layout {
    flex-direction: row;
    gap: 40px;
    align-items: flex-start;
  }

  .left-panel {
    width: 280px;
    flex-shrink: 0;
    margin-bottom: 0;
    position: sticky;
    top: 20px;
  }

  .right-panel {
    flex: 1;
  }

  /* 电脑端显示垂直拼音按钮 */
  .pinyin-buttons-vertical {
    display: flex;
  }

  /* 电脑端隐藏横向拼音按钮 */
  .pinyin-buttons-horizontal {
    display: none;
  }
}

/* 中等屏幕调整 */
@media (min-width: 768px) and (max-width: 1023px) {
  .left-panel {
    width: 240px;
  }

  .hanzi-char-large {
    font-size: 80px;
  }

  .pinyin-button-vertical {
    padding: 10px 20px;
    font-size: 16px;
    max-width: 180px;
  }
}

/* 大屏幕调整 */
@media (min-width: 1024px) {
  .left-panel {
    width: 320px;
  }

  .hanzi-char-large {
    font-size: 96px;
  }

  .pinyin-button-vertical {
    max-width: 220px;
  }
}

/* 小手机端 */
@media (max-width: 480px) {
  .hanzi-char-large {
    font-size: 56px;
  }

  .pinyin-button-horizontal {
    padding: 8px 12px;
    font-size: 14px;
    min-width: 80px;
  }
}
</style>