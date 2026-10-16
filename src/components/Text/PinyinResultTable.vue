<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { showSuccess } from '../../services/ToastService.js'
import { convertPinyinForCopy } from '../../utils/pinyinBlock.js'
import mandarinIcon from '../../assets/icons/pinyin/mandarin.svg'
import pinyinIcon from '../../assets/icons/settings/pinyin.svg'
import keyboardIcon from '../../assets/icons/pinyin/keyboard.svg'
import ipaIcon from '../../assets/icons/pinyin/ipa.svg'
import bookIcon from '../../assets/icons/special/book.svg'

const ICONS_BY_TAG = Object.freeze({
  putonghua: mandarinIcon,
  standard: pinyinIcon,
  other: pinyinIcon,
  keyboard: keyboardIcon,
  yzcIPA: ipaIcon,
  dictIPA: bookIcon
})

const props = defineProps({
  pairs: { type: Array, default: () => [] },
  appearance: { type: String, default: 'popup' }
})
const tableRef = ref(null)

function valueItems(pair) {
  if (pair.valueItems?.length) return pair.valueItems
  return pair.valueHtml ? [pair.valueHtml] : []
}

function iconFor(pair) {
  return ICONS_BY_TAG[pair.tag] || (pair.isIPA ? ipaIcon : pinyinIcon)
}

function alignValueColumns() {
  const grids = [...(tableRef.value?.querySelectorAll('.pinyin-result-values') || [])]
  const widths = []
  grids.forEach(grid => {
    grid.classList.remove('pinyin-result-values--aligned')
    grid.style.removeProperty('grid-template-columns')
  })
  for (const grid of grids) {
    ;[...grid.querySelectorAll('.pinyin-result-unit')].forEach((unit, index) => {
      widths[index] = Math.max(widths[index] || 0, unit.getBoundingClientRect().width)
    })
  }
  if (!widths.length) return
  const columns = widths.map(width => `${Math.ceil(width)}px`).join(' ')
  grids.forEach(grid => {
    grid.classList.add('pinyin-result-values--aligned')
    grid.style.gridTemplateColumns = columns
  })
}

async function copyPair(pair) {
  const container = document.createElement('div')
  container.innerHTML = valueItems(pair).join(' ')
  const text = convertPinyinForCopy(container.textContent.trim(), pair.isIPA)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    showSuccess('复制成功')
  } catch (_) {
    // 剪贴板权限被拒绝时保持静默。
  }
}

async function scheduleAlignment() {
  await nextTick()
  alignValueColumns()
}

watch(() => props.pairs, scheduleAlignment, {deep: true})
onMounted(scheduleAlignment)
</script>

<template>
  <div ref="tableRef" class="pinyin-result-table" :class="`pinyin-result-table--${appearance}`">
    <div class="pinyin-result-grid">
      <div v-for="(pair, index) in pairs" :key="`${pair.tag || ''}-${pair.label}-${index}`" class="pinyin-result-row">
        <span class="pinyin-result-label" :class="{'pinyin-result-cell--divided': index > 0}">
          <img class="pinyin-result-icon" :src="iconFor(pair)" alt="" aria-hidden="true">
          <span>{{ pair.label }}</span>
        </span>
        <button type="button" class="pinyin-result-value" :class="{'pinyin-result-cell--divided': index > 0}" title="复制" @click="copyPair(pair)">
          <span class="pinyin-result-values">
            <span v-for="(item, itemIndex) in valueItems(pair)" :key="itemIndex" class="pinyin-result-unit" v-html="item" />
          </span>
        </button>
        <button type="button" class="pinyin-result-copy" :class="{'pinyin-result-cell--divided': index > 0}" title="复制" :aria-label="`复制${pair.label}`" @click="copyPair(pair)">
          <CopyDocument aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pinyin-result-table{--pinyin-result-divider:#cbd2cd;width:100%;overflow-x:auto;overscroll-behavior-x:contain}.pinyin-result-table--popup{min-width:min(420px,calc(100vw - 26px))}.pinyin-result-table--panel{min-height:254px;border:1px solid #dfe4e0;border-radius:14px;background:#fff}.pinyin-result-grid{display:grid;grid-template-columns:max-content minmax(max-content,1fr) 42px;width:max-content;min-width:100%}.pinyin-result-row{display:contents}.pinyin-result-label,.pinyin-result-value,.pinyin-result-copy{display:flex;align-items:center;min-height:50px;box-sizing:border-box}.pinyin-result-label{position:sticky;z-index:2;left:0;gap:8px;padding:10px 14px;border-right:1px solid var(--pinyin-result-divider);color:#68716a;background:#f6f6f6;font-size:.88rem;white-space:nowrap}.pinyin-result-value{min-width:max-content;padding:10px 16px;border:0;color:#2d342f;background:#fff;font-family:'Charis SIL','Cambria','Cambria Math',serif;font-size:1.12rem;font-weight:400;text-align:left;cursor:pointer}.pinyin-result-copy{justify-content:center;width:42px;padding:0;border:0;color:#9aa29c;background:#fff;cursor:pointer;transition:color .15s ease,background .15s ease}.pinyin-result-value:hover{color:#174f2b;background:#f7faf8}.pinyin-result-value:hover+.pinyin-result-copy,.pinyin-result-copy:hover{color:#2e7245;background:#f7faf8}.pinyin-result-copy svg{width:17px;height:17px}.pinyin-result-cell--divided{border-top:1px solid var(--pinyin-result-divider)}.pinyin-result-values{display:inline-grid;align-items:baseline;column-gap:4px}.pinyin-result-unit{white-space:nowrap}.pinyin-result-unit :deep(.rt-pinyin),.pinyin-result-unit :deep(.rt-ipa){font-size:1em;line-height:inherit}.pinyin-result-icon{width:18px;height:18px;flex:0 0 18px;object-fit:contain;opacity:.7}
@media(max-width:750px){.pinyin-result-table--panel{min-height:180px}}
@media(max-width:560px){.pinyin-result-grid{grid-template-columns:minmax(max-content,1fr) 42px}.pinyin-result-label{position:static;grid-column:1/-1;min-height:0;padding:9px 14px 5px;border-right:0}.pinyin-result-value,.pinyin-result-copy{min-height:44px}.pinyin-result-value{padding:5px 8px 12px 14px}.pinyin-result-copy{padding-bottom:7px}.pinyin-result-value.pinyin-result-cell--divided,.pinyin-result-copy.pinyin-result-cell--divided{border-top:0}}
</style>
