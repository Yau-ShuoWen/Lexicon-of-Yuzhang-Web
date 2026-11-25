<!-- PinyinTable -->
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showError } from '../../services/ToastService.js'
import PinyinTableSkeleton from './PinyinTableSkeleton.vue'
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { request } from '../../services/request.js'
import PinyinTransfer from './PinyinTransfer.vue'
import TextInfo from '../../components/Status/TextInfo.vue'
import { tableFromDocument } from '../../utils/pinyinDocument.js'
import leftIcon from '../../assets/icons/to-left.svg'
import rightIcon from '../../assets/icons/to-right.svg'


const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const {t} = useI18n()

const pinyinData = ref([])
const faq = ref([])
const panels = ['table', 'input', 'transfer', 'faq']
const storageKey = 'pinyin-panel'
const savedPanel = localStorage.getItem(storageKey)
const activePanel = ref(panels.includes(savedPanel) ? savedPanel : 'table')
const hasSwitchedPanel = ref(false)
const panelTitle = computed(() => ({ table: `${t('dialect.' + dialect.value)}${t('pinyin_table.title')}`, input: t('pinyin_table.input_title', { dialect: t('dialect.' + dialect.value) }), transfer: t('pinyin_table.transfer_title'), faq: t('pinyin_table.faq_title') })[activePanel.value])
function switchPanel(direction) {
  selectedItemId.value = null
  hasSwitchedPanel.value = true
  const index = panels.indexOf(activePanel.value)
  activePanel.value = panels[(index + direction + panels.length) % panels.length]
  localStorage.setItem(storageKey, activePanel.value)
}
const loading = ref(true)
const showSkeleton = ref(false)
const selectedItemId = ref(null)
const currentChildren = ref([])
const popoverStyle = ref({})
const popoverRef = ref(null)
let selectedButton = null
let skeletonTimer = null

const hasData = computed(() => pinyinData.value.length > 0)

useHead({
  title: () => `${t('dialect_about.pinyin_table.' + dialect.value)}`
})

function startLoading() {
  loading.value = true
  showSkeleton.value = false
  clearTimeout(skeletonTimer)
  skeletonTimer = setTimeout(() => {
    if (loading.value && !hasData.value) showSkeleton.value = true
  }, 160)
}

function stopLoading() {
  loading.value = false
  showSkeleton.value = false
  clearTimeout(skeletonTimer)
}


// 生命周期
onMounted(fetchTable)
onMounted(() => {
  window.addEventListener('scroll', closeChildren, true)
  window.addEventListener('resize', closeChildren)
  document.addEventListener('pointerdown', closeOnOutsidePointer)
})
onUnmounted(() => {
  window.removeEventListener('scroll', closeChildren, true)
  window.removeEventListener('resize', closeChildren)
  document.removeEventListener('pointerdown', closeOnOutsidePointer)
})

function closeChildren() {
  selectedItemId.value = null
  selectedButton = null
}

function closeOnOutsidePointer(event) {
  if (selectedItemId.value === null) return
  if (popoverRef.value?.contains(event.target) || selectedButton?.contains(event.target)) return
  closeChildren()
}

async function fetchTable() {
  try {
    startLoading()
    closeChildren()
    const document = await request(`/api/pinyin/document/${dialect.value}`)
    faq.value = document?.faq || []
    if (document) pinyinData.value = tableFromDocument(document, language.value)
    else {
      const data = await request(`/api/pinyin/table/${dialect.value}/${language.value}`)
      pinyinData.value = data.table
    }

  } catch (e) {
    console.error(e)
    showError(t('pinyin_table.load_failed'))
  }
  finally {
    stopLoading()
  }
}

function handleItemClick(item, event) {
  if (!item.exist || !item.children || item.children.length <= 1) return
  if (selectedItemId.value === item.id) {
    closeChildren()
    return
  }
  selectedButton = event.currentTarget
  currentChildren.value = item.children
  const rect = event.currentTarget.getBoundingClientRect()
  const mobile = window.innerWidth <= 500
  const cellWidth = rect.width
  const padding = mobile ? 8 : 12
  const gap = 6
  const maxColumns = Math.max(1, Math.floor((window.innerWidth - 16 - padding * 2 + gap) / (cellWidth + gap)))
  const columns = Math.min(item.children.length, maxColumns)
  const contentWidth = columns * cellWidth + (columns - 1) * gap + padding * 2
  const rows = Math.ceil(item.children.length / columns)
  const height = rows * rect.height + (rows - 1) * gap + padding * 2
  const above = rect.top >= height + 8 || rect.top > window.innerHeight - rect.bottom
  const availableHeight = Math.max(52, above ? rect.top - 16 : window.innerHeight - rect.bottom - 16)
  const width = Math.min(window.innerWidth - 16, contentWidth + (height > availableHeight ? 16 : 0))
  const groupRect = event.currentTarget.closest('.attribute-group')?.getBoundingClientRect()
  const center = mobile && columns === maxColumns && maxColumns >= 3 && groupRect
    ? groupRect.left + groupRect.width / 2
    : rect.left + rect.width / 2
  const left = Math.max(8, Math.min(center - width / 2, window.innerWidth - width - 8))
  popoverStyle.value = {
    '--child-columns': columns,
    '--child-width': `${cellWidth}px`,
    '--popover-padding': `${padding}px`,
    left: `${left}px`,
    top: above ? 'auto' : `${rect.bottom + 8}px`,
    bottom: above ? `${window.innerHeight - rect.top + 8}px` : 'auto',
    width: `${width}px`,
    maxHeight: `${availableHeight}px`
  }
  selectedItemId.value = item.id
}

/* ---------- 监听路由变化 ---------- */
watch([dialect, language], fetchTable)
</script>


<template>
  <div class="broaden-layout pinyin-layout">

    <!-- ===== Hero 标题区 ===== -->
    <header class="pinyin-hero">

      <h1 class="hero-title">
        {{ panelTitle }}
      </h1>

      <nav class="panel-navigation" :aria-label="$t('pinyin_table.panel_navigation')">
        <button type="button" :aria-label="$t('pinyin_table.previous_panel')" @click="switchPanel(-1)"><img :src="leftIcon" alt="" /></button>
        <button type="button" :aria-label="$t('pinyin_table.next_panel')" @click="switchPanel(1)"><img :src="rightIcon" alt="" /></button>
      </nav>

    </header>

    <div v-show="activePanel === 'table'" class="pinyin-content-host">
      <PinyinTableSkeleton v-if="showSkeleton && !hasSwitchedPanel" key="skeleton" />

      <div v-else-if="hasData" key="content" class="pinyin-container">
        <div class="this-table-block">
          <div
              v-for="(grid, gridIndex) in pinyinData"
              :key="grid.id || grid.code + '-' + gridIndex"
              class="attribute-group"
              :class="['accent-' + (gridIndex % 3), { 'initial-enter': !hasSwitchedPanel }]"
              :style="{ animationDelay: (gridIndex * 120) + 'ms' }"
          >

            <div class="pinyin-group-header">
              <h3>{{ grid.name }}</h3>
            </div>

            <div v-for="line in grid.line" :key="line.id" class="pinyin-line">
              <div v-for="group in line.group" :key="group.id" class="pinyin-group">
                <div class="items-grid">

                  <button
                      v-for="(item, itemIndex) in group.item"
                      :key="item.id"
                      class="item-box"
                      :class="{ invalid: !item.exist, 'initial-item-enter': !hasSwitchedPanel, selected: selectedItemId === item.id }"
                      type="button"
                      :disabled="!item.exist"
                      :style="{ animationDelay: (itemIndex * 35) + 'ms' }"
                      @click="handleItemClick(item, $event)"
                  >
                    <div class="main-display" v-formatted-text="item.standard"/>
                  </button>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-show="activePanel === 'input'" class="panel-content">
      <div v-if="showSkeleton && !hasSwitchedPanel" class="panel-skeleton">
        <section class="skeleton-card"><div class="skeleton-heading"><span class="skeleton-title shimmer" /></div><span class="skeleton-line shimmer" /></section>
      </div>
      <template v-else>
        <section class="input-guide" :class="{ 'initial-enter': !hasSwitchedPanel }" :aria-label="$t('pinyin_table.input_guide')">
          <div class="pinyin-group-header"><h3>{{ $t('pinyin_table.input_guide') }}</h3></div>
          <TextInfo :dialect="dialect.toString()" :language="language.toString()" :text-key="`pinyin-explain:${dialect}`" />
        </section>
      </template>
    </div>
    <div v-show="activePanel === 'transfer'" class="panel-content">
      <PinyinTransfer :class="{ 'initial-enter': !hasSwitchedPanel }" :dialect="dialect.toString()" :language="language.toString()" />
    </div>
    <section v-if="showSkeleton && !hasSwitchedPanel" v-show="activePanel === 'faq'" class="skeleton-card" aria-hidden="true"><div class="skeleton-heading"><span class="skeleton-title shimmer" /></div><span class="skeleton-line shimmer" /></section>
    <section v-else v-show="activePanel === 'faq'" class="pinyin-faq" :class="{ 'initial-enter': !hasSwitchedPanel }" :aria-label="$t('pinyin_table.faq_title')">
      <div class="pinyin-group-header"><h3>{{ $t('pinyin_table.faq_title') }}</h3></div>
      <div v-if="!faq.length" class="pinyin-faq__fallback">
        <details><summary>{{ $t('pinyin_table.faq_detail_question') }}</summary><p>{{ $t('pinyin_table.faq_detail_answer') }}</p></details>
        <details><summary>{{ $t('pinyin_table.faq_transfer_question') }}</summary><p>{{ $t('pinyin_table.faq_transfer_answer', { dialect: $t('dialect.' + dialect) }) }}</p></details>
        <details><summary>{{ $t('pinyin_table.faq_tone_question') }}</summary><p>{{ $t('pinyin_table.faq_tone_answer') }}</p></details>
      </div>
      <details v-for="entry in faq" :key="entry.id" class="pinyin-faq__item">
        <summary><span v-formatted-text="entry.question?.[language] || entry.question?.sc || ''" /></summary>
        <div class="pinyin-faq__answer" v-formatted-text="entry.answer?.[language] || entry.answer?.sc || ''" />
      </details>
    </section>
  </div>
  <Teleport to="body">
    <div v-if="selectedItemId !== null" ref="popoverRef" class="pinyin-children-popover" :style="popoverStyle" role="region" :aria-label="$t('pinyin_table.detail_title')">
      <div class="pinyin-children-row">
        <div v-for="child in currentChildren" :key="child.id" class="item-box child-box">
          <div class="main-display" v-formatted-text="child.title ? ` [${child.title}] ` : child.key" />
        </div>
      </div>
    </div>
  </Teleport>
</template>


<style scoped>


.pinyin-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 116px;
  box-sizing: border-box;
  border: 1px solid #b9d8bf;
  border-radius: var(--border-radius-lg);
  padding: 28px;
  margin-bottom: 18px;
  color: var(--color-text);
  background: #d5ebd8;
  box-shadow: 0 2px 8px rgba(27, 67, 31, .06);
  user-select: none;
  -webkit-user-select: none;
}

.hero-title {
  margin: 0;
  color: #245c35;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.3;
}

.panel-navigation {
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
}
.panel-navigation button {
  width: 42px;
  height: 42px;
  padding: 0;
  border: 0;
  border-radius: 11px;
  background: rgba(36, 92, 53, .12);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.panel-navigation button img { width: 16px; height: 16px; opacity: .65; }
.panel-navigation button:hover, .panel-navigation button:focus-visible { background: rgba(36, 92, 53, .28); }
.panel-navigation button:hover img, .panel-navigation button:focus-visible img { opacity: 1; }
.panel-content { min-width: 0; }
.input-guide { min-width: 0; padding: 22px 20px; border: 1px solid var(--pinyin-card-border); border-radius: var(--border-radius-lg); background: #fff; box-shadow: var(--pinyin-card-shadow); }
.input-guide p { margin: 0; }
.pinyin-faq__fallback details { border-top: 1px solid #dce8dd; }
.pinyin-faq__fallback summary { padding: 14px 2px; cursor: pointer; font-weight: 650; }
.pinyin-faq__fallback p { margin: 0; padding: 0 2px 16px; line-height: 1.7; }

/* ======== 分组卡片 ======== */
.attribute-group {
  background: #fff;
  border: 1px solid var(--pinyin-card-border);
  border-radius: var(--border-radius-lg);

  padding: 22px 20px;
  box-shadow: var(--pinyin-card-shadow);
}
.initial-enter { animation: fadeInUp .55s ease both; }

.pinyin-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  user-select: none;
  -webkit-user-select: none;
}

/* 分组标记 */
.pinyin-group-header::before {
  content: '';
  width: 6px;
  height: 22px;
  border-radius: 4px;
  background: var(--color-primary);
}

.accent-1 .pinyin-group-header::before {
  background: var(--color-secondary);
}

.accent-2 .pinyin-group-header::before {
  background: var(--color-accent);
}

.pinyin-group-header h3 {
  margin: 0;
  font-size: 19px;
  color: var(--color-text);
  font-weight: 700;
}

/* ======== Line（跨Group容器）======= */
/* 这一层决定：不同Line绝不混排 */
.pinyin-line {
  display: flex;
  flex-wrap: wrap;
  gap: 30px; /* Group之间横向距离 */
  margin-bottom: 26px; /* Line之间纵向距离 */
}

.pinyin-line:last-child {
  margin-bottom: 0;
}

/* ======== Group（不可拆单位）======= */
/* 这一层决定：Group内部不会被压缩拆开 */
.pinyin-group {
  flex: 0 0 auto;
  display: inline-block;
}

/* ======== Group内部Item排列 ======== */
/* 这一层决定：Group内部更紧凑 */
.items-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 76px;
  gap: 6px; /* Group内部Item间距 */
}

/* ======== Item ======== */
.item-box {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  background: #f7faf7;
  border: 1px solid #d6e6d2;
  border-radius: var(--border-radius-md);

  padding: 6px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  font: inherit;

  cursor: pointer;
  transition: border-color .18s ease, background .18s ease;
}
.initial-item-enter { opacity: 0; animation: itemIn .45s ease forwards; }

.item-box:not(:disabled):hover,
.item-box:not(:disabled):focus-visible {
  border-color: var(--color-primary);
  background: #edf5ed;
}

.item-box:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.item-box.selected { border-color: var(--color-primary); background: #edf5ed; }
.pinyin-children-popover {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  padding: var(--popover-padding, 12px);
  border: 1px solid #b9d8bf;
  border-radius: var(--border-radius-lg);
  background: #fff;
  box-shadow: 0 7px 20px rgba(27, 67, 31, .17), 0 2px 5px rgba(27, 67, 31, .08);
  overflow-y: auto;
  overflow-x: hidden;
}
.pinyin-children-row { display: grid; grid-template-columns: repeat(var(--child-columns, 1), var(--child-width, 76px)); gap: 6px; }
.child-box { width: var(--child-width, 76px); cursor: default; }
.item-box.child-box:hover { border-color: #d6e6d2; background: #f7faf7; }

/* ======== invalid ======== */
.item-box.invalid {
  background: #f0f2f4;
  border: 1px dashed #d3d9df;
  box-shadow: none;
  cursor: default;
}

.item-box.invalid .main-display {
  color: #b6bec7;
}

/* ======== 文字 ======== */
.main-display {
  font-family: 'Cambria', 'Cambria Math', serif;
  font-size: 22px;
  text-align: center;
  color: var(--color-text);
  line-height: 1;
  user-select: none;
  -webkit-user-select: none;
}

.pinyin-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pinyin-content-host {
  min-width: 0;
}
.pinyin-faq { padding: 22px 20px; border: 1px solid var(--pinyin-card-border); border-radius: var(--border-radius-lg); background: #fff; box-shadow: var(--pinyin-card-shadow); }
.pinyin-faq__item { border-top: 1px solid #dce8dd; }
.pinyin-faq__item summary { padding: 14px 2px; color: var(--color-text); font-weight: 650; cursor: pointer; }
.pinyin-faq__answer { padding: 0 2px 16px; color: var(--color-text); line-height: 1.7; white-space: pre-wrap; }
.panel-skeleton { display: grid; gap: 18px; }
.skeleton-card { padding: 22px 20px; border: 1px solid var(--pinyin-card-border); border-radius: var(--border-radius-lg); background: #fff; box-shadow: var(--pinyin-card-shadow); }
.skeleton-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.skeleton-heading::before { content: ''; width: 6px; height: 22px; border-radius: 4px; background: var(--color-primary); }
.accent-1 .skeleton-heading::before { background: var(--color-secondary); }
.skeleton-title { width: 140px; height: 22px; border-radius: var(--border-radius-md); }
.skeleton-line { display: block; width: 100%; height: 52px; border-radius: var(--border-radius-md); }
.shimmer { position: relative; overflow: hidden; background: #eaf0e9; }
.shimmer::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent); animation: skeleton-shimmer 1.35s infinite; }
@keyframes skeleton-shimmer { to { transform: translateX(100%); } }

.this-table-block {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ======== 入场动画 ======== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes itemIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .initial-enter, .initial-item-enter, .shimmer::after { animation: none; opacity: 1; }
}

.pinyin-layout {
  --pinyin-card-border: #d3ddd5;
  --pinyin-card-shadow: 0 1px 5px rgba(27, 67, 31, .035);
  width: 1088px;
  padding-bottom: 100px;
}

@media (max-width: 1105px ) {
  .pinyin-layout {
    width: 754px
  }
}

@media (max-width: 750px ) {
  .pinyin-layout {
    width: 500px
  }
  .pinyin-line {
    flex-direction: column;
    gap: 14px;
    align-items: center;
  }
  .pinyin-group {
    width: 70%;
  }
  .item-box {
    width: auto;
  }
}


/* ======== Mobile Layout ======== */
@media (max-width: 500px) {

  .pinyin-layout {
    width: 100%;
  }

  .pinyin-hero {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) 42px;
    align-items: center;
    column-gap: 12px;
    min-height: 108px;
    padding: 20px 18px;
  }
  .panel-navigation {
    grid-column: 1 / -1;
    grid-row: 1;
    width: 100%;
    justify-content: space-between;
    pointer-events: none;
  }
  .panel-navigation button { pointer-events: auto; }

  .hero-title {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
    margin: 0;
    font-size: clamp(16px, 5.5vw, 24px);
    text-align: center;
    overflow-wrap: anywhere;
  }

  /* 每行只有一个 group */
  .pinyin-line {
    flex-direction: column;
    gap: 14px;
  }

  .pinyin-group {
    width: 100%;
  }

  /* item 平均分配宽度 */
  .items-grid {
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
  }
}
</style>
<!--/-->
