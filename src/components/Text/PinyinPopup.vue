<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import AnchoredPopup from '../Window/AnchoredPopup.vue'
import { showSuccess } from '../../services/ToastService.js'
import { convertPinyinForCopy } from '../../utils/pinyinBlock.js'
import { selectPinyinPairs } from '../../utils/pinyinNotations.js'

const visible = ref(false)
const pairs = ref([])
const anchor = ref(null)
const popupListRef = ref(null)
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
  anchor.value = trigger
  currentTrigger.classList.add('active')
  pairs.value = selectPinyinPairs(payload.pairs || [])
  visible.value = true
  await nextTick()
  alignValueColumns()
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

function alignValueColumns() {
  if (mobileQuery?.matches) return
  const grids = [...(popupListRef.value?.querySelectorAll('.pinyin-popup-values') || [])]
  const widths = []

  for (const grid of grids) {
    ;[...grid.querySelectorAll('.pinyin-popup-unit')].forEach((unit, index) => {
      widths[index] = Math.max(widths[index] || 0, unit.getBoundingClientRect().width)
    })
  }

  if (!widths.length) return
  const columns = widths.map(width => `${Math.ceil(width)}px`).join(' ')
  grids.forEach(grid => {
    grid.classList.add('pinyin-popup-values--aligned')
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
    <div ref="popupListRef" class="pinyin-popup-list">
      <div v-for="(pair, index) in pairs" :key="`${pair.tag}-${pair.label}-${index}`" class="pinyin-popup-row">
        <span class="pinyin-popup-label" :class="{'pinyin-popup-cell--divided': index > 0}">{{ pair.label }}</span>
        <button type="button" class="pinyin-popup-value" :class="{'pinyin-popup-cell--divided': index > 0}" title="复制" @click="copyPair(pair)">
          <span v-if="pair.valueItems?.length" class="pinyin-popup-values">
            <span
              v-for="(item, itemIndex) in pair.valueItems"
              :key="itemIndex"
              class="pinyin-popup-unit"
              v-html="item"
            />
          </span>
          <span v-else v-html="pair.valueHtml" />
        </button>
        <button type="button" class="pinyin-popup-copy" :class="{'pinyin-popup-cell--divided': index > 0}" title="复制" aria-label="复制这一行拼音" @click="copyPair(pair)">
          <CopyDocument aria-hidden="true" />
        </button>
      </div>
    </div>
  </AnchoredPopup>
</template>

<style scoped>
.pinyin-popup-list {
  --pinyin-popup-divider: #cbd2cd;
  display: grid;
  grid-template-columns: minmax(128px, auto) minmax(90px, 1fr) 42px;
  min-width: min(420px, calc(100vw - 26px));
}

.pinyin-popup-row {
  display: contents;
}

.pinyin-popup-cell--divided {
  border-top: 1px solid var(--pinyin-popup-divider);
}

.pinyin-popup-label,
.pinyin-popup-value,
.pinyin-popup-copy {
  display: flex;
  align-items: center;
  min-height: 50px;
  box-sizing: border-box;
}

.pinyin-popup-label {
  padding: 10px 14px;
  border-right: 1px solid var(--pinyin-popup-divider);
  color: #68716a;
  background: #f6f6f6;
  font-size: .88rem;
  white-space: nowrap;
}

.pinyin-popup-value {
  min-width: 0;
  padding: 10px 8px 10px 16px;
  border: 0;
  color: #2d342f;
  background: #fff;
  font-family: 'Cambria', 'Cambria Math', 'Charis SIL', serif;
  font-size: 1.12rem;
  text-align: left;
  cursor: pointer;
}

.pinyin-popup-value:hover {
  color: #174f2b;
  background: #f7faf8;
}

.pinyin-popup-copy {
  justify-content: center;
  width: 42px;
  padding: 0;
  border: 0;
  color: #9aa29c;
  background: #fff;
  cursor: pointer;
  transition: color .15s ease, background .15s ease;
}

.pinyin-popup-value:hover + .pinyin-popup-copy,
.pinyin-popup-copy:hover {
  color: #2e7245;
  background: #f7faf8;
}

.pinyin-popup-copy svg {
  width: 17px;
  height: 17px;
}

.pinyin-popup-value.pinyin-popup-cell--divided,
.pinyin-popup-copy.pinyin-popup-cell--divided {
  border-top: 1px solid var(--pinyin-popup-divider);
}

.pinyin-popup-values {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
}

.pinyin-popup-values--aligned {
  display: inline-grid;
  align-items: baseline;
  column-gap: 8px;
}

.pinyin-popup-unit {
  white-space: nowrap;
}

@media (max-width: 520px) {
  .pinyin-popup-list {
    grid-template-columns: minmax(0, 1fr) 42px;
    min-width: 0;
  }

  .pinyin-popup-label {
    grid-column: 1 / -1;
    border-right: 0;
    min-height: 0;
    padding: 9px 14px 5px;
  }

  .pinyin-popup-value.pinyin-popup-cell--divided,
  .pinyin-popup-copy.pinyin-popup-cell--divided {
    border-top: 0;
  }

  .pinyin-popup-value,
  .pinyin-popup-copy {
    min-height: 44px;
  }

  .pinyin-popup-value {
    padding: 5px 8px 12px 14px;
  }

  .pinyin-popup-copy {
    padding-bottom: 7px;
  }
}
</style>
