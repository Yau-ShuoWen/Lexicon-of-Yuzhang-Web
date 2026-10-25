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


const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const {t} = useI18n()

const pinyinData = ref([])
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
        {{ $t('dialect.' + dialect) }}{{ $t('pinyin_table.title') }}
      </h1>

      <p class="hero-hint">
        <img :src="informationIcon" alt="" draggable="false" />
        <span>{{ $t('pinyin_table.hint') }}</span>
      </p>

    </header>

    <div class="pinyin-content-host">
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
    <PinyinTransfer :dialect="dialect.toString()" :language="language.toString()" />
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
  border-radius: var(--border-radius-md);
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
    padding: 22px 18px 20px;
  }

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
