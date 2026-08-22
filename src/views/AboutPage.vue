<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showError } from "../services/ToastService.js";
import { useI18n } from 'vue-i18n'
import DialectSelector from "../components/Select/DialectSelector.vue";
import LanguageSelector from "../components/Select/LanguageSelector.vue";
import { useHead } from '@vueuse/head'
import { isAdminUser } from '../utils/auth.js'

const {t} = useI18n()
const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const loading = ref(true)
const result = ref('')
const currentUser = ref(null)

useHead({
  title: () => `${t('nav.about_us')}`
})

const staggerDelay = (n) => ({'--card-delay': `${n * 110}ms`})

const statisticItems = computed(() =>
    Array.isArray(result.value?.statistic) ? result.value.statistic : []
)

const thanksItems = computed(() =>
    Array.isArray(result.value?.thanks) ? result.value.thanks : []
)

const fetchAbout = async () => {
  loading.value = true

  try {
    const res = await fetch(`/api/info/about-page/${dialect.value}/${language.value}`)
    if (!res.ok) throw new Error(t('common.loadingError'))
    result.value = await res.json()
  } catch (err) {
    console.error(err)
    showError(err.message)
  }
  finally {
    loading.value = false
  }
}

const loadCurrentUser = () => {
  try {
    const raw = localStorage.getItem('auth-user')
    currentUser.value = raw ? JSON.parse(raw) : null
  } catch {
    currentUser.value = null
  }
}

const isAdmin = computed(() => isAdminUser(currentUser.value))
loadCurrentUser()

watch([language, dialect], () => {
  fetchAbout()
}, {immediate: true})
</script>

<template>
  <div class="broaden-layout">

    <Transition name="page-fade" mode="out-in">

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

      <div v-else key="content" class="about-layout">

        <div class="left-column">

          <section class="about-feature enter-card" :style="staggerDelay(1)">
            <h2 class="card-title" v-formatted-text="$t('about_page.about')"/>
            <div class="card-body" v-formatted-text="result.about"/>
          </section>

          <div class="selector-container enter-card" :style="staggerDelay(2)">
            <LanguageSelector/>
            <DialectSelector/>
          </div>

        </div>

        <div class="right-column">

          <section class="side-card enter-card" :style="staggerDelay(3)">
            <h2 class="card-title" v-formatted-text="$t('about_page.statistic')"/>

            <div class="stat-grid">
              <div v-for="(s, i) in statisticItems" :key="i" class="stat-item">
                <span class="stat-label" v-formatted-text="s.left"/>
                <span class="stat-value" v-formatted-text="s.right"/>
              </div>
            </div>
          </section>

          <section class="side-card enter-card" :style="staggerDelay(4)">
            <h2 class="card-title" v-formatted-text="$t('about_page.thanks')"/>

            <ul class="thanks-list">
              <li
                  v-for="(item, i) in thanksItems"
                  :key="i"
                  class="thanks-item enter-item"
                  :style="{ '--item-delay': `${i * 90}ms` }"
              >
                <span class="thanks-text" v-formatted-text="item"/>
              </li>
            </ul>
          </section>

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

              <router-link
                  :to="{ name: 'DictAuth', params: { language: language, dialect: dialect } }"
                  class="contact-item contact-button"
              >
                <span class="contact-icon">
                  <img src="../assets/icons/developer.svg" alt="login"/>
                </span>
                <span class="contact-text">账号测试</span>
              </router-link>

              <router-link
                  v-if="isAdmin"
                  :to="{ name: 'DevHome', params: { language: language, dialect: dialect } }"
                  class="contact-item"
              >
                <span class="contact-icon">
                  <img src="../assets/icons/developer.svg" alt="admin"/>
                </span>
                <span class="contact-text">开发者模式</span>
              </router-link>

            </div>
          </section>

        </div>

      </div>

    </Transition>
  </div>
</template>

<style scoped>
/* keep original about page styling */
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

@media (max-width: 768px) {
  .about-layout, .skeleton-layout {
    flex-direction: column;
  }

  .left-column, .right-column, .skeleton-left, .skeleton-right {
    width: 100%;
  }

  .about-feature {
    padding: 24px 0px;
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

.about-feature {
  position: relative;
  overflow: hidden;
  background: #a5d89a;
  color: var(--color-text);
  border-radius: var(--border-radius-xl);
  padding: 30px 15px;
  margin-bottom: 26px;
  box-shadow: 0 8px 24px rgba(46, 125, 50, 0.14);
}

.about-feature::before, .about-feature::after {
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

.about-feature :deep(b) {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.about-feature :deep(.rt-hr) {
  border: none;
  margin: 18px 0;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-primary-light) 0%, rgba(46, 125, 50, 0.12) 100%);
}

.side-card {
  background: linear-gradient(180deg, #ffffff 0%, #f7fbf5 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-sm);
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
  opacity: 0;
  animation: item-enter 0.45s ease forwards;
  animation-delay: calc(var(--card-delay, 0ms) + var(--item-delay, 0ms));
}

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
  transition: background-color var(--transition-base), color var(--transition-base);
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
}

.contact-item:hover {
  background: rgba(46, 125, 50, 0.07);
  color: var(--color-primary);
}

.contact-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(46, 125, 50, 0.10);
}

.contact-icon img {
  width: 18px;
  height: 18px;
}

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
  margin-bottom: 26px;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.28) 0%, rgba(46, 125, 50, 0.34) 100%);
}

.selector-skeleton {
  height: 66px;
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
  background: linear-gradient(90deg, #d4e5d0 0%, #c2d8bd 100%);
}

.page-fade-enter-active, .page-fade-leave-active {
  transition: opacity 0.35s ease;
}

.page-fade-enter-from, .page-fade-leave-to {
  opacity: 0;
}

.enter-card {
  animation: card-enter 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
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

@media (prefers-reduced-motion: reduce) {
  .enter-card, .thanks-item, .skeleton::after, .contact-item, .contact-icon, .contact-icon img {
    animation: none !important;
    transition: none !important;
  }
}
</style>
