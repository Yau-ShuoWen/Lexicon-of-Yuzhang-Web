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
    failed.value = false
    return
  }

  const controller = new AbortController()
  requestController = controller
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
    <header class="transfer-heading">
      <h2>拼音转换</h2>
    </header>
    <div class="transfer-body">
      <div class="transfer-field">
        <textarea
          v-model="input"
          class="transfer-input"
          :class="{active: hasInput}"
          rows="2"
          :aria-label="$t('pinyin_table.transfer_input_placeholder')"
          :placeholder="$t('pinyin_table.transfer_input_placeholder')"
          @input="handleInput"
        />
      </div>

      <div class="transfer-field">
        <PinyinResultTable v-if="rows.length" :pairs="rows" appearance="panel" />
        <div v-else class="result-empty" role="status" aria-live="polite">
          {{ failed ? $t('pinyin_table.transfer_failed') : $t('alphabet_transfer.result_placeholder') }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pinyin-transfer {
  margin-top: 18px;
  padding: 22px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  background: #fff;
  box-shadow: var(--pinyin-card-shadow);
}

.transfer-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.transfer-heading::before {
  content: '';
  width: 6px;
  height: 22px;
  border-radius: 4px;
  background: var(--color-primary);
}

.transfer-heading h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 19px;
  font-weight: 700;
}

.transfer-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.transfer-field {
  min-width: 0;
  width: 100%;
}

.transfer-input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 78px;
  min-height: 78px;
  margin: 0;
  padding: 12px 16px;
  resize: none;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: #f7faf7;
  color: var(--color-text);
  font: inherit;
  line-height: 1.6;
  outline: none;
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.transfer-input.active,
.transfer-input:focus {
  border-color: var(--color-primary);
  background: #fff;
  box-shadow: 0 0 0 2px rgba(46, 125, 50, .14);
}

.result-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 254px;
  padding: 14px 16px;
  border: 1px dashed #d5dde5;
  border-radius: 14px;
  background: #eef2f4;
  color: var(--color-text-light);
  font-size: 20px;
  text-align: center;
}

@media (max-width: 750px) {
  .result-empty { min-height: 180px; }
}

@media (max-width: 500px) {
  .pinyin-transfer { padding: 18px 14px; }
}
</style>
