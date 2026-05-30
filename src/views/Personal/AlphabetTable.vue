<!-- PinyinTable.vue -->
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatRichText } from '../../utils/textFormatter.js'
import { showError } from '../../services/ToastService.js'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";
import { useHead } from '@vueuse/head'
import { useI18n } from "vue-i18n";

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const {t} = useI18n()

const currentAlphabet = ref(null)
const pinyinData = ref([])
const introduce = ref('')

const loading = ref(false)

const showDetail = ref(false)
const currentKey = ref('')

/**
 * 每个转换器一个输入框
 */
const transferData = ref([])

useHead({
  title: () => `${t('personal.alphabet_table.title')}`
})

/* ======== computed ======== */

const transferList = computed(() =>
    currentAlphabet.value?.trans || []
)

async function fetchTable() {

  const code = route.params.code

  try {
    loading.value = true
    const res = await fetch(`/api/personal/alphabet/table/${code}/${language.value}`)

    if (!res.ok) throw new Error(res.status)

    const data = await res.json()

    introduce.value = data.middle
    currentAlphabet.value = data.left
    pinyinData.value = data.right.table

    /**
     * 初始化每个转换框
     */
    transferData.value = transferList.value.map(i => ({
      name: i.left,
      funName: i.right,
      input: '',
      output: '',
      timer: null
    }))

  } catch (e) {

    console.error(e)
    showError('加载拼音表失败')
  }
  finally {

    loading.value = false
  }
}

/* ======== item ======== */

function handleItemClick(item) {
  if (!item.exist) return

  currentKey.value = item.id
  showDetail.value = true
}

/* ======== display ======== */

function formatDisplay(item) {
  if (!item.exist) return ''
  const s = item.standard?.trim() || ''

  try {
    return formatRichText(` ${s} `)
  } catch {
    return s
  }
}

/* ======== transfer ======== */

async function transferText(item) {

  if (!item.input.trim()) {

    item.output = ''
    return
  }

  try {
    const code = route.params.code
    const res = await fetch(
        `/api/personal/alphabet/transfer/${code}/${language.value}` +
        `?funName=${encodeURIComponent(item.funName)}` +
        `&s=${encodeURIComponent(item.input)}`
    )

    if (!res.ok) throw new Error(res.status)
    item.output = await res.text()

  } catch (e) {
    console.error(e)
    item.output = '转换失败'
  }
}

function handleTransferInput(item) {
  clearTimeout(item.timer)
  item.timer = setTimeout(async () => {
    await transferText(item)
  }, 250)
}

/* ======== watch ======== */

watch(
    () => route.params.code,
    async () => {
      await fetchTable()
    },
    {immediate: true}
)

watch(language, async () => {
  await fetchTable()
})

/* ======== mounted ======== */

onMounted(async () => {
  await fetchTable()
})
</script>

<template>

  <div class="broaden-layout">

    <LoadingIcon v-if="loading"/>

    <div v-else class="pinyin-container">

      <div v-if="introduce?.length" v-formatted-text="introduce" class="text-box"/>

      <!-- ======== transfer ======== -->

      <div
          v-if="transferData.length"
          class="transfer-box"
      >

        <div
            v-for="item in transferData"
            :key="item.funName"
            class="transfer-item"
        >

          <div class="transfer-title">
            {{ item.name }}
          </div>

          <textarea
              v-model="item.input"
              class="form-control pinyin-input-text"
              rows="5"
              placeholder="请输入内容"
              @input="handleTransferInput(item)"
          />

          <div
              v-if="item.output"
              class="transfer-output"
              v-formatted-text="item.output"
          />

        </div>

      </div>

      <!-- ======== table ======== -->

      <div class="table-block">


        <div
            v-for="grid in pinyinData"
            :key="grid.code"
            class="attribute-group"
        >

          <div class="group-header">
            <h3>{{ grid.name }}</h3>
          </div>

          <div
              v-for="line in grid.line"
              :key="line.id"
              class="pinyin-line"
          >

            <div
                v-for="group in line.group"
                :key="group.id"
                class="pinyin-group"
            >

              <div class="items-grid">

                <div
                    v-for="item in group.item"
                    :key="item.id"
                    class="item-box clickable"
                    :class="{ invalid: !item.exist }"
                    @click="handleItemClick(item)"
                >

                  <div class="main-display" v-html="formatDisplay(item)"/>

                </div>

              </div>

            </div>

          </div>

        </div>
      </div>

    </div>

  </div>

</template>

<style>
/* ======== text ======== */

.text-box {
  background: var(--color-background);
  border: 2px solid var(--color-primary-light);
  border-radius: var(--border-radius-md);
  padding: 20px;
  line-height: 1.7;
  color: var(--color-text);
}

/* ======== group ======== */
.attribute-group {

  background: #fff;
  border-radius: 12px;
  padding: 20px 18px;
  /*border: 2px solid var(--color-primary-light);*/
}

.group-header h3 {
  margin: 0;
  font-size: 17px;
  color: #34495e;
  font-weight: 600;
}


/* ======== line ======== */
.pinyin-line {
  display: flex;
  flex-wrap: wrap;
  gap: 30px;
  margin-bottom: 26px;
}

.pinyin-line:last-child {
  margin-bottom: 0;
}

/* ======== group ======== */

.pinyin-group {
  flex: 0 0 auto;
  display: inline-block;
}

/* ======== grid ======== */

.items-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 70px;
  gap: 5px;
}

/* ======== item ======== */

.item-box {
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 12px 8px;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.item-box.clickable {
  cursor: pointer;
}

.item-box.clickable:not(.invalid):hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.item-box.invalid {
  opacity: 0.5;
  background: #f8f9fa;
  border-color: #dee2e6;
  pointer-events: none;
  transform: none !important;
  box-shadow: none !important;
}

.item-box.invalid .main-display {
  color: #adb5bd;
}

/* ======== display ======== */

.main-display {
  font-size: 20px;
  text-align: center;
  color: var(--color-text);
  line-height: 1.25;
}

/* ======== container ======== */

.pinyin-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ======== transfer ======== */

.transfer-box {
  margin-bottom: 20px;
}

.transfer-item {
  margin-bottom: 24px;
}

.transfer-title {
  margin-bottom: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.pinyin-input-text {
  margin: 2px 0 10px 0;
  width: 100%;
}

.transfer-output {
  min-height: 60px;
  padding: 14px;
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  line-height: 1.7;
  white-space: pre-wrap;
}

/* ======== mobile ======== */

@media (max-width: 450px) {
  .pinyin-line {
    flex-direction: column;
    gap: 14px;
  }

  .pinyin-group {
    width: 100%;
  }

  .items-grid {
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
  }

  .pinyin-input-text {
    width: 100%;
  }
}

</style>