<script setup>

import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useHead } from '@vueuse/head'
import { showError } from "../../services/ToastService.js";
import { request } from '../../services/request.js'

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

useHead({
  title: '语言字母表',
  meta: [
    { key: 'description', name: 'description', content: '查看不同语言及拼音方案的字母表、读音和转写说明。' }
  ]
})

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

const totalCount = ref(0)

/* ======== 获取数据 ======== */

async function fetchCatalog() {
  loading.value = true

  try {
    catalog.value = await request(`/api/alphabet/catalog/${language.value}`)

    totalCount.value = catalog.value.reduce((n, g) => n + g.right.length, 0)

    loading.value = false
  } catch (e) {
    loading.value = false
    console.error(e)
    showError("加载目录失败")
  }
}

watch(language, fetchCatalog)

onMounted(fetchCatalog)
</script>

<template>

  <div class="broaden-layout alphabet-page">

    <!-- ====== 标题区 ====== -->
    <header class="hero">

      <h1 class="big-title">我会几十门语言的字母</h1>

      <p class="hero-stat" v-if="!loading">
        共收录 <strong>{{ totalCount }}</strong> 种字母
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
      >
        <h2 class="catalog-title" v-formatted-text="group.left"/>

        <div class="alphabet-grid">

          <router-link
              v-for="item in group.right"
              :key="item.url || item.type"
              class="alphabet-card"
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
  text-align: center;
  padding: 32px 10px 24px;
  margin-bottom: 18px;
}

.big-title {
  margin: 0;
  color: var(--color-text);
  font-size: clamp(1.75rem, 4vw, 2.4rem);
  font-weight: 700;
  line-height: 1.4;
}

/* 统计行 */
.hero-stat {
  margin: 8px auto 0;
  font-size: .9rem;
  color: var(--color-text-light);
}

.hero-stat strong {
  font-weight: 700;
  color: var(--color-text);
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
  transition: border-color .15s ease, background-color .15s ease;
}

.alphabet-card:hover,
.alphabet-card:focus-visible {
  border-color: var(--color-primary);
  background-color: var(--color-background);
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
}

/* ===== name ===== */

.alphabet-name {
  font-size: 16px;
  color: #333333;
  text-align: center;
  line-height: 1.4;
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
