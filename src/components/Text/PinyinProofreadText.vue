<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { formatRichText } from '../../utils/textFormatter.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '输入拼音' },
  maxLength: { type: Number, default: 50 },
  dialect: { type: String, default: 'nam' }
})

const emit = defineEmits([
  'update:modelValue',
  'input',
  'blur',
  'valid',
  'invalid',
  'corrected',
  'clear'
])

// ===== 核心状态（统一）=====
const modelValue = ref(props.modelValue)
const result = ref(null) // { code, display, correction }

const isChecking = ref(false)
const isCorrecting = ref(false)

// ===== computed（完全替代旧状态）=====

const statusMessage = computed(() => {
  if (!result.value) return ''
  if (result.value.code === 3) return '无效拼音'
  return result.value.display || ''
})

const statusType = computed(() => {
  if (!result.value) return ''
  return {
    1: 'status-success',
    2: 'status-warning',
    3: 'status-error'
  }[result.value.code]
})

const showCorrectionButton = computed(() => {
  return result.value?.code === 2
})

const formattedStatusMessage = computed(() => {
  if (!statusMessage.value) return ''

  return result.value.code === 3
      ? statusMessage.value
      : formatRichText(statusMessage.value)
})

// ===== 同步父组件 =====
watch(() => props.modelValue, (v) => {
  if (v !== modelValue.value) modelValue.value = v
})

// ===== 生命周期 =====
onMounted(() => {
  if (modelValue.value.trim()) checkPinyin()
})

// ===== 事件 =====
function onInput(e) {
  const value = e.target.value
  modelValue.value = value
  emit('update:modelValue', value)
  emit('input', value)
}

function onBlur() {
  emit('blur', modelValue.value)
  modelValue.value.trim() ? checkPinyin() : resetStatus()
}

function onEnter() {
  modelValue.value.trim() ? checkPinyin() : resetStatus()
}

// ===== 核心逻辑 =====

async function checkPinyin() {
  const pinyin = modelValue.value.trim()
  if (!pinyin) return resetStatus()

  isChecking.value = true

  try {
    const res = await fetch(
        `/api/pinyin/normalize/${props.dialect}?pinyin=${encodeURIComponent(pinyin)}`
    )

    if (!res.ok) {
      console.error('拼音验证请求失败:', res.status)
      return
    }

    const triple = await res.json()
    handleCheckResult(triple)

  } catch (e) {
    console.error('拼音验证异常:', e)
  } finally {
    isChecking.value = false
  }
}

// ===== 核心简化点 =====
function handleCheckResult(triple) {
  const code = triple.left ?? triple[0]
  const display = triple.middle ?? triple[1]
  const correction = triple.right ?? triple[2]

  result.value = {
    code,
    display,
    correction: correction || null
  }

  // ===== emit 保持不变 =====
  if (code === 1) {
    emit('valid', display)
  } else if (code === 2) {
    emit('invalid', {
      type: 'correctable',
      middle: display,
      right: correction
    })
  } else if (code === 3) {
    emit('invalid', { type: 'invalid' })
  }
}

function applyCorrection() {
  const correction = result.value?.correction
  if (!correction || isCorrecting.value) return

  const original = modelValue.value

  isCorrecting.value = true

  try {
    modelValue.value = correction
    emit('update:modelValue', correction)

    emit('corrected', {
      original,
      corrected: correction
    })

    setTimeout(checkPinyin, 100)
  } finally {
    isCorrecting.value = false
  }
}

function clearAll() {
  modelValue.value = ''
  emit('update:modelValue', '')
  emit('clear')
  resetStatus()
}

function resetStatus() {
  result.value = null
}

// ===== 对外暴露保持不变 =====
defineExpose({
  checkPinyin,
  clearAll,
  applyCorrection
})
</script>

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