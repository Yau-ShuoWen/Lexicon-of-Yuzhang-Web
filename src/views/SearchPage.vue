<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">汉字查询</h1>
      <p class="page-subtitle">查询汉字的拼音、含义及相关信息</p>
    </div>

    <!-- 搜索表单 -->
    <div class="card search-card">
      <div class="card-body">
        <div class="search-form">
          <div class="form-group">
            <input
                type="text"
                v-model="hanziInput"
                placeholder="请输入要查询的汉字"
                @keyup.enter="searchHanzi"
                class="form-control form-control-lg"
            />
          </div>

          <div class="search-params">
            <div class="form-group">
              <label>语言：</label>
              <select v-model="lang" class="form-control">
                <option value="sc">简体</option>
                <option value="tc">繁體</option>
              </select>
            </div>

            <div class="form-group">
              <label>拼音格式：</label>
              <select v-model="status" class="form-control">
                <option :value="1">拼音</option>
                <option :value="2">国际音标（仅用于参考资料）</option>
                <option :value="3">国际音标</option>
              </select>
            </div>

            <div class="form-group">
              <label>模糊识别：</label>
              <select v-model="vague" class="form-control">
                <option :value="true">开启</option>
                <option :value="false">关闭</option>
              </select>
            </div>
          </div>

          <button @click="searchHanzi" :disabled="loading" class="btn btn-primary btn-lg">
            {{ loading ? '查询中...' : '查询' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="error" class="card card-error mt-4">
      <div class="card-body">
        <div class="error-content">
          <span class="error-icon">⚠️</span>
          {{ error }}
        </div>
      </div>
    </div>

    <!-- 查询结果 -->
    <div v-if="results.length > 0" class="results-section mt-4">
      <h2 class="section-title">查询结果</h2>

      <div v-for="(result, index) in results" :key="index" class="result-card card mt-3">
        <div class="card-header hanzi-header">
          <span class="hanzi-char">{{ result.hanzi }}</span>
          <span class="hanzi-lang">{{ result.language === 'sc' ? '简体' : '繁體' }}</span>
        </div>

        <div class="card-body">
          <!-- 拼音列表 -->
          <div class="pinyin-section">
            <h4 class="section-subtitle">拼音选择</h4>
            <div class="pinyin-list">
              <div
                  v-for="(info, pinyin) in result.infoMap"
                  :key="pinyin"
                  class="pinyin-item"
                  :class="{ active: selectedPinyin === pinyin && selectedHanzi === result.hanzi }"
                  @click="selectPinyin(result.hanzi, pinyin, info)"
              >
                <span v-html="formatTextWithFont(info.stdPy)"></span>
                <span v-if="info.special" class="special-tag">特殊</span>
              </div>
            </div>
          </div>

          <!-- 拼音详情 -->
          <div v-if="selectedHanzi === result.hanzi && selectedPinyin" class="pinyin-detail mt-4">
            <h3 class="detail-title">
              标准读音: <span v-html="formatTextWithFont(selectedInfo.stdPy)"></span>
            </h3>

            <div class="detail-grid">
              <!-- 多种读法 -->
              <div v-if="selectedInfo.mulPy && selectedInfo.mulPy.length > 0" class="detail-item">
                <h4 class="detail-label">多种读法</h4>
                <div class="detail-content">
                  <div
                      v-for="(pair, idx) in selectedInfo.mulPy"
                      :key="idx"
                      class="detail-row"
                  >
                    <span class="detail-key" v-html="formatTextWithFont(pair.left)"></span>:
                    <span class="detail-value" v-html="formatTextWithFont(pair.right)"></span>
                  </div>
                </div>
              </div>

              <!-- IPA扩展 -->
              <div v-if="selectedInfo.ipaExp && selectedInfo.ipaExp.length > 0" class="detail-item">
                <h4 class="detail-label">IPA扩展</h4>
                <div class="detail-content">
                  <div
                      v-for="(triple, idx) in selectedInfo.ipaExp"
                      :key="idx"
                      class="detail-row"
                  >
                    <span class="detail-key">
                      <span v-html="formatTextWithFont(triple.left)"></span>
                      (<span v-html="formatTextWithFont(triple.middle)"></span>):
                    </span>
                    <span class="detail-value" v-html="formatTextWithFont(triple.right)"></span>
                  </div>
                </div>
              </div>

              <!-- 拼音解释 -->
              <div v-if="selectedInfo.pyExplain && selectedInfo.pyExplain.length > 0" class="detail-item">
                <h4 class="detail-label">拼音解释</h4>
                <div class="detail-content">
                  <div
                      v-for="(explain, idx) in selectedInfo.pyExplain"
                      :key="idx"
                      class="detail-row"
                  >
                    <span v-html="formatTextWithFont(explain)"></span>
                  </div>
                </div>
              </div>

              <!-- 含义 -->
              <div v-if="selectedInfo.mean && selectedInfo.mean.length > 0" class="detail-item">
                <h4 class="detail-label">含义</h4>
                <div class="detail-content">
                  <div
                      v-for="(meaning, idx) in selectedInfo.mean"
                      :key="idx"
                      class="detail-row"
                  >
                    <span v-html="formatTextWithFont(meaning)"></span>
                  </div>
                </div>
              </div>

              <!-- 备注 -->
              <div v-if="selectedInfo.note && selectedInfo.note.length > 0" class="detail-item">
                <h4 class="detail-label">备注</h4>
                <div class="detail-content">
                  <div
                      v-for="(note, idx) in selectedInfo.note"
                      :key="idx"
                      class="detail-row"
                  >
                    <span v-html="formatTextWithFont(note)"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 无结果 -->
    <div v-else-if="searched" class="empty-state mt-4">
      <div class="empty-content">
        <span class="empty-icon">🔍</span>
        <h3>未找到相关汉字信息</h3>
        <p>请尝试调整搜索条件或输入其他汉字</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, reactive} from 'vue'
import {formatTextWithFont as formatTextWithFontUtil} from '../utils/textFormatter.js'

const hanziInput = ref('')
const lang = ref('sc')
const status = ref(1)
const vague = ref(false)
const results = ref([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)
const selectedHanzi = ref('')
const selectedPinyin = ref('')
const selectedInfo = ref({})

const searchHanzi = async () => {
  if (!hanziInput.value.trim()) {
    error.value = '请输入要查询的汉字'
    return
  }

  loading.value = true
  error.value = ''
  searched.value = true
  selectedHanzi.value = ''
  selectedPinyin.value = ''

  try {
    const params = new URLSearchParams({
      hanzi: hanziInput.value,
      lang: lang.value,
      status: status.value,
      vague: vague.value
    })

    const response = await fetch(`/api/search/nam/byhanzi?${params}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    results.value = await response.json()
  } catch (err) {
    console.error('查询失败:', err)
    error.value = '查询失败，请检查网络连接或稍后重试'
    results.value = []
  } finally {
    loading.value = false
  }
}

const selectPinyin = (hanzi, pinyin, info) => {
  if (selectedPinyin.value === pinyin && selectedHanzi.value === hanzi) {
    selectedHanzi.value = ''
    selectedPinyin.value = ''
    selectedInfo.value = {}
  } else {
    selectedHanzi.value = hanzi
    selectedPinyin.value = pinyin
    selectedInfo.value = info
  }
}

const formatTextWithFont = (text) => {
  return formatTextWithFontUtil(text)
}
</script>

<style scoped>
.search-card {
  max-width: 800px;
  margin: 0 auto;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.search-params {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}

.form-control-lg {
  padding: var(--spacing-lg);
  font-size: var(--font-size-lg);
}

.error-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-error);
}

.error-icon {
  font-size: var(--font-size-lg);
}

.results-section {
  max-width: 800px;
  margin: 0 auto;
}

.section-title {
  color: var(--color-text);
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.hanzi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-background-alt);
}

.hanzi-char {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  color: var(--color-primary);
}

.hanzi-lang {
  background: var(--color-success);
  color: white;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.pinyin-section {
  margin-bottom: var(--spacing-lg);
}

.section-subtitle {
  color: var(--color-text-light);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-lg);
}

.pinyin-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.pinyin-item {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-background-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-weight: 500;
}

.pinyin-item:hover {
  background: var(--color-border);
  transform: translateY(-1px);
}

.pinyin-item.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.special-tag {
  background: var(--color-warning);
  color: white;
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
}

.detail-title {
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.detail-item {
  background: var(--color-background-alt);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-lg);
}

.detail-label {
  color: var(--color-primary);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.detail-row {
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.detail-key {
  font-weight: 600;
  color: var(--color-text);
  min-width: 120px;
}

.detail-value {
  color: var(--color-text);
  flex: 1;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-light);
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-md);
}

.empty-state h3 {
  color: var(--color-text-light);
  margin-bottom: var(--spacing-sm);
}

.empty-state p {
  color: var(--color-text-lighter);
}

@media (max-width: 768px) {
  .search-params {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  .pinyin-list {
    justify-content: center;
  }

  .hanzi-header {
    flex-direction: column;
    gap: var(--spacing-sm);
    text-align: center;
  }

  .detail-row {
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .detail-key {
    min-width: auto;
  }
}

@media (max-width: 480px) {
  .pinyin-item {
    flex: 1;
    min-width: 120px;
    justify-content: center;
  }
}
</style>