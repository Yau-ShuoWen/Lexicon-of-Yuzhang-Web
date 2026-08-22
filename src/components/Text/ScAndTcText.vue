<!--  src/components/Text/ScAndTcText.vue  -->

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'

const props = defineProps({
  traditionalText: {type: String, default: ''},
  simplifiedText: {type: String, default: ''},
  layout: {type: String, default: 'large'},
  maxLength: {type: Number, default: 20000},
  rows: {type: Number, default: 4},
  dialect: {type: String, required:true},
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

const hint = computed(() => {
  if (isScDirty.value && isTcDirty.value)  return {icon: '❌', title: '错误状态，请刷新页面'};
  if (!isScDirty.value && !isTcDirty.value) return {icon: '✅', title: '简繁对应状态正确'};
  if (isScDirty.value) return {icon: '简', title: '校对简体中，按下Ctrl+Enter或点击「同步」保存，字数需要相等'};
  if (isTcDirty.value) return {icon: '繁', title: '编辑繁体中，按下Ctrl+Enter或点击「同步」自动翻译简体'};
})

// 是否有待同步的内容（决定手动同步按钮是否可用）
const hasPendingSync = computed(() => isTcDirty.value || isScDirty.value)

const isSubmitting = ref(false)

const tcLocked = computed(() => isScDirty.value)
const scLocked = computed(() => isTcDirty.value)

// ============ 移动端模式：单框切换 ============
const viewMode = ref('tc')   // 当前显示的语言：'tc' 繁体 / 'sc' 简体
const mobileLocked = computed(() => viewMode.value === 'tc' ? isScDirty.value : isTcDirty.value)

function toggleViewMode() {
  viewMode.value = viewMode.value === 'tc' ? 'sc' : 'tc'
}

const tcBox = ref(null)
const scBox = ref(null)

function syncHeight(source, target) {
  if (!source || !target) return
  target.style.height = source.style.height
}

onMounted(() => {

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === tcBox.value) syncHeight(tcBox.value, scBox.value)
      if (entry.target === scBox.value) syncHeight(scBox.value, tcBox.value)
    }
  })
  if (tcBox.value) observer.observe(tcBox.value)
  if (scBox.value) observer.observe(scBox.value)
})

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

// ============ 移动端单框检查（按当前视图写入对应框） ============
function onMobileCheck(e) {
  if (viewMode.value === 'tc') {
    newTc.value = e.target.value
    isTcDirty.value = true
    emit('update:traditionalText', newTc.value)
  } else {
    newSc.value = e.target.value
    isScDirty.value = true
    emit('update:simplifiedText', newSc.value)
  }
}

// ============ 移动端 Ctrl + Enter（按当前视图分发） ============
function onMobileUpdate(e) {
  // Enter+Ctrl / Enter + ⌘
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
    e.preventDefault()
  else return

  if (viewMode.value === 'tc') translateTcToSc()
  else commitSc()
}

// ============ 繁体翻译：繁体 → 简体（Ctrl+Enter 或手动同步触发） ============
async function translateTcToSc() {
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
        `/api/proofread/sc-tc-translate/${props.dialect}`,
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

// ============ 简体校对：保存简体（Ctrl+Enter 或手动同步触发） ============
async function commitSc() {
  if (props.disabled) return
  if (isSubmitting.value) return

  await nextTick()

  if (cpLen(oldTc.value) !== cpLen(newSc.value)) {
    console.error("旧tc sc长度不一致")
    return
  }

  oldSc.value = newSc.value
  isScDirty.value = false

  emit('update:simplifiedText', newSc.value)
}

// ============ 手动同步按钮：分担 Ctrl+Enter 的工作 ============
async function manualSync() {
  if (isTcDirty.value) await translateTcToSc()
  else if (isScDirty.value) await commitSc()
}

// ============ 繁体框 Ctrl + Enter 触发翻译请求 ============
function onTraditionalUpdate(e) {
  // Enter+Ctrl / Enter + ⌘
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
    e.preventDefault()
  else return

  translateTcToSc()
}

// ============ 简体框 Ctrl + Enter 触发校对 ============
function onSimplifiedUpdate(e) {
  // Enter+Ctrl / Enter + ⌘
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
    e.preventDefault()
  else return

  commitSc()
}

// ============ 清空 ============
function clearAll() {
  oldTc.value = ''
  oldSc.value = ''
  newTc.value = ''
  newSc.value = ''
  isTcDirty.value = false
  isScDirty.value = false
  viewMode.value = 'tc'

  emit('update:traditionalText', '')
  emit('update:simplifiedText', '')
  emit('clear')
}

defineExpose({clearAll})
</script>

<template>
  <div>
    <!-- 小型布局：单行双输入框 -->
    <div v-if="layout === 'small'" class="sc-tc-row">

      <input type="text" class="form-control sc-tc-input sc-tc-input--small" placeholder="繁體"
             :value="newTc" :maxlength="maxLength" :disabled="disabled || tcLocked"
             @input="onTraditionalCheck" @keydown="onTraditionalUpdate"/>

      <input type="text" class="form-control sc-tc-input sc-tc-input--small" placeholder="簡體"
             :value="newSc" :maxlength="maxLength" :disabled="disabled || scLocked"
             @input="onSimplifiedCheck" @keydown="onSimplifiedUpdate"/>

      <div v-if="!disabled" class="sc-tc-actions">
        <button type="button" class="sc-tc-btn sc-tc-btn--sync"
                :disabled="isSubmitting || !hasPendingSync"
                title="手动同步（等同 Ctrl+Enter）" @click="manualSync">同步</button>
        <button type="button" class="sc-tc-btn sc-tc-btn--ghost" @click="clearAll">清除</button>
        <span class="sc-tc-status" :title="hint.title">{{ hint.icon }}</span>
      </div>
    </div>

    <!-- 中型布局：双输入框 + 右侧操作列 -->
    <div v-else-if="layout === 'middle'" class="sc-tc-group">

      <div class="sc-tc-fields">
        <input type="text" class="form-control sc-tc-input sc-tc-input--middle" placeholder="繁體"
               :value="newTc" :maxlength="maxLength" :disabled="disabled || tcLocked"
               @input="onTraditionalCheck" @keydown="onTraditionalUpdate"/>

        <input type="text" class="form-control sc-tc-input sc-tc-input--middle" placeholder="簡體"
               :value="newSc" :maxlength="maxLength" :disabled="disabled || scLocked"
               @input="onSimplifiedCheck" @keydown="onSimplifiedUpdate"/>
      </div>

      <div v-if="!disabled" class="sc-tc-actions sc-tc-actions--column">
        <button type="button" class="sc-tc-btn sc-tc-btn--sync"
                :disabled="isSubmitting || !hasPendingSync"
                title="手动同步（等同 Ctrl+Enter）" @click="manualSync">同步</button>
        <button type="button" class="sc-tc-btn sc-tc-btn--ghost" @click="clearAll">清除</button>
        <span class="sc-tc-status" :title="hint.title">{{ hint.icon }}</span>
      </div>
    </div>

    <!-- 移动端布局：单框 + 简繁切换按钮 -->
    <div v-else-if="layout === 'mobile'" class="sc-tc-mobile">

      <div class="sc-tc-mobile__bar">
        <div class="sc-tc-toggle" title="切换简体/繁体" @click="toggleViewMode">
          <span class="sc-tc-toggle__thumb" :class="{'is-sc': viewMode === 'sc'}"></span>
          <span class="sc-tc-toggle__label" :class="{'is-active': viewMode === 'tc'}">繁</span>
          <span class="sc-tc-toggle__label" :class="{'is-active': viewMode === 'sc'}">简</span>
        </div>

        <div v-if="!disabled" class="sc-tc-mobile__actions">
          <button type="button" class="sc-tc-btn sc-tc-btn--sync"
                  :disabled="isSubmitting || !hasPendingSync"
                  title="手动同步（等同 Ctrl+Enter）" @click="manualSync">同步</button>
          <button type="button" class="sc-tc-btn sc-tc-btn--ghost" @click="clearAll">清除</button>
        </div>

        <span v-if="!disabled" class="sc-tc-status" :title="hint.title">{{ hint.icon }}</span>
      </div>

      <textarea class="form-control sc-tc-textarea sc-tc-mobile__textarea"
                :placeholder="viewMode === 'tc' ? '繁體' : '簡體'"
                :value="viewMode === 'tc' ? newTc : newSc"
                :maxlength="maxLength" :rows="rows" :disabled="disabled || mobileLocked"
                @input="onMobileCheck" @keydown="onMobileUpdate"/>
    </div>

    <!-- 大型布局：双文本框 + 右侧操作列 -->
    <div v-else class="sc-tc-group">

      <div class="sc-tc-fields">
        <textarea
            placeholder="繁體" class="form-control sc-tc-textarea" ref="tcBox"
            :value="newTc" :maxlength="maxLength" :rows="rows" :disabled="disabled || tcLocked"
            @input="onTraditionalCheck" @keydown="onTraditionalUpdate"/>

        <textarea
            placeholder="簡體" class="form-control sc-tc-textarea" ref="scBox"
            :value="newSc" :maxlength="maxLength" :rows="rows" :disabled="disabled || scLocked"
            @input="onSimplifiedCheck" @keydown="onSimplifiedUpdate"/>
      </div>

      <div v-if="!disabled" class="sc-tc-actions sc-tc-actions--column">
        <button type="button" class="sc-tc-btn sc-tc-btn--sync"
                :disabled="isSubmitting || !hasPendingSync"
                title="手动同步（等同 Ctrl+Enter）" @click="manualSync">同步</button>
        <button type="button" class="sc-tc-btn sc-tc-btn--ghost" @click="clearAll">清除</button>
        <span class="sc-tc-status" :title="hint.title">{{ hint.icon }}</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ============ 简繁对照组件样式 ============ */

/* --- 小型布局：单行排列，可换行 --- */
.sc-tc-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

/* --- 大型/中型布局：输入对 + 右侧操作列 --- */
.sc-tc-group {
  display: flex;
  align-items: stretch;
  gap: var(--spacing-md);
}

.sc-tc-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

/* --- 输入框尺寸 --- */
.sc-tc-input--small {
  width: 130px;
  min-width: 110px;
  height: 34px;
  padding: 4px 10px;
  font-size: var(--font-size-sm);
  line-height: 1.3;
}

.sc-tc-input--middle {
  flex: 1;
  min-width: 100px;
  max-width: 500px;
  height: 34px;
  padding: 4px 10px;
  font-size: var(--font-size-sm);
  line-height: 1.3;
}

/* --- 文本框 --- */
.sc-tc-textarea {
  flex: 1;
  min-width: 0;
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
}

/* --- 操作区 --- */
.sc-tc-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.sc-tc-actions--column {
  flex-direction: column;
  align-items: stretch;
}

.sc-tc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 32px;
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: all var(--transition-fast);
}

.sc-tc-btn:disabled {
  cursor: not-allowed;
}

/* 同步主按钮 */
.sc-tc-btn--sync {
  background: var(--gradient-primary);
  border-color: transparent;
  color: #fff;
  font-weight: 500;
}

.sc-tc-btn--sync:hover:not(:disabled) {
  filter: brightness(1.06);
  box-shadow: var(--shadow-sm);
}

.sc-tc-btn--sync:disabled {
  background: #e9ecef;
  color: #adb5bd;
}

/* 清除次按钮 */
.sc-tc-btn--ghost {
  background: #f8f9fa;
  color: #6c757d;
}

.sc-tc-btn--ghost:hover:not(:disabled) {
  background: #e9ecef;
}

/* 状态角标 */
.sc-tc-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
  padding: 0 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  background: #f8f9fa;
  font-size: 14px;
  cursor: help;
}

/* --- 移动端布局：单框 + 切换开关 --- */
.sc-tc-mobile {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.sc-tc-mobile__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.sc-tc-mobile__actions {
  display: flex;
  gap: var(--spacing-xs);
}

.sc-tc-mobile__textarea {
  width: 100%;
  min-height: 120px;
}

/* 简繁切换开关（滑块滑动动画） */
.sc-tc-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 76px;
  height: 34px;
  padding: 3px;
  border-radius: 999px;
  background: #e9ecef;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.sc-tc-toggle:active {
  transform: scale(0.94);
}

.sc-tc-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-base);
}

.sc-tc-toggle__thumb.is-sc {
  transform: translateX(42px);
}

.sc-tc-toggle__label {
  position: relative;
  z-index: 1;
  flex: 1;
  text-align: center;
  font-size: var(--font-size-sm);
  line-height: 28px;
  color: var(--color-text-light);
  transition: color var(--transition-fast), font-weight var(--transition-fast);
}

.sc-tc-toggle__label.is-active {
  color: #fff;
  font-weight: 600;
}
</style>
