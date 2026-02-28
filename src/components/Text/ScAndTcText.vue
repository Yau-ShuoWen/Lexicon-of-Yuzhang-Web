<!--  src/components/Text/ScAndTcText.vue  -->

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'

const props = defineProps({
  traditionalText: {type: String, default: ''},
  simplifiedText: {type: String, default: ''},
  layout: {type: String, default: 'large'},
  maxLength: {type: Number, default: 20000},
  rows: {type: Number, default: 4},
  dialect: {type: String, default: 'nam'},
  disabled: {type: Boolean, default: false}
})

const emit = defineEmits([
  'update:traditionalText',
  'update:simplifiedText',
  'clear'
])

// ============ 核心状态 ============
const oldTc = ref('')
const oldSc = ref('')
const newTc = ref('')
const newSc = ref('')
const isTcDirty = ref(false)
const isScDirty = ref(false)

const isSubmitting = ref(false)

const tcLocked = computed(() => isScDirty.value)
const scLocked = computed(() => isTcDirty.value)

// ============ 代码点长度 ============
function cpLen(str) {
  return Array.from(str || '').length
}

// ============ 初始化 ============
onMounted(() => {
  if (props.traditionalText && props.simplifiedText) {
    if (cpLen(props.traditionalText) !== cpLen(props.simplifiedText)) {
      throw new Error("初始化繁简长度不一致，这是设计缺陷")
    }
  }

  oldTc.value = props.traditionalText || ''
  oldSc.value = props.simplifiedText || ''
  newTc.value = props.traditionalText || ''
  newSc.value = props.simplifiedText || ''
})

// ============ 繁体框检查 ============
function onTraditionalCheck(e) {
  newTc.value = e.target.value
  isTcDirty.value = true
  emit('update:traditionalText', newTc.value)
}

// ============ 简体框检查 ============
function onSimplifiedCheck(e) {
  newSc.value = e.target.value
  isScDirty.value = true
  emit('update:simplifiedText', newSc.value)
}

// ============ 繁体框 Ctrl + Enter 触发翻译请求 ============
async function onTraditionalUpdate(e) {
  // Enter+Ctrl / Enter + ⌘
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
    e.preventDefault()
  else return

  if (props.disabled) return
  if (isSubmitting.value) return

  await nextTick()

  if (cpLen(oldTc.value) !== cpLen(oldSc.value)) {
    console.error("旧tc sc长度不一致")
    return
  }

  isSubmitting.value = true

  try {
    const res = await fetch(
        `/api/transfer/${props.dialect}/sc-tc-translate`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            left: oldTc.value,
            middle: newTc.value,
            right: oldSc.value
          })
        }
    )

    const data = await res.json()

    if (data.success) {

      oldTc.value = data.data.tc
      oldSc.value = data.data.sc

      newTc.value = data.data.tc
      newSc.value = data.data.sc

      emit('update:traditionalText', newTc.value)
      emit('update:simplifiedText', newSc.value)

      isTcDirty.value = false
      isScDirty.value = false
    } else {
      console.log(data)
    }

  } catch (error) {
    console.error('保存失败:', error)
  }
  finally {
    isSubmitting.value = false
  }

}

// ============ 简体框 Ctrl + Enter 触发校对 ============
async function onSimplifiedUpdate(e) {
  // Enter+Ctrl / Enter + ⌘
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
    e.preventDefault()
  else return

  if (props.disabled) return
  if (isSubmitting.value) return

  await nextTick()

  if (cpLen(oldTc.value) !== cpLen(newSc.value)) {
    console.error("旧tc sc长度不一致")
    return
  } else {
    oldSc.value = newSc.value
    isScDirty.value = false
  }

  emit('update:simplifiedText', newSc.value)
}

// ============ 清空 ============
function clearAll() {
  oldTc.value = ''
  oldSc.value = ''
  newTc.value = ''
  newSc.value = ''
  isTcDirty.value = false
  isScDirty.value = false

  emit('update:traditionalText', '')
  emit('update:simplifiedText', '')
  emit('clear')
}

defineExpose({clearAll})
</script>

<template>
  <div>
    <div v-if="layout === 'small'" class="small-row">

      <input type="text" class="form-control small-input" placeholder="繁體"
          :value="newTc" :maxlength="maxLength" :disabled="disabled || tcLocked"
          @input="onTraditionalCheck" @keydown="onTraditionalUpdate"/>

      <input type="text" class="form-control small-input" placeholder="簡體"
          :value="newSc" :maxlength="maxLength" :disabled="disabled || scLocked"
          @input="onSimplifiedCheck" @keydown="onSimplifiedUpdate"/>

      <button @click="clearAll" class="dev-btn-small dev-normal-button">清除</button>

      <div class="dev-btn-small" v-if="isScDirty&&isTcDirty" title="错误状态，请刷新页面">❌</div>
      <div class="dev-btn-small" v-if="!isScDirty&&!isTcDirty" title="简繁对应状态正确">✅</div>
      <div class="dev-btn-small" v-if="isScDirty" title="校对简体中，按下Ctrl+Enter保存，字数需要相等">⌨️简</div>
      <div class="dev-btn-small" v-if="isTcDirty" title="编辑繁体中，按下Ctrl+Enter自动翻译简体">⌨️繁</div>

    </div>

    <div v-else class="form-group">

      <textarea
          placeholder="繁體" class="form-control textarea"
          :value="newTc" :maxlength="maxLength" :rows="rows" :disabled="disabled || tcLocked"
          @input="onTraditionalCheck" @keydown="onTraditionalUpdate"/>

      <textarea
          placeholder="簡體" class="form-control textarea"
          :value="newSc" :maxlength="maxLength" :rows="rows" :disabled="disabled || scLocked"
          @input="onSimplifiedCheck" @keydown="onSimplifiedUpdate"/>

      <div class="button-group">
        <button @click="clearAll" class="dev-btn-small dev-normal-button">清除</button>
        <div class="dev-btn-small" v-if="isScDirty&&isTcDirty" title="错误状态，请刷新页面">❌</div>
        <div class="dev-btn-small" v-if="!isScDirty&&!isTcDirty" title="简繁对应状态正确">✅</div>
        <div class="dev-btn-small" v-if="isScDirty" title="校对简体中，按下Ctrl+Enter保存，字数需要相等">⌨️简</div>
        <div class="dev-btn-small" v-if="isTcDirty" title="编辑繁体中，按下Ctrl+Enter自动翻译简体">⌨️繁</div>
      </div>
    </div>

  </div>
</template>

<style>
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

.textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  line-height: 1.5;
}
</style>