<template>
  <div class="card">
    <div class="card-body">
      <h3 class="card-title">{{ title }}</h3>

      <div class="form-group">
        <label>{{ traditionalLabel }}</label>
        <textarea
            :placeholder="traditionalPlaceholder"
            v-model="traditionalText"
            :maxlength="maxLength"
            class="form-control textarea"
            :rows="rows"
            @blur="onTraditionalBlur"
        ></textarea>
        <div class="char-count" v-if="showCharCount">
          字数: {{ getStringLength(traditionalText) }}/{{ maxLength }}
        </div>
      </div>

      <div class="form-group">
        <label>{{ simplifiedLabel }}</label>
        <textarea
            :placeholder="simplifiedPlaceholder"
            v-model="simplifiedText"
            :maxlength="maxLength"
            class="form-control textarea"
            :rows="rows"
            @blur="onSimplifiedBlur"
        ></textarea>
        <div class="char-count" v-if="showCharCount">
          字数: {{ getStringLength(simplifiedText) }}/{{ maxLength }}
        </div>
      </div>

      <div class="button-group">
        <button
            @click="manualCorrect"
            class="btn btn-success"
            v-if="showCorrection"
            :disabled="isConverting"
        >
          {{ correctButtonText }}
        </button>
        <button
            @click="clearAll"
            class="btn btn-outline-secondary"
            v-if="showClearButton"
        >
          {{ clearButtonText }}
        </button>
      </div>

      <!-- 统一提示框 -->
      <div v-if="statusMessage" class="status-message mt-2" :class="statusType">
        <span v-if="isConverting" class="spinner-border spinner-border-sm me-2"></span>
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

// 定义组件属性
const props = defineProps({
  // 标题
  title: {
    type: String,
    default: '简繁体转换'
  },
  // 繁体文本标签
  traditionalLabel: {
    type: String,
    default: '繁体文本：'
  },
  // 简体文本标签
  simplifiedLabel: {
    type: String,
    default: '简体文本：'
  },
  // 繁体占位符
  traditionalPlaceholder: {
    type: String,
    default: '繁體文本'
  },
  // 简体占位符
  simplifiedPlaceholder: {
    type: String,
    default: '简体文本'
  },
  // 校对按钮文本
  correctButtonText: {
    type: String,
    default: '校对完成'
  },
  // 清除按钮文本
  clearButtonText: {
    type: String,
    default: '清除'
  },
  // 最大长度
  maxLength: {
    type: Number,
    default: 2000
  },
  // 文本域行数
  rows: {
    type: Number,
    default: 4
  },
  // 防抖延迟（毫秒）
  debounceDelay: {
    type: Number,
    default: 500
  },
  // 初始繁体文本
  initialTraditionalText: {
    type: String,
    default: ''
  },
  // 初始简体文本
  initialSimplifiedText: {
    type: String,
    default: ''
  },
  // 是否显示字符计数
  showCharCount: {
    type: Boolean,
    default: true
  },
  // 是否显示清除按钮
  showClearButton: {
    type: Boolean,
    default: true
  },
  // 是否启用实时转换
  enableRealtimeConversion: {
    type: Boolean,
    default: true
  },
  // 转换API地址
  conversionApi: {
    type: String,
    default: '/api/transfer/tc'
  }
})

// 定义事件
const emit = defineEmits([
  'update:traditionalText',
  'update:simplifiedText',
  'traditional-change',
  'simplified-change',
  'convert',
  'correct',
  'error',
  'clear',
  'blur:traditional',
  'blur:simplified'
])

// 响应式数据
const traditionalText = ref(props.initialTraditionalText)
const simplifiedText = ref(props.initialSimplifiedText)
const showCorrection = ref(false)
const isConverting = ref(false)
const isDebouncing = ref(false)

// 计算属性
const charCountInfo = computed(() => {
  const traditionalLength = getStringLength(traditionalText.value)
  const simplifiedLength = getStringLength(simplifiedText.value)
  return {
    traditional: traditionalLength,
    simplified: simplifiedLength,
    isConsistent: traditionalLength === simplifiedLength
  }
})

// 状态消息
const statusMessage = computed(() => {
  if (isConverting.value) {
    return '转换中...'
  }
  if (isDebouncing.value) {
    return '等待输入完成...'
  }
  if (!charCountInfo.value.isConsistent && traditionalText.value && simplifiedText.value) {
    return `简繁体长度不一致（简体:${charCountInfo.value.simplified} 繁体:${charCountInfo.value.traditional}），请校对`
  }
  if (charCountInfo.value.isConsistent && traditionalText.value && simplifiedText.value) {
    return '转换完成'
  }
  return ''
})

// 状态类型
const statusType = computed(() => {
  if (isConverting.value || isDebouncing.value) {
    return 'status-info'
  }
  if (!charCountInfo.value.isConsistent && traditionalText.value && simplifiedText.value) {
    return 'status-warning'
  }
  if (charCountInfo.value.isConsistent && traditionalText.value && simplifiedText.value) {
    return 'status-success'
  }
  return 'status-info'
})

// 内部状态
let lastTraditionalText = props.initialTraditionalText
let isProcessingChange = false
let debounceTimer = null

// 监听初始值变化
watch(() => props.initialTraditionalText, (newVal) => {
  if (newVal !== traditionalText.value) {
    traditionalText.value = newVal
    lastTraditionalText = newVal
  }
})

watch(() => props.initialSimplifiedText, (newVal) => {
  if (newVal !== simplifiedText.value) {
    simplifiedText.value = newVal
  }
})

// 使用 watch 监听繁体文本变化
watch(traditionalText, (newVal, oldVal) => {
  if (isProcessingChange) return
  if (newVal === oldVal) return

  emit('update:traditionalText', newVal)
  emit('traditional-change', newVal)

  if (props.enableRealtimeConversion) {
    scheduleConversion()
  }
})

// 使用 watch 监听简体文本变化
watch(simplifiedText, (newVal, oldVal) => {
  if (isProcessingChange) return
  if (newVal === oldVal) return

  emit('update:simplifiedText', newVal)
  emit('simplified-change', newVal)
  updateCorrectionStatus()
})

// 使用代码点计算字符串长度（正确处理代理对）
function getStringLength(str) {
  if (!str) return 0
  return Array.from(str).length
}

// 使用代码点进行字符串切片
function stringSlice(str, start, end) {
  if (!str) return ''
  const chars = Array.from(str)
  return chars.slice(start, end).join('')
}

// 调度转换（防抖）
function scheduleConversion() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  isDebouncing.value = true
  debounceTimer = setTimeout(() => {
    isDebouncing.value = false
    processTraditionalTextChange()
  }, props.debounceDelay)
}

// 完整转换
async function fullTransfer() {
  if (!traditionalText.value) {
    emit('error', '请输入繁体文本')
    return
  }

  // 清除防抖计时器
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
    isDebouncing.value = false
  }

  isConverting.value = true
  try {
    const response = await fetch(`${props.conversionApi}?tc=` + encodeURIComponent(traditionalText.value))
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    simplifiedText.value = data.sc
    lastTraditionalText = traditionalText.value

    emit('convert', {
      traditional: traditionalText.value,
      simplified: simplifiedText.value
    })

    updateCorrectionStatus()
  } catch (err) {
    emit('error', '转换失败: ' + err.message)
  } finally {
    isConverting.value = false
  }
}

// 手动校对
function manualCorrect() {
  if (charCountInfo.value.isConsistent) {
    lastTraditionalText = traditionalText.value
    showCorrection.value = false

    emit('correct', {
      traditional: traditionalText.value,
      simplified: simplifiedText.value
    })
  }
}

// 清除所有内容
function clearAll() {
  traditionalText.value = ''
  simplifiedText.value = ''
  lastTraditionalText = ''
  showCorrection.value = false
  isDebouncing.value = false

  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  emit('clear')
  emit('update:traditionalText', '')
  emit('update:simplifiedText', '')
}

// 处理繁体文本变化
function processTraditionalTextChange() {
  isProcessingChange = true

  // 如果繁体文本为空，清空简体文本
  if (!traditionalText.value) {
    simplifiedText.value = ''
    lastTraditionalText = ''
    emit('update:simplifiedText', '')
    isProcessingChange = false
    return
  }

  // 如果简体文本为空，直接请求完整转换
  if (!simplifiedText.value) {
    fullTransfer()
    isProcessingChange = false
    return
  }

  // 使用改进的diff算法检测变化
  const diffResult = calculateTextDiff(lastTraditionalText, traditionalText.value)

  if (diffResult.type === 'add' && diffResult.text) {
    convertAndInsertPartialText(diffResult)
  } else if (diffResult.type === 'delete') {
    handleDeleteOperation(diffResult)
  } else if (diffResult.type === 'replace' && diffResult.position !== undefined) {
    handlePartialReplace(diffResult)
  } else if (diffResult.type === 'replace') {
    fullTransfer()
    isProcessingChange = false
  } else {
    isProcessingChange = false
  }
}

// 处理删除操作
function handleDeleteOperation(diffResult) {
  const newSimplified = stringSlice(simplifiedText.value, 0, diffResult.position) +
      stringSlice(simplifiedText.value, diffResult.position + diffResult.length)
  simplifiedText.value = newSimplified
  lastTraditionalText = traditionalText.value
  emit('update:simplifiedText', newSimplified)
  isProcessingChange = false
}

// 更新校对状态
function updateCorrectionStatus() {
  showCorrection.value = !charCountInfo.value.isConsistent &&
      traditionalText.value &&
      simplifiedText.value
}

// 转换并插入部分文本
async function convertAndInsertPartialText(diffResult) {
  isConverting.value = true
  try {
    const response = await fetch(`${props.conversionApi}?tc=` + encodeURIComponent(diffResult.text))
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    const convertedNewText = data.sc
    const newSimplified =
        stringSlice(simplifiedText.value, 0, diffResult.position) +
        convertedNewText +
        stringSlice(simplifiedText.value, diffResult.position)

    simplifiedText.value = newSimplified
    lastTraditionalText = traditionalText.value
    emit('update:simplifiedText', newSimplified)

    updateCorrectionStatus()
  } catch (err) {
    emit('error', '部分转换失败: ' + err.message)

    // 插入占位符确保长度一致
    const newSimplified = stringSlice(simplifiedText.value, 0, diffResult.position) +
        '□'.repeat(getStringLength(diffResult.text)) +
        stringSlice(simplifiedText.value, diffResult.position)
    simplifiedText.value = newSimplified
    emit('update:simplifiedText', newSimplified)
    updateCorrectionStatus()
  } finally {
    isConverting.value = false
    isProcessingChange = false
  }
}

// 处理局部替换
async function handlePartialReplace(diffResult) {
  isConverting.value = true
  try {
    const response = await fetch(`${props.conversionApi}?tc=` + encodeURIComponent(diffResult.newText))
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    const convertedText = data.sc

    const newSimplified =
        stringSlice(simplifiedText.value, 0, diffResult.position) +
        convertedText +
        stringSlice(simplifiedText.value, diffResult.position + diffResult.length)

    simplifiedText.value = newSimplified
    lastTraditionalText = traditionalText.value
    emit('update:simplifiedText', newSimplified)

    updateCorrectionStatus()
  } catch (err) {
    emit('error', '局部替换转换失败: ' + err.message)
    fullTransfer()
  } finally {
    isConverting.value = false
    isProcessingChange = false
  }
}

// 改进的文本差异计算
function calculateTextDiff(oldText, newText) {
  if (!oldText || !newText) {
    return { type: 'replace' }
  }

  const oldChars = Array.from(oldText)
  const newChars = Array.from(newText)

  // 查找第一个不同的字符位置
  let start = 0
  while (start < oldChars.length && start < newChars.length && oldChars[start] === newChars[start]) {
    start++
  }

  // 查找最后一个不同的字符位置
  let oldEnd = oldChars.length - 1
  let newEnd = newChars.length - 1
  while (oldEnd >= start && newEnd >= start && oldChars[oldEnd] === newChars[newEnd]) {
    oldEnd--
    newEnd--
  }

  // 判断操作类型
  if (start > oldEnd && start <= newEnd) {
    // 纯新增
    const addedText = newChars.slice(start, newEnd + 1).join('')
    return {
      type: 'add',
      position: start,
      text: addedText,
      length: getStringLength(addedText)
    }
  } else if (start > newEnd && start <= oldEnd) {
    // 纯删除
    const deletedLength = oldEnd - start + 1
    return {
      type: 'delete',
      position: start,
      length: deletedLength
    }
  } else if (start <= oldEnd && start <= newEnd) {
    // 替换操作
    const oldSegment = oldChars.slice(start, oldEnd + 1).join('')
    const newSegment = newChars.slice(start, newEnd + 1).join('')

    if (getStringLength(oldSegment) === getStringLength(newSegment)) {
      return {
        type: 'replace',
        position: start,
        oldText: oldSegment,
        newText: newSegment,
        length: getStringLength(oldSegment)
      }
    }
  }

  return { type: 'replace' }
}

// 文本框失去焦点事件
function onTraditionalBlur() {
  emit('blur:traditional', traditionalText.value)
}

function onSimplifiedBlur() {
  emit('blur:simplified', simplifiedText.value)
}

// 暴露方法给父组件
defineExpose({
  fullTransfer,
  manualCorrect,
  clearAll,
  getStringLength
})
</script>

<style scoped>
.button-group {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
}

.status-message {
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-md);
  border-left: 4px solid;
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

.char-count {
  font-size: 0.875rem;
  color: #6c757d;
  text-align: right;
  margin-top: 0.25rem;
}

.textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  line-height: 1.5;
}

.spinner-border {
  width: 1rem;
  height: 1rem;
}

@media (max-width: 768px) {
  .button-group {
    flex-direction: column;
  }

  .button-group .btn {
    width: 100%;
  }
}
</style>