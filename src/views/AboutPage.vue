<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showError } from '../services/ToastService.js'
import { useI18n } from 'vue-i18n'
import { useHead } from '@vueuse/head'
import { request } from '../services/request.js'

const { t } = useI18n()
const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const loading = ref(true)
const result = ref({})

useHead({
  title: () => t('nav.about_us')
})

const statisticItems = computed(() =>
    Array.isArray(result.value?.statistic) ? result.value.statistic : []
)

const metricLabels = computed(() => [
  t('about_page.hanzi'),
  t('about_page.words'),
  t('about_page.dictionary_sections')
])

const metricItems = computed(() => statisticItems.value.slice(4, 7).map((item, index) => ({
  value: String(item.right ?? '').match(/\d+/)?.[0] ?? item.right,
  label: metricLabels.value[index]
})))

const timelineFacts = computed(() => statisticItems.value.slice(0, 2))
const versionFacts = computed(() => statisticItems.value.slice(2, 4))

const thanksItems = computed(() =>
    Array.isArray(result.value?.thanks) ? result.value.thanks : []
)

const fetchAbout = async () => {
  loading.value = true

  try {
    result.value = await request(`/api/info/about-page/${dialect.value}/${language.value}`)
  } catch (err) {
    console.error(err)
    showError(err.message)
  }
  finally {
    loading.value = false
  }
}

watch([language, dialect], fetchAbout, {immediate: true})
</script>

<template>
  <div class="broaden-layout">

    <Transition name="page-fade" mode="out-in">

      <div v-if="loading" key="loading" class="skeleton-layout">

        <div class="skeleton-left">
          <div class="skeleton feature-skeleton"></div>
        </div>

        <div class="skeleton-right">
          <div v-for="i in 2" :key="i" class="skeleton side-skeleton">
            <div class="skeleton-bar skeleton-bar-title" :style="{ width: (46 + i * 10) + '%' }"></div>
            <div class="skeleton-bar" :style="{ width: (92 - i * 5) + '%' }"></div>
            <div class="skeleton-bar" :style="{ width: (84 - i * 4) + '%' }"></div>
            <div class="skeleton-bar" :style="{ width: (64 - i * 3) + '%' }"></div>
          </div>
        </div>

      </div>

      <div v-else key="content" class="about-layout">

        <div class="left-column">

          <section class="about-feature">
            <h2 class="card-title" v-formatted-text="$t('about_page.about')"/>
            <div class="card-body" v-formatted-text="result.about"/>
          </section>

        </div>

        <div class="right-column">

          <section class="side-card">
            <h2 class="card-title" v-formatted-text="$t('about_page.statistic')"/>

            <div class="stat-grid">
              <div v-for="(item, i) in metricItems" :key="i" class="stat-item">
                <span class="stat-value">{{ item.value }}</span>
                <span class="stat-label">{{ item.label }}</span>
              </div>
            </div>
            <div class="stat-facts">
              <div class="stat-fact-group">
                <div v-for="(item, i) in timelineFacts" :key="i" class="stat-fact">
                  <span v-formatted-text="item.left"/> <strong v-formatted-text="item.right"/>
                </div>
              </div>
              <div class="stat-fact-group">
                <div v-for="(item, i) in versionFacts" :key="i" class="stat-fact">
                  <span v-formatted-text="item.left"/> <strong v-formatted-text="item.right"/>
                </div>
              </div>
            </div>
          </section>

          <section class="side-card">
            <h2 class="card-title" v-formatted-text="$t('about_page.thanks')"/>

            <ul class="thanks-list">
              <li
                  v-for="(item, i) in thanksItems"
                  :key="i"
                  class="thanks-item"
              >
                <span class="thanks-text" v-formatted-text="item"/>
              </li>
            </ul>
          </section>

          <a class="icp-link" href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">
            <img src="../assets/icons/icp.svg" alt="" />
            <span>蜀ICP备2026005399号</span>
          </a>

        </div>

      </div>

    </Transition>
  </div>
</template>

<style scoped>
.broaden-layout {
  --about-card-shadow: 0 3px 12px rgba(27, 67, 31, .09);
}

.about-layout {
  --about-content-indent: 22px;
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

.about-feature {
  background: #fff;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  padding: 22px 18px;
  margin-bottom: 26px;
  box-shadow: var(--about-card-shadow);
}

.about-feature .card-body {
  padding-top: 0;
  padding-left: 14px;
  color: var(--color-text);
  line-height: 1.8;
}

.about-feature :deep(b) {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.about-feature :deep(.rt-hr) {
  border: none;
  margin: 18px 0;
  height: 1px;
  background: var(--color-border);
}

.side-card {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--about-card-shadow);
  padding: 22px 18px;
  margin-bottom: 26px;
}

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
  margin-left: 6px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-left: var(--about-content-indent);
}

.stat-item {
  display: grid;
  align-content: start;
  gap: 4px;
  min-width: 0;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-light);
}

.stat-value {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.stat-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0 0 var(--about-content-indent);
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-light);
  font-size: .82rem;
  line-height: 1.5;
}

.stat-fact-group {
  display: grid;
  align-content: start;
  gap: 5px;
}

.stat-fact {
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
}

.stat-fact strong {
  color: var(--color-text);
  font-weight: 600;
}

.thanks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.thanks-item {
  padding: 4px 8px;
  line-height: 1.65;
}

.icp-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0 2px;
  color: var(--color-text-light);
  font-size: .8rem;
  text-decoration: none;
}

.icp-link:hover,
.icp-link:focus-visible {
  color: var(--color-primary-dark);
  text-decoration: underline;
}

.icp-link img {
  width: 16px;
  height: 16px;
  opacity: .65;
}

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
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--about-card-shadow);
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.75), transparent);
  animation: skeleton-shimmer 1.3s infinite;
}

.feature-skeleton {
  height: 360px;
}

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
}

.page-fade-enter-active, .page-fade-leave-active {
  transition: opacity 0.35s ease;
}

.page-fade-enter-from, .page-fade-leave-to {
  opacity: 0;
}

@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 768px) {
  .about-layout, .skeleton-layout {
    flex-direction: column;
  }

  .left-column, .right-column, .skeleton-left, .skeleton-right {
    width: 100%;
  }

  .about-feature, .side-card {
    padding: 20px 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    animation: none !important;
  }
}
</style>
