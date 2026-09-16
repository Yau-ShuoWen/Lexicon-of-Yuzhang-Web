<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatRichText } from '../../utils/textFormatter.js'

const props = defineProps({
  code: { type: String, required: true },
  language: { type: String, required: true },
  name: { type: String, required: true },
  funName: { type: String, required: true }
})
const {t} = useI18n()

const input = ref('')
const output = ref('')
const inputEl = ref(null)
const outputHeight = ref(220)
let timer = null
let resizeObserver = null

const hasInput = computed(() => input.value.trim().length > 0)
const hasOutput = computed(() => output.value.trim().length > 0)
const hasTableOutput = computed(() =>
  formatRichText(output.value)?.includes('<table class="rt-table">') === true
)

async function transferText() {
  if (!input.value.trim()) {
    output.value = ''
    return
  }

  try {
    const res = await fetch(
      `/api/alphabet/transfer/${props.code}/${props.language}` +
      `?funName=${encodeURIComponent(props.funName)}` +
      `&s=${encodeURIComponent(input.value)}`
    )

    if (!res.ok) throw new Error(res.status)
    output.value = await res.text()
  } catch (e) {
    console.error(e)
    output.value = t('alphabet_transfer.failed')
  }
}

function handleInput() {
  clearTimeout(timer)
  timer = setTimeout(transferText, 250)
}

watch(() => [props.code, props.language, props.funName], () => {
  input.value = ''
  output.value = ''
  clearTimeout(timer)
})

function syncOutputHeight() {
  if (!inputEl.value) return
  outputHeight.value = Math.max(220, Math.round(inputEl.value.offsetHeight))
}

onMounted(() => {
  syncOutputHeight()

  if (!window.ResizeObserver || !inputEl.value) return

  resizeObserver = new ResizeObserver(() => {
    syncOutputHeight()
  })

  resizeObserver.observe(inputEl.value)
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
  <div class="transfer-item">
    <div class="transfer-head">
      <div>
        <div class="transfer-chip">
          {{ name }}
        </div>
      </div>
    </div>

    <div class="transfer-body">
      <div class="transfer-field">
        <div class="pane-top">
          <span class="pane-label">{{ $t('alphabet_transfer.input') }}</span>
        </div>
        <textarea
          ref="inputEl"
          v-model="input"
          class="form-control pinyin-input-text"
          :class="{ active: hasInput }"
          rows="5"
          :placeholder="$t('alphabet_transfer.input_placeholder')"
          @input="handleInput"
        />
      </div>

      <div class="transfer-field">
        <div class="pane-top">
          <span class="pane-label">{{ $t('alphabet_transfer.result') }}</span>
          <span class="pane-hint">{{ hasOutput ? $t('alphabet_transfer.updated') : $t('alphabet_transfer.waiting') }}</span>
        </div>

        <div
          v-if="hasOutput"
          class="transfer-output"
          :class="{ active: hasOutput, 'table-output': hasTableOutput }"
          :style="{ height: `${outputHeight}px` }"
          v-formatted-text="output"
        />
        <div v-else class="transfer-empty" :style="{ height: `${outputHeight}px` }">
          {{ $t('alphabet_transfer.result_placeholder') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transfer-item {
  position: relative;
  padding: 22px 0;
  border-top: 1px solid rgba(74, 111, 200, 0.12);
}

.transfer-item::before {
  content: none;
}

.transfer-item:first-child {
  padding-top: 0;
  border-top: none;
}

.transfer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.transfer-title {
  margin-bottom: 4px;
  font-size: 18px;
  font-weight: 700;
  color: #34495e;
}

.transfer-note {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-light);
  line-height: 1.5;
}

.transfer-chip {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(74, 111, 200, 0.08);
  border: 1px solid rgba(74, 111, 200, 0.16);
  color: var(--color-secondary);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.transfer-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.transfer-field {
  min-width: 0;
}

.pane-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 8px;
}

.pane-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.4px;
}

.pane-hint {
  font-size: 12px;
  color: var(--color-text-light);
}

.pinyin-input-text {
  margin: 0;
  width: 100%;
  min-height: 220px;
  padding: 14px 16px;
  resize: vertical;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #f3f6f8;
  line-height: 1.75;
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.pinyin-input-text.active,
.pinyin-input-text:focus {
  border-color: var(--color-secondary);
  box-shadow: 0 0 0 4px rgba(74, 111, 200, 0.10);
  background: #ffffff;
}

.transfer-output {
  padding: 14px 16px;
  background: #f1f5f2;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
}

.transfer-output.active {
  border-color: rgba(46, 125, 50, 0.28);
  box-shadow: 0 8px 18px rgba(46, 125, 50, 0.08);
}

.transfer-output.table-output {
  padding: 0;
  overflow: hidden;
  white-space: normal;
  background: #ffffff;
}

.transfer-output.table-output :deep(.rt-table-wrap) {
  width: 100%;
  max-width: none;
  height: 100%;
  padding-bottom: 0;
  overflow: auto;
  scrollbar-width: none;
}

.transfer-output.table-output :deep(.rt-table-wrap)::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.transfer-output.table-output :deep(.rt-table) {
  width: 100%;
  min-width: 100%;
  height: 100%;
}

.transfer-output.table-output :deep(.rt-table > :first-child > tr:first-child > *) {
  border-top: 0;
}

.transfer-output.table-output :deep(.rt-table > :last-child > tr:last-child > *) {
  border-bottom: 0;
}

.transfer-output.table-output :deep(.rt-table tr > *:first-child) {
  border-left: 0;
}

.transfer-output.table-output :deep(.rt-table tr > *:last-child) {
  border-right: 0;
}

.transfer-output.table-output :deep(.rt-col-nowrap) {
  width: 1px;
  min-width: 0;
  padding-inline: 8px;
  white-space: nowrap;
}

.transfer-empty {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px dashed #d5dde5;
  background: #eef2f4;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-text-light);
  font-size: 14px;
}

@media (max-width: 750px) {
  .transfer-body {
    grid-template-columns: 1fr;
  }

  .transfer-head {
    flex-direction: column;
  }
}

@media (max-width: 500px) {
  .transfer-item {
    padding: 18px 0;
  }

  .transfer-title {
    font-size: 17px;
  }

  .pinyin-input-text {
    min-height: 180px;
  }
}
</style>
