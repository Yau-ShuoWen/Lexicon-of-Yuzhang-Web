<!-- PinyinTable -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatRichText } from '../../utils/textFormatter.js'
import { showError } from '../../services/ToastService.js'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";
import PinyinDetail from "./PinyinDetail.vue";
import { useHead } from '@vueuse/head'
import { useI18n } from "vue-i18n";


const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const {t} = useI18n()

const pinyinData = ref([])
const loading = ref(true)
const showDetail = ref(false)
const currentKey = ref('')

useHead({
  title: () => `${t('dialect_about.pinyin_table.' + dialect.value)}`
})


// 生命周期
onMounted(fetchTable)

async function fetchTable() {
  try {
    loading.value = true
    const res = await fetch(`/api/pinyin/table/${dialect.value}/${language.value}`)
    if (!res.ok) throw new Error(res.status)

    const data = await res.json()
    pinyinData.value = data.table

  } catch (e) {
    console.error(e)
    showError('加载拼音表失败')
  }
  finally {
    loading.value = false
  }
}

function handleItemClick(item) {
  if (!item.exist) return

  currentKey.value = item.id
  showDetail.value = true
}

/* 显示规则 */
function formatDisplay(item) {

  if (!item.exist) return ''

  const s = item.standard?.trim() || ''

  try {
    return formatRichText(` ${s} `)
  } catch {
    return s
  }
}

/* ---------- 监听路由变化 ---------- */
watch(dialect, fetchTable)
</script>


<template>
  <div class="broaden-layout pinyin-layout">

    <!-- ===== Hero 标题区 ===== -->
    <header class="pinyin-hero">

      <h1 class="hero-title">
        <span class="hero-dialect">{{ $t('dialect.' + dialect) }}</span>
        <span class="hero-title-main">{{ $t('pinyin_table.title') }}</span>
      </h1>

      <p class="hero-subtitle">{{ $t('pinyin_table.subtitle') }}</p>

      <div class="hero-hint">
        <span class="hint-icon">i</span>
        <span v-formatted-text="$t('pinyin_table.hint')"/>
      </div>

    </header>

    <LoadingIcon v-if="loading"/>

    <div v-else class="pinyin-container">


      <div class="this-table-block">
        <div
            v-for="(grid, gridIndex) in pinyinData"
            :key="grid.code"
            class="attribute-group"
            :class="'accent-' + (gridIndex % 3)"
            :style="{ animationDelay: (gridIndex * 120) + 'ms' }"
        >

          <div class="group-header">
            <h3>{{ grid.name }}</h3>
          </div>

          <div v-for="line in grid.line" :key="line.id" class="pinyin-line">
            <div v-for="group in line.group" :key="group.id" class="pinyin-group">
              <div class="items-grid">

                <div
                    v-for="(item, itemIndex) in group.item"
                    :key="item.id"
                    class="item-box clickable"
                    :class="{ invalid: !item.exist }"
                    :style="{ animationDelay: (itemIndex * 35) + 'ms' }"
                    @click="handleItemClick(item)"
                >
                  <div
                      class="main-display"
                      v-html="formatDisplay(item)"
                  />
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
  <PinyinDetail
      :show="showDetail"
      :dialect="dialect.toString()"
      :language="language.toString()"
      :pinyinKey="currentKey"
      @close="showDetail = false"
  />
</template>


<style>


/* ======== Hero 标题区 ======== */
.pinyin-hero {
  position: relative;
  overflow: hidden;
  border-radius: var(--border-radius-xl);
  padding: 32px 28px 26px;
  margin-bottom: 18px;
  color: #fff;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-lg);
  animation: heroIn 0.6s ease both;
}

/* 装饰圆 */
.pinyin-hero::before,
.pinyin-hero::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.pinyin-hero::before {
  width: 220px;
  height: 220px;
  right: -60px;
  top: -90px;
  background: rgba(255, 255, 255, 0.12);
}

.pinyin-hero::after {
  width: 140px;
  height: 140px;
  left: -40px;
  bottom: -70px;
  background: rgba(255, 255, 255, 0.08);
}

.hero-badge {
  position: relative;
  z-index: 1;
  display: inline-block;
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 13px;
  letter-spacing: 3px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.35);
  margin-bottom: 12px;
}

.hero-title {
  position: relative;
  z-index: 1;
  margin: 0 0 8px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.3;
  text-shadow: 0 2px 10px rgba(255, 255, 255, 0.15);
}

/* 方言名（如“南昌话”） */
.hero-dialect {
  color: #ffffff;
  margin-right: 8px;
}

/* “方言拼音表”胶囊 */
.hero-title-main {
  display: inline-block;
  vertical-align: middle;
  padding: 3px 14px;
  border-radius: 999px;
  font-size: 19px;
  font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.hero-subtitle {
  position: relative;
  z-index: 1;
  margin: 0 0 16px;
  font-size: 14px;
  opacity: 0.92;
  line-height: 1.6;
}

.hero-hint {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.4);
  font-size: 13px;
  backdrop-filter: blur(4px);
}

.hint-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border-radius: 50%;
  background: #fff;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  font-style: normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* ======== 图例 ======== */
.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  padding: 4px 4px 6px;
  font-size: 13px;
  color: var(--color-text-light);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.legend-dot {
  width: 13px;
  height: 13px;
  border-radius: 4px;
}

.valid-dot {
  background: linear-gradient(180deg, #ffffff 0%, #e6f4e2 100%);
  border: 1px solid var(--color-primary-light);
}

.invalid-dot {
  background: #fafbfc;
  border: 1px dashed #cbd2d9;
}

/* ======== 分组卡片 ======== */
.attribute-group {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xl);

  padding: 22px 20px;
  box-shadow: var(--shadow-sm);
  animation: fadeInUp 0.55s ease both;
  transition: box-shadow var(--transition-base);
}


.attribute-group:hover {
  box-shadow: var(--shadow-md);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

/* 左侧强调条 */
.group-header::before {
  content: '';
  width: 6px;
  height: 22px;
  border-radius: 4px;
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.3);
}

/* 分组强调色循环 */
.accent-0 .group-header::before {
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.3);
}

.accent-1 .group-header::before {
  background: var(--color-secondary);
  box-shadow: 0 2px 6px rgba(74, 111, 200, 0.3);
}

.accent-2 .group-header::before {
  background: var(--color-accent);
  box-shadow: 0 2px 6px rgba(243, 96, 72, 0.3);
}

.group-header h3 {
  margin: 0;
  font-size: 19px;
  color: #34495e;
  font-weight: 700;
  letter-spacing: 1px;
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
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #f2f9f0 100%);
  border: 1.5px solid #d6e6d2;
  border-radius: 10px;

  padding: 12px 6px;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;

  /* 入场动画：opacity 0 + 错峰 delay（内联） */
  opacity: 0;
  animation: itemIn 0.45s ease forwards;

  transition: transform 0.25s ease, box-shadow 0.25s ease,
  border-color 0.25s ease, background 0.25s ease;
}

/* ======== 可点击态 ======== */
.item-box.clickable {
  cursor: pointer;
}

/* 悬浮：上浮 + 放大 + 高亮 */
.item-box.clickable:not(.invalid):hover {
  transform: translateY(-4px) scale(1.05);
  border-color: var(--color-primary);
  background: linear-gradient(180deg, #ffffff 0%, #e6f4e2 100%);
  box-shadow: 0 8px 18px rgba(46, 125, 50, 0.18);
  z-index: 2;
}

/* 按下：轻微回缩 */
.item-box.clickable:not(.invalid):active {
  transform: translateY(-1px) scale(0.98);
  box-shadow: 0 3px 8px rgba(46, 125, 50, 0.15);
}

/* 光泽扫过 */
/*.item-box.clickable:not(.invalid)::after {
  content: '';
  position: absolute;
  top: 0;
  left: -80%;
  width: 50%;
  height: 100%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: skewX(-20deg);
  opacity: 0;
  transition: left 0.5s ease, opacity 0.2s ease;
}*/

.item-box.clickable:not(.invalid):hover::after {
  left: 130%;
  opacity: 1;
}

/* ======== invalid ======== */
.item-box.invalid {
  background: #f0f2f4;
  border: 1px dashed #d3d9df;
  box-shadow: none;
  pointer-events: none;
}

.item-box.invalid .main-display {
  color: #b6bec7;
}

/* ======== 文字 ======== */
.main-display {
  font-size: 20px;
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

.this-table-block {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ======== 入场动画 ======== */
@keyframes heroIn {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

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
  width: 1088px;
  margin-bottom: 50px;
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

  .hero-title-main {
    font-size: 16px;
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