<!-- PinyinTable -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showError } from '../../services/ToastService.js'
import PinyinDetail from './PinyinDetail.vue'
import PinyinTableSkeleton from './PinyinTableSkeleton.vue'
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { request } from '../../services/request.js'
import PinyinTransfer from './PinyinTransfer.vue'
import { tableFromDocument } from '../../utils/pinyinDocument.js'
import informationIcon from '../../assets/icons/about.svg'
import leftIcon from '../../assets/icons/to-left.svg'
import rightIcon from '../../assets/icons/to-right.svg'


const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const {t} = useI18n()

const pinyinData = ref([])
const faq = ref([])
const panels = ['table', 'input', 'faq']
const storageKey = 'pinyin-panel'
const savedPanel = localStorage.getItem(storageKey)
const activePanel = ref(panels.includes(savedPanel) ? savedPanel : 'table')
const panelTitle = computed(() => ({ table: `${t('dialect.' + dialect.value)}${t('pinyin_table.title')}`, input: `${t('dialect.' + dialect.value)}输入法`, faq: '常见问题' })[activePanel.value])
function switchPanel(direction) {
  const index = panels.indexOf(activePanel.value)
  activePanel.value = panels[(index + direction + panels.length) % panels.length]
  localStorage.setItem(storageKey, activePanel.value)
}
const loading = ref(true)
const showSkeleton = ref(false)
const showDetail = ref(false)
const currentKey = ref('')
const currentChildren = ref(null)
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

async function fetchTable() {
  try {
    startLoading()
    const document = await request(`/api/pinyin/document/${dialect.value}`)
    faq.value = document?.faq || []
    if (document) pinyinData.value = tableFromDocument(document, language.value)
    else {
      const data = await request(`/api/pinyin/table/${dialect.value}/${language.value}`)
      pinyinData.value = data.table
    }

  } catch (e) {
    console.error(e)
    showError('加载拼音表失败')
  }
  finally {
    stopLoading()
  }
}

function handleItemClick(item) {
  if (!item.exist) return

  currentKey.value = item.id
  currentChildren.value = item.children || null
  showDetail.value = true
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

      <p v-if="activePanel === 'table'" class="hero-hint">
        <img :src="informationIcon" alt="" draggable="false" />
        <span>{{ $t('pinyin_table.hint') }}</span>
      </p>
      <p v-else class="hero-hint">{{ activePanel === 'input' ? '通用赣语拼音方案' : '补充说明' }}</p>

      <nav class="panel-navigation" aria-label="拼音页面切换">
        <button type="button" aria-label="上一个界面" @click="switchPanel(-1)"><img :src="leftIcon" alt="" /></button>
        <button type="button" aria-label="下一个界面" @click="switchPanel(1)"><img :src="rightIcon" alt="" /></button>
      </nav>

    </header>

    <div v-if="activePanel === 'table'" class="pinyin-content-host">
      <PinyinTableSkeleton v-if="showSkeleton" key="skeleton" />

      <div v-else-if="hasData" key="content" class="pinyin-container">
        <div class="this-table-block">
          <div
              v-for="(grid, gridIndex) in pinyinData"
              :key="grid.id || grid.code + '-' + gridIndex"
              class="attribute-group"
              :class="'accent-' + (gridIndex % 3)"
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
                      :class="{ invalid: !item.exist }"
                      type="button"
                      :disabled="!item.exist"
                      :style="{ animationDelay: (itemIndex * 35) + 'ms' }"
                      @click="handleItemClick(item)"
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
    <div v-if="activePanel === 'input'" class="panel-content">
      <section class="input-guide" aria-label="输入法说明">
        <h2>输入法说明</h2>
        <p>南昌话输入法的使用说明将在这里补充。</p>
      </section>
      <PinyinTransfer :dialect="dialect.toString()" :language="language.toString()" />
    </div>
    <section v-if="activePanel === 'faq'" class="pinyin-faq" aria-label="常见问题">
      <h2>常见问题</h2>
      <div v-if="!faq.length" class="pinyin-faq__fallback">
        <details><summary>怎样查看某个拼音的详细信息？</summary><p>在拼音表中点击方格，即可查看该拼音的详细信息。灰色方格不可点击。</p></details>
        <details><summary>怎样使用拼音转换？</summary><p>切换到“南昌话输入法”，在拼音转换框中输入拼音，结果会自动显示在下方。</p></details>
        <details><summary>声调符号标在哪里？</summary><p>有 a、o、e 时标在最后一个上；否则有 i、u、ü 时标在第一个上。只有 m、n、ng 时，分别标在 m、n、n 上。</p></details>
      </div>
      <details v-for="entry in faq" :key="entry.id" class="pinyin-faq__item">
        <summary><span v-formatted-text="entry.question?.[language] || entry.question?.sc || ''" /></summary>
        <div class="pinyin-faq__answer" v-formatted-text="entry.answer?.[language] || entry.answer?.sc || ''" />
      </details>
    </section>
  </div>
  <PinyinDetail
      :show="showDetail"
      :dialect="dialect.toString()"
      :language="language.toString()"
      :pinyinKey="currentKey"
      :documentChildren="currentChildren"
      @close="showDetail = false"
  />
</template>


<style scoped>


.pinyin-hero {
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  padding: 28px;
  margin-bottom: 18px;
  color: var(--color-text);
  background: #c7e4ca;
  box-shadow: var(--pinyin-card-shadow);
  user-select: none;
  -webkit-user-select: none;
}

.hero-title {
  margin: 0 0 14px;
  color: #245c35;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.3;
}

.hero-hint {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  padding: 7px 11px;
  border: 1px solid #a9cfb1;
  border-radius: 999px;
  color: #315f3c;
  background: #e5f3e7;
  font-size: 13px;
  line-height: 1.4;
}

.hero-hint img {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  opacity: .72;
}

.panel-navigation {
  position: absolute;
  right: 28px;
  bottom: 28px;
  display: flex;
  gap: 16px;
}
.panel-navigation button {
  width: 42px;
  height: 42px;
  padding: 0;
  border: 0;
  border-radius: 11px;
  background: #376847;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.panel-navigation button img { width: 12px; height: 12px; filter: brightness(0) invert(1); }
.panel-navigation button:hover, .panel-navigation button:focus-visible { background: #245c35; }
.panel-content { min-width: 0; }
.input-guide { padding: 22px; border: 1px solid var(--color-border); border-radius: var(--border-radius-lg); background: #fff; box-shadow: var(--pinyin-card-shadow); }
.input-guide h2 { margin: 0 0 12px; font-size: 19px; }
.input-guide p { margin: 0; }
.pinyin-faq__fallback details { border-top: 1px solid #dce8dd; }
.pinyin-faq__fallback summary { padding: 14px 2px; cursor: pointer; font-weight: 650; }
.pinyin-faq__fallback p { margin: 0; padding: 0 2px 16px; line-height: 1.7; }

/* ======== 分组卡片 ======== */
.attribute-group {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);

  padding: 22px 20px;
  box-shadow: var(--pinyin-card-shadow);
  animation: fadeInUp 0.55s ease both;
}

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

  opacity: 0;
  animation: itemIn 0.45s ease forwards;

  cursor: pointer;
  transition: border-color .18s ease, background .18s ease;
}

.item-box:not(:disabled):hover,
.item-box:not(:disabled):focus-visible {
  border-color: var(--color-primary);
  background: #edf5ed;
}

.item-box:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

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
.pinyin-faq { margin-top: 30px; padding: 22px; border: 1px solid var(--color-border); border-radius: var(--border-radius-lg); background: #fff; box-shadow: var(--pinyin-card-shadow); }
.pinyin-faq h2 { margin: 0 0 14px; color: #245c35; font-size: 21px; }
.pinyin-faq__item { border-top: 1px solid #dce8dd; }
.pinyin-faq__item summary { padding: 14px 2px; color: var(--color-text); font-weight: 650; cursor: pointer; }
.pinyin-faq__answer { padding: 0 2px 16px; color: var(--color-text); line-height: 1.7; white-space: pre-wrap; }

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

.pinyin-layout {
  --pinyin-card-shadow: 0 3px 12px rgba(27, 67, 31, .09);
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
    padding: 22px 18px 84px;
  }
  .panel-navigation { right: 18px; bottom: 16px; }

  .hero-title {
    font-size: 24px;
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
