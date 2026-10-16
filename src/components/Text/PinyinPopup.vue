<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AnchoredPopup from '../Window/AnchoredPopup.vue'
import { selectPinyinPairs } from '../../utils/pinyinNotations.js'
import PinyinResultTable from './PinyinResultTable.vue'

const visible = ref(false)
const pairs = ref([])
const anchor = ref(null)
let currentTrigger = null
let locked = false
let showTimer = null
let hideTimer = null
let mobileQuery = null

const findTrigger = target => target instanceof Element
  ? target.closest('.rt-pinyin-trigger')
  : null

function readPayload(trigger) {
  try {
    return JSON.parse(decodeURIComponent(trigger.dataset.pinyinData || ''))
  } catch (error) {
    console.warn('无法读取富文本拼音块', error)
    return null
  }
}

function open(trigger) {
  const payload = readPayload(trigger)
  if (!payload) return

  currentTrigger?.classList.remove('active')
  currentTrigger = trigger
  anchor.value = trigger
  currentTrigger.classList.add('active')
  pairs.value = selectPinyinPairs(payload.pairs || [])
  visible.value = true
}

function clearTrigger() {
  window.clearTimeout(showTimer)
  window.clearTimeout(hideTimer)
  currentTrigger?.classList.remove('active')
  currentTrigger = null
  anchor.value = null
  locked = false
  pairs.value = []
}

function onDocumentClick(event) {
  const trigger = findTrigger(event.target)
  if (!trigger) return
  event.preventDefault()
  event.stopPropagation()
  window.clearTimeout(showTimer)
  window.clearTimeout(hideTimer)
  if (currentTrigger === trigger && (mobileQuery.matches || locked)) {
    visible.value = false
    return
  }
  void open(trigger)
  locked = !mobileQuery.matches
}

function onTriggerEnter(event) {
  if (mobileQuery.matches || locked) return
  const trigger = findTrigger(event.target)
  if (!trigger) return
  window.clearTimeout(showTimer)
  window.clearTimeout(hideTimer)
  showTimer = window.setTimeout(() => {
    if (currentTrigger !== trigger) void open(trigger)
  }, 300)
}

function onTriggerLeave(event) {
  if (mobileQuery.matches || locked || !findTrigger(event.target)) return
  window.clearTimeout(showTimer)
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    if (!document.querySelector('.anchored-popup:hover')) visible.value = false
  }, 120)
}

function onPopupEnter() {
  if (!mobileQuery.matches) window.clearTimeout(hideTimer)
}

function onPopupLeave() {
  if (mobileQuery.matches || locked) return
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    visible.value = false
  }, 120)
}

watch(visible, openState => {
  if (!openState) clearTrigger()
})

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 768px)')
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('mouseenter', onTriggerEnter, true)
  document.addEventListener('mouseleave', onTriggerLeave, true)
})
onBeforeUnmount(() => {
  clearTrigger()
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('mouseenter', onTriggerEnter, true)
  document.removeEventListener('mouseleave', onTriggerLeave, true)
})
</script>

<template>
  <AnchoredPopup
    v-model="visible"
    :anchor="anchor"
    @mouseenter="onPopupEnter"
    @mouseleave="onPopupLeave"
  >
    <PinyinResultTable :pairs="pairs" :disable-alignment-below="768" />
  </AnchoredPopup>
</template>
