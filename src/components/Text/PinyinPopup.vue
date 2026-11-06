<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import UnifiedModal from '../Window/UnifiedModal.vue'
import { selectPinyinPairs } from '../../utils/pinyinNotations.js'
import PinyinResultTable from './PinyinResultTable.vue'

const visible = ref(false)
const pairs = ref([])
const findTrigger = target => target instanceof Element
  ? target.closest('.rt-pinyin-trigger[data-pinyin-data]')
  : null

function open(trigger) {
  try {
    const payload = JSON.parse(decodeURIComponent(trigger.dataset.pinyinData || ''))
    pairs.value = selectPinyinPairs(payload.pairs || [])
    visible.value = true
  } catch (error) {
    console.warn('无法读取富文本拼音块', error)
  }
}

function onDocumentClick(event) {
  const trigger = findTrigger(event.target)
  if (!trigger) return
  event.preventDefault()
  event.stopPropagation()
  open(trigger)
}

function onDocumentKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const trigger = findTrigger(event.target)
  if (!trigger) return
  event.preventDefault()
  open(trigger)
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <UnifiedModal v-model="visible" title="拼音" plain elevated :backdrop-blur="false">
    <PinyinResultTable :pairs="pairs" appearance="plain" />
  </UnifiedModal>
</template>
