<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { showSuccess } from '../../services/ToastService.js'
import { convertPinyinForCopy } from '../../utils/pinyinBlock.js'

const popupRef = ref(null)
const visible = ref(false)
const mobile = ref(false)
const singleColumn = ref(false)
const pairs = ref([])
const position = ref({ left: '', top: '', arrowLeft: '' })

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

async function open(trigger) {
  const payload = readPayload(trigger)
  if (!payload) return

  currentTrigger?.classList.remove('active')
  currentTrigger = trigger
  currentTrigger.classList.add('active')
  pairs.value = payload.pairs || []
  mobile.value = mobileQuery.matches
  singleColumn.value = false
  visible.value = true

  await nextTick()
  if (mobile.value) measureMobileLayout()
  else alignDesktopValues()
  await nextTick()
  placePopup()
}

function close() {
  window.clearTimeout(showTimer)
  window.clearTimeout(hideTimer)
  currentTrigger?.classList.remove('active')
  currentTrigger = null
  locked = false
  visible.value = false
  pairs.value = []
}

function placePopup() {
  const popup = popupRef.value
  if (!popup || !currentTrigger || mobile.value) {
    position.value = { left: '', top: '', arrowLeft: '' }
    return
  }

  const triggerRect = currentTrigger.getBoundingClientRect()
  const popupRect = popup.getBoundingClientRect()
  const left = Math.max(12, Math.min(
    triggerRect.left + triggerRect.width / 2 - popupRect.width / 2,
    window.innerWidth - popupRect.width - 12
  ))
  const below = triggerRect.bottom + 10
  const top = Math.max(12, Math.min(
    below + popupRect.height > window.innerHeight - 12
      ? triggerRect.top - popupRect.height - 10
      : below,
    window.innerHeight - popupRect.height - 12
  ))
  const arrowLeft = Math.max(12, Math.min(
    triggerRect.left + triggerRect.width / 2 - left - 4,
    popupRect.width - 18
  ))

  position.value = {
    left: `${left}px`,
    top: `${top}px`,
    arrowLeft: `${arrowLeft}px`
  }
}

function measureMobileLayout() {
  const popup = popupRef.value
  if (!popup) return
  popup.classList.add('rt-pinyin-popup-measuring')
  const naturalWidth = popup.getBoundingClientRect().width
  popup.classList.remove('rt-pinyin-popup-measuring')
  singleColumn.value = naturalWidth > window.innerWidth - 32
}

function alignDesktopValues() {
  const grids = [...(popupRef.value?.querySelectorAll('.rt-pinyin-popup-value-grid') || [])]
  const widths = []

  for (const grid of grids) {
    ;[...grid.querySelectorAll('.rt-pinyin-popup-unit')].forEach((unit, index) => {
      widths[index] = Math.max(widths[index] || 0, unit.getBoundingClientRect().width)
    })
  }

  if (!widths.length) return
  const columns = widths.map(width => `${Math.ceil(width)}px`).join(' ')
  grids.forEach(grid => {
    grid.classList.add('rt-pinyin-popup-value-grid-aligned')
    grid.style.gridTemplateColumns = columns
  })
}

function getPlainValue(pair) {
  const container = document.createElement('div')
  container.innerHTML = pair.valueItems?.length
    ? pair.valueItems.join(' ')
    : pair.valueHtml || ''
  return container.textContent.trim()
}

async function copyPair(pair) {
  const text = convertPinyinForCopy(getPlainValue(pair), pair.isIPA)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    showSuccess('复制成功')
  } catch (_) {
    // 剪贴板权限被浏览器拒绝时保持现有的静默行为。
  }
}

function onDocumentClick(event) {
  const trigger = findTrigger(event.target)
  if (trigger) {
    event.stopPropagation()
    if (currentTrigger === trigger && (mobileQuery.matches || locked)) {
      close()
      return
    }
    void open(trigger)
    locked = !mobileQuery.matches
    window.clearTimeout(hideTimer)
    return
  }
  if (!popupRef.value?.contains(event.target)) close()
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
    if (!popupRef.value?.matches(':hover')) close()
  }, 100)
}

function onPopupEnter() {
  if (!mobile.value) window.clearTimeout(hideTimer)
}

function onPopupLeave() {
  if (mobile.value || locked) return
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(close, 100)
}

function onScroll() {
  if (!mobileQuery.matches) close()
}

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 768px)')
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('mouseenter', onTriggerEnter, true)
  document.addEventListener('mouseleave', onTriggerLeave, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', close)
  document.addEventListener('visibilitychange', close)
})

onBeforeUnmount(() => {
  close()
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('mouseenter', onTriggerEnter, true)
  document.removeEventListener('mouseleave', onTriggerLeave, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', close)
  document.removeEventListener('visibilitychange', close)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && mobile"
      class="rt-pinyin-popup-overlay"
      style="display: block"
      @click="close"
    />
    <div
      v-if="visible"
      ref="popupRef"
      class="rt-pinyin-popup"
      :class="{
        'rt-pinyin-popup-mobile': mobile,
        'rt-pinyin-popup-single-column': singleColumn
      }"
      :style="{
        display: 'block',
        left: position.left,
        top: position.top,
        '--arrow-left': position.arrowLeft
      }"
      @click.stop
      @mouseenter="onPopupEnter"
      @mouseleave="onPopupLeave"
    >
      <button type="button" class="rt-pinyin-popup-close" aria-label="关闭" @click="close">×</button>
      <div class="rt-pinyin-popup-inner">
        <div v-for="(pair, index) in pairs" :key="`${pair.label}-${index}`" class="rt-pinyin-popup-row">
          <span class="rt-pinyin-popup-label">{{ pair.label }}</span>
          <button
            type="button"
            class="rt-pinyin-popup-value"
            title="复制"
            @click="copyPair(pair)"
          >
            <span v-if="pair.valueItems?.length" class="rt-pinyin-popup-value-grid">
              <span
                v-for="(item, itemIndex) in pair.valueItems"
                :key="itemIndex"
                class="rt-pinyin-popup-unit"
                v-html="item"
              />
            </span>
            <span v-else v-html="pair.valueHtml" />
          </button>
          <button type="button" class="rt-pinyin-copy-btn" title="复制" @click="copyPair(pair)">
            <CopyDocument aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
