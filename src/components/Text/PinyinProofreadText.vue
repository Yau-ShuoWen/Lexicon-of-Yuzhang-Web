<template>
  <div class="pinyin-proofread-row">
    <!-- 拼音输入框 -->
    <input
        type="text"
        class="form-control small-input"
        :placeholder="placeholder"
        :value="modelValue"
        :maxlength="maxLength"
        @input="onInput"
        @blur="onBlur"
        @keydown.enter.prevent="onEnter"
    />

    <!-- 状态消息（使用 v-html 显示格式化拼音） -->
    <div v-if="statusMessage"
         class="status-message" :class="statusType"
         v-html="formattedStatusMessage">
    </div>

    <!-- 校正按钮（条件显示） -->
    <button
        v-if="showCorrectionButton"
        class="dev-btn-small correction-btn"
        @click="applyCorrection"
        :disabled="isCorrecting">
      {{ isCorrecting ? '校正中...' : '校正' }}
    </button>

    <!-- 清除按钮 -->
    <button class="dev-btn-small dev-normal-button" @click="clearAll">清除</button>
  </div>
</template>

<script setup>
import {ref, computed, watch, onMounted} from 'vue'
import {formatRichText} from '../../utils/textFormatter.js'


const props = defineProps({
  // 1. 双向绑定的拼音文本
  // 2. 输入框占位符
  // 3. 最大文本长度
  // 4. 方言代号
  modelValue: {type: String, default: ''},
  placeholder: {type: String, default: '输入拼音'},
  maxLength: {type: Number, default: 50},
  dialect: {type: String, default: 'nam'}
})

// 定义事件
const emit = defineEmits([
  'update:modelValue',
  'input',
  'blur',
  'valid',
  'invalid',
  'corrected',
  'clear'
])

// 内部状态
const modelValue = ref(props.modelValue)
const statusMessage = ref('')
const statusType = ref('')
const showCorrectionButton = ref(false)
const isCorrecting = ref(false)
const isChecking = ref(false)

// 校正数据存储
const correctionData = ref({
  statusCode: 0,
  middleValue: '',
  rightValue: ''
})


// 计算格式化后的状态消息
const formattedStatusMessage = computed(() => {
  if (!statusMessage.value) return ''

  // 状态码为1或2时，使用textFormatter格式化
  if (correctionData.value.statusCode === 1 || correctionData.value.statusCode === 2) {
    return formatRichText(statusMessage.value)
  }

  // 其他情况（如无效拼音）直接返回文本
  return statusMessage.value
})

// 监听父组件传入的值变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== modelValue.value) modelValue.value = newVal
})

// 组件挂载时，如果有初始值就验证
onMounted(() => {
  if (modelValue.value.trim()) checkPinyin()
})


// 输入事件处理
function onInput(event) {
  const value = event.target.value
  modelValue.value = value
  emit('update:modelValue', value)
  emit('input', value)
}

function onBlur() {
  emit('blur', modelValue.value)

  if (modelValue.value.trim()) checkPinyin()
  else resetStatus()
}


function onEnter() {
  if (modelValue.value.trim()) checkPinyin()
  else resetStatus()
}


// 验证拼音
async function checkPinyin() {
  const pinyin = modelValue.value.trim()
  if (!pinyin) {
    resetStatus()
    return
  }

  isChecking.value = true
  try {
    const response = await fetch(`/api/pinyin/${props.dialect}/normalize?pinyin=${encodeURIComponent(pinyin)}`)
    if (!response.ok) {
      // 网络错误：不视为空内容，保持原样
      console.error('拼音验证请求失败:', response.status)
      // 保持当前状态，不重置
      return
    }

    const triple = await response.json()
    handleCheckResult(triple)
  } catch (error) {
    // 静默处理错误，保持原样
    console.error('拼音验证异常:', error)
  } finally {
    isChecking.value = false
  }
}

// 处理验证结果
function handleCheckResult(triple) {
  const statusCode = triple.left || triple[0]
  const middleValue = triple.middle || triple[1]
  const rightValue = triple.right || triple[2]

  // 保存校正数据
  correctionData.value = {
    statusCode,
    middleValue,
    rightValue
  }

  switch (statusCode) {
    case 1: // 正确
      statusMessage.value = middleValue
      statusType.value = 'status-success'
      showCorrectionButton.value = false
      emit('valid', middleValue)
      break

    case 2: // 可校正
      statusMessage.value = middleValue
      statusType.value = 'status-warning'
      showCorrectionButton.value = true
      emit('invalid', {type: 'correctable', middle: middleValue, right: rightValue})
      break

    case 3: // 无效
      statusMessage.value = '无效拼音'
      statusType.value = 'status-error'
      showCorrectionButton.value = false
      emit('invalid', {type: 'invalid'})
      break

    case 4: // 需要补充音调
      statusMessage.value = '缺少音调'
      statusType.value = 'status-error'
      showCorrectionButton.value = false
      emit('invalid', {type: 'invalid'})
      break

    default:
      // 未知状态码，保持原样
      statusMessage.value = ''
      statusType.value = ''
      showCorrectionButton.value = false
      break
  }
}

function applyCorrection() {
  if (!correctionData.value.rightValue || isCorrecting.value) return

  const originalValue = modelValue.value

  isCorrecting.value = true
  try {
    modelValue.value = correctionData.value.rightValue
    emit('update:modelValue', correctionData.value.rightValue)
    emit('corrected', {
      original: originalValue,
      corrected: correctionData.value.rightValue
    })

    setTimeout(() => {
      checkPinyin()
    }, 100)
  } finally {
    isCorrecting.value = false
  }
}

// 清除所有内容
function clearAll() {
  modelValue.value = ''
  emit('update:modelValue', '')
  emit('clear')
  resetStatus()
}

// 重置状态
function resetStatus() {
  statusMessage.value = ''
  statusType.value = ''
  showCorrectionButton.value = false
  correctionData.value = {
    statusCode: 0,
    middleValue: '',
    rightValue: ''
  }
}

// 暴露方法给父组件
defineExpose({
  checkPinyin,
  clearAll,
  applyCorrection
})
</script>

<style>
.pinyin-proofread-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.small-input {
  width: 120px;
  min-width: 100px;
  height: 32px;
  padding: 4px 8px;
  line-height: 1.3;
}

.correction-btn {
  background-color: #ffc107;
  color: #212529;
  border-color: #ffc107;
}

.correction-btn:hover:not(:disabled) {
  background-color: #e0a800;
  border-color: #d39e00;
}

.correction-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* 状态栏加宽 */
.status-message {
  padding: 6px 12px;
  border-radius: 4px;
  border-left: 4px solid;
  font-size: 14px;
  min-width: 100px; /* 从100px加宽到150px */
  max-width: 250px; /* 从200px加宽到250px */
  white-space: normal; /* 允许换行 */
  word-break: break-word; /* 长单词换行 */
  overflow: visible; /* 显示完整内容 */
  text-overflow: clip;
}

.status-message :deep(.dict-link) {
  color: #007bff;
  text-decoration: none;
}

.status-message :deep(.dict-link:hover) {
  text-decoration: underline;
}

.status-message :deep(b) {
  font-weight: bold;
}

.status-message :deep(small) {
  font-size: 0.875em;
  color: gray;
}

.status-info {
  background-color: #d1ecf1;
  border-color: #bee5eb;
  color: #0c5460;
}

.status-warning {
  background-color: #fff3cd;
  border-color: #ffeaa7;
  color: #856404;
}

.status-success {
  background-color: #d1f2eb;
  border-color: #a3e4d7;
  color: #0d6251;
}

.status-error {
  background-color: #f8d7da;
  border-color: #f5c6cb;
  color: #721c24;
}
</style>