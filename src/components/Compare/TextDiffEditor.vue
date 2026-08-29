<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getToken } from '../../utils/auth.js'

const DIFF_LINE_HEIGHT = 24

const props = defineProps({
  source: { type: String, default: '' },
  target: { type: String, default: '' },
  sourceLabel: { type: String, default: '左侧版本' },
  targetLabel: { type: String, default: '右侧版本' },
  compareUrl: { type: String, default: '/api/tool/string-diff' },
  placeholder: { type: String, default: '输入文本后自动比较' }
})

const emit = defineEmits([
  'update:source',
  'update:target',
  'error',
  'compared'
])

const sourceText = computed({
  get: () => props.source,
  set: value => emit('update:source', value)
})

const targetText = computed({
  get: () => props.target,
  set: value => emit('update:target', value)
})

const diffData = ref({ source: '', target: '', changes: [] })
const isComparing = ref(false)
const errorMessage = ref('')
const activeChangeIndex = ref(-1)
const gutterOffset = ref(0)

const sourceTextarea = ref(null)
const targetTextarea = ref(null)
const sourceHighlight = ref(null)
const targetHighlight = ref(null)
const sourceLineNumbers = ref(null)
const targetLineNumbers = ref(null)
const gutterCanvas = ref(null)

let compareTimer = null
let compareSequence = 0
let isSyncingScroll = false
let scrollFrame = null

const changes = computed(() => Array.isArray(diffData.value?.changes)
  ? diffData.value.changes
  : [])

const summary = computed(() => ({
  total: changes.value.length,
  deleted: changes.value.filter(item => item.type === 'DELETED').length,
  added: changes.value.filter(item => item.type === 'ADDED').length,
  modified: changes.value.filter(item => item.type === 'MODIFIED').length
}))

const currentChangeLabel = computed(() => {
  if (!changes.value.length || activeChangeIndex.value < 0) return ''
  return `${activeChangeIndex.value + 1}/${changes.value.length}`
})

const sourceLineCount = computed(() => lineCount(sourceText.value))
const targetLineCount = computed(() => lineCount(targetText.value))
const gutterHeight = computed(() => `${Math.max(sourceLineCount.value, targetLineCount.value, 1) * DIFF_LINE_HEIGHT}px`)

const sourceLineList = computed(() => lineList(sourceLineCount.value))
const targetLineList = computed(() => lineList(targetLineCount.value))

const sourceHighlights = computed(() => buildHighlights(diffData.value.source, 'source'))
const targetHighlights = computed(() => buildHighlights(diffData.value.target, 'target'))

const gutterItems = computed(() => changes.value.map((change, index) => ({
  change,
  index,
  line: Math.max(
    lineNumber(charsOf(diffData.value.source), change.sourceStart),
    lineNumber(charsOf(diffData.value.target), change.targetStart)
  )
})))

function charsOf(value) {
  return Array.from(value || '')
}

function lineCount(value) {
  return Math.max(1, String(value || '').split('\n').length)
}

function lineList(count) {
  return Array.from({ length: count }, (_, index) => index + 1)
}

function sliceChars(chars, start, end) {
  return chars.slice(start, end).join('')
}

function lineNumber(chars, index) {
  let line = 1
  for (let i = 0; i < index; i++) {
    if (chars[i] === '\n') line++
  }
  return line
}

function buildHighlights(text, side) {
  const chars = charsOf(text)
  const result = []
  const ranges = changes.value
    .map((change, index) => ({
      start: side === 'source' ? change.sourceStart : change.targetStart,
      end: side === 'source' ? change.sourceEnd : change.targetEnd,
      type: change.type,
      index
    }))
    .filter(range => range.end > range.start)
    .sort((left, right) => left.start - right.start)

  let cursor = 0
  ranges.forEach(range => {
    if (range.start > cursor) {
      result.push({
        id: `context-${side}-${cursor}`,
        value: sliceChars(chars, cursor, range.start),
        className: ''
      })
    }

    const isRemoved = side === 'source'
      ? range.type === 'DELETED' || range.type === 'MODIFIED'
      : false
    const isAdded = side === 'target'
      ? range.type === 'ADDED' || range.type === 'MODIFIED'
      : false

    result.push({
      id: `change-${side}-${range.index}`,
      value: sliceChars(chars, range.start, range.end),
      className: isRemoved ? 'diff-highlight--removed' : isAdded ? 'diff-highlight--added' : ''
    })
    cursor = range.end
  })

  if (cursor < chars.length || !result.length) {
    result.push({
      id: `tail-${side}-${cursor}`,
      value: sliceChars(chars, cursor, chars.length),
      className: ''
    })
  }

  return result
}

function actionLabel(type) {
  if (type === 'DELETED') return '补到右侧'
  if (type === 'ADDED') return '删除右侧'
  return '用左侧替换'
}

function changeTypeLabel(type) {
  if (type === 'DELETED') return '左侧删除'
  if (type === 'ADDED') return '右侧新增'
  return '内容修改'
}

function replaceByCodePoints(text, start, end, replacement) {
  const chars = charsOf(text)
  return chars.slice(0, start).concat(charsOf(replacement), chars.slice(end)).join('')
}

function codePointIndexToStringIndex(text, codePointIndex) {
  return charsOf(text).slice(0, codePointIndex).join('').length
}

function invalidateDiff(nextSource = sourceText.value, nextTarget = targetText.value) {
  diffData.value = { source: nextSource, target: nextTarget, changes: [] }
  activeChangeIndex.value = -1
}

function onTextInput(side, event) {
  const value = event.target.value
  if (side === 'source') {
    sourceText.value = value
    invalidateDiff(value, targetText.value)
  } else {
    targetText.value = value
    invalidateDiff(sourceText.value, value)
  }
}

function applyChange(change) {
  if (!change || isComparing.value) return

  const nextTarget = replaceByCodePoints(
    targetText.value,
    change.targetStart,
    change.targetEnd,
    change.sourceText
  )
  const nextCaret = codePointIndexToStringIndex(
    nextTarget,
    change.targetStart + charsOf(change.sourceText).length
  )
  targetText.value = nextTarget
  invalidateDiff(sourceText.value, nextTarget)

  nextTick(() => {
    targetTextarea.value?.focus()
    targetTextarea.value?.setSelectionRange(nextCaret, nextCaret)
  })
}

function applyAll() {
  if (isComparing.value || !changes.value.length) return

  let nextTarget = targetText.value
  const ordered = [...changes.value].sort((left, right) => {
    if (left.targetStart !== right.targetStart) return right.targetStart - left.targetStart
    return right.targetEnd - left.targetEnd
  })

  ordered.forEach(change => {
    nextTarget = replaceByCodePoints(
      nextTarget,
      change.targetStart,
      change.targetEnd,
      change.sourceText
    )
  })

  targetText.value = nextTarget
  invalidateDiff(sourceText.value, nextTarget)
  nextTick(() => targetTextarea.value?.focus())
}

function gutterButtonStyle(item) {
  return { top: `${Math.max(0, item.line - 1) * DIFF_LINE_HEIGHT + 4}px` }
}

function goToChange(index) {
  if (!changes.value.length) return
  const normalizedIndex = (index + changes.value.length) % changes.value.length
  const change = changes.value[normalizedIndex]
  const line = Math.max(
    lineNumber(charsOf(diffData.value.source), change.sourceStart),
    lineNumber(charsOf(diffData.value.target), change.targetStart)
  )
  const nextScrollTop = Math.max(0, (line - 4) * DIFF_LINE_HEIGHT)

  activeChangeIndex.value = normalizedIndex
  setScrollTop(nextScrollTop)
}

function previousChange() {
  goToChange(activeChangeIndex.value <= 0 ? changes.value.length - 1 : activeChangeIndex.value - 1)
}

function nextChange() {
  goToChange(activeChangeIndex.value < 0 ? 0 : activeChangeIndex.value + 1)
}

function setScrollTop(value) {
  const textareas = [sourceTextarea.value, targetTextarea.value]
  const layers = [sourceHighlight.value, targetHighlight.value, sourceLineNumbers.value, targetLineNumbers.value]
  isSyncingScroll = true
  textareas.forEach(element => {
    if (element) element.scrollTop = value
  })
  layers.forEach(element => {
    if (element) element.scrollTop = value
  })
  gutterOffset.value = value
  if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    isSyncingScroll = false
    scrollFrame = null
  })
}

function syncScroll(event) {
  if (isSyncingScroll) return
  const source = sourceTextarea.value
  const target = targetTextarea.value
  if (!source || !target) return

  const scrollTop = event.target.scrollTop
  const scrollLeft = event.target.scrollLeft
  isSyncingScroll = true

  ;[source, target].forEach(element => {
    element.scrollTop = scrollTop
    element.scrollLeft = scrollLeft
  })
  ;[sourceHighlight.value, targetHighlight.value].forEach(element => {
    if (element) {
      element.scrollTop = scrollTop
      element.scrollLeft = scrollLeft
    }
  })
  ;[sourceLineNumbers.value, targetLineNumbers.value].forEach(element => {
    if (element) element.scrollTop = scrollTop
  })
  gutterOffset.value = scrollTop

  if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    isSyncingScroll = false
    scrollFrame = null
  })
}

async function compare() {
  const sequence = compareSequence
  errorMessage.value = ''

  if (!sourceText.value && !targetText.value) {
    diffData.value = { source: '', target: '', changes: [] }
    activeChangeIndex.value = -1
    emit('compared', diffData.value)
    isComparing.value = false
    return
  }

  isComparing.value = true
  try {
    const headers = { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) headers['X-Auth-Token'] = token

    const response = await fetch(props.compareUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: sourceText.value, target: targetText.value })
    })
    const json = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(json?.message || `比较失败：HTTP ${response.status}`)
    }
    if (!json?.success) {
      throw new Error(json?.message || '比较失败')
    }
    if (sequence !== compareSequence) return

    diffData.value = json.data || {
      source: sourceText.value,
      target: targetText.value,
      changes: []
    }
    activeChangeIndex.value = diffData.value.changes?.length ? 0 : -1
    emit('compared', diffData.value)
    await nextTick()
    setScrollTop(sourceTextarea.value?.scrollTop || 0)
  } catch (error) {
    if (sequence !== compareSequence) return
    errorMessage.value = error.message || '比较失败'
    emit('error', error)
  } finally {
    if (sequence === compareSequence) isComparing.value = false
  }
}

function scheduleCompare() {
  compareSequence++
  clearTimeout(compareTimer)
  isComparing.value = true
  compareTimer = setTimeout(compare, 260)
}

watch(
  [() => props.source, () => props.target, () => props.compareUrl],
  scheduleCompare,
  { immediate: true }
)

onBeforeUnmount(() => {
  clearTimeout(compareTimer)
  compareSequence++
  if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
})
</script>

<template>
  <section class="text-diff-editor">
    <div class="text-diff-editor__toolbar">
      <div class="text-diff-editor__status" aria-live="polite">
        <span class="text-diff-editor__status-dot" :class="{ 'is-busy': isComparing }"></span>
        <span>{{ isComparing ? '比较中…' : (changes.length ? '已完成比较' : '等待输入') }}</span>
        <span v-if="currentChangeLabel" class="text-diff-editor__position">差异 {{ currentChangeLabel }}</span>
      </div>

      <div class="text-diff-editor__toolbar-actions">
        <button
          class="diff-toolbar-button"
          type="button"
          :disabled="isComparing || !changes.length"
          aria-label="上一个差异"
          title="上一个差异"
          @click="previousChange"
        >↑</button>
        <button
          class="diff-toolbar-button"
          type="button"
          :disabled="isComparing || !changes.length"
          aria-label="下一个差异"
          title="下一个差异"
          @click="nextChange"
        >↓</button>
        <button
          class="diff-apply-all"
          type="button"
          :disabled="isComparing || !changes.length"
          @click="applyAll"
        >
          应用全部修改
        </button>
      </div>
    </div>

    <div class="text-diff-editor__summary">
      <span class="summary-count">{{ isComparing ? '正在计算差异' : `共 ${summary.total} 处差异` }}</span>
      <span v-if="summary.deleted" class="summary-badge summary-badge--deleted">删除 {{ summary.deleted }}</span>
      <span v-if="summary.added" class="summary-badge summary-badge--added">新增 {{ summary.added }}</span>
      <span v-if="summary.modified" class="summary-badge summary-badge--modified">修改 {{ summary.modified }}</span>
    </div>

    <p v-if="errorMessage" class="text-diff-editor__error" role="alert">{{ errorMessage }}</p>

    <div class="text-diff-editor__workbench">
      <div class="text-diff-editor__diff-head">
        <div class="diff-pane-heading">
          <span class="diff-pane-heading__side">左</span>
          <span>
            <strong>{{ sourceLabel }}</strong>
            <small>修改来源 · 完整编辑框</small>
          </span>
        </div>
        <div class="diff-gutter-heading">DIFF</div>
        <div class="diff-pane-heading diff-pane-heading--right">
          <span>
            <strong>{{ targetLabel }}</strong>
            <small>应用目标 · 完整编辑框</small>
          </span>
          <span class="diff-pane-heading__side">右</span>
        </div>
      </div>

      <div class="text-diff-editor__body">
        <div class="text-diff-pane">
          <div ref="sourceLineNumbers" class="text-diff-line-numbers" aria-hidden="true">
            <span v-for="line in sourceLineList" :key="`source-line-${line}`">{{ line }}</span>
          </div>
          <div class="text-diff-input-shell">
            <div ref="sourceHighlight" class="text-diff-highlight-layer" aria-hidden="true">
              <span
                v-for="segment in sourceHighlights"
                :key="segment.id"
                :class="segment.className"
              >{{ segment.value }}</span>
            </div>
            <textarea
              ref="sourceTextarea"
              class="text-diff-textarea"
              :value="source"
              :placeholder="placeholder"
              wrap="off"
              spellcheck="false"
              aria-label="左侧完整文本编辑框"
              @input="onTextInput('source', $event)"
              @scroll="syncScroll"
            ></textarea>
          </div>
        </div>

        <div class="text-diff-gutter" aria-label="差异操作">
          <div
            ref="gutterCanvas"
            class="text-diff-gutter__canvas"
            :style="{ height: gutterHeight, transform: `translateY(-${gutterOffset}px)` }"
          >
            <button
              v-for="item in gutterItems"
              :key="`gutter-${item.index}`"
              class="diff-row-action"
              :class="{ 'is-active': item.index === activeChangeIndex }"
              type="button"
              :style="gutterButtonStyle(item)"
              :disabled="isComparing"
              :title="`${changeTypeLabel(item.change.type)}：${actionLabel(item.change.type)}`"
              @click="activeChangeIndex = item.index; applyChange(item.change)"
            >
              <span aria-hidden="true">{{ item.change.type === 'ADDED' ? '×' : '›' }}</span>
              <small>{{ actionLabel(item.change.type) }}</small>
            </button>
          </div>
        </div>

        <div class="text-diff-pane">
          <div ref="targetLineNumbers" class="text-diff-line-numbers" aria-hidden="true">
            <span v-for="line in targetLineList" :key="`target-line-${line}`">{{ line }}</span>
          </div>
          <div class="text-diff-input-shell">
            <div ref="targetHighlight" class="text-diff-highlight-layer" aria-hidden="true">
              <span
                v-for="segment in targetHighlights"
                :key="segment.id"
                :class="segment.className"
              >{{ segment.value }}</span>
            </div>
            <textarea
              ref="targetTextarea"
              class="text-diff-textarea"
              :value="target"
              :placeholder="placeholder"
              wrap="off"
              spellcheck="false"
              aria-label="右侧完整文本编辑框"
              @input="onTextInput('target', $event)"
              @scroll="syncScroll"
            ></textarea>
          </div>
        </div>
      </div>

      <div v-if="!isComparing && !changes.length && (source || target)" class="text-diff-editor__same-state">
        两侧内容相同。
      </div>
      <div v-else-if="!isComparing && !source && !target" class="text-diff-editor__empty">
        在左右两个完整编辑框中输入文本开始比较。
      </div>
    </div>
  </section>
</template>

<style scoped>
.text-diff-editor {
  --diff-bg: #1d2025;
  --diff-bg-deep: #17191d;
  --diff-bg-soft: #24282f;
  --diff-border: #363b44;
  --diff-text: #d8dee9;
  --diff-muted: #78818f;
  --diff-green-bg: rgba(56, 142, 91, 0.3);
  --diff-red-bg: rgba(190, 73, 65, 0.3);
  --diff-line-height: 24px;

  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.text-diff-editor__toolbar,
.text-diff-editor__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.text-diff-editor__status,
.text-diff-editor__toolbar-actions,
.text-diff-editor__summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.text-diff-editor__status {
  color: var(--color-text-light, #666);
  font-size: 0.84rem;
}

.text-diff-editor__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7c8794;
}

.text-diff-editor__status-dot.is-busy {
  background: #e5a84b;
  box-shadow: 0 0 0 4px rgba(229, 168, 75, 0.14);
}

.text-diff-editor__position {
  padding-left: 8px;
  border-left: 1px solid #d9dde3;
  color: #4d5968;
  font-variant-numeric: tabular-nums;
}

.diff-toolbar-button,
.diff-apply-all {
  min-height: 30px;
  border: 1px solid #cbd1d9;
  border-radius: 4px;
  background: #fff;
  color: #47515e;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.diff-toolbar-button {
  min-width: 30px;
  padding: 3px 8px;
}

.diff-apply-all {
  padding: 4px 12px;
  border-color: #34784b;
  background: #34784b;
  color: white;
}

.diff-toolbar-button:hover:not(:disabled) {
  border-color: #8e9aaa;
  background: #f3f5f7;
}

.diff-apply-all:hover:not(:disabled) {
  background: #2b633e;
}

.diff-toolbar-button:disabled,
.diff-apply-all:disabled,
.diff-row-action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.text-diff-editor__summary {
  justify-content: flex-start;
  min-height: 24px;
  color: #5d6876;
  font-size: 0.78rem;
}

.summary-count {
  color: #4b5562;
}

.summary-badge {
  padding: 2px 7px;
  border: 1px solid transparent;
  border-radius: 3px;
  font-size: 0.72rem;
}

.summary-badge--deleted {
  border-color: #e1a19d;
  background: #fff0ef;
  color: #a44740;
}

.summary-badge--added {
  border-color: #9ccbad;
  background: #edf8f0;
  color: #327348;
}

.summary-badge--modified {
  border-color: #abc3e4;
  background: #edf4fd;
  color: #3f6592;
}

.text-diff-editor__error {
  margin: 0;
  padding: 9px 12px;
  border: 1px solid #e6aaa5;
  border-radius: 4px;
  background: #fff2f1;
  color: #a33b35;
  font-size: 0.82rem;
}

.text-diff-editor__workbench {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--diff-border);
  border-radius: 6px;
  background: var(--diff-bg);
  box-shadow: 0 8px 22px rgba(24, 29, 36, 0.18);
}

.text-diff-editor__diff-head,
.text-diff-editor__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px minmax(0, 1fr);
}

.text-diff-editor__diff-head {
  align-items: stretch;
  min-height: 48px;
  border-bottom: 1px solid var(--diff-border);
  background: var(--diff-bg-soft);
  color: var(--diff-text);
}

.diff-pane-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 7px 12px;
}

.diff-pane-heading--right {
  justify-content: space-between;
  border-left: 1px solid var(--diff-border);
}

.diff-pane-heading strong,
.diff-pane-heading small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-pane-heading strong {
  font-size: 0.82rem;
  font-weight: 600;
}

.diff-pane-heading small {
  margin-top: 2px;
  color: var(--diff-muted);
  font-size: 0.68rem;
}

.diff-pane-heading__side {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  border: 1px solid #4a5260;
  border-radius: 4px;
  color: #aeb7c4;
  font: 0.72rem/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.diff-gutter-heading {
  display: flex;
  align-items: center;
  justify-content: center;
  border-inline: 1px solid var(--diff-border);
  color: #7f8996;
  font: 0.62rem/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.12em;
}

.text-diff-editor__body {
  min-width: 720px;
  height: min(70vh, 760px);
  overflow: hidden;
}

.text-diff-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  background: var(--diff-bg);
}

.text-diff-line-numbers {
  flex: 0 0 42px;
  min-height: 0;
  overflow: hidden;
  padding-top: 10px;
  border-right: 1px solid rgba(255, 255, 255, 0.055);
  color: #626c79;
  font: 0.68rem/var(--diff-line-height) ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: right;
  user-select: none;
}

.text-diff-line-numbers span {
  display: block;
  height: var(--diff-line-height);
  padding-right: 7px;
}

.text-diff-input-shell {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--diff-bg);
}

.text-diff-highlight-layer,
.text-diff-textarea {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 10px 14px;
  border: 0;
  font: 0.78rem/var(--diff-line-height) ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 400;
  letter-spacing: normal;
  tab-size: 4;
  white-space: pre;
  overflow-wrap: normal;
  word-break: normal;
}

.text-diff-highlight-layer {
  z-index: 0;
  overflow: auto;
  color: transparent;
  pointer-events: none;
  scrollbar-width: thin;
}

.text-diff-highlight-layer span {
  color: transparent;
  border-radius: 2px;
}

.diff-highlight--removed {
  background: var(--diff-red-bg);
  box-shadow: inset 0 -1px 0 rgba(224, 122, 114, 0.45);
}

.diff-highlight--added {
  background: var(--diff-green-bg);
  box-shadow: inset 0 -1px 0 rgba(76, 175, 125, 0.45);
}

.text-diff-textarea {
  z-index: 1;
  resize: none;
  outline: none;
  background: transparent;
  color: var(--diff-text);
  caret-color: #f4f7fb;
  -webkit-text-fill-color: var(--diff-text);
  overflow: auto;
  scrollbar-width: thin;
}

.text-diff-textarea::placeholder {
  color: #4e5763;
  -webkit-text-fill-color: #4e5763;
}

.text-diff-textarea:focus {
  box-shadow: inset 0 0 0 1px rgba(126, 166, 218, 0.45);
}

.text-diff-textarea::selection {
  background: rgba(126, 166, 218, 0.35);
}

.text-diff-gutter {
  position: relative;
  z-index: 2;
  overflow: hidden;
  border-inline: 1px solid var(--diff-border);
  background: var(--diff-bg-deep);
}

.text-diff-gutter__canvas {
  position: relative;
  width: 100%;
  transition: transform 0.08s linear;
}

.diff-row-action {
  position: absolute;
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 88px;
  padding: 4px 5px;
  transform: translateX(-50%);
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #aeb7c4;
  cursor: pointer;
  font: inherit;
}

.diff-row-action span {
  color: #e5edf6;
  font-size: 1.2rem;
  line-height: 0.8;
}

.diff-row-action small {
  font-size: 0.64rem;
  white-space: nowrap;
}

.diff-row-action:hover:not(:disabled),
.diff-row-action.is-active {
  border-color: #586575;
  background: #303742;
  color: #fff;
}

.text-diff-editor__same-state,
.text-diff-editor__empty {
  position: absolute;
  right: 12px;
  bottom: 10px;
  left: 12px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 4px;
  background: rgba(23, 25, 29, 0.86);
  color: #8993a0;
  text-align: center;
  font-size: 0.78rem;
  pointer-events: none;
}

@media (max-width: 768px) {
  .text-diff-editor__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .text-diff-editor__toolbar-actions {
    width: 100%;
  }

  .diff-apply-all {
    margin-left: auto;
  }

  .text-diff-editor__diff-head,
  .text-diff-editor__body {
    grid-template-columns: minmax(0, 1fr) 80px minmax(0, 1fr);
  }

  .text-diff-editor__body {
    min-width: 620px;
    height: 60vh;
  }

  .diff-row-action {
    min-width: 64px;
  }

  .diff-row-action small {
    display: none;
  }
}
</style>
