<script setup>

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { showError } from "../../services/ToastService.js";

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

/* ======== 数据 ======== */

const loading = ref(true)
const catalog = ref([])

/* ======== 前端控制的跳转 ======== */

// 页面类型 → 路由构造器：特殊卡片跳转到独立页面，目标完全由前端决定
// 后端返回的普通卡片没有 type 字段 → 走默认的字母表页面
const PAGE_TYPE_ROUTE = {
    // 简体繁体转换 → 独立界面
    'tc-sc': ({language, dialect}) => `/${language}/${dialect}/ysw/alphabet/tc-sc`,
}

// 默认跳转：统一的字母表页面
function defaultCardRoute(language, dialect, item) {
    return `/${language}/${dialect}/ysw/alphabet/${item.url}`
}

// 根据卡片的 type 决定跳转目标
function cardTo(item) {
    const build = PAGE_TYPE_ROUTE[item.type]
    return build
        ? build({language: language.value, dialect: dialect.value})
        : defaultCardRoute(language.value, dialect.value, item)
}

/* ======== 展示目录 ======== */

// 渲染
const displayCatalog = computed(() => {
  return catalog.value.map(g => ({left: g.left, right: g.right}))
})

/* ======== 标题 ======== */

// 逐字入场的标题字符
const bigTitleChars = [...'我会几十门语言']
const smallTitleChars = [...'（的字母）']

// 背景漂浮的装饰字母
const floatingLetters = [
  {ch: 'A', top: '6%', left: '5%', size: 36, delay: 0},
  {ch: 'B', top: '14%', left: '92%', size: 30, delay: 1},
  {ch: 'α', top: '32%', left: '3%', size: 28, delay: 2},
  {ch: 'あ', top: '29%', left: '90%', size: 32, delay: 3},
  {ch: '한', top: '56%', left: '6%', size: 30, delay: 4},
  {ch: 'Ω', top: '50%', left: '90%', size: 26, delay: 5},
  {ch: 'Я', top: '72%', left: '12%', size: 24, delay: 6},
  {ch: 'ح', top: '70%', left: '86%', size: 26, delay: 7},
  {ch: '日', top: '80%', left: '18%', size: 28, delay: 8},
  {ch: 'の', top: '82%', left: '78%', size: 24, delay: 9},
  {ch: 'T', top: '44%', left: '46%', size: 22, delay: 10},
  {ch: 'か', top: '40%', left: '38%', size: 20, delay: 11},
]

/* ======== 计数动画（数量感） ======== */

const totalCount = ref(0)
const shownCount = ref(0)
let countTimer = null

function runCountUp() {
  cancelAnimationFrame(countTimer)
  const target = totalCount.value
  const duration = 1100
  const start = performance.now()

  const step = (now) => {
    const p = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
    shownCount.value = Math.round(eased * target)
    if (p < 1) countTimer = requestAnimationFrame(step)
  }
  countTimer = requestAnimationFrame(step)
}

/* ======== 获取数据 ======== */

async function fetchCatalog() {
  loading.value = true

  try {
    const res = await fetch(`/api/alphabet/catalog/${language.value}`)

    if (!res.ok) throw new Error(res.status)
    catalog.value = await res.json()

    totalCount.value = catalog.value.reduce((n, g) => n + g.right.length, 0)

    loading.value = false

    // 等 DOM 渲染完成后再跑计数动画
    await nextTick()
    runCountUp()
  } catch (e) {
    loading.value = false
    console.error(e)
    showError("加载目录失败")
  }
}

watch(language, fetchCatalog)

onMounted(fetchCatalog)

onBeforeUnmount(() => cancelAnimationFrame(countTimer))
</script>

<template>

  <div class="broaden-layout alphabet-page">

    <!-- ====== 标题区 ====== -->
    <header class="hero">

      <div class="float-letters" aria-hidden="true">
        <span
            v-for="(f, i) in floatingLetters"
            :key="i"
            class="float-letter"
            :style="{ top: f.top, left: f.left, fontSize: f.size + 'px', '--d': f.delay }"
        >{{ f.ch }}</span>
      </div>

      <h1 class="big-title" aria-label="我会几十门语言的字母">
        <template v-for="(ch, i) in bigTitleChars" :key="'b' + i">
          <span class="title-char" :style="{ '--i': i }">{{ ch }}</span>
        </template>
        <span class="title-break" aria-hidden="true"></span>
        <template v-for="(ch, i) in smallTitleChars" :key="'s' + i">
          <span class="title-char title-char--small" :style="{ '--i': i + bigTitleChars.length }">{{ ch }}</span>
        </template>
      </h1>

      <p class="hero-stat" v-if="!loading">
        共收录 <strong>{{ shownCount }}</strong> 种字母
      </p>
    </header>

    <!-- ====== 骨架屏 ====== -->
    <div v-if="loading" class="catalog-skeleton" aria-hidden="true">
      <div v-for="g in 4" :key="g" class="skeleton-group">
        <div class="skeleton-title shimmer"/>
        <div class="skeleton-grid">
          <div v-for="c in 8" :key="c" class="skeleton-card shimmer"/>
        </div>
      </div>
    </div>

    <!-- ====== 目录 ====== -->
    <template v-else>
      <section
          v-for="(group, gi) in displayCatalog"
          :key="gi"
          class="catalog-group"
          :style="{ '--gi': gi }"
      >
        <h2 class="catalog-title" v-formatted-text="group.left"/>

        <div class="alphabet-grid">

          <router-link
              v-for="(item, ci) in group.right"
              :key="item.url || item.type"
              class="alphabet-card"
              :style="{ '--ci': ci }"
              :to="cardTo(item)"
          >
            <div class="alphabet-example" v-formatted-text="item.example"/>
            <div class="alphabet-name" v-formatted-text="item.name"/>
          </router-link>
        </div>
      </section>
    </template>

  </div>

</template>

<style scoped>
/* ===== 页面 ===== */

.alphabet-page {
  min-height: 60vh;
}

/* ===== 标题区 ===== */

.hero {
  position: relative;
  text-align: center;
  padding: 26px 10px 20px;
  margin-bottom: 26px;
}

.big-title {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px;
  margin: 0;
  font-size: clamp(2.1rem, 6vw, 3.2rem);
  font-weight: 800;
  letter-spacing: 3px;
  line-height: 1.5;
  filter:none;  /*drop-shadow(0 3px 8px rgba(46, 125, 50, .22));*/
}

/* 强制换行（“的字母”放到第二行） */
.title-break {
  flex-basis: 100%;
  height: 0;
}

/* 逐字入场 */
.title-char {
  display: inline-block;
  opacity: 0;
  background: linear-gradient(120deg, #2e7d32, #4caf50, #1976d2);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: charDrop .65s cubic-bezier(.22, 1.2, .36, 1) forwards;
  animation-delay: calc(var(--i) * 90ms + 200ms);
}

.title-char--small {
  font-size: .58em;
  font-weight: 600;
  letter-spacing: 8px;
  margin-left: 8px;
}

@keyframes charDrop {
  0% {
    opacity: 0;
    transform: translateY(-1.4em) rotate(-14deg) scale(.5);
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: translateY(0) rotate(0deg) scale(1);
  }
}

/* 统计行 */
.hero-stat {
  position: relative;
  z-index: 1;
  margin: 16px auto 0;
  font-size: 1rem;
  color: var(--color-text-light);
  animation: statIn .6s ease .9s both;
}

.hero-stat strong {
  font-size: 1.35em;
  font-weight: 800;
  color: var(--color-accent);
  margin: 0 2px;
}

@keyframes statIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* 背景漂浮字母 */
.float-letters {
  position:absolute;
  inset:0;

  z-index:0;

  pointer-events:none;
  user-select:none;

  overflow:hidden;
}


.float-letter {
  position:absolute;
  font-weight:700;
  color:var(--color-primary);
  opacity:.09;

  animation:
      floatOpacity 5s ease-in-out infinite alternate;

  animation-delay:
      calc(var(--d) * -.4s);
}



@keyframes floatOpacity {

  from {
    opacity:.05;
  }

  to {
    opacity:.13;
  }

}

/* ===== 骨架屏 ===== */

.catalog-skeleton {
  margin-top: 6px;
}

.skeleton-group {
  margin-bottom: 30px;
}

.skeleton-title {
  width: 150px;
  height: 26px;
  border-radius: 8px;
  margin-bottom: 15px;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.skeleton-card {
  height: 110px;
  border-radius: var(--border-radius-md);
}

.shimmer {
  background: linear-gradient(90deg, #ececec 25%, #f7f7f7 40%, #ececec 55%);
  background-size: 300% 100%;
  animation: shimmer 1s linear infinite;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

/* ===== group ===== */

.catalog-group {
  margin-bottom: 30px;
  animation: groupIn .5s ease both;
  animation-delay: calc(var(--gi) * 150ms);
}

@keyframes groupIn {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.catalog-title {
  margin-bottom: 15px;
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text);
}

/* ===== grid ===== */

.alphabet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

/* ===== card ===== */

.alphabet-card {
  position: relative;
  overflow: hidden;
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 18px 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 110px;
  opacity: 0;

  /* 级联入场：组内卡片逐个“涌出” */
  animation: cardIn .5s cubic-bezier(.2, .9, .3, 1) forwards;
  animation-delay: calc(var(--gi) * 150ms + var(--ci) * 45ms + 120ms);

  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
}

@keyframes cardIn {
  0% {
    opacity: 0;
    transform: translateY(26px) scale(.85) rotate(-3deg);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

/* 卡片扫光 */
.alphabet-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 35%, rgba(255, 255, 255, .5) 50%, transparent 65%);
  transform: translateX(-120%);
  transition: transform .5s ease;
}

.alphabet-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-4px);
  box-shadow: 0 8px 18px rgba(46, 125, 50, .16);
}

.alphabet-card:hover::after {
  transform: translateX(120%);
}

.alphabet-card:hover .alphabet-example {
  transform: scale(1.12);
}

/* ===== example ===== */

.alphabet-example {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  color: var(--color-text);
  margin-bottom: 10px;
  line-height: 1.3;
  word-break: break-word;
  transition: transform .25s ease;
}

/* ===== name ===== */

.alphabet-name {
  font-size: 16px;
  color: #333333;
  text-align: center;
  line-height: 1.4;
}

/* ===== 动效敏感 ===== */

@media (prefers-reduced-motion: reduce) {

  .title-char,
  .hero-stat,
  .catalog-group,
  .alphabet-card {
    opacity: 1;
    animation: none;
  }
}

/* ===== mobile ===== */

@media (max-width: 600px) {

  .alphabet-grid,
  .skeleton-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .alphabet-card,
  .skeleton-card {
    min-height: 95px;
    padding: 14px 10px;
  }

  .skeleton-card {
    height: 95px;
  }

  .alphabet-example {
    font-size: 20px;
  }

  .alphabet-name {
    font-size: 12px;
  }
}

</style>
