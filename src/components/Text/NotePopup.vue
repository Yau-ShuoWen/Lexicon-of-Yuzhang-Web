<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const tooltipRef = ref(null)
const visible = ref(false)
const content = ref('')
const position = ref({ left: '', top: '', arrowLeft: '' })

let currentNote = null
let coarsePointer = false

const findNote = target => target instanceof Element ? target.closest('.rt-note') : null

async function open(note) {
  currentNote = note
  try {
    content.value = decodeURIComponent(note.dataset.note || '')
  } catch (_) {
    content.value = ''
  }
  visible.value = true
  await nextTick()
  placeTooltip()
}

function close() {
  currentNote = null
  visible.value = false
  content.value = ''
}

function placeTooltip() {
  const tooltip = tooltipRef.value
  if (!tooltip || !currentNote) return

  const noteRect = currentNote.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const left = Math.max(12, Math.min(
    noteRect.left + noteRect.width / 2 - tooltipRect.width / 2,
    window.innerWidth - tooltipRect.width - 12
  ))
  const gap = coarsePointer ? 4 : 10
  const below = noteRect.bottom + gap
  const top = Math.max(12, Math.min(
    below + tooltipRect.height > window.innerHeight - 12
      ? noteRect.top - tooltipRect.height - gap
      : below,
    window.innerHeight - tooltipRect.height - 12
  ))
  const arrowLeft = Math.max(12, Math.min(
    noteRect.left + noteRect.width / 2 - left - 4,
    tooltipRect.width - 18
  ))

  position.value = {
    left: `${left}px`,
    top: `${top}px`,
    arrowLeft: `${arrowLeft}px`
  }
}

function onMouseOver(event) {
  if (coarsePointer) return
  const note = findNote(event.target)
  if (note && note !== currentNote) void open(note)
}

function onMouseOut(event) {
  if (coarsePointer) return
  const note = findNote(event.target)
  if (!note) return
  const related = event.relatedTarget
  if (related instanceof Element && (related.closest('.rt-note') || tooltipRef.value?.contains(related))) return
  close()
}

function onClick(event) {
  const note = findNote(event.target)
  if (note) {
    event.stopPropagation()
    if (currentNote === note) close()
    else void open(note)
    return
  }
  if (!tooltipRef.value?.contains(event.target)) close()
}

onMounted(() => {
  coarsePointer = window.matchMedia('(pointer: coarse)').matches
  document.addEventListener('mouseover', onMouseOver)
  document.addEventListener('mouseout', onMouseOut)
  document.addEventListener('click', onClick)
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
  document.addEventListener('visibilitychange', close)
})

onBeforeUnmount(() => {
  close()
  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('mouseout', onMouseOut)
  document.removeEventListener('click', onClick)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
  document.removeEventListener('visibilitychange', close)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="tooltipRef"
      class="rt-note-tooltip"
      :style="{
        display: 'block',
        left: position.left,
        top: position.top,
        '--arrow-left': position.arrowLeft
      }"
      @click.stop
      v-html="content"
    />
  </Teleport>
</template>
