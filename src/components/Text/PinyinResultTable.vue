<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { showSuccess } from '../../services/ToastService.js'
import { convertPinyinForCopy } from '../../utils/pinyinBlock.js'

const props = defineProps({
  pairs: { type: Array, default: () => [] },
  appearance: { type: String, default: 'popup' },
  compactAt: { type: String, default: '520' },
  disableAlignmentBelow: { type: Number, default: 0 }
})
const tableRef = ref(null)

function valueItems(pair) {
  if (pair.valueItems?.length) return pair.valueItems
  return pair.valueHtml ? [pair.valueHtml] : []
}

function alignValueColumns() {
  const grids = [...(tableRef.value?.querySelectorAll('.pinyin-result-values') || [])]
  const widths = []
  grids.forEach(grid => {
    grid.classList.remove('pinyin-result-values--aligned')
    grid.style.removeProperty('grid-template-columns')
  })
  if (props.disableAlignmentBelow && window.innerWidth <= props.disableAlignmentBelow) return
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
  <div ref="tableRef" class="pinyin-result-table" :class="[`pinyin-result-table--${appearance}`, `pinyin-result-table--compact-${compactAt}`]">
    <div v-for="(pair, index) in pairs" :key="`${pair.tag || ''}-${pair.label}-${index}`" class="pinyin-result-row">
      <span class="pinyin-result-label" :class="{'pinyin-result-cell--divided': index > 0}">{{ pair.label }}</span>
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
</template>

<style scoped>
.pinyin-result-table{--pinyin-result-divider:#cbd2cd;display:grid;grid-template-columns:minmax(128px,auto) minmax(90px,1fr) 42px;width:100%}.pinyin-result-table--popup{min-width:min(420px,calc(100vw - 26px))}.pinyin-result-table--panel{min-height:254px;overflow:hidden;border:1px solid #dfe4e0;border-radius:14px;background:#fff}.pinyin-result-row{display:contents}.pinyin-result-label,.pinyin-result-value,.pinyin-result-copy{display:flex;align-items:center;min-height:50px;box-sizing:border-box}.pinyin-result-label{padding:10px 14px;border-right:1px solid var(--pinyin-result-divider);color:#68716a;background:#f6f6f6;font-size:.88rem;white-space:nowrap}.pinyin-result-value{min-width:0;padding:10px 8px 10px 16px;border:0;color:#2d342f;background:#fff;font-family:'Charis SIL','Cambria','Cambria Math',serif;font-size:1.12rem;font-weight:400;text-align:left;cursor:pointer}.pinyin-result-copy{justify-content:center;width:42px;padding:0;border:0;color:#9aa29c;background:#fff;cursor:pointer;transition:color .15s ease,background .15s ease}.pinyin-result-value:hover{color:#174f2b;background:#f7faf8}.pinyin-result-value:hover+.pinyin-result-copy,.pinyin-result-copy:hover{color:#2e7245;background:#f7faf8}.pinyin-result-copy svg{width:17px;height:17px}.pinyin-result-cell--divided{border-top:1px solid var(--pinyin-result-divider)}.pinyin-result-values{display:flex;align-items:baseline;gap:4px}.pinyin-result-values--aligned{display:inline-grid;column-gap:4px}.pinyin-result-unit{white-space:nowrap}.pinyin-result-unit :deep(.rt-pinyin),.pinyin-result-unit :deep(.rt-ipa){font-size:1em;line-height:inherit}
.pinyin-result-table--popup .pinyin-result-values{flex-wrap:wrap;gap:0 8px}.pinyin-result-table--popup .pinyin-result-values--aligned{column-gap:4px}
@media(max-width:560px){.pinyin-result-table--compact-560{grid-template-columns:minmax(0,1fr) 42px}.pinyin-result-table--compact-560 .pinyin-result-label{grid-column:1/-1;min-height:0;padding:9px 14px 5px;border-right:0}.pinyin-result-table--compact-560 .pinyin-result-value,.pinyin-result-table--compact-560 .pinyin-result-copy{min-height:44px}.pinyin-result-table--compact-560 .pinyin-result-value{padding:5px 8px 12px 14px}.pinyin-result-table--compact-560 .pinyin-result-copy{padding-bottom:7px}.pinyin-result-table--compact-560 .pinyin-result-value.pinyin-result-cell--divided,.pinyin-result-table--compact-560 .pinyin-result-copy.pinyin-result-cell--divided{border-top:0}}
@media(max-width:520px){.pinyin-result-table--compact-520{min-width:0;grid-template-columns:minmax(0,1fr) 42px}.pinyin-result-table--compact-520 .pinyin-result-label{grid-column:1/-1;min-height:0;padding:9px 14px 5px;border-right:0}.pinyin-result-table--compact-520 .pinyin-result-value,.pinyin-result-table--compact-520 .pinyin-result-copy{min-height:44px}.pinyin-result-table--compact-520 .pinyin-result-value{padding:5px 8px 12px 14px}.pinyin-result-table--compact-520 .pinyin-result-copy{padding-bottom:7px}.pinyin-result-table--compact-520 .pinyin-result-value.pinyin-result-cell--divided,.pinyin-result-table--compact-520 .pinyin-result-copy.pinyin-result-cell--divided{border-top:0}}
@media(max-width:500px){.pinyin-result-table--compact-500{grid-template-columns:minmax(0,1fr) 42px}.pinyin-result-table--compact-500 .pinyin-result-label{grid-column:1/-1;min-height:0;padding:9px 14px 5px;border-right:0}.pinyin-result-table--compact-500 .pinyin-result-value{padding:5px 8px 12px 14px}.pinyin-result-table--compact-500 .pinyin-result-copy{padding-bottom:7px}.pinyin-result-table--compact-500 .pinyin-result-value.pinyin-result-cell--divided,.pinyin-result-table--compact-500 .pinyin-result-copy.pinyin-result-cell--divided{border-top:0}}
@media(max-width:750px){.pinyin-result-table--panel{min-height:180px}}
</style>
