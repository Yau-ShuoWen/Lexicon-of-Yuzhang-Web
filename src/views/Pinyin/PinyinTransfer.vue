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

function handleInput(event) {
  const field = event.target
  const original = field.value
  const normalized = original.replace(/[\r\n]+/g, ' ')
  if (normalized !== original) {
    const caret = field.selectionStart
    const nextCaret = original.slice(0, caret).replace(/[\r\n]+/g, ' ').length
    field.value = normalized
    field.setSelectionRange(nextCaret, nextCaret)
    input.value = normalized
  }
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
      <div class="transfer-field transfer-input-wrap">
        <div class="transfer-input-marker" aria-hidden="true"></div>
        <textarea
          v-model="input"
          class="transfer-input"
          :class="{active: hasInput}"
          rows="2"
          wrap="off"
          :aria-label="$t('pinyin_table.transfer_input_placeholder')"
          :placeholder="$t('pinyin_table.transfer_input_placeholder')"
          @keydown.enter.prevent
          @input="handleInput"
        />
      </div>

      <div class="transfer-field transfer-results">
        <header class="transfer-results-heading">
          <h2>{{ $t('pinyin_table.transfer_result_title') }}</h2>
        </header>
        <PinyinResultTable v-if="rows.length" :pairs="rows" appearance="transfer" />
        <div v-else class="result-empty" role="status" aria-live="polite">
          {{ failed ? $t('pinyin_table.transfer_failed') : $t('alphabet_transfer.result_placeholder') }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pinyin-transfer {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.transfer-results {
  box-sizing: border-box;
  padding: 22px 20px;
  border: 1px solid var(--pinyin-card-border);
  border-radius: var(--border-radius-lg);
  background: #fff;
  box-shadow: var(--pinyin-card-shadow);
}
.transfer-results-heading { margin-bottom: 14px; }

.transfer-results-heading h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 19px;
  font-weight: 700;
}

.transfer-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.transfer-field {
  min-width: 0;
  width: 100%;
}

.transfer-input-wrap { position: relative; }

.transfer-input-marker {
  position: absolute;
  top: 23px;
  left: 20.5px;
  width: 6px;
  height: 22px;
  border-radius: 4px;
  background: var(--color-primary);
  pointer-events: none;
}

.transfer-input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 142px;
  min-height: 142px;
  margin: 0;
  padding: 60px 20px 12px;
  resize: none;
  border: 1px solid var(--pinyin-card-border);
  border-radius: var(--border-radius-lg);
  background: #fff;
  color: var(--color-text);
  font: inherit;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
  overflow-y: hidden;
  box-shadow: var(--pinyin-card-shadow);
  outline: none;
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.transfer-input.active,
.transfer-input:focus {
  border-color: var(--color-primary);
  background: #fff;
  box-shadow: 0 0 0 2px rgba(46, 125, 50, .14), var(--pinyin-card-shadow);
}

.result-empty {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 64px;
  padding: 14px 0;
  color: var(--color-text-light);
  font-size: 16px;
  text-align: left;
}

@media (max-width: 500px) {
  .transfer-results { padding: 18px 14px; }
}

</style>
