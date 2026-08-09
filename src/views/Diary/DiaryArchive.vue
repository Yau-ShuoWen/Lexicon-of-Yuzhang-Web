<script setup>
/**
 * DiaryArchive.vue —— 日记归档侧边栏组件
 *
 * 交互设计：
 * - 年份采用手风琴式折叠，同时只允许展开一个年份；
 *   折叠时仅显示「xx年 · xx篇」，展开后显示 4×3 的月份网格。
 *   点击整块年份区域均可展开/收起（收起后回到原来的紧凑样式）。
 * - 月份格固定展示「x月（换行）x篇」，无内容的月份也照常显示（0篇，置灰禁用）。
 * - 点击有内容的月份格，向外触发 select 事件，由父组件刷新左侧日记列表。
 * - 组件整体吸顶（position: sticky），滚动页面时归档栏固定在右侧不划走。
 */
import { computed, ref, watch } from 'vue'
import LoadingIcon from '../../components/Status/LoadingIcon.vue'

const props = defineProps({
  // 语言：sc 简体 / tc 繁体
  language: { type: String, default: 'sc' },
  // 归档目录数据（由父组件请求）
  catalog: { type: Array, default: () => [] },
  // 是否正在加载目录
  loading: { type: Boolean, default: false },
  // 当前筛选的年份 / 月份（用于高亮激活格）
  activeYear: { type: [String, Number], default: '' },
  activeMonth: { type: [String, Number], default: '' }
})

const emit = defineEmits(['select'])

const isTc = computed(() => props.language === 'tc')

const text = computed(() => ({
  archive: isTc.value ? '目錄歸檔' : '目录归档',
  yearSuffix: isTc.value ? '年' : '年',
  monthSuffix: isTc.value ? '月' : '月',
  countSuffix: isTc.value ? '篇' : '篇',
  noData: isTc.value ? '暫無歸檔資料' : '暂无归档资料',
  emptyMonth: isTc.value ? '本月無日記' : '本月无日记'
}))

// 全部年份的总篇数，显示在面板标题右侧
const totalCount = computed(() =>
    props.catalog.reduce((sum, year) => sum + (year.total || 0), 0)
)

// 当前展开的年份（手风琴：同一时刻只有一个年份展开）
const openYear = ref('')

// 外部筛选年份变化时，自动展开对应年份
watch(
    () => String(props.activeYear || ''),
    (val) => {
      if (val) openYear.value = val
    },
    { immediate: true }
)

function toggleYear(year) {
  const key = String(year)
  openYear.value = openYear.value === key ? '' : key
}

function isActive(year, month) {
  return String(props.activeYear) === String(year)
      && String(props.activeMonth) === String(month)
}

function handleCellClick(year, month, total) {
  if (!total) return
  emit('select', { year: String(year), month: String(month), total })
}

// 将某年份的月份数据补全为固定的 1~12 月（4×3 网格）
// 后端只返回有日记的月份，缺失的月份按 0 篇渲染（置灰禁用格）
function getYearMonths(yearItem) {
  const byMonth = new Map(
      yearItem.months.map(item => [Number(item.month), item.total || 0])
  )
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    return { month, total: byMonth.get(month) || 0 }
  })
}
</script>

<template>
  <section class="diary-archive">
    <header class="diary-archive__head">
      <svg
          class="diary-archive__head-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <span class="diary-archive__title" v-formatted-text="text.archive" />
      <span class="diary-archive__total">{{ totalCount }}{{ text.countSuffix }}</span>
    </header>

    <div v-if="loading" class="diary-archive__loading">
      <LoadingIcon :size="18" :inline="true" :show-text="false" />
    </div>

    <div v-else-if="catalog.length" class="diary-archive__years">
      <div
          v-for="yearItem in catalog"
          :key="`archive-year-${yearItem.year}`"
          class="diary-archive__year"
          :class="{ 'is-open': openYear === String(yearItem.year) }"
          @click="toggleYear(yearItem.year)"
      >
        <button
            type="button"
            class="diary-archive__year-head"
            :aria-expanded="openYear === String(yearItem.year)"
            @click.stop="toggleYear(yearItem.year)"
        >
          <span class="diary-archive__year-name">
            <span class="diary-archive__year-num">{{ yearItem.year }}</span>
            <span class="diary-archive__year-suffix">{{ text.yearSuffix }}</span>
          </span>

          <span class="diary-archive__year-meta">
            <span class="diary-archive__year-total">{{ yearItem.total }}{{ text.countSuffix }}</span>
            <svg
                class="diary-archive__chevron"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </span>
        </button>

        <div class="diary-archive__body">
          <div class="diary-archive__grid">
            <button
                v-for="monthItem in getYearMonths(yearItem)"
                :key="`archive-month-${yearItem.year}-${monthItem.month}`"
                type="button"
                class="diary-archive__cell"
                :class="{
                'is-active': isActive(yearItem.year, monthItem.month),
                'is-empty': !monthItem.total
              }"
                :disabled="!monthItem.total"
                :title="monthItem.total
                ? `${monthItem.month}${text.monthSuffix} · ${monthItem.total}${text.countSuffix}`
                : text.emptyMonth"
                @click.stop="handleCellClick(yearItem.year, monthItem.month, monthItem.total)"
            >
              <span class="diary-archive__cell-month">{{ monthItem.month }}{{ text.monthSuffix }}</span>
              <span class="diary-archive__cell-count">{{ monthItem.total }}{{ text.countSuffix }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="diary-archive__empty" v-formatted-text="text.noData" />
  </section>
</template>

<style scoped>
.diary-archive {
  position: sticky;
  top: 16px;
  background: var(--color-background);
  border: 2px solid var(--color-primary-light);
  border-radius: var(--border-radius-lg);
  padding: 16px 14px;
  box-shadow: 0 6px 18px rgba(46, 125, 50, 0.08);
}

/* ---- 面板头部 ---- */
.diary-archive__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 2px dashed var(--color-border);
}

.diary-archive__head-icon {
  width: 18px;
  height: 18px;
  color: var(--color-primary);
  flex: none;
}

.diary-archive__title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.diary-archive__total {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary-dark);
  background: #eaf7ea;
  border-radius: 999px;
  padding: 2px 10px;
}

/* ---- 年份列表 ---- */
.diary-archive__years {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diary-archive__year {
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: #ffffff;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

/*
  只在折叠状态（未展开）时，悬停整个卡片
  展开时取消悬停效果
*/
@media (hover: hover) {
  .diary-archive__year:not(.is-open):hover {
    background: #f2faf0;
    border-color: var(--color-primary-light);
    box-shadow: 0 2px 8px rgba(46, 125, 50, 0.1);
  }
}

.diary-archive__year.is-open {
  border-color: var(--color-primary-light);
  box-shadow: 0 2px 8px rgba(46, 125, 50, 0.1);
  background: #ffffff; /* 展开时强制白色背景，覆盖悬停效果 */
}

.diary-archive__year-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.2s ease;
}

.diary-archive__year-name {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}

.diary-archive__year-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary-dark);
  letter-spacing: 1px;
}

.diary-archive__year-suffix {
  font-size: 13px;
  color: var(--color-text-light);
}

.diary-archive__year-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.diary-archive__year-total {
  font-size: 12px;
  color: var(--color-text-light);
  background: var(--color-border-light);
  border-radius: 999px;
  padding: 2px 8px;
}

.diary-archive__chevron {
  width: 14px;
  height: 14px;
  color: var(--color-text-lighter);
  transition: transform 0.25s ease, color 0.25s ease;
}

.diary-archive__year.is-open .diary-archive__chevron {
  transform: rotate(180deg);
  color: var(--color-primary);
}

/* ---- 展开动画（grid-template-rows 0fr → 1fr）---- */
.diary-archive__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}

.diary-archive__grid {
  overflow: hidden;
  min-height: 0;
}

.diary-archive__year.is-open .diary-archive__body {
  grid-template-rows: 1fr;
}

/* ---- 4×3 月份网格 ---- */
.diary-archive__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 10px 10px 12px;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.25s ease 0.05s, transform 0.25s ease 0.05s;
}

.diary-archive__year.is-open .diary-archive__grid {
  opacity: 1;
  transform: translateY(0);
}

.diary-archive__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  background: #dbf6d5;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.18s ease;
}

/* 仅在支持悬停的设备上显示 hover 效果（触屏设备点击后不会残留悬停态） */
@media (hover: hover) {
  .diary-archive__cell:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: #d1efca;
    transform: translateY(-2px);
    box-shadow: 0 2px 6px rgba(46, 125, 50, 0.15);
  }

  /* 激活格悬停时保持主色渐变，避免被普通悬停样式覆盖成浅色/白色 */
  .diary-archive__cell.is-active:hover {
    background: var(--gradient-primary);
    border-color: var(--color-primary-dark);
    box-shadow: 0 2px 8px rgba(46, 125, 50, 0.25);
    transform: none;
  }
}

.diary-archive__cell-month {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary-dark);
}

.diary-archive__cell-count {
  font-size: 11px;
  color: var(--color-text-light);
}

/* 无内容的月份：置灰 + 虚线框 */
.diary-archive__cell.is-empty {
  background: #fafafa;
  border-style: dashed;
  color: var(--color-text-lighter);
  cursor: not-allowed;
}

.diary-archive__cell.is-empty .diary-archive__cell-month {
  color: var(--color-text-lighter);
}

/* 当前筛选中的月份：主色渐变高亮 */
.diary-archive__cell.is-active {
  background: var(--gradient-primary);
  border-color: var(--color-primary-dark);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(46, 125, 50, 0.25);
}

.diary-archive__cell.is-active .diary-archive__cell-month,
.diary-archive__cell.is-active .diary-archive__cell-count {
  color: #ffffff;
}

/* ---- 空态 / 加载态 ---- */
.diary-archive__empty {
  padding: 8px 0;
  color: var(--color-text-light);
  line-height: 1.7;
}

.diary-archive__loading {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

/* 窄屏下归档栏位于内容下方，取消吸顶 */
@media (max-width: 500px) {
  .diary-archive {
    position: static;
  }
}
</style>
