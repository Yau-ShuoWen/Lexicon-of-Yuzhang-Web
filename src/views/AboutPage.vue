<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showError } from "../services/ToastService.js";
import { useI18n } from 'vue-i18n'
import DialectSelector from "../components/Select/DialectSelector.vue";
import LanguageSelector from "../components/Select/LanguageSelector.vue";
import { useHead } from '@vueuse/head'

const { t } = useI18n()
const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const loading = ref(true)
const result = ref('')

useHead({
  title: () => `${t('nav.about_us')}`
})

// 入场动画的错峰延迟（毫秒），卡片按顺序递增，产生逐块浮现效果
const staggerDelay = (n) => ({ '--card-delay': `${n * 110}ms` })

// 统计指标：后端返回 [{label, value}]，防御非数组
const statisticItems = computed(() =>
    Array.isArray(result.value?.statistic) ? result.value.statistic : []
)

// 致谢列表：后端返回 List<String>，防御非数组
const thanksItems = computed(() =>
    Array.isArray(result.value?.thanks) ? result.value.thanks : []
)

const fetchAbout = async () => {
  loading.value = true

  try {
    const start = Date.now();

    const res = await fetch(`/api/info/about-page/${dialect.value}/${language.value}`)
    if (!res.ok) throw new Error(t('common.loadingError'))
    result.value = await res.json()

    console.log('SQL耗时:', Date.now() - start, 'ms');

  } catch (err) {
    console.error(err)
    showError(err.message);
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAbout()
})

watch([language, dialect], () => {
  fetchAbout()
}, { immediate: true })
</script>

<template>
  <div class="broaden-layout">

    <!-- 加载骨架屏 / 内容 平滑过渡 -->
    <Transition name="page-fade" mode="out-in">

      <!-- ===== 骨架屏 ===== -->
      <div v-if="loading" key="loading" class="skeleton-layout">

        <div class="skeleton-left">
          <div class="skeleton feature-skeleton"></div>
          <div class="skeleton selector-skeleton"></div>
        </div>

        <div class="skeleton-right">
          <div v-for="i in 3" :key="i" class="skeleton side-skeleton">
            <div class="skeleton-bar skeleton-bar-title" :style="{ width: (46 + i * 10) + '%' }"></div>
            <div class="skeleton-bar" :style="{ width: (92 - i * 5) + '%' }"></div>
            <div class="skeleton-bar" :style="{ width: (84 - i * 4) + '%' }"></div>
            <div class="skeleton-bar" :style="{ width: (64 - i * 3) + '%' }"></div>
          </div>
        </div>

      </div>

      <!-- ===== 内容 ===== -->
      <div v-else key="content" class="about-layout">

        <!-- 左側 -->
        <div class="left-column">

          <!-- 關於：主题强调卡（与右侧干净白卡形成强烈反差） -->
          <section class="about-feature enter-card" :style="staggerDelay(1)">
            <h2 class="card-title" v-formatted-text="$t('about_page.about')"/>
            <div class="card-body" v-formatted-text="result.about"/>
          </section>

          <!-- 语言 / 方言切换 -->
          <div class="selector-container enter-card" :style="staggerDelay(2)">
            <LanguageSelector/>
            <DialectSelector/>
          </div>

        </div>

        <!-- 右側 -->
        <div class="right-column">

          <!-- 統計：指标卡片网格 -->
          <section class="side-card enter-card" :style="staggerDelay(3)">
            <h2 class="card-title" v-formatted-text="$t('about_page.statistic')"/>

            <div class="stat-grid">
              <div v-for="(s, i) in statisticItems" :key="i" class="stat-item">
                <span class="stat-label" v-formatted-text="s.label"/>
                <span class="stat-value" v-formatted-text="s.value"/>
              </div>
            </div>
          </section>

          <!-- 致謝：列表 -->
          <section class="side-card enter-card" :style="staggerDelay(4)">
            <h2 class="card-title" v-formatted-text="$t('about_page.thanks')"/>

            <ul class="thanks-list">
              <li
                  v-for="(t, i) in thanksItems"
                  :key="i"
                  class="thanks-item enter-item"
                  :style="{ '--item-delay': `${i * 90}ms` }"
              >
<!--                <span class="thanks-dot" aria-hidden="true"></span>-->
                <span class="thanks-text" v-formatted-text="t"/>
              </li>
            </ul>
          </section>

          <!-- 联系 -->
          <section class="side-card enter-card" :style="staggerDelay(5)">
            <h2 class="card-title" v-formatted-text="$t('about_page.contact')"/>

            <div class="contact-list">

              <a href="https://github.com/Yau-ShuoWen" target="_blank" class="contact-item">
                <span class="contact-icon">
                  <img src="../assets/icons/github.svg" alt="GitHub"/>
                </span>
                <span class="contact-text">{{ $t('about.github_project') }}</span>
              </a>

              <div class="contact-item">
                <span class="contact-icon">
                  <img src="../assets/icons/qq.svg" alt="QQ"/>
                </span>
                <span class="contact-text">QQ交流群：496423006</span>
              </div>

              <a href="https://beian.miit.gov.cn" target="_blank" class="contact-item">
                <span class="contact-icon">
                  <img src="../assets/icons/icp.svg" alt="ICP"/>
                </span>
                <span class="contact-text">蜀ICP备 2026005399号</span>
              </a>

              <router-link
                  :to="{ name: 'YswHome', params: { language: language } }"
                  class="contact-item"
              >
                <span class="contact-icon">
                  <img src="../assets/icons/developer.svg" alt="developer"/>
                </span>
                <span class="contact-text">{{ `說文的屋里（彩蛋）` }}</span>
              </router-link>

            </div>
          </section>

        </div>

      </div>

    </Transition>

  </div>
</template>

<style scoped>
/* ============ 布局：桌面两栏 3:2 ============ */
.about-layout {
  display: flex;
  gap: 26px;
  align-items: flex-start;
}

.left-column {
  flex: 5;
  min-width: 0;
}

.right-column {
  flex: 3;
  min-width: 0;
}

/* 手機版改直排 */
@media (max-width: 768px) {
  .about-layout,
  .skeleton-layout {
    flex-direction: column;
  }

  .left-column,
  .right-column,
  .skeleton-left,
  .skeleton-right {
    width: 100%;
  }

  .about-feature {
    padding: 24px 20px;
  }

  .side-card {
    padding: 20px 18px;
  }

  .contact-icon {
    width: 34px;
    height: 34px;
  }

  .selector-container {
    gap: 12px;
    padding: 12px;
  }
}

/* ============ 左侧「关于」强调卡：浅绿底 + 深色字 ============ */
.about-feature {
  position: relative;
  overflow: hidden;

  background: #a5d89a;
  color: var(--color-text);

  border-radius: var(--border-radius-xl);
  padding: 30px 32px;
  margin-bottom: 26px;

  box-shadow: 0 8px 24px rgba(46, 125, 50, 0.14);
}

/* 装饰圆（柔和绿色调） */
.about-feature::before,
.about-feature::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.about-feature::before {
  width: 220px;
  height: 220px;
  right: -70px;
  top: -90px;
  background: rgba(46, 125, 50, 0.08);
}

.about-feature::after {
  width: 150px;
  height: 150px;
  left: -50px;
  bottom: -80px;
  background: rgba(46, 125, 50, 0.06);
}

.about-feature .card-body {
  position: relative;
  z-index: 1;

  color: var(--color-text);
  line-height: 1.8;
}

/* 强调字 {b ...} → 主题深绿 */
.about-feature :deep(b) {
  color: var(--color-primary-dark);
  font-weight: 600;
}

/* 分隔线 ------ → 绿色渐变 */
.about-feature :deep(.rt-hr) {
  border: none;
  margin: 18px 0;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-primary-light) 0%, rgba(46, 125, 50, 0.12) 100%);
}

/* ============ 右侧卡片：干净白卡（参考 PinyinTable 风格） ============ */
.side-card {
  background: linear-gradient(180deg, #ffffff 0%, #f7fbf5 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-sm);

  padding: 22px 24px;
  margin-bottom: 26px;
}

.right-column .side-card:last-child {
  margin-bottom: 0;
}

/* ============ 卡片标题：左侧主题色强调条 ============ */
.card-title {
  display: flex;
  align-items: center;
  gap: 10px;

  margin: 0 0 14px;

  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.02em;
}

.card-title::before {
  content: '';
  flex-shrink: 0;

  width: 6px;
  height: 22px;
  border-radius: 4px;

  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.3);
}

/* ============ 卡片正文（富文本适配） ============ */
.card-body {
  overflow-wrap: break-word;
  word-break: normal;
  line-height: 1.75;
  color: var(--color-text);
  padding:0;
}

/* ============ 统计：指标卡片网格 ============ */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 5px;

  padding: 12px 14px;

  background: linear-gradient(180deg, #ffffff 0%, #f2f9f0 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-light);
}

.stat-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.2;
  overflow-wrap: anywhere;
}

/* ============ 致谢：圆点列表 ============ */
.thanks-list {
  list-style: none;
  margin: 0;
  padding: 0;

  display: flex;
  flex-direction: column;
  gap: 0px;
}

.thanks-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  padding: 4px 8px;
  line-height: 1.65;

  /* 逐个进入：先随卡片入场，再按索引错峰浮现 */
  opacity: 0;
  animation: item-enter 0.45s ease forwards;
  animation-delay: calc(var(--card-delay, 0ms) + var(--item-delay, 0ms));
}

/* 行首绿色圆点 */
.thanks-dot {
  flex-shrink: 0;

  width: 6px;
  height: 6px;
  margin-top: 7px; /* 与首行文字大致对齐 */

  border-radius: 50%;
  background: var(--color-primary-light);
}

.thanks-text {
  color: var(--color-text);
}

/* ============ 联系列表（仅交互项保留轻量 hover） ============ */
.contact-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 12px;

  padding-top: 5px;
  padding-bottom: 5px;
  border-radius: 10px;

  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
  user-select: none;

  transition: background-color var(--transition-base),
  color var(--transition-base);
}

.contact-item:hover {
  background: rgba(46, 125, 50, 0.07);
  color: var(--color-primary);
}

/* 图标：浅绿圆形底 */
.contact-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 36px;
  height: 36px;
  flex-shrink: 0;

  border-radius: 50%;
  background: rgba(46, 125, 50, 0.10);

  transition: background var(--transition-base);
}

.contact-icon img {
  width: 18px;
  height: 18px;

  transition: filter var(--transition-base);
}

/* hover：图标变主题绿底 + 反白 */
.contact-item:hover .contact-icon {
  background: var(--color-primary);
}

.contact-item:hover .contact-icon img {
  filter: brightness(0) invert(1);
}

/* ============ 语言 / 方言切换 ============ */
.selector-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  padding: 14px;

  background: linear-gradient(180deg, #ffffff 0%, #f7fbf5 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-sm);
}

/* ============ 骨架屏 ============ */
.skeleton-layout {
  display: flex;
  gap: 26px;
  align-items: flex-start;
}

.skeleton-left {
  flex: 5;
  min-width: 0;
}

.skeleton-right {
  flex: 3;
  min-width: 0;

  display: flex;
  flex-direction: column;
  gap: 26px;
}

.skeleton {
  position: relative;
  overflow: hidden;

  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xl);
}

/* 扫描光 */
.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;

  transform: translateX(-100%);

  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.75), transparent);

  animation: skeleton-shimmer 1.3s infinite;
}

/* 左侧骨架：模拟「关于」强调卡 + 选择器条 */
.feature-skeleton {
  height: 360px;
  margin-bottom: 26px;

  background: linear-gradient(135deg, rgba(76, 175, 80, 0.28) 0%, rgba(46, 125, 50, 0.34) 100%);
}

.selector-skeleton {
  height: 66px;
}

/* 右侧骨架：卡片 + 文本条 */
.side-skeleton {
  padding: 22px 24px;
}

.skeleton-bar {
  height: 14px;
  border-radius: 999px;

  background: #e3eae3;

  margin-top: 12px;
}

.skeleton-bar-title {
  height: 22px;
  margin: 0 0 18px;

  background: linear-gradient(90deg, #d4e5d0 0%, #c2d8bd 100%);
}

/* ============ 加载 → 内容 过渡 ============ */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.35s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

/* ============ 入场动画 ============ */
.enter-card {
  animation: card-enter 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: var(--card-delay, 0ms);
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(22px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 致谢条目逐个进入 */
@keyframes item-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

/* ============ 尊重「减弱动态效果」 ============ */
@media (prefers-reduced-motion: reduce) {

  .enter-card,
  .enter-item,
  .skeleton::after,
  .contact-item,
  .contact-icon,
  .contact-icon img {
    animation: none !important;
    transition: none !important;
  }
}
</style>
