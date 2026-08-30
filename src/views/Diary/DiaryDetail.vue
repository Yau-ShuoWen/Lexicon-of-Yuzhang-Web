<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import LanguageSelector from '../../components/Select/LanguageSelector.vue'
import { showError } from '../../services/ToastService.js'
import { getBlogVisibilityLevel, hasPermission } from '../../utils/auth.js'
import {
  formatDateLabel,
  formatDateTimeLabel,
  getDiaryById,
  getNearbyDiaries
} from './diaryApi.js'

const route = useRoute()
const router = useRouter()

const language = computed(() => String(route.params.language || 'sc'))
const dialect = computed(() => String(route.params.dialect || 'lac'))
const diaryId = computed(() => route.params.id ? String(route.params.id) : '')
const canEdit = computed(() => hasPermission('blog.edit'))
const requestedView = computed(() => String(route.query.view || '').toLowerCase())
const blogLevel = computed(() => getBlogVisibilityLevel())
const canSelfView = computed(() => blogLevel.value >= 3)
const canFriendView = computed(() => blogLevel.value >= 2)
const canStrangerView = computed(() => blogLevel.value >= 1)
const permittedViewModes = computed(() => {
  const modes = []
  if (canSelfView.value) modes.push('self')
  if (canFriendView.value) modes.push('friend')
  if (canStrangerView.value) modes.push('stranger')
  return modes
})

const availableViewModes = computed(() => (
    Array.isArray(diary.value?.availableViews)
        ? diary.value.availableViews
            .filter(Boolean)
            .map(item => String(item).trim().toLowerCase())
        : []
))

const visibleViewModes = computed(() => {
  if (!diary.value) {
    return []
  }
  if (!availableViewModes.value.length) return permittedViewModes.value
  return permittedViewModes.value.filter(mode => availableViewModes.value.includes(mode))
})

const viewLabels = computed(() => {
  if (visibleViewModes.value.includes('self')) {
    return {
      self: text.value.self,
      friend: text.value.friend,
      stranger: text.value.stranger
    }
  }
  return {
    friend: text.value.full,
    stranger: text.value.public
  }
})

const viewOptions = computed(() => {
  if (visibleViewModes.value.length <= 1) {
    return []
  }
  return visibleViewModes.value.map(mode => ({
    mode,
    label: viewLabels.value[mode] ?? mode
  }))
})

const viewMode = computed(() => {
  const current = diary.value?.viewMode ? String(diary.value.viewMode).toLowerCase() : ''
  if (current && visibleViewModes.value.includes(current)) {
    return current
  }

  const raw = requestedView.value
  const requested = raw === 'self' || raw === 'friend' || raw === 'stranger' ? raw : ''
  if (requested && visibleViewModes.value.includes(requested)) {
    return requested
  }

  return visibleViewModes.value[0] || requested || 'stranger'
})

const text = computed(() => (
    language.value === 'tc'
        ? {
          title: '日記詳情',
          loadingTitle: '載入中',
          back: '返回日記列表',
          summary: '摘要',
          content: '正文',
          noContent: '暫無正文內容',
          notFound: '沒有找到這篇日記。',
          startDate: '開始寫作',
          finalizeDate: '完成時間',
          createdTime: '建立時間',
          updatedTime: '最後更新',
          prev: '上一篇',
          next: '下一篇',
          view: '視角',
          self: '自己',
          friend: '朋友',
          stranger: '陌生人',
          full: '完整版',
          public: '公開版'
        }
        : {
          title: '日记详情',
          loadingTitle: '加载中',
          back: '返回日记列表',
          summary: '摘要',
          content: '正文',
          noContent: '暂无正文内容',
          notFound: '没有找到这篇日记。',
          startDate: '开始写作',
          finalizeDate: '完成时间',
          createdTime: '创建时间',
          updatedTime: '最后更新',
          prev: '上一篇',
          next: '下一篇',
          view: '视角',
          self: '自己',
          friend: '朋友',
          stranger: '陌生人',
          full: '完整版',
          public: '公开版'
        }
))

const loading = ref(true)
const showSkeleton = ref(false)
const animateDetail = ref(false)
const diary = ref(null)
const nearby = ref({prev: null, next: null})
let skeletonTimer = null
let detailAnimationTimer = null

function diaryLink(id) {
  const query = {}
  if (route.query.view) query.view = String(route.query.view)
  return {
    name: 'DiaryDetail',
    params: {
      language: language.value,
      dialect: dialect.value,
      id: String(id)
    },
    query
  }
}

function diaryEditLink() {
  return {
    name: 'DiaryEditor',
    params: {
      language: language.value,
      dialect: dialect.value,
      id: diaryId.value
    }
  }
}

function setView(mode) {
  const nextMode = mode === 'self'
      ? (canSelfView.value ? 'self' : (canFriendView.value ? 'friend' : 'stranger'))
      : mode === 'friend'
          ? (canFriendView.value ? 'friend' : 'stranger')
          : 'stranger'
  router.replace({
    query: {
      ...route.query,
      view: nextMode
    }
  })
}

const backQuery = computed(() => {
  const query = {}
  if (route.query.view) query.view = String(route.query.view)
  return query
})

const backToList = computed(() => ({
  name: 'DiaryHome',
  params: {
    language: language.value,
    dialect: dialect.value
  },
  query: backQuery.value
}))

const activeViewIndex = computed(() => {
  const index = viewOptions.value.findIndex(option => option.mode === viewMode.value)
  return index >= 0 ? index : 0
})

useHead({
  title: () => diary.value?.date ? `${diary.value.date} - ${text.value.title}` : text.value.loadingTitle
})

function startLoading() {
  loading.value = true
  showSkeleton.value = false
  clearTimeout(skeletonTimer)
  skeletonTimer = setTimeout(() => {
    if (loading.value) {
      showSkeleton.value = true
    }
  }, 180)
}

function stopLoading() {
  loading.value = false
  showSkeleton.value = false
  clearTimeout(skeletonTimer)
  animateDetail.value = false
  clearTimeout(detailAnimationTimer)
  detailAnimationTimer = setTimeout(() => {
    animateDetail.value = true
  }, 0)
}

async function loadDiary() {
  startLoading()
  try {
    diary.value = diaryId.value
        ? await getDiaryById(language.value, diaryId.value, requestedView.value)
        : null
    nearby.value = diaryId.value
        ? await getNearbyDiaries(diaryId.value, requestedView.value)
        : {prev: null, next: null}
  } catch (error) {
    console.error(error)
    showError(error.message || '加载详情失败')
    diary.value = null
    nearby.value = {prev: null, next: null}
  }
  finally {
    stopLoading()
  }
}

watch(
    () => [language.value, diaryId.value, requestedView.value],
    loadDiary,
    {immediate: true}
)

onBeforeUnmount(() => {
  clearTimeout(skeletonTimer)
  clearTimeout(detailAnimationTimer)
})
</script>

<template>
  <div class="broaden-layout diary-detail">

    <nav v-if="nearby.prev || nearby.next" class="detail-nav">
      <div class="detail-nav__pages">
        <router-link v-if="nearby.prev" :to="diaryLink(nearby.prev.id)" class="nav-btn">
        <span class="nav-btn__dir">{{ text.prev }}</span>
        <span class="nav-btn__date">{{ formatDateLabel(nearby.prev.date) }}</span>
        </router-link>
      <span v-else class="nav-btn nav-btn--disabled">
          <span class="nav-btn__dir">{{ text.prev }}</span>
          <span class="nav-btn__date" aria-hidden="true"></span>
        </span>

        <router-link v-if="nearby.next" :to="diaryLink(nearby.next.id)" class="nav-btn nav-btn--right">
        <span class="nav-btn__dir">{{ text.next }}</span>
        <span class="nav-btn__date">{{ formatDateLabel(nearby.next.date) }}</span>

        </router-link>
      <span v-else class="nav-btn nav-btn--disabled nav-btn--right">
          <span class="nav-btn__dir">{{ text.next }}</span>
          <span class="nav-btn__date" aria-hidden="true"></span>
        </span>
      </div>

      <div class="detail-header__right">
        <LanguageSelector class="language-switch" />
        <div v-if="viewOptions.length" class="view-switch" :aria-label="text.view">
<!--          <span class="view-switch__label">{{ text.view }}</span>-->
          <div
              class="view-switch__track"
              :class="`is-${viewOptions.length}`"
              :style="{
              '--segment-count': String(viewOptions.length),
              '--active-index': String(activeViewIndex)
            }"
          >
            <button
                v-for="option in viewOptions"
                :key="option.mode"
                class="view-switch__option"
                :class="{ active: viewMode === option.mode }"
                @click="setView(option.mode)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

    </nav>

    <div v-if="showSkeleton" class="detail-skeleton panel" aria-hidden="true">
      <div class="detail-skeleton__title shimmer"/>
      <div class="detail-skeleton__line shimmer"/>
      <div class="detail-skeleton__line shimmer"/>
      <div class="detail-skeleton__line detail-skeleton__line--short shimmer"/>
      <div class="detail-skeleton__meta">
        <span class="detail-skeleton__pill shimmer"/>
        <span class="detail-skeleton__pill shimmer"/>
        <span class="detail-skeleton__pill shimmer"/>
      </div>
    </div>

    <div v-else-if="diary" class="detail-body panel" :class="{ 'detail-body--enter': animateDetail }">
      <div class="detail-heading">
        <div class="detail-heading__main">
          <h1 class="detail-title" v-formatted-text="diary.title ?? formatDateLabel(diary.date)"/>
          <router-link v-if="canEdit" :to="diaryEditLink()" class="detail-edit-link">编辑日记</router-link>
        </div>
      </div>

      <section class="content-block">
        <div
            v-if="diary.content"
            class="content-block__body content-block__body--article"
            v-formatted-text="diary.content"
        />
        <div v-else class="empty-box" v-formatted-text="text.noContent"/>
      </section>
      <div class="detail-meta">
        <span v-if="diary.startDate">{{ text.startDate }}: {{ formatDateLabel(diary.startDate) }}</span>
        <span v-if="diary.finalizeDate">{{ text.finalizeDate }}: {{ formatDateLabel(diary.finalizeDate) }}</span>
        <span v-if="diary.createdTime">{{ text.createdTime }}: {{ formatDateTimeLabel(diary.createdTime) }}</span>
        <span v-if="diary.updatedTime">{{ text.updatedTime }}: {{ formatDateTimeLabel(diary.updatedTime) }}</span>
      </div>

    </div>


    <div v-else class="empty-box panel" v-formatted-text="text.notFound"/>


  </div>
</template>

<style scoped>
.diary-detail {
  padding-bottom: 32px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 0px;
}

.detail-header__right {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.detail-header__right > .language-switch {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
}

.back-link {
  color: var(--color-primary-dark);
  text-decoration: none;
  font-weight: 600;
}

.panel {
  background: linear-gradient(180deg, #ffffff 0%, #fbfefb 100%);
  border: 1px solid var(--color-border-light);
  border-radius: var(--border-radius-lg);
  padding: 30px;
  box-shadow: var(--shadow-md);
}

.detail-body {
  position: relative;
  overflow: hidden;
}

.detail-heading {
  padding: 8px 4px 24px;
  border-bottom: 1px solid var(--color-border-light);
}

.detail-heading__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.detail-title {
  margin: 0;
  color: var(--color-primary-dark);
  font-size: 30px;
  line-height: 1.3;
}

.detail-edit-link {
  flex: 0 0 auto;
  padding: 7px 12px;
  border: 1px solid #b9d4bc;
  border-radius: 8px;
  color: var(--color-primary-dark);
  background: #f1f9f2;
  font-size: 0.82rem;
  text-decoration: none;
}

.detail-edit-link:hover {
  background: #e5f3e7;
}

@media (max-width: 500px) {
  .detail-heading__main {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-title {
    font-size: 22px;
  }
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  margin-top: 28px;
  color: var(--color-text-light);
  font-size: 14px;
}

.detail-meta span {
  padding: 6px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: 999px;
  background: #f5faf3;
}

.content-block + .content-block {
  margin-top: 22px;
}

.content-block {
  margin-top: 26px;
  padding: 0 4px;
}

.content-block__title {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  color: var(--color-text);
}

.content-block__body {
  color: var(--color-text);
  line-height: 1.8;
}

.content-block__body--article {
  font-size: 17px;
}

.empty-box {
  color: var(--color-text-light);
  line-height: 1.8;
}

.detail-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: 18px;
  margin: 8px 0 22px;
}

.detail-nav__pages {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.nav-btn {
  width: auto;
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  position: relative;
  gap: 6px;
  max-width: none;
  min-height: 66px;
  justify-content: center;
  padding: 12px 18px;
  border: 1px solid #d8e8d3;
  border-radius: var(--border-radius-lg);
  background: linear-gradient(145deg, #ffffff 0%, #f2f9f0 100%);
  color: var(--color-primary-dark);
  text-decoration: none;
  box-shadow: 0 5px 14px rgba(46, 125, 50, 0.07);
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.nav-btn:hover {
  transform: translateY(-2px);
  border-color: var(--color-primary-light);
  background: linear-gradient(145deg, #ffffff 0%, #eaf7e7 100%);
  box-shadow: 0 9px 20px rgba(46, 125, 50, 0.13);
}

.nav-btn--right {
  align-items: flex-end;
  text-align: right;
}

.nav-btn--disabled {
  opacity: 0.35;
  pointer-events: none;
  background: #f7f9f6;
  box-shadow: none;
}

.nav-btn__dir {
  font-size: 14px;
  font-weight: 600;
}

.nav-btn__date {
  display: block;
  min-height: 1.2em;
  font-size: 13px;
  color: var(--color-text-light);
}

.view-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.view-switch__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-light);
}

.view-switch__track {
  position: relative;
  display: inline-grid;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, #f7fbf5 0%, #eaf4e5 100%);
  border: 1px solid #d8e7d1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.view-switch__track::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px - (var(--segment-count) - 1) * 4px) / var(--segment-count));
  border-radius: 999px;
  background: linear-gradient(135deg, #5aa84d 0%, #2f7d43 100%);
  box-shadow: 0 8px 18px rgba(46, 125, 67, 0.22);
  transform: translateX(calc(var(--active-index) * (100% + 4px)));
  transition: transform 0.28s ease;
}

.view-switch__track.is-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.view-switch__track.is-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.view-switch__option {
  position: relative;
  z-index: 1;
  border: 0;
  background: transparent;
  color: var(--color-text-light);
  min-width: 68px;
  padding: 8px 14px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.22s ease, transform 0.22s ease;
}

.view-switch__option.active {
  color: #fff;
}

.view-switch__option:hover {
  color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.view-switch__option.active:hover {
  color: #fff;
  transform: none;
}

.detail-body--enter {
  animation: diaryDetailRiseIn 0.42s ease 0.04s both;
}

.detail-skeleton {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-skeleton__title,
.detail-skeleton__line,
.detail-skeleton__pill {
  border-radius: 999px;
  background: #e7efe2;
}

.detail-skeleton__title {
  width: min(320px, 68%);
  height: 34px;
}

.detail-skeleton__line {
  width: 100%;
  height: 16px;
}

.detail-skeleton__line--short {
  width: 78%;
}

.detail-skeleton__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}

.detail-skeleton__pill {
  width: 150px;
  height: 14px;
}

.shimmer {
  position: relative;
  overflow: hidden;
}

.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.75), transparent);
  animation: diarySkeletonShimmer 1.2s ease-in-out infinite;
}

@keyframes diarySkeletonShimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes diaryDetailRiseIn {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/*
@media (max-width: 480px) {
  .nav-btn__date {
    display: none;
  }
}
*/
@media (max-width: 480px) {
  .panel {
    padding: 15px;
  }

  .detail-meta {
    gap: 0 20px;
  }

}

@media (max-width: 820px) {
  .detail-nav {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .detail-nav__pages {
    width: 100%;
  }

  .detail-header__right {
    justify-content: flex-end;
  }

  .detail-header__right > .language-switch {
    position: static;
    align-self: flex-end;
    transform: none;
  }
}

@media (max-width: 560px) {
  .detail-header__right {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .detail-header__right .view-switch {
    align-self: center;
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    flex-wrap: nowrap;
  }

  .detail-header__right .view-switch__track {
    flex: 1 1 auto;
    min-width: 0;
  }

  .detail-header__right .view-switch__option {
    min-width: 0;
    padding-inline: 4px;
  }

  .detail-header__right > .language-switch {
    flex: 0 0 auto;
  }
}
</style>
