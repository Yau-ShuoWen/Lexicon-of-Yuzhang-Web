<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { request } from '../../services/request.js'
import { formatRichText } from '../../utils/textFormatter.js'
import PinyinResultTable from '../../components/Text/PinyinResultTable.vue'

const props = defineProps({
  dialect: { type: String, required: true },
  language: { type: String, required: true }
})

const input = ref('')
const rows = ref([])
const loading = ref(false)
const failed = ref(false)
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

function handleInput() {
  window.clearTimeout(timer)
  timer = window.setTimeout(transfer, 250)
}

watch(() => [props.dialect, props.language], () => {
  window.clearTimeout(timer)
  void transfer()
})

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

        <PinyinResultTable v-if="rows.length" :pairs="rows" appearance="panel" compact-at="500" />
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
.result-empty{display:flex;align-items:center;justify-content:center;min-height:254px;padding:14px 16px;border:1px dashed #d5dde5;border-radius:14px;background:#eef2f4;color:var(--color-text-light);font-size:14px;text-align:center}
@media(max-width:750px){.transfer-body{grid-template-columns:1fr}.transfer-input,.result-empty{min-height:180px}}
@media(max-width:500px){.pinyin-transfer{padding:18px 14px}}
</style>
