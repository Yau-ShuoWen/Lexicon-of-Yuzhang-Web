<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { request } from '../../services/request.js'
import { showSuccess } from '../../services/ToastService.js'
import { formatRichText } from '../../utils/textFormatter.js'
import { convertPinyinForCopy } from '../../utils/pinyinBlock.js'

const props = defineProps({
  dialect: { type: String, required: true },
  language: { type: String, required: true }
})

const input = ref('')
const rows = ref([])
const loading = ref(false)
const failed = ref(false)
const resultTableRef = ref(null)
let timer = null
let requestController = null

const hasInput = computed(() => input.value.trim().length > 0)

function parsePinyinBlock(value) {
  const start = value.indexOf('▕')
  const end = value.indexOf('▏', start + 1)
  if (start < 0 || end < 0) return []

  return value.slice(start + 1, end)
    .split('│')
    .slice(1)
    .map(part => {
      const fields = part.split('┆')
      const tagged = fields.length >= 3
      const rawValue = fields.slice(tagged ? 2 : 1).join('┆').trim()
      return {
        tag: tagged ? fields[0].trim() : '',
        label: fields[tagged ? 1 : 0]?.trim() || '',
        rawValue,
        valueHtml: formatRichText(rawValue),
        valueItems: rawValue.split(/\s+/).filter(Boolean).map(item => formatRichText(item)),
        isIPA: /\[-[^\]]*\]/.test(rawValue)
      }
    })
    .filter(row => row.label && row.rawValue)
}

async function transfer() {
  const value = input.value.trim()
  requestController?.abort()

  if (!value) {
    rows.value = []
    loading.value = false
    failed.value = false
    return
  }

  const controller = new AbortController()
  requestController = controller
  loading.value = true
  failed.value = false

  try {
    const params = new URLSearchParams({pinyin: value})
    const result = await request(
      `/api/pinyin/preview/${props.dialect}/${props.language}?${params}`,
      {signal: controller.signal}
    )
    if (requestController !== controller) return
    rows.value = parsePinyinBlock(result)
    failed.value = rows.value.length === 0
    await nextTick()
    alignValueColumns()
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error(error)
      rows.value = []
      failed.value = true
    }
  } finally {
    if (requestController === controller) loading.value = false
  }
}

function alignValueColumns() {
  const grids = [...(resultTableRef.value?.querySelectorAll('.result-values') || [])]
  const widths = []

  grids.forEach(grid => {
    grid.classList.remove('result-values--aligned')
    grid.style.removeProperty('grid-template-columns')
  })

  for (const grid of grids) {
    ;[...grid.querySelectorAll('.result-unit')].forEach((unit, index) => {
      widths[index] = Math.max(widths[index] || 0, unit.getBoundingClientRect().width)
    })
  }

  if (!widths.length) return
  const columns = widths.map(width => `${Math.ceil(width)}px`).join(' ')
  grids.forEach(grid => {
    grid.classList.add('result-values--aligned')
    grid.style.gridTemplateColumns = columns
  })
}

function handleInput() {
  window.clearTimeout(timer)
  timer = window.setTimeout(transfer, 250)
}

watch(() => [props.dialect, props.language], () => {
  window.clearTimeout(timer)
  void transfer()
})

function plainText(row) {
  const container = document.createElement('div')
  container.innerHTML = row.valueHtml
  return container.textContent.trim()
}

async function copyRow(row) {
  const text = convertPinyinForCopy(plainText(row), row.isIPA)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    showSuccess('复制成功')
  } catch (_) {
    // 剪贴板权限被拒绝时保持静默。
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(timer)
  requestController?.abort()
})
</script>

<template>
  <section class="pinyin-transfer">
    <div class="transfer-body">
      <div class="transfer-field">
        <div class="pane-top">
          <span class="pane-label">{{ $t('alphabet_transfer.input') }}</span>
        </div>
        <textarea
          v-model="input"
          class="transfer-input"
          :class="{active: hasInput}"
          rows="6"
          :placeholder="$t('pinyin_table.transfer_input_placeholder')"
          @input="handleInput"
        />
        <p class="input-help">{{ $t('pinyin_table.transfer_input_help') }}</p>
      </div>

      <div class="transfer-field">
        <div class="pane-top">
          <span class="pane-label">{{ $t('alphabet_transfer.result') }}</span>
          <span class="pane-hint">
            {{ loading ? $t('pinyin_table.converting') : (rows.length ? $t('alphabet_transfer.updated') : $t('alphabet_transfer.waiting')) }}
          </span>
        </div>

        <div v-if="rows.length" ref="resultTableRef" class="result-table">
          <div v-for="(row, index) in rows" :key="`${row.tag}-${row.label}-${index}`" class="result-row">
            <span class="result-label">{{ row.label }}</span>
            <button class="result-value" type="button" title="复制" @click="copyRow(row)">
              <span class="result-values">
                <span
                  v-for="(item, itemIndex) in row.valueItems"
                  :key="itemIndex"
                  class="result-unit"
                  v-html="item"
                />
              </span>
            </button>
            <button class="copy-button" type="button" title="复制" :aria-label="`复制${row.label}`" @click="copyRow(row)">
              <CopyDocument aria-hidden="true" />
            </button>
          </div>
        </div>
        <div v-else class="result-empty">
          {{ failed ? $t('pinyin_table.transfer_failed') : $t('alphabet_transfer.result_placeholder') }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pinyin-transfer{margin-top:18px;padding:22px 20px;border:1px solid var(--color-border);border-radius:var(--border-radius-xl);background:#fff;box-shadow:var(--shadow-sm)}
.transfer-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.transfer-field{min-width:0}.pane-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px}.pane-label{font-size:13px;font-weight:700;color:var(--color-text);letter-spacing:.4px}.pane-hint{font-size:12px;color:var(--color-text-light)}
.transfer-input{display:block;width:100%;min-height:254px;margin:0;padding:14px 16px;resize:vertical;border:1px solid var(--color-border);border-radius:14px;background:#f3f6f8;color:var(--color-text);font:inherit;line-height:1.75;outline:none;transition:border-color .2s ease,box-shadow .2s ease,background .2s ease}.transfer-input.active,.transfer-input:focus{border-color:var(--color-secondary);background:#fff;box-shadow:0 0 0 4px rgba(74,111,200,.1)}.input-help{margin:8px 2px 0;color:var(--color-text-light);font-size:12px}
.result-table{display:grid;grid-template-columns:minmax(128px,auto) minmax(90px,1fr) 42px;overflow:hidden;min-height:254px;border:1px solid #dfe4e0;border-radius:14px;background:#fff}.result-row{display:contents}.result-row:not(:first-child) .result-label,.result-row:not(:first-child) .result-value,.result-row:not(:first-child) .copy-button{border-top:1px solid #cbd2cd}.result-label,.result-value,.copy-button{display:flex;align-items:center;min-height:50px;box-sizing:border-box}.result-label{padding:10px 14px;border-right:1px solid #cbd2cd;color:#68716a;background:#f6f6f6;font-size:.88rem;white-space:nowrap}.result-value{min-width:0;padding:10px 8px 10px 16px;border:0;color:#2d342f;background:#fff;font-family:'Charis SIL','Cambria','Cambria Math',serif;font-size:1.12rem;text-align:left;cursor:pointer}.result-values{display:flex;align-items:baseline;gap:4px}.result-values--aligned{display:inline-grid;column-gap:4px}.result-unit{white-space:nowrap}.result-value:hover,.result-value:hover+.copy-button,.copy-button:hover{color:#2e7245;background:#f7faf8}.copy-button{justify-content:center;width:42px;padding:0;border:0;color:#9aa29c;background:#fff;cursor:pointer}.copy-button svg{width:17px;height:17px}.result-value :deep(.rt-pinyin),.result-value :deep(.rt-ipa){font-size:1em;line-height:inherit}.result-empty{display:flex;align-items:center;justify-content:center;min-height:254px;padding:14px 16px;border:1px dashed #d5dde5;border-radius:14px;background:#eef2f4;color:var(--color-text-light);font-size:14px;text-align:center}
@media(max-width:750px){.transfer-body{grid-template-columns:1fr}.transfer-input{min-height:180px}.result-table,.result-empty{min-height:180px}}
@media(max-width:500px){.pinyin-transfer{padding:18px 14px}.result-table{grid-template-columns:minmax(0,1fr) 42px}.result-label{grid-column:1/-1;min-height:0;padding:9px 14px 5px;border-right:0}.result-row:not(:first-child) .result-label{border-top:1px solid #cbd2cd}.result-row:not(:first-child) .result-value,.result-row:not(:first-child) .copy-button{border-top:0}.result-value{padding:5px 8px 12px 14px}.copy-button{padding-bottom:7px}}
</style>
