<template>
  <div>
    <div v-if="layout === 'small'" class="small-row">

      <input
          type="text"
          class="form-control small-input"
          :placeholder="`繁體`"
          :value="modelTraditional"
          :maxlength="maxLength"
          @input="onTraditionalInput"
          @blur="onTraditionalBlur"
          :disabled="disabled"
      />

      <input
          type="text"
          class="form-control small-input"
          :placeholder="`簡體`"
          :value="modelSimplified"
          :maxlength="maxLength"
          @input="onSimplifiedInput"
          @blur="onSimplifiedBlur"
          :disabled="disabled"
      />

      <div v-if="statusMessage && !disabled"
           class="status-message"
           :class="statusType"
      >
        {{ statusMessage }}
      </div>

      <button v-if="!disabled" class="dev-btn-small dev-normal-button" @click="clearAll" >清除</button>
    </div>

    <div v-else class="form-group">

        <textarea
            :placeholder="`繁體`"
            :value="modelTraditional"
            :maxlength="maxLength"
            class="form-control textarea"
            :rows="rows"
            @input="onTraditionalInput"
            @blur="onTraditionalBlur"
            :disabled="disabled"
        ></textarea>

      <textarea
          :placeholder="`簡體`"
          :value="modelSimplified"
          :maxlength="maxLength"
          class="form-control textarea"
          :rows="rows"
          @input="onSimplifiedInput"
          @blur="onSimplifiedBlur"
          :disabled="disabled"
      ></textarea>
    </div>

    <!-- 按钮 + 状态消息（大版本使用） -->
    <div v-if="layout === 'large' && !disabled" class="button-group">
      <div v-if="statusMessage" class="status-message" :class="statusType">
        {{ statusMessage }}
      </div>

      <button v-if="!disabled" @click="clearAll" class="dev-btn-small dev-normal-button">清除</button>
    </div>
  </div>
</template>

<script setup>
import {ref, watch, computed} from 'vue'

// 定义组件属性 - 使用 v-model 绑定
const props = defineProps({
  // 双向绑定的繁体文本
  traditionalText: {
    type: String,
    default: ''
  },
  // 双向绑定的简体文本
  simplifiedText: {
    type: String,
    default: ''
  },
  layout: {
    type: String,
    default: 'large'   // 'small' | 'large'
  },
  // 最大长度
  maxLength: {
    type: Number,
    default: 20000
  },
  // 文本域行数
  rows: {
    type: Number,
    default: 4
  },
  // 防抖延迟（毫秒）
  debounceDelay: {
    type: Number,
    default: 2000
  },
  // 转换API地址
  conversionApi: {
    type: String,
    default: '/api/transfer/tc'
  },
  // 禁用状态
  disabled: {
    type: Boolean,
    default: false
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

// 内部响应式数据（用于处理逻辑，但通过 emit 更新父组件）
const modelTraditional = ref(props.traditionalText)
const modelSimplified = ref(props.simplifiedText)

// 监听父组件传入的值变化
watch(() => props.traditionalText, (newVal) => {
  if (newVal !== modelTraditional.value) {
    modelTraditional.value = newVal
    lastTraditionalText = newVal
  }
})

watch(() => props.simplifiedText, (newVal) => {
  if (newVal !== modelSimplified.value) {
    modelSimplified.value = newVal
  }
})

// 其他内部状态保持不变
const showCorrection = ref(false)
const isConverting = ref(false)
const isDebouncing = ref(false)

// 计算属性
const charCountInfo = computed(() => {
  const traditionalLength = getStringLength(modelTraditional.value)
  const simplifiedLength = getStringLength(modelSimplified.value)
  return {
    traditional: traditionalLength,
    simplified: simplifiedLength,
    isConsistent: traditionalLength === simplifiedLength
  }
})

// 状态消息
const statusMessage = computed(() => {
  if (isConverting.value) {
    return '轉換中……'
  }
  if (isDebouncing.value) {
    return '請輸入文本'
  }
  if (!charCountInfo.value.isConsistent && modelTraditional.value && modelSimplified.value) {
    return `請校對簡體`
  }
  if (charCountInfo.value.isConsistent && modelTraditional.value && modelSimplified.value) {
    return '轉換完成！'
  }
  if (!modelTraditional.value) {
    return '請輸入文本'
  }
  return ''
})

// 状态类型
const statusType = computed(() => {
  if (isConverting.value || isDebouncing.value) {
    return 'status-info'
  }
  if (!charCountInfo.value.isConsistent && modelTraditional.value && modelSimplified.value) {
    return 'status-warning'
  }
  if (charCountInfo.value.isConsistent && modelTraditional.value && modelSimplified.value) {
    return 'status-success'
  }
  return 'status-info'
})

// 内部状态
let lastTraditionalText = props.traditionalText
let isProcessingChange = false
let debounceTimer = null

// 输入事件处理
function onTraditionalInput(event) {
  modelTraditional.value = event.target.value
  emit('update:traditionalText', event.target.value)
  emit('traditional-change', event.target.value)
  scheduleConversion()
}

function onSimplifiedInput(event) {
  modelSimplified.value = event.target.value
  emit('update:simplifiedText', event.target.value)
  emit('simplified-change', event.target.value)
  updateCorrectionStatus()
}

// 使用 watch 监听内部繁体文本变化（用于处理转换逻辑）
watch(modelTraditional, (newVal, oldVal) => {
  if (isProcessingChange) return
  if (newVal === oldVal) return

  scheduleConversion()
})

// 使用 watch 监听内部简体文本变化（用于处理校对逻辑）
watch(modelSimplified, (newVal, oldVal) => {
  if (isProcessingChange) return
  if (newVal === oldVal) return

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
  if (!modelTraditional.value) {
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
    const response = await fetch(`${props.conversionApi}?tc=` + encodeURIComponent(modelTraditional.value))
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    modelSimplified.value = data.sc
    emit('update:simplifiedText', data.sc)
    lastTraditionalText = modelTraditional.value

    emit('convert', {
      traditional: modelTraditional.value,
      simplified: data.sc
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
    lastTraditionalText = modelTraditional.value
    showCorrection.value = false

    emit('correct', {
      traditional: modelTraditional.value,
      simplified: modelSimplified.value
    })
  }
}

// 清除所有内容
function clearAll() {
  modelTraditional.value = ''
  modelSimplified.value = ''
  emit('update:traditionalText', '')
  emit('update:simplifiedText', '')
  lastTraditionalText = ''
  showCorrection.value = false
  isDebouncing.value = false

  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  emit('clear')
}

// 处理繁体文本变化
function processTraditionalTextChange() {
  isProcessingChange = true

  // 如果繁体文本为空，清空简体文本
  if (!modelTraditional.value) {
    modelSimplified.value = ''
    lastTraditionalText = ''
    emit('update:simplifiedText', '')
    isProcessingChange = false
    return
  }

  // 如果简体文本为空，直接请求完整转换
  if (!modelSimplified.value) {
    fullTransfer()
    isProcessingChange = false
    return
  }

  // 使用改进的diff算法检测变化
  const diffResult = calculateTextDiff(lastTraditionalText, modelTraditional.value)

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
  const newSimplified = stringSlice(modelSimplified.value, 0, diffResult.position) +
      stringSlice(modelSimplified.value, diffResult.position + diffResult.length)
  modelSimplified.value = newSimplified
  emit('update:simplifiedText', newSimplified)
  lastTraditionalText = modelTraditional.value
  isProcessingChange = false

  // 触发校对状态更新
  updateCorrectionStatus()
}

// 更新校对状态
function updateCorrectionStatus() {
  showCorrection.value = !charCountInfo.value.isConsistent &&
      modelTraditional.value &&
      modelSimplified.value
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
        stringSlice(modelSimplified.value, 0, diffResult.position) +
        convertedNewText +
        stringSlice(modelSimplified.value, diffResult.position)

    modelSimplified.value = newSimplified
    emit('update:simplifiedText', newSimplified)
    lastTraditionalText = modelTraditional.value

    updateCorrectionStatus()
  } catch (err) {
    emit('error', '部分转换失败: ' + err.message)

    // 插入占位符确保长度一致
    const newSimplified = stringSlice(modelSimplified.value, 0, diffResult.position) +
        '□'.repeat(getStringLength(diffResult.text)) +
        stringSlice(modelSimplified.value, diffResult.position)
    modelSimplified.value = newSimplified
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
        stringSlice(modelSimplified.value, 0, diffResult.position) +
        convertedText +
        stringSlice(modelSimplified.value, diffResult.position + diffResult.length)

    modelSimplified.value = newSimplified
    emit('update:simplifiedText', newSimplified)
    lastTraditionalText = modelTraditional.value

    updateCorrectionStatus()
  } catch (err) {
    emit('error', '局部替换转换失败: ' + err.message)
    await fullTransfer()
  } finally {
    isConverting.value = false
    isProcessingChange = false
  }
}

// 改进的文本差异计算
function calculateTextDiff(oldText, newText) {
  if (!oldText || !newText) {
    return {type: 'replace'}
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

  return {type: 'replace'}
}

// 文本框失去焦点事件
function onTraditionalBlur() {
  emit('blur:traditional', modelTraditional.value)
}

function onSimplifiedBlur() {
  emit('blur:simplified', modelSimplified.value)
}

// 暴露方法给父组件
defineExpose({
  clearAll,
  fullTransfer,
  manualCorrect
})
</script>

<style>
/* 原有样式完全保持不变 */
.small-row {
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
</style>