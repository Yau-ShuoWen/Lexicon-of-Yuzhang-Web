<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'

const props = defineProps({ items: { type: Array, required: true } })
const emit = defineEmits(['move'])
const listRef = ref(null)
const draggingKey = ref(null)
let press = null

const keyOf = item => String(item.localKey || item.id)
const rows = () => [...(listRef.value?.querySelectorAll('[data-sort-key]') || [])]

function layoutRect(element) {
  const rect = element.getBoundingClientRect()
  const transform = window.getComputedStyle(element).transform
  const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform)
  return {left: rect.left - (matrix?.m41 || 0), top: rect.top - (matrix?.m42 || 0), width: rect.width, height: rect.height}
}

function cleanup() {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', finish)
  window.removeEventListener('pointercancel', cancel)
  press?.preview?.remove()
  press = null
  draggingKey.value = null
}

function start(event, index) {
  if (event.button !== 0) return
  event.preventDefault()
  const row = event.currentTarget.closest('[data-sort-index]')
  if (!row) return
  press = {key: keyOf(props.items[index]), pointerId: event.pointerId,
    x: event.clientX, y: event.clientY, row, preview: null, lastSwap: null, moving: false}
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancel)
}

function move(event) {
  if (!press || event.pointerId !== press.pointerId) return
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) return cleanup()
  if (!press.preview) {
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) return
    const rect = press.row.getBoundingClientRect()
    const preview = press.row.cloneNode(true)
    preview.classList.add('sort-preview')
    Object.assign(preview.style, {
      position: 'fixed', zIndex: '10000', pointerEvents: 'none',
      width: `${rect.width}px`, height: `${rect.height}px`,
      left: `${rect.left}px`, top: `${rect.top}px`
    })
    document.body.appendChild(preview)
    press.preview = preview
    press.offsetX = event.clientX - rect.left
    press.offsetY = event.clientY - rect.top
    draggingKey.value = press.key
    window.getSelection()?.removeAllRanges()
  }
  press.preview.style.left = `${event.clientX - press.offsetX}px`
  press.preview.style.top = `${event.clientY - press.offsetY}px`
  if (press.moving || (press.lastSwap && Math.hypot(event.clientX - press.lastSwap.x, event.clientY - press.lastSwap.y) < 12)) return

  const sourceIndex = props.items.findIndex(item => keyOf(item) === press.key)
  const target = rows().find(row => {
    if (row.dataset.sortKey === press.key) return false
    const rect = layoutRect(row)
    return event.clientX >= rect.left && event.clientX < rect.left + rect.width &&
      event.clientY >= rect.top && event.clientY < rect.top + rect.height
  })
  if (sourceIndex < 0 || !target) return
  const targetIndex = Number(target.dataset.sortIndex)
  if (sourceIndex === targetIndex) return
  press.moving = true
  const previous = new Map(rows().filter(row => row.dataset.sortKey !== press.key)
    .map(row => [row.dataset.sortKey, layoutRect(row)]))
  emit('move', sourceIndex, targetIndex)
  press.lastSwap = {x: event.clientX, y: event.clientY}
  nextTick(() => {
    if (!press) return
    for (const row of rows()) {
      if (row.dataset.sortKey === press.key) continue
      const before = previous.get(row.dataset.sortKey)
      if (!before) continue
      row.getAnimations().forEach(animation => animation.cancel())
      const after = row.getBoundingClientRect()
      const y = before.top - after.top
      if (Math.abs(y) > 1) row.animate([{transform: `translateY(${y}px)`}, {transform: 'translateY(0)'}], {duration: 180, easing: 'ease-out'})
    }
    press.moving = false
  })
}

function finish(event) {
  if (!press || event.pointerId !== press.pointerId) return
  cleanup()
}

function cancel(event) {
  if (press && event.pointerId === press.pointerId) cleanup()
}

onBeforeUnmount(cleanup)
</script>

<template>
  <div ref="listRef" class="sort-list">
    <div v-for="(item, index) in items" :key="item.localKey || item.id" class="sort-row"
         :class="{'sort-dragging': draggingKey === keyOf(item)}" :data-sort-index="index"
         :data-sort-key="item.localKey || item.id">
      <button type="button" class="sort-handle" aria-label="拖动排序" @pointerdown="start($event, index)">⋮⋮</button>
      <div class="sort-content"><slot :item="item" :index="index" /></div>
    </div>
  </div>
</template>

<style scoped>
.sort-list { display: grid; gap: 12px; }
.sort-row { display: flex; gap: 12px; align-items: center; padding: 14px; border: 1px solid #dbe7dc; border-radius: 12px; background: #fff; }
.sort-dragging { opacity: 0; pointer-events: none; }
.sort-handle { flex: 0 0 32px; height: 40px; border: 0; color: #65836c; background: transparent; font: inherit; font-size: 1.2rem; cursor: grab; touch-action: none; }
.sort-content { flex: 1; min-width: 0; }
:global(.sort-preview) { opacity: .85; box-shadow: 0 8px 22px #213e2926; }
</style>
