<script setup>
import {nextTick, onUnmounted, ref} from 'vue'
import plusIcon from '../../../assets/icons/plus-white.svg'

const props = defineProps({
  modelValue: {type: Array, required: true},
  createItem: {type: Function, required: true},
  layout: {type: String, default: 'list'},
  itemLabel: {type: String, required: true},
  autoSort: {type: Boolean, default: false}
})

const ids = new WeakMap()
let nextId = 0
const itemId = item => {
  if (!ids.has(item)) ids.set(item, `hanzi-sort-${nextId++}`)
  return ids.get(item)
}

const draggingId = ref(null)
let press = null
let preview = null

function updateSort() {
  if (props.autoSort) props.modelValue.forEach((item, index) => { item.sort = index + 1 })
}

function addItem() {
  props.modelValue.push(props.createItem())
  updateSort()
}

function removeItem(index) {
  props.modelValue.splice(index, 1)
  updateSort()
}

function pointerDown(event, item) {
  if (event.button !== 0) return
  const id = itemId(item)
  press = {id, originalIndex: props.modelValue.findIndex(value => itemId(value) === id),
    pointerId: event.pointerId, x: event.clientX, y: event.clientY,
    element: event.currentTarget.closest('[data-hanzi-sort-id]')}
  window.addEventListener('pointermove', pointerMove)
  window.addEventListener('pointerup', pointerUp)
  window.addEventListener('pointercancel', pointerCancel)
}

function pointerMove(event) {
  const drag = press
  if (!drag || event.pointerId !== drag.pointerId) return
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) { finishDrag(); return }
  if (!draggingId.value) {
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return
    draggingId.value = drag.id
    window.getSelection()?.removeAllRanges()
    const rect = drag.element.getBoundingClientRect()
    preview = drag.element.cloneNode(true)
    preview.classList.add('hanzi-drag-preview')
    Object.assign(preview.style, {width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px`})
    window.document.body.appendChild(preview)
    drag.offsetX = event.clientX - rect.left
    drag.offsetY = event.clientY - rect.top
  }
  preview.style.left = `${event.clientX - drag.offsetX}px`
  preview.style.top = `${event.clientY - drag.offsetY}px`
  for (const element of drag.element.parentElement.querySelectorAll('[data-hanzi-sort-id]')) {
    const id = element.dataset.hanziSortId
    if (id === drag.id) continue
    const rect = element.getBoundingClientRect()
    const transform = window.getComputedStyle(element).transform
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform)
    const left = rect.left - (matrix?.m41 || 0)
    const top = rect.top - (matrix?.m42 || 0)
    if (event.clientX < left || event.clientX >= left + rect.width || event.clientY < top || event.clientY >= top + rect.height) continue
    const sourceIndex = props.modelValue.findIndex(item => itemId(item) === drag.id)
    const targetIndex = props.modelValue.findIndex(item => itemId(item) === id)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) break
    // 换位后，大卡片可能移动到指针另一侧，指针却仍在它的区域内。
    // 只有指针确实反向越过上次换位点，才允许与同一项换回去。
    if (drag.lastSwap?.targetId === id) {
      const travel = (event.clientX - drag.lastSwap.x) * drag.lastSwap.dx
        + (event.clientY - drag.lastSwap.y) * drag.lastSwap.dy
      if (travel > -12) break
    }
    const sourceRect = drag.element.getBoundingClientRect()
    const deltaX = left + rect.width / 2 - (sourceRect.left + sourceRect.width / 2)
    const deltaY = top + rect.height / 2 - (sourceRect.top + sourceRect.height / 2)
    const distance = Math.hypot(deltaX, deltaY) || 1
    const before = new Map([...drag.element.parentElement.querySelectorAll('[data-hanzi-sort-id]')]
      .filter(row => row.dataset.hanziSortId !== drag.id)
      .map(row => [row.dataset.hanziSortId, row.getBoundingClientRect()]))
    props.modelValue.splice(targetIndex, 0, ...props.modelValue.splice(sourceIndex, 1))
    updateSort()
    drag.lastSwap = {targetId: id, x: event.clientX, y: event.clientY,
      dx: deltaX / distance, dy: deltaY / distance}
    nextTick(() => {
      if (press !== drag) return
      for (const row of drag.element.parentElement.querySelectorAll('[data-hanzi-sort-id]')) {
        const previous = before.get(row.dataset.hanziSortId)
        if (!previous) continue
        row.getAnimations().forEach(animation => animation.cancel())
        const current = row.getBoundingClientRect()
        const x = previous.left - current.left
        const y = previous.top - current.top
        if (Math.abs(x) >= 1 || Math.abs(y) >= 1) row.animate([
          {transform: `translate(${x}px, ${y}px)`}, {transform: 'translate(0, 0)'}
        ], {duration: 180, easing: 'ease-out'})
      }
    })
    break
  }
}

function pointerUp(event) {
  if (press && event.pointerId === press.pointerId) finishDrag()
}

function pointerCancel() {
  if (press && draggingId.value) {
    const index = props.modelValue.findIndex(item => itemId(item) === press.id)
    if (index >= 0) props.modelValue.splice(press.originalIndex, 0, ...props.modelValue.splice(index, 1))
    updateSort()
  }
  finishDrag()
}

function finishDrag() {
  window.removeEventListener('pointermove', pointerMove)
  window.removeEventListener('pointerup', pointerUp)
  window.removeEventListener('pointercancel', pointerCancel)
  preview?.remove()
  preview = null
  press = null
  draggingId.value = null
}

function onVisibilityChange() {
  if (document.hidden && press) finishDrag()
}

window.addEventListener('blur', finishDrag)
document.addEventListener('visibilitychange', onVisibilityChange)
onUnmounted(() => {
  pointerCancel()
  window.removeEventListener('blur', finishDrag)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="hanzi-sortable" :class="`hanzi-sortable--${layout}`">
    <div v-for="(item, index) in modelValue" :key="itemId(item)" class="hanzi-sortable__card"
         :class="{'hanzi-sortable__card--dragging': draggingId === itemId(item)}" :data-hanzi-sort-id="itemId(item)">
      <button type="button" class="hanzi-sortable__handle" :aria-label="`拖动排序${itemLabel}`" title="拖动排序" @pointerdown="pointerDown($event, item)">
        <svg viewBox="0 0 22 30" aria-hidden="true"><circle cx="7" cy="7" r="2"/><circle cx="15" cy="7" r="2"/><circle cx="7" cy="15" r="2"/><circle cx="15" cy="15" r="2"/><circle cx="7" cy="23" r="2"/><circle cx="15" cy="23" r="2"/></svg>
      </button>
      <div class="hanzi-sortable__content"><slot :item="item" :index="index" /></div>
      <button type="button" class="hanzi-sortable__remove" :aria-label="`删除${itemLabel}`" :title="`删除${itemLabel}`" @click="removeItem(index)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg>
      </button>
    </div>
    <button type="button" class="hanzi-sortable__add" :aria-label="`添加${itemLabel}`" :title="`添加${itemLabel}`" @click="addItem"><img :src="plusIcon" alt="" /></button>
  </div>
</template>

<style scoped>
.hanzi-sortable { display: grid; gap: 12px; }
.hanzi-sortable--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.hanzi-sortable--list { grid-template-columns: minmax(0, 1fr); }
.hanzi-sortable__card { display: grid; grid-template-columns: 34px minmax(0, 1fr) 38px; align-items: start; gap: 10px; min-width: 0; padding: 14px; border: 1px solid #d8e5da; border-radius: 11px; background: #fff; }
.hanzi-sortable__card:hover { border-color: #aacbb0; background: #fbfdfb; }
.hanzi-sortable__card--dragging, .hanzi-sortable__card--dragging * { pointer-events: none !important; }
.hanzi-sortable__card--dragging { opacity: 0; }
.hanzi-sortable__handle { display: grid; place-items: center; align-self: stretch; min-height: 40px; border: 0; background: transparent; color: #788d7d; cursor: grab; touch-action: none; }
.hanzi-sortable__handle:active { cursor: grabbing; }
.hanzi-sortable__handle svg { width: 22px; height: 30px; fill: currentColor; }
.hanzi-sortable__content { min-width: 0; }
.hanzi-sortable__remove { display: grid; place-items: center; width: 38px; height: 38px; border: 0; border-radius: 8px; background: transparent; color: #b45d5d; cursor: pointer; }
.hanzi-sortable__remove:hover { background: #fff1f1; }
.hanzi-sortable__remove svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.hanzi-sortable__add { display: grid; place-items: center; width: 58px; height: 58px; padding: 0; border: 1px solid #58a869; border-radius: 10px; background: #58a869; cursor: pointer; }
.hanzi-sortable__add:hover { background: #4c985c; border-color: #4c985c; }
.hanzi-sortable__add img { width: 27px; height: 27px; }
:global(.hanzi-drag-preview) { position: fixed !important; z-index: 10000; margin: 0 !important; pointer-events: none !important; opacity: .72; mix-blend-mode: multiply; box-shadow: none !important; user-select: none; }
@media (max-width: 900px) { .hanzi-sortable--grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 600px) { .hanzi-sortable__card { grid-template-columns: 30px minmax(0, 1fr) 34px; gap: 6px; padding: 10px; } }
</style>
