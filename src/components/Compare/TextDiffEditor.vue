<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getToken } from '../../utils/auth.js'

const { t } = useI18n()

const DIFF_LINE_HEIGHT = 24
const EMPTY_DIFF = { source: '', target: '', changes: [] }

const props = defineProps({
  source: { type: String, default: '' },
  target: { type: String, default: '' },
  sourceLabel: { type: String, default: '' },
  targetLabel: { type: String, default: '' },
  compareUrl: { type: String, default: '/api/tool/string-diff' },
  placeholder: { type: String, default: '' }
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

const diffData = ref({ ...EMPTY_DIFF })
const compareState = ref('idle')
const errorMessage = ref('')
const activeChangeIndex = ref(-1)
const sourceScrollTop = ref(0)
const targetScrollTop = ref(0)
const undoStack = ref([])
const redoStack = ref([])

const sourceTextarea = ref(null)
const targetTextarea = ref(null)
const sourceLineBackgrounds = ref(null)
const targetLineBackgrounds = ref(null)
const sourceHighlight = ref(null)
const targetHighlight = ref(null)
const sourceLineNumbers = ref(null)
const targetLineNumbers = ref(null)
const gutterElement = ref(null)
const gutterWidth = ref(124)
const gutterHeight = ref(700)

let compareTimer = null
let compareSequence = 0
let abortController = null
let gutterResizeObserver = null

const changes = computed(() => Array.isArray(diffData.value?.changes)
  ? diffData.value.changes.map((change, index) => normalizeChange(change, index))
  : [])

const hunks = computed(() => {
  const groups = new Map()
  changes.value.forEach((change, index) => {
    const key = Number.isInteger(change.hunkIndex) ? change.hunkIndex : index
    if (!groups.has(key)) {
      groups.set(key, {
        id: `hunk-${key}`,
        hunkIndex: key,
        type: change.hunkType || change.type,
        sourceStart: change.hunkSourceStart ?? change.sourceStart,
        sourceEnd: change.hunkSourceEnd ?? change.sourceEnd,
        targetStart: change.hunkTargetStart ?? change.targetStart,
        targetEnd: change.hunkTargetEnd ?? change.targetEnd,
        sourceLineStart: change.sourceHunkLineStart,
        sourceLineEnd: change.sourceHunkLineEnd,
        targetLineStart: change.targetHunkLineStart,
        targetLineEnd: change.targetHunkLineEnd,
        changes: []
      })
    }
    groups.get(key).changes.push(change)
  })
  return [...groups.values()].sort((left, right) => left.hunkIndex - right.hunkIndex)
})

const isComparing = computed(() => compareState.value === 'scheduled' || compareState.value === 'comparing')
const hasText = computed(() => Boolean(sourceText.value || targetText.value))

const summary = computed(() => ({
  total: hunks.value.length,
  deleted: hunks.value.filter(item => item.type === 'DELETED').length,
  added: hunks.value.filter(item => item.type === 'ADDED').length,
  modified: hunks.value.filter(item => item.type === 'MODIFIED').length
}))

const currentChangeLabel = computed(() => {
  if (!hunks.value.length || activeChangeIndex.value < 0) return ''
  return `${activeChangeIndex.value + 1}/${hunks.value.length}`
})

const sourceLineCount = computed(() => lineCount(sourceText.value))
const targetLineCount = computed(() => lineCount(targetText.value))
const sourceLineList = computed(() => lineList(sourceLineCount.value))
const targetLineList = computed(() => lineList(targetLineCount.value))

const sourceHighlightLines = computed(() => buildHighlightLines(diffData.value.source, 'source'))
const targetHighlightLines = computed(() => buildHighlightLines(diffData.value.target, 'target'))
const sourceLineStates = computed(() => buildLineStates(diffData.value.source, 'source'))
const targetLineStates = computed(() => buildLineStates(diffData.value.target, 'target'))

const gutterItems = computed(() => hunks.value.map((hunk, index) => ({
  hunk,
  index,
  path: connectorPath(hunk),
  buttonTop: connectorButtonTop(hunk)
})))

const sourceInsertionMarkers = computed(() => insertionMarkers('source'))
const targetInsertionMarkers = computed(() => insertionMarkers('target'))

const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
const displayPlaceholder = computed(() => props.placeholder || t('text_diff.placeholder'))

function charsOf(value) {
  return Array.from(value || '')
}

function lineCount(value) {
  return Math.max(1, String(value || '').split('\n').length)
}

function lineList(count) {
  return Array.from({ length: count }, (_, index) => index + 1)
}

function clampRange(value, max) {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0
  return Math.max(0, Math.min(max, number))
}

function lineNumber(chars, index) {
  let line = 1
  const end = clampRange(index, chars.length)
  for (let i = 0; i < end; i++) {
    if (chars[i] === '\n') line++
  }
  return line
}

function codePointOffsetAtLine(text, zeroBasedLine) {
  const chars = charsOf(text)
  if (zeroBasedLine <= 0) return 0
  let line = 0
  for (let index = 0; index < chars.length; index++) {
    if (chars[index] === '\n' && ++line === zeroBasedLine) return index + 1
  }
  return chars.length
}

function normalizeChange(change, index) {
  const sourceChars = charsOf(diffData.value.source)
  const targetChars = charsOf(diffData.value.target)
  const sourceStart = clampRange(change?.sourceStart, sourceChars.length)
  const sourceEnd = Math.max(sourceStart, clampRange(change?.sourceEnd, sourceChars.length))
  const targetStart = clampRange(change?.targetStart, targetChars.length)
  const targetEnd = Math.max(targetStart, clampRange(change?.targetEnd, targetChars.length))
  const type = ['ADDED', 'DELETED', 'MODIFIED'].includes(change?.type) ? change.type : 'MODIFIED'
  const sourceHunkLineStart = Number.isInteger(change?.sourceLineStart)
    ? change.sourceLineStart
    : lineNumber(sourceChars, sourceStart) - 1
  const sourceHunkLineEnd = Number.isInteger(change?.sourceLineEnd)
    ? change.sourceLineEnd
    : lineNumber(sourceChars, Math.max(sourceStart, sourceEnd - 1))
  const targetHunkLineStart = Number.isInteger(change?.targetLineStart)
    ? change.targetLineStart
    : lineNumber(targetChars, targetStart) - 1
  const targetHunkLineEnd = Number.isInteger(change?.targetLineEnd)
    ? change.targetLineEnd
    : lineNumber(targetChars, Math.max(targetStart, targetEnd - 1))

  return {
    ...change,
    id: change?.id || `${type}-${index}-${sourceStart}-${targetStart}`,
    type,
    sourceStart,
    sourceEnd,
    targetStart,
    targetEnd,
    sourceText: typeof change?.sourceText === 'string'
      ? change.sourceText
      : sourceChars.slice(sourceStart, sourceEnd).join(''),
    targetText: typeof change?.targetText === 'string'
      ? change.targetText
      : targetChars.slice(targetStart, targetEnd).join(''),
    sourceLineStart: lineNumber(sourceChars, sourceStart),
    targetLineStart: lineNumber(targetChars, targetStart),
    hunkIndex: Number.isInteger(change?.hunkIndex) ? change.hunkIndex : index,
    hunkType: ['ADDED', 'DELETED', 'MODIFIED'].includes(change?.hunkType) ? change.hunkType : type,
    sourceHunkLineStart,
    sourceHunkLineEnd,
    targetHunkLineStart,
    targetHunkLineEnd,
    hunkSourceStart: codePointOffsetAtLine(diffData.value.source, sourceHunkLineStart),
    hunkSourceEnd: codePointOffsetAtLine(diffData.value.source, sourceHunkLineEnd),
    hunkTargetStart: codePointOffsetAtLine(diffData.value.target, targetHunkLineStart),
    hunkTargetEnd: codePointOffsetAtLine(diffData.value.target, targetHunkLineEnd)
  }
}

function sliceChars(chars, start, end) {
  return chars.slice(start, end).join('')
}

function buildHighlightLines(text, side) {
  const chars = charsOf(text)
  const ranges = changes.value
    .map(change => ({
      start: side === 'source' ? change.sourceStart : change.targetStart,
      end: side === 'source' ? change.sourceEnd : change.targetEnd,
      type: change.type,
      id: change.id
    }))
    .filter(range => range.end > range.start)
    .sort((left, right) => left.start - right.start)

  const lineRanges = []
  let lineStart = 0
  for (let index = 0; index <= chars.length; index++) {
    if (index === chars.length || chars[index] === '\n') {
      lineRanges.push({ start: lineStart, end: index })
      lineStart = index + 1
    }
  }

  return lineRanges.map((line, lineIndex) => {
    const segments = []
    let cursor = line.start

    ranges.forEach(range => {
      if (range.end <= line.start || range.start >= line.end) return

      const start = Math.max(line.start, range.start)
      const end = Math.min(line.end, range.end)
      if (start > cursor) {
        segments.push({
          id: `context-${side}-${lineIndex}-${cursor}`,
          value: sliceChars(chars, cursor, start),
          className: ''
        })
      }

      if (end > start) {
        const isRemoved = side === 'source' && ['DELETED', 'MODIFIED'].includes(range.type)
        const isAdded = side === 'target' && ['ADDED', 'MODIFIED'].includes(range.type)
        segments.push({
          id: `change-${side}-${range.id}-${lineIndex}`,
          value: sliceChars(chars, start, end),
          className: isRemoved ? 'diff-highlight--removed' : isAdded ? 'diff-highlight--added' : ''
        })
        cursor = end
      }
    })

    if (cursor < line.end || !segments.length) {
      segments.push({
        id: `tail-${side}-${lineIndex}`,
        value: sliceChars(chars, cursor, line.end),
        className: ''
      })
    }

    return { id: `line-${side}-${lineIndex}`, segments }
  })
}

function buildLineStates(text, side) {
  const states = Array.from({ length: lineCount(text) }, () => '')

  hunks.value.forEach(hunk => {
    const start = side === 'source' ? hunk.sourceLineStart : hunk.targetLineStart
    const end = side === 'source' ? hunk.sourceLineEnd : hunk.targetLineEnd
    if (end <= start) return
    for (let line = start; line < end; line++) {
      states[line] = hunk.type === 'MODIFIED'
        ? 'modified'
        : hunk.type === 'ADDED'
          ? 'added'
          : 'removed'
    }
  })

  return states
}

function lineStateClass(state) {
  return state ? `diff-line-background--${state}` : ''
}

function changeTypeLabel(type) {
  if (type === 'DELETED') return t('text_diff.left_deleted')
  if (type === 'ADDED') return t('text_diff.right_added')
  return t('text_diff.content_modified')
}

function directionLabel(direction) {
  return direction === 'left' ? t('text_diff.apply_right_to_left') : t('text_diff.apply_left_to_right')
}

function connectorRange(lineStart, lineEnd, scrollTop) {
  const start = 10 + lineStart * DIFF_LINE_HEIGHT - scrollTop
  const end = 10 + lineEnd * DIFF_LINE_HEIGHT - scrollTop
  return end > start ? [start, end] : [start - 1, start + 1]
}

function connectorPath(hunk) {
  const [sourceStart, sourceEnd] = connectorRange(hunk.sourceLineStart, hunk.sourceLineEnd, sourceScrollTop.value)
  const [targetStart, targetEnd] = connectorRange(hunk.targetLineStart, hunk.targetLineEnd, targetScrollTop.value)
  const width = gutterWidth.value
  const bend = width * 0.34
  return [
    `M 0 ${sourceStart}`,
    `C ${bend} ${sourceStart}, ${width - bend} ${targetStart}, ${width} ${targetStart}`,
    `L ${width} ${targetEnd}`,
    `C ${width - bend} ${targetEnd}, ${bend} ${sourceEnd}, 0 ${sourceEnd}`,
    'Z'
  ].join(' ')
}

function connectorButtonTop(hunk) {
  const [sourceStart, sourceEnd] = connectorRange(hunk.sourceLineStart, hunk.sourceLineEnd, sourceScrollTop.value)
  const [targetStart, targetEnd] = connectorRange(hunk.targetLineStart, hunk.targetLineEnd, targetScrollTop.value)
  return (sourceStart + sourceEnd + targetStart + targetEnd) / 4
}

function insertionMarkers(side) {
  const scrollTop = side === 'source' ? sourceScrollTop.value : targetScrollTop.value
  return hunks.value
    .filter(hunk => side === 'source'
      ? hunk.sourceLineEnd <= hunk.sourceLineStart
      : hunk.targetLineEnd <= hunk.targetLineStart)
    .map(hunk => {
      const line = side === 'source' ? hunk.sourceLineStart : hunk.targetLineStart
      return {
        id: `${side}-${hunk.id}`,
        type: hunk.type.toLowerCase(),
        top: 10 + line * DIFF_LINE_HEIGHT - scrollTop
      }
    })
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
  undoStack.value = []
  redoStack.value = []
  const value = event.target.value
  if (side === 'source') {
    sourceText.value = value
    invalidateDiff(value, targetText.value)
  } else {
    targetText.value = value
    invalidateDiff(sourceText.value, value)
  }
}

function setText(side, value) {
  if (side === 'source') {
    sourceText.value = value
    invalidateDiff(value, targetText.value)
  } else {
    targetText.value = value
    invalidateDiff(sourceText.value, value)
  }
}

function handleKeydown(side, event) {
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && canUndo.value) {
    event.preventDefault()
    undoLastApply()
    return
  }
  if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z')) && canRedo.value) {
    event.preventDefault()
    redoLastApply()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    compareNow()
    return
  }

  if (event.key !== 'Tab') return
  event.preventDefault()

  const textarea = event.target
  const insertion = '  '
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value.slice(0, start) + insertion + textarea.value.slice(end)
  undoStack.value = []
  redoStack.value = []
  setText(side, value)

  nextTick(() => {
    const current = side === 'source' ? sourceTextarea.value : targetTextarea.value
    current?.focus()
    current?.setSelectionRange(start + insertion.length, start + insertion.length)
  })
}

function snapshot() {
  return { source: sourceText.value, target: targetText.value }
}

function restoreSnapshot(value) {
  sourceText.value = value.source
  targetText.value = value.target
  invalidateDiff(value.source, value.target)
}

function recordApply() {
  undoStack.value = [...undoStack.value, snapshot()].slice(-50)
  redoStack.value = []
}

function undoLastApply() {
  if (!canUndo.value) return
  const previous = undoStack.value[undoStack.value.length - 1]
  redoStack.value = [...redoStack.value, snapshot()].slice(-50)
  undoStack.value = undoStack.value.slice(0, -1)
  restoreSnapshot(previous)
}

function redoLastApply() {
  if (!canRedo.value) return
  const next = redoStack.value[redoStack.value.length - 1]
  undoStack.value = [...undoStack.value, snapshot()].slice(-50)
  redoStack.value = redoStack.value.slice(0, -1)
  restoreSnapshot(next)
}

function applyChange(hunk, direction = 'right') {
  if (!hunk || isComparing.value) return

  const isRightDirection = direction === 'right'
  const side = isRightDirection ? 'target' : 'source'
  const currentText = isRightDirection ? targetText.value : sourceText.value
  const start = isRightDirection ? hunk.targetStart : hunk.sourceStart
  const end = isRightDirection ? hunk.targetEnd : hunk.sourceEnd
  const replacement = isRightDirection
    ? sliceChars(charsOf(diffData.value.source), hunk.sourceStart, hunk.sourceEnd)
    : sliceChars(charsOf(diffData.value.target), hunk.targetStart, hunk.targetEnd)
  const nextText = replaceByCodePoints(currentText, start, end, replacement)
  const nextCaret = codePointIndexToStringIndex(
    nextText,
    start + charsOf(replacement).length
  )

  recordApply()
  setText(side, nextText)
  nextTick(() => {
    const textarea = side === 'source' ? sourceTextarea.value : targetTextarea.value
    textarea?.focus()
    textarea?.setSelectionRange(nextCaret, nextCaret)
  })
}

function applyAll(direction = 'right') {
  if (isComparing.value || !hunks.value.length) return

  const isRightDirection = direction === 'right'
  const side = isRightDirection ? 'target' : 'source'
  let nextText = isRightDirection ? targetText.value : sourceText.value
  const ordered = [...hunks.value].sort((left, right) => {
    const leftStart = isRightDirection ? left.targetStart : left.sourceStart
    const rightStart = isRightDirection ? right.targetStart : right.sourceStart
    if (leftStart !== rightStart) return rightStart - leftStart
    const leftEnd = isRightDirection ? left.targetEnd : left.sourceEnd
    const rightEnd = isRightDirection ? right.targetEnd : right.sourceEnd
    return rightEnd - leftEnd
  })

  ordered.forEach(hunk => {
    const start = isRightDirection ? hunk.targetStart : hunk.sourceStart
    const end = isRightDirection ? hunk.targetEnd : hunk.sourceEnd
    const replacement = isRightDirection
      ? sliceChars(charsOf(diffData.value.source), hunk.sourceStart, hunk.sourceEnd)
      : sliceChars(charsOf(diffData.value.target), hunk.targetStart, hunk.targetEnd)
    nextText = replaceByCodePoints(nextText, start, end, replacement)
  })

  recordApply()
  setText(side, nextText)
  nextTick(() => {
    const textarea = side === 'source' ? sourceTextarea.value : targetTextarea.value
    textarea?.focus()
  })
}

function goToChange(index) {
  if (!hunks.value.length) return
  const normalizedIndex = (index + hunks.value.length) % hunks.value.length
  const hunk = hunks.value[normalizedIndex]

  activeChangeIndex.value = normalizedIndex
  setScrollTop('source', Math.max(0, (hunk.sourceLineStart - 3) * DIFF_LINE_HEIGHT))
  setScrollTop('target', Math.max(0, (hunk.targetLineStart - 3) * DIFF_LINE_HEIGHT))
}

function previousChange() {
  goToChange(activeChangeIndex.value <= 0 ? hunks.value.length - 1 : activeChangeIndex.value - 1)
}

function nextChange() {
  goToChange(activeChangeIndex.value < 0 ? 0 : activeChangeIndex.value + 1)
}

function setScrollTop(side, value) {
  const textarea = side === 'source' ? sourceTextarea.value : targetTextarea.value
  if (!textarea) return
  textarea.scrollTop = value
  syncScroll(side, textarea)
}

function syncScroll(side, element) {
  const highlight = side === 'source' ? sourceHighlight.value : targetHighlight.value
  const backgrounds = side === 'source' ? sourceLineBackgrounds.value : targetLineBackgrounds.value
  const numbers = side === 'source' ? sourceLineNumbers.value : targetLineNumbers.value
  translateLayer(highlight, element.scrollLeft, element.scrollTop)
  translateLayer(backgrounds, 0, element.scrollTop)
  translateLayer(numbers, 0, element.scrollTop)
  if (side === 'source') sourceScrollTop.value = element.scrollTop
  else targetScrollTop.value = element.scrollTop
}

function translateLayer(layer, scrollLeft, scrollTop) {
  if (!layer) return
  layer.style.transform = `translate3d(${-scrollLeft}px, ${-scrollTop}px, 0)`
}

// 后续：可选的 IDEA 式智能同步滚动，按差异块映射位置，而不是直接绑定 scrollTop。

function normalizeResponse(data, source, target) {
  return {
    source: typeof data?.source === 'string' ? data.source : source,
    target: typeof data?.target === 'string' ? data.target : target,
    changes: Array.isArray(data?.changes) ? data.changes : []
  }
}

async function compare() {
  const sequence = compareSequence
  const sourceSnapshot = sourceText.value
  const targetSnapshot = targetText.value
  errorMessage.value = ''

  if (!sourceSnapshot && !targetSnapshot) {
    diffData.value = { ...EMPTY_DIFF }
    activeChangeIndex.value = -1
    compareState.value = 'idle'
    emit('compared', diffData.value)
    return
  }

  abortController?.abort()
  abortController = new AbortController()
  compareState.value = 'comparing'

  try {
    const headers = { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) headers['X-Auth-Token'] = token

    const response = await fetch(props.compareUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: sourceSnapshot, target: targetSnapshot }),
      signal: abortController.signal
    })
    const json = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(json?.message || t('text_diff.compare_http_failed', { status: response.status }))
    }
    if (!json?.success) {
      throw new Error(json?.message || t('text_diff.compare_failed'))
    }
    if (sequence !== compareSequence) return

    diffData.value = normalizeResponse(json.data, sourceSnapshot, targetSnapshot)
    activeChangeIndex.value = diffData.value.changes.length ? 0 : -1
    compareState.value = 'idle'
    emit('compared', diffData.value)
    await nextTick()
    if (sourceTextarea.value) syncScroll('source', sourceTextarea.value)
    if (targetTextarea.value) syncScroll('target', targetTextarea.value)
  } catch (error) {
    if (error?.name === 'AbortError' || sequence !== compareSequence) return
    errorMessage.value = error?.message || t('text_diff.compare_retry_later')
    compareState.value = 'error'
    emit('error', error)
  } finally {
    if (sequence === compareSequence && compareState.value === 'comparing') {
      compareState.value = 'idle'
    }
  }
}

function scheduleCompare() {
  compareSequence++
  clearTimeout(compareTimer)
  invalidateDiff(props.source, props.target)
  errorMessage.value = ''
  compareState.value = 'scheduled'
  compareTimer = setTimeout(compare, 320)
}

function compareNow() {
  clearTimeout(compareTimer)
  compareSequence++
  compare()
}

watch(
  [() => props.source, () => props.target, () => props.compareUrl],
  scheduleCompare,
  { immediate: true }
)

onMounted(() => {
  if (!gutterElement.value || typeof ResizeObserver === 'undefined') return
  gutterResizeObserver = new ResizeObserver(([entry]) => {
    gutterWidth.value = entry.contentRect.width || 124
    gutterHeight.value = entry.contentRect.height || 700
  })
  gutterResizeObserver.observe(gutterElement.value)
})

onBeforeUnmount(() => {
  clearTimeout(compareTimer)
  compareSequence++
  abortController?.abort()
  gutterResizeObserver?.disconnect()
})
</script>

<template>
  <section class="text-diff-editor">
    <div class="text-diff-editor__toolbar">
      <div class="text-diff-editor__status" aria-live="polite">
        <span class="text-diff-editor__status-dot" :class="[`is-${compareState}`]"></span>
        <span class="text-diff-editor__status-label">
          {{ compareState === 'scheduled' ? $t('text_diff.waiting') : compareState === 'comparing' ? $t('text_diff.comparing') : compareState === 'error' ? $t('text_diff.compare_failed') : changes.length ? $t('text_diff.completed') : $t('text_diff.ready') }}
        </span>
        <span v-if="currentChangeLabel" class="text-diff-editor__position">{{ $t('text_diff.difference') }} {{ currentChangeLabel }}</span>
        <span v-if="summary.deleted" class="summary-badge summary-badge--deleted">{{ $t('text_diff.deleted') }} {{ summary.deleted }}</span>
        <span v-if="summary.added" class="summary-badge summary-badge--added">{{ $t('text_diff.added') }} {{ summary.added }}</span>
        <span v-if="summary.modified" class="summary-badge summary-badge--modified">{{ $t('text_diff.modified') }} {{ summary.modified }}</span>
      </div>

      <div class="text-diff-editor__toolbar-actions">
        <button
          class="diff-toolbar-button diff-toolbar-button--icon"
          type="button"
          :disabled="isComparing || !hunks.length"
          :aria-label="$t('text_diff.previous')"
          :title="$t('text_diff.previous')"
          @click="previousChange"
        >↑</button>
        <button
          class="diff-toolbar-button diff-toolbar-button--icon"
          type="button"
          :disabled="isComparing || !hunks.length"
          :aria-label="$t('text_diff.next')"
          :title="$t('text_diff.next')"
          @click="nextChange"
        >↓</button>
        <button
          class="diff-toolbar-button"
          type="button"
          :disabled="!canUndo"
          :title="$t('text_diff.undo_title')"
          @click="undoLastApply"
        >{{ $t('text_diff.undo') }}</button>
        <button
          class="diff-toolbar-button"
          type="button"
          :disabled="!canRedo"
          :title="$t('text_diff.redo_title')"
          @click="redoLastApply"
        >{{ $t('text_diff.redo') }}</button>
        <button
          class="diff-toolbar-button"
          type="button"
          :disabled="isComparing || !hasText"
          @click="compareNow"
        >{{ $t('text_diff.compare_again') }}</button>
        <button
          class="diff-apply-all diff-apply-all--left"
          type="button"
          :disabled="isComparing || !hunks.length"
          @click="applyAll('left')"
        >
          ← {{ $t('text_diff.apply_all') }}
        </button>
        <button
          class="diff-apply-all"
          type="button"
          :disabled="isComparing || !hunks.length"
          @click="applyAll('right')"
        >
          {{ $t('text_diff.apply_all') }} →
        </button>
      </div>
    </div>

    <p v-if="errorMessage" class="text-diff-editor__error" role="alert">
      {{ errorMessage }}
      <button type="button" @click="compareNow">{{ $t('common.retry') }}</button>
    </p>

    <div class="text-diff-editor__workbench">
<!--      <div class="text-diff-editor__diff-head">-->
<!--        <div class="diff-pane-heading">-->
<!--          <span class="diff-pane-heading__side">左</span>-->
<!--          <span class="diff-pane-heading__copy">-->
<!--            <strong>{{ sourceLabel }}</strong>-->
<!--            <small>修改来源 · 可直接编辑</small>-->
<!--          </span>-->
<!--          <span class="diff-pane-heading__meta">{{ sourceLineCount }} 行</span>-->
<!--        </div>-->
<!--        <div class="diff-gutter-heading" aria-hidden="true"><span>DIFF</span></div>-->
<!--        <div class="diff-pane-heading diff-pane-heading&#45;&#45;right">-->
<!--          <span class="diff-pane-heading__copy">-->
<!--            <strong>{{ targetLabel }}</strong>-->
<!--            <small>应用目标 · 可直接编辑</small>-->
<!--          </span>-->
<!--          <span class="diff-pane-heading__meta">{{ targetLineCount }} 行</span>-->
<!--          <span class="diff-pane-heading__side">右</span>-->
<!--        </div>-->
<!--      </div>-->

      <div class="text-diff-editor__body">
        <div class="text-diff-pane">
          <span
            v-for="marker in sourceInsertionMarkers"
            :key="marker.id"
            class="diff-insertion-marker"
            :class="`is-${marker.type}`"
            :style="{ top: `${marker.top}px` }"
            aria-hidden="true"
          ></span>
          <div class="text-diff-line-numbers" aria-hidden="true">
            <div ref="sourceLineNumbers" class="text-diff-line-number-track">
              <span v-for="line in sourceLineList" :key="`source-line-${line}`" :class="lineStateClass(sourceLineStates[line - 1])">{{ line }}</span>
            </div>
          </div>
          <div class="text-diff-input-shell">
            <div class="text-diff-line-backgrounds" aria-hidden="true">
              <div ref="sourceLineBackgrounds" class="text-diff-line-background-track">
                <span v-for="(state, index) in sourceLineStates" :key="`source-bg-${index}`" :class="lineStateClass(state)"></span>
              </div>
            </div>
            <div class="text-diff-highlight-layer" aria-hidden="true">
              <div ref="sourceHighlight" class="text-diff-highlight-track">
                <div v-for="line in sourceHighlightLines" :key="line.id" class="text-diff-highlight-line">
                  <span v-for="segment in line.segments" :key="segment.id" :class="segment.className">{{ segment.value }}</span>
                </div>
              </div>
            </div>
            <textarea
              ref="sourceTextarea"
              class="text-diff-textarea"
              :value="source"
              :placeholder="displayPlaceholder"
              wrap="off"
              spellcheck="false"
              :aria-label="$t('text_diff.source_aria')"
              @input="onTextInput('source', $event)"
              @keydown="handleKeydown('source', $event)"
              @scroll="syncScroll('source', $event.target)"
            ></textarea>
          </div>
        </div>

        <div ref="gutterElement" class="text-diff-gutter" :aria-label="$t('text_diff.actions_aria')">
          <svg class="text-diff-gutter__connectors" :viewBox="`0 0 ${gutterWidth} ${gutterHeight}`" preserveAspectRatio="none" aria-hidden="true">
            <path
              v-for="item in gutterItems"
              :key="`connector-${item.hunk.id}`"
              :d="item.path"
              :class="[`is-${item.hunk.type.toLowerCase()}`, { 'is-active': item.index === activeChangeIndex }]"
            />
          </svg>
          <div class="text-diff-gutter__track">
            <div
              v-for="item in gutterItems"
              :key="`gutter-${item.hunk.id}`"
              class="diff-row-action-group"
              :class="{ 'is-active': item.index === activeChangeIndex }"
              :style="{ top: `${item.buttonTop}px` }"
            >
              <button
                class="diff-row-action diff-row-action--left"
                type="button"
                :disabled="isComparing"
                :title="`${changeTypeLabel(item.hunk.type)}：${directionLabel('left')}`"
                :aria-label="`${changeTypeLabel(item.hunk.type)}，${directionLabel('left')}`"
                @click="activeChangeIndex = item.index; applyChange(item.hunk, 'left')"
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                class="diff-row-action diff-row-action--right"
                type="button"
                :disabled="isComparing"
                :title="`${changeTypeLabel(item.hunk.type)}：${directionLabel('right')}`"
                :aria-label="`${changeTypeLabel(item.hunk.type)}，${directionLabel('right')}`"
                @click="activeChangeIndex = item.index; applyChange(item.hunk, 'right')"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>

        <div class="text-diff-pane">
          <span
            v-for="marker in targetInsertionMarkers"
            :key="marker.id"
            class="diff-insertion-marker"
            :class="`is-${marker.type}`"
            :style="{ top: `${marker.top}px` }"
            aria-hidden="true"
          ></span>
          <div class="text-diff-line-numbers" aria-hidden="true">
            <div ref="targetLineNumbers" class="text-diff-line-number-track">
              <span v-for="line in targetLineList" :key="`target-line-${line}`" :class="lineStateClass(targetLineStates[line - 1])">{{ line }}</span>
            </div>
          </div>
          <div class="text-diff-input-shell">
            <div class="text-diff-line-backgrounds" aria-hidden="true">
              <div ref="targetLineBackgrounds" class="text-diff-line-background-track">
                <span v-for="(state, index) in targetLineStates" :key="`target-bg-${index}`" :class="lineStateClass(state)"></span>
              </div>
            </div>
            <div class="text-diff-highlight-layer" aria-hidden="true">
              <div ref="targetHighlight" class="text-diff-highlight-track">
                <div v-for="line in targetHighlightLines" :key="line.id" class="text-diff-highlight-line">
                  <span v-for="segment in line.segments" :key="segment.id" :class="segment.className">{{ segment.value }}</span>
                </div>
              </div>
            </div>
            <textarea
              ref="targetTextarea"
              class="text-diff-textarea"
              :value="target"
              :placeholder="displayPlaceholder"
              wrap="off"
              spellcheck="false"
              :aria-label="$t('text_diff.target_aria')"
              @input="onTextInput('target', $event)"
              @keydown="handleKeydown('target', $event)"
              @scroll="syncScroll('target', $event.target)"
            ></textarea>
          </div>
        </div>
      </div>

<!--      <div v-if="!isComparing && !changes.length && hasText" class="text-diff-editor__same-state">-->
<!--        两侧内容相同。-->
<!--      </div>-->
<!--      <div v-else-if="!isComparing && !hasText" class="text-diff-editor__empty">-->
<!--        <span class="text-diff-editor__empty-icon">⇄</span>-->
<!--        <strong>开始比较两段文本</strong>-->
<!--        <span>在左右编辑框中输入或粘贴内容，差异会自动显示在中间。</span>-->
<!--      </div>-->
    </div>
  </section>
</template>

<style scoped>
.text-diff-editor {
  --diff-bg: #1d2025;
  --diff-bg-deep: #17191d;
  --diff-bg-soft: #272c34;
  --diff-border: #3a414c;
  --diff-text: #d8dee9;
  --diff-muted: #818b99;
  --diff-green-bg: rgba(49, 130, 86, 0.27);
  --diff-green-line: rgba(46, 125, 82, 0.25);
  --diff-red-bg: rgba(190, 73, 65, 0.27);
  --diff-red-line: rgba(173, 61, 54, 0.23);
  --diff-blue-bg: rgba(69, 112, 167, 0.26);
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
  min-width: 0;
  color: #556170;
  font-size: 0.8rem;
}

.text-diff-editor__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7c8794;
  box-shadow: 0 0 0 3px rgba(124, 135, 148, 0.12);
}

.text-diff-editor__status-dot.is-scheduled,
.text-diff-editor__status-dot.is-comparing {
  background: #e5a84b;
  box-shadow: 0 0 0 3px rgba(229, 168, 75, 0.16);
}

.text-diff-editor__status-dot.is-error {
  background: #bd4b45;
  box-shadow: 0 0 0 3px rgba(189, 75, 69, 0.14);
}

.text-diff-editor__status-dot.is-idle {
  background: #4e9a67;
  box-shadow: 0 0 0 3px rgba(78, 154, 103, 0.13);
}

.text-diff-editor__position {
  padding-left: 9px;
  border-left: 1px solid #d6dce3;
  color: #4d5968;
  font-variant-numeric: tabular-nums;
}

.diff-toolbar-button,
.diff-apply-all,
.text-diff-editor__error button {
  min-height: 32px;
  border: 1px solid #cbd1d9;
  border-radius: 5px;
  background: #fff;
  color: #47515e;
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.diff-toolbar-button {
  min-width: 30px;
  padding: 3px 10px;
}

.diff-toolbar-button--icon {
  padding: 1px 9px;
  color: #596574;
  font-size: 1rem;
  line-height: 1;
}

.diff-apply-all {
  padding: 4px 13px;
  border-color: #34784b;
  background: #34784b;
  color: white;
}

.diff-toolbar-button:hover:not(:disabled),
.text-diff-editor__error button:hover:not(:disabled) {
  border-color: #8e9aaa;
  background: #f3f5f7;
  transform: translateY(-1px);
}

.diff-apply-all:hover:not(:disabled) {
  border-color: #2b633e;
  background: #2b633e;
  transform: translateY(-1px);
}

.diff-apply-all--left {
  border-color: #aeb8c4;
  background: #f8fafc;
  color: #536071;
}

.diff-apply-all--left:hover:not(:disabled) {
  border-color: #7f8c9c;
  background: #eef2f6;
  color: #344152;
}

.diff-toolbar-button:disabled,
.diff-apply-all:disabled,
.diff-row-action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.text-diff-editor__summary {
  justify-content: flex-start;
  min-height: 25px;
  color: #5d6876;
  font-size: 0.75rem;
}

.summary-count {
  color: #4b5562;
}

.summary-badge {
  padding: 2px 7px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.7rem;
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

.summary-hint {
  margin-left: auto;
  color: #929ba7;
  font-size: 0.69rem;
}

.text-diff-editor__error {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 8px 11px;
  border: 1px solid #e6aaa5;
  border-radius: 5px;
  background: #fff2f1;
  color: #a33b35;
  font-size: 0.8rem;
}

.text-diff-editor__error button {
  min-height: 26px;
  margin-left: auto;
  padding: 2px 9px;
  border-color: #dfa19c;
  color: #983c36;
}

.text-diff-editor__workbench {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--diff-border);
  border-radius: 7px;
  background: var(--diff-bg);
  box-shadow: 0 10px 28px rgba(24, 29, 36, 0.18);
}

.text-diff-editor__diff-head,
.text-diff-editor__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 124px minmax(0, 1fr);
}

.text-diff-editor__diff-head {
  align-items: stretch;
  min-height: 54px;
  border-bottom: 1px solid var(--diff-border);
  background: var(--diff-bg-soft);
  color: var(--diff-text);
}

.diff-pane-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 8px 12px;
}

.diff-pane-heading--right {
  justify-content: space-between;
  border-left: 1px solid var(--diff-border);
}

.diff-pane-heading__copy {
  min-width: 0;
}

.diff-pane-heading strong,
.diff-pane-heading small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-pane-heading strong {
  color: #e5eaf1;
  font-size: 0.82rem;
  font-weight: 600;
}

.diff-pane-heading small {
  margin-top: 2px;
  color: var(--diff-muted);
  font-size: 0.67rem;
}

.text-diff-editor__body {
  min-width: 760px;
  height: clamp(520px, calc(100vh - 130px), 700px);
  overflow: hidden;
}

.text-diff-pane {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  background: var(--diff-bg);
}

.text-diff-line-numbers {
  box-sizing: border-box;
  flex: 0 0 47px;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.055);
  color: #626c79;
  font: 0.67rem/var(--diff-line-height) ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: right;
  user-select: none;
}

.text-diff-line-number-track,
.text-diff-line-background-track,
.text-diff-highlight-track {
  box-sizing: border-box;
  will-change: transform;
}

.text-diff-line-number-track {
  min-height: 100%;
  padding: 10px 0;
}

.diff-insertion-marker {
  position: absolute;
  right: 0;
  left: 0;
  z-index: 4;
  height: 2px;
  transform: translateY(-1px);
  background: #687381;
  box-shadow: 0 0 0 1px rgba(104, 115, 129, 0.12);
  pointer-events: none;
}

.diff-insertion-marker.is-added {
  background: #34845a;
  box-shadow: 0 0 0 1px rgba(76, 175, 125, 0.13);
}

.diff-insertion-marker.is-deleted {
  background: #b95c55;
  box-shadow: 0 0 0 1px rgba(224, 122, 114, 0.13);
}

.diff-insertion-marker.is-modified {
  background: #527fab;
  box-shadow: 0 0 0 1px rgba(105, 157, 216, 0.14);
}

.text-diff-line-numbers span {
  display: block;
  height: var(--diff-line-height);
  padding-right: 8px;
}

.text-diff-line-numbers span.diff-line-background--removed {
  color: #d57d76;
}

.text-diff-line-numbers span.diff-line-background--added {
  color: #7ac095;
}

.text-diff-line-numbers span.diff-line-background--modified {
  color: #83a8d5;
}

.text-diff-input-shell {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--diff-bg);
}

.text-diff-line-backgrounds,
.text-diff-highlight-layer,
.text-diff-textarea {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border: 0;
  font: 0.78rem/var(--diff-line-height) ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 400;
  letter-spacing: normal;
  tab-size: 4;
  white-space: pre;
  overflow-wrap: normal;
  word-break: normal;
}

.text-diff-line-backgrounds {
  z-index: 0;
  overflow: hidden;
}

.text-diff-line-background-track {
  min-height: 100%;
  padding: 10px 0;
}

.text-diff-line-backgrounds span {
  display: block;
  height: var(--diff-line-height);
  width: 100%;
}

.diff-line-background--removed {
  background: var(--diff-red-line);
}

.diff-line-background--added {
  background: var(--diff-green-line);
}

.diff-line-background--modified {
  background: var(--diff-blue-bg);
}

.text-diff-highlight-layer {
  z-index: 1;
  overflow: hidden;
  color: transparent;
  pointer-events: none;
}

.text-diff-highlight-track {
  width: max-content;
  min-width: 100%;
  min-height: 100%;
  padding: 10px 14px;
}

.text-diff-highlight-line {
  display: block;
  width: max-content;
  min-width: 100%;
  height: var(--diff-line-height);
  line-height: var(--diff-line-height);
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
  z-index: 2;
  padding: 10px 14px;
  resize: none;
  outline: none;
  background: transparent;
  color: var(--diff-text);
  caret-color: #f4f7fb;
  -webkit-text-fill-color: var(--diff-text);
  overflow: auto;
  scroll-behavior: auto;
  scrollbar-width: thin;
  scrollbar-color: #4d5662 transparent;
}

.text-diff-textarea::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.text-diff-textarea::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 8px;
  background: #4d5662;
  background-clip: padding-box;
}

.text-diff-textarea::placeholder {
  color: #59636f;
  -webkit-text-fill-color: #59636f;
}

.text-diff-textarea:focus {
  box-shadow: inset 0 0 0 1px rgba(126, 166, 218, 0.48);
}

.text-diff-textarea::selection {
  background: rgba(126, 166, 218, 0.36);
}

.text-diff-gutter {
  position: relative;
  z-index: 3;
  overflow: hidden;
  border-inline: 1px solid var(--diff-border);
  background: var(--diff-bg-deep);
}

.text-diff-gutter__connectors {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.text-diff-gutter__connectors path {
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.text-diff-gutter__connectors path.is-added {
  fill: rgba(49, 130, 86, 0.22);
  stroke: rgba(76, 175, 125, 0.52);
}

.text-diff-gutter__connectors path.is-deleted {
  fill: rgba(190, 73, 65, 0.22);
  stroke: rgba(224, 122, 114, 0.52);
}

.text-diff-gutter__connectors path.is-modified {
  fill: rgba(69, 112, 167, 0.24);
  stroke: rgba(105, 157, 216, 0.58);
}

.text-diff-gutter__connectors path.is-active {
  filter: brightness(1.35);
  stroke-width: 1.5;
}

.text-diff-gutter__track {
  position: relative;
  width: 100%;
  height: 100%;
}

.diff-row-action-group {
  position: absolute;
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transform: translate(-50%, -50%);
  min-height: 28px;
  padding: 2px;
  border: 1px solid transparent;
  border-radius: 5px;
}

.diff-row-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 31px;
  height: 25px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: #aeb7c4;
  cursor: pointer;
  font: inherit;
}

.diff-row-action--left {
  color: #e19991;
}

.diff-row-action--right {
  color: #8bc99f;
}

.diff-row-action:hover:not(:disabled) {
  border-color: #586575;
  background: #303742;
  color: #fff;
}

.diff-row-action-group.is-active {
  border-color: #586575;
  background: #303742;
}

.text-diff-editor__same-state,
.text-diff-editor__empty {
  position: absolute;
  right: 12px;
  bottom: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: rgba(23, 25, 29, 0.9);
  color: #8993a0;
  text-align: center;
  font-size: 0.76rem;
  pointer-events: none;
}

.text-diff-editor__empty-icon {
  color: #77879b;
  font-size: 1.1rem;
}

.text-diff-editor__empty strong {
  color: #b2bbc7;
  font-weight: 500;
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

  .summary-hint {
    display: none;
  }

  .text-diff-editor__diff-head,
  .text-diff-editor__body {
    grid-template-columns: minmax(0, 1fr) 92px minmax(0, 1fr);
  }

  .text-diff-editor__body {
    min-width: 680px;
    height: 60vh;
  }

  .diff-pane-heading {
    padding-inline: 8px;
  }

  .diff-pane-heading__meta,
  .diff-pane-heading small {
    display: none;
  }

  .diff-row-action {
    width: 29px;
  }
}
</style>
