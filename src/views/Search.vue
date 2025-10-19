<template>
  <div class="search-container">

    <div class="search-form">
      <div class="input-group">
        <input type="text" v-model="hanziInput" placeholder="请输入要查询的汉字" @keyup.enter="searchHanzi"/>
      </div>

      <div class="parameter-group">
        <div class="param-item">
          <label>语言：</label>
          <select v-model="lang">
            <option value="sc">简体</option>
            <option value="tc">繁體</option>
          </select>
        </div>

        <div class="param-item">
          <label>拼音格式：</label>
          <select v-model="status">
            <option :value="1">拼音</option>
            <option :value="2">国际音标（仅用于参考资料）</option>
            <option :value="3">国际音标</option>
          </select>
        </div>

        <div class="param-item">
          <label>模糊识别：</label>
          <select v-model="vague">
            <option :value="true">开启</option>
            <option :value="false">关闭</option>
          </select>
        </div>
      </div>

      <button @click="searchHanzi" :disabled="loading">
        {{ loading ? '查询中...' : '查询' }}
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="results.length > 0" class="results-container">
      <h2>查询结果</h2>

      <div v-for="(result, index) in results" :key="index" class="hanzi-result">
        <div class="hanzi-header">
          <span class="hanzi-char">{{ result.hanzi }}</span>
          <span class="hanzi-lang">{{ result.language === 'sc' ? '简体' : '繁體' }}</span>
        </div>

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

        <div
            v-if="selectedHanzi === result.hanzi && selectedPinyin"
            class="pinyin-detail"
        >
          <h3>标准读音: <span v-html="formatTextWithFont(selectedInfo.stdPy)"></span></h3>

          <div class="detail-section">
            <h4>多种读法</h4>
            <div v-if="selectedInfo.mulPy && selectedInfo.mulPy.length > 0">
              <div
                  v-for="(pair, idx) in selectedInfo.mulPy"
                  :key="idx" class="detail-item">
                <span class="label" v-html="formatTextWithFont(pair.left)"></span>:
                <span v-html="formatTextWithFont(pair.right)"></span>
              </div>
            </div>
            <div v-else class="no-data">无多音字信息</div>
          </div>

          <div class="detail-section" v-if="selectedInfo.ipaExp && selectedInfo.ipaExp.length > 0">
            <h4>IPA扩展</h4>
            <div
                v-for="(triple, idx) in selectedInfo.ipaExp"
                :key="idx" class="detail-item">
                <span class="label">
                  <span v-html="formatTextWithFont(triple.left)"></span>
                  (<span v-html="formatTextWithFont(triple.middle)"></span>):
                </span>
              <span v-html="formatTextWithFont(triple.right)"></span>
            </div>
          </div>

          <div class="detail-section" v-if="selectedInfo.pyExplain && selectedInfo.pyExplain.length > 0">
            <h4>拼音解释</h4>
            <div
                v-for="(explain, idx) in selectedInfo.pyExplain"
                :key="idx" class="detail-item">
              <span v-html="formatTextWithFont(explain)"></span>
            </div>
          </div>

          <div class="detail-section" v-if="selectedInfo.mean && selectedInfo.mean.length > 0">
            <h4>含义</h4>
            <div
                v-for="(meaning, idx) in selectedInfo.mean"
                :key="idx" class="detail-item">
              <span v-html="formatTextWithFont(meaning)"></span>
            </div>
          </div>

          <div class="detail-section" v-if="selectedInfo.note && selectedInfo.note.length > 0">
            <h4>备注</h4>
            <div
                v-for="(note, idx) in selectedInfo.note"
                :key="idx"
                class="detail-item"
            >
              <span v-html="formatTextWithFont(note)"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="searched" class="no-results">未找到相关汉字信息</div>
  </div>
</template>


<script setup>
import {ref, reactive} from 'vue'
import {formatTextWithFont as formatTextWithFontUtil} from '../utils/textFormatter.js'

// 响应式数据
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

// 方法
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

    const response = await fetch(`http://localhost:8080/api/search/nam/byhanzi?${params}`)

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
.search-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.search-form {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.input-group {
  margin-bottom: 15px;
}

.input-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.input-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.parameter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 15px;
}

.param-item {
  display: flex;
  align-items: center;
}

.param-item label {
  margin-right: 8px;
  font-weight: bold;
}

.param-item select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #45a049;
}

.error-message {
  color: #d32f2f;
  background-color: #ffebee;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.results-container h2 {
  color: #333;
  border-bottom: 1px solid #ddd;
  padding-bottom: 10px;
}

.hanzi-result {
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 20px;
  overflow: hidden;
}

.hanzi-header {
  background-color: #f0f0f0;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hanzi-char {
  font-size: 24px;
  font-weight: bold;
}

.hanzi-lang {
  background-color: #4CAF50;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.pinyin-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.pinyin-item {
  padding: 8px 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 5px;
}

.pinyin-item:hover {
  background-color: #e0e0e0;
}

.pinyin-item.active {
  background-color: #4CAF50;
  color: white;
}

.special-tag {
  background-color: #ff9800;
  color: white;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 3px;
}

.pinyin-detail {
  padding: 15px;
}

.pinyin-detail h3 {
  margin-top: 0;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h4 {
  margin-bottom: 10px;
  color: #555;
}

.detail-item {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-item .label {
  font-weight: bold;
  margin-right: 8px;
}

.no-data {
  color: #999;
  font-style: italic;
}

.no-results {
  text-align: center;
  color: #999;
  padding: 40px;
  font-size: 18px;
}

</style>