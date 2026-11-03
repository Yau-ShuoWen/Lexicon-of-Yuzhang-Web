<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { User, Connection, View } from '@element-plus/icons-vue'
import diaryBodyStyle from './diaryBodyStyle.js'
import closeIcon from '../../assets/icons/close.svg'
import writingIcon from '../../assets/书写.svg'
import leftIcon from '../../assets/icons/to-left.svg'
import rightIcon from '../../assets/icons/to-right.svg'
import './diarySkeleton.css'
import { showError } from '../../services/ToastService.js'
import { getDiaryVisibilityLevel, hasPermission } from '../../utils/auth.js'
import {
  formatDateLabel,
  formatDateTimeLabel,
  getDiaryById,
  getNearbyDiaries
} from './diaryApi.js'

const route = useRoute()
const vDiaryBodyStyle = diaryBodyStyle
const router = useRouter()

const language = computed(() => String(route.params.language || 'sc'))
const dialect = computed(() => String(route.params.dialect || 'lac'))
const diaryId = computed(() => route.params.id ? String(route.params.id) : '')
const canEdit = computed(() => hasPermission('diary.edit'))
const requestedView = computed(() => String(route.query.view || '').toLowerCase())
const diaryLevel = computed(() => getDiaryVisibilityLevel())
const canSelfView = computed(() => diaryLevel.value >= 3)
const canFriendView = computed(() => diaryLevel.value >= 2)
const canStrangerView = computed(() => diaryLevel.value >= 1)
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
  return {
    self: text.value.self,
    friend: text.value.friend,
    stranger: text.value.stranger
  }
})

const viewOptions = computed(() => {
  if (visibleViewModes.value.length <= 1) {
    return []
  }
  return visibleViewModes.value.map(mode => ({
    mode,
    label: viewLabels.value[mode] ?? mode,
    icon: mode === 'self' ? User : mode === 'friend' ? Connection : View
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
          self: '私人',
          friend: '親友',
          stranger: '公開'
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
          self: '私人',
          friend: '亲友',
          stranger: '公开'
        }
))

const loading = ref(true)
const showSkeleton = ref(false)
const animateDetail = ref(false)
const diary = ref(null)
const previewImage = ref(null)
const previewZoom = ref(1)
const previewDialog = ref(null)
function openImagePreview(event) {
  const image = event.target.closest?.('.rt-picture img')
  if (!image) return
  previewImage.value = { src: image.src, alt: image.alt }
  previewZoom.value = 1
  nextTick(() => previewDialog.value?.focus())
}
function closeImagePreview() { previewImage.value = null }
function changePreviewZoom(step) { previewZoom.value = Math.min(4, Math.max(.25, previewZoom.value + step)) }
const nearby = ref({prev: null, next: null})
let skeletonTimer = null
let detailAnimationTimer = null
let loadSequence = 0

function preloadImage(url) {
  return new Promise(resolve => {
    const image = new Image()
    const timer = setTimeout(() => { image.onload = null; image.onerror = null; resolve(false) }, 10000)
    image.onload = () => { clearTimeout(timer); resolve(true) }
    image.onerror = () => { clearTimeout(timer); resolve(false) }
    image.src = url
  })
}

async function preloadDiaryImages(entry) {
  if (!entry?.content) return
  const ids = [...entry.content.matchAll(/^\{p (?:(.*?)=>)?([1-9][0-9]*)}$/gm)].map(match => match[2])
  await Promise.all([...new Set(ids)].map(async id => {
    const url = entry.images?.[id]?.url
    if (!url || await preloadImage(url)) return
    try {
      const refreshed = await refreshDiaryImages()
      const replacement = refreshed?.[id]
      if (replacement?.url && await preloadImage(replacement.url)) entry.images[id] = replacement
    } catch (error) { console.warn('日记图片预加载失败', id, error) }
  }))
}

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

useHead({
  title: () => diary.value?.date ? `${diary.value.date} - ${text.value.title}` : text.value.loadingTitle
})

function startLoading() {
  loading.value = true
  diary.value = null
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
  const sequence = ++loadSequence
  startLoading()
  try {
    const entry = diaryId.value
        ? await getDiaryById(language.value, diaryId.value, requestedView.value)
        : null
    await preloadDiaryImages(entry)
    if (sequence !== loadSequence) return
    diary.value = entry
    nearby.value = diaryId.value
        ? await getNearbyDiaries(diaryId.value, requestedView.value)
        : {prev: null, next: null}
  } catch (error) {
    if (sequence !== loadSequence) return
    console.error(error)
    showError(error.message || '加载详情失败')
    diary.value = null
    nearby.value = {prev: null, next: null}
  }
  finally {
    if (sequence === loadSequence) stopLoading()
  }
}

async function refreshDiaryImages() {
  const refreshed = await getDiaryById(language.value, diaryId.value, requestedView.value)
  return refreshed?.images || {}
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

    <nav v-if="nearby.prev || nearby.next || viewOptions.length" class="detail-nav">
      <div class="detail-nav__pages">
        <router-link v-if="nearby.prev" :to="diaryLink(nearby.prev.id)" class="nav-btn" :title="`${text.prev} · ${formatDateLabel(nearby.prev.date)}`" :aria-label="`${text.prev} · ${formatDateLabel(nearby.prev.date)}`">
          <img :src="leftIcon" alt="" />
          <span class="nav-btn__text"><span class="nav-btn__dir">{{ text.prev }}</span><span class="nav-btn__date">{{ formatDateLabel(nearby.prev.date) }}</span></span>
        </router-link>
        <span v-else class="nav-btn nav-btn--disabled"><span class="nav-btn__text"><span class="nav-btn__dir">{{ text.prev }}</span><span class="nav-btn__date" aria-hidden="true">&nbsp;</span></span></span>
        <router-link v-if="nearby.next" :to="diaryLink(nearby.next.id)" class="nav-btn nav-btn--right" :title="`${text.next} · ${formatDateLabel(nearby.next.date)}`" :aria-label="`${text.next} · ${formatDateLabel(nearby.next.date)}`">
          <span class="nav-btn__text"><span class="nav-btn__dir">{{ text.next }}</span><span class="nav-btn__date">{{ formatDateLabel(nearby.next.date) }}</span></span>
          <img :src="rightIcon" alt="" />
        </router-link>
        <span v-else class="nav-btn nav-btn--disabled nav-btn--right"><span class="nav-btn__text"><span class="nav-btn__dir">{{ text.next }}</span><span class="nav-btn__date" aria-hidden="true">&nbsp;</span></span></span>
      </div>

      <div class="detail-header__right">
        <div v-if="viewOptions.length" class="view-switch" :aria-label="text.view">
          <div
              class="view-switch__track"
              :class="`is-${viewOptions.length}`"
          >
            <button
                v-for="option in viewOptions"
                :key="option.mode"
                class="view-switch__option"
                :class="{ active: viewMode === option.mode }"
                @click="setView(option.mode)"
            >
              <component :is="option.icon" class="view-switch__icon" aria-hidden="true" />
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

    </nav>

    <div v-if="showSkeleton" class="detail-skeleton panel" aria-hidden="true">
      <div class="detail-skeleton__title diary-skeleton-shimmer"/>
      <div class="detail-skeleton__line diary-skeleton-shimmer"/>
      <div class="detail-skeleton__line diary-skeleton-shimmer"/>
      <div class="detail-skeleton__line detail-skeleton__line--short diary-skeleton-shimmer"/>
      <div class="detail-skeleton__meta">
        <span class="detail-skeleton__pill diary-skeleton-shimmer"/>
        <span class="detail-skeleton__pill diary-skeleton-shimmer"/>
        <span class="detail-skeleton__pill diary-skeleton-shimmer"/>
      </div>
    </div>

    <div v-else-if="diary" class="detail-body panel" :class="{ 'detail-body--enter': animateDetail }">
      <div class="detail-heading">
        <div class="detail-heading__main">
          <h1 class="detail-title" v-formatted-text="diary.title ?? formatDateLabel(diary.date)"/>
          <router-link v-if="canEdit" :to="diaryEditLink()" class="detail-edit-link"><img :src="writingIcon" alt="" />{{ language === 'tc' ? '編輯日記' : '编辑日记' }}</router-link>
        </div>
      </div>

      <section class="content-block">
        <div
            v-if="diary.content"
            class="content-block__body content-block__body--article"
            v-diary-body-style="{ text: diary.content, images: diary.images, refreshImages: refreshDiaryImages }"
            @dblclick="openImagePreview"
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

    <Teleport to="body">
      <div v-if="previewImage" ref="previewDialog" class="diary-detail-preview" role="dialog" aria-modal="true" aria-label="图片预览" tabindex="-1" @click.self="closeImagePreview" @keydown.esc="closeImagePreview" @wheel.prevent="changePreviewZoom($event.deltaY < 0 ? .1 : -.1)">
        <div class="diary-detail-preview__image-wrap"><button type="button" class="diary-detail-preview__close" aria-label="关闭预览" @click="closeImagePreview"><img :src="closeIcon" alt="" /></button><img :src="previewImage.src" :alt="previewImage.alt" :style="{ zoom: previewZoom }" /></div>
      </div>
    </Teleport>


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
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.back-link {
  color: var(--color-primary-dark);
  text-decoration: none;
  font-weight: 600;
}

.panel {
  background: var(--color-background);
  border: 1px solid var(--color-border-light);
  border-radius: var(--border-radius-lg);
  padding: 30px;
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
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border: 1px solid #b9d4bc;
  border-radius: 8px;
  color: var(--color-primary-dark);
  background: #f1f9f2;
  font-size: 0.82rem;
  text-decoration: none;
}
.detail-edit-link img { width: 16px; height: 16px; }

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
  padding: 0;
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
.content-block__body--article :deep(.rt-picture) { margin: 12px 0; text-align: left; }
.content-block__body--article :deep(.rt-picture img) { box-sizing: border-box; display: block; width: auto; height: auto; max-width: min(400px, 100%); max-height: 400px; margin: 0; padding: 4px; border: 1px solid #b8c8bb; border-radius: 4px; object-fit: contain; cursor: zoom-in; }
.content-block__body--article :deep(.rt-picture figcaption) { text-align: left; }
@media (max-width: 560px) {
  .content-block__body--article :deep(.rt-picture img) { width: 100%; max-width: 100%; max-height: none; }
}
.diary-detail-preview { position: fixed; z-index: 3000; inset: 0; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 50px 18px 18px; background: rgba(0, 0, 0, .55); }
.diary-detail-preview__image-wrap { position: relative; width: fit-content; margin: auto; }
.diary-detail-preview__image-wrap > img { display: block; width: auto; height: auto; max-width: calc(100vw - 36px); max-height: calc(100vh - 88px); object-fit: contain; }
.diary-detail-preview__close { position: absolute; z-index: 1; top: -40px; right: 0; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: rgba(255, 255, 255, .9); cursor: pointer; }
.diary-detail-preview__close img { width: 16px; height: 16px; filter: brightness(0); }

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
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 0;
  min-width: 0;
  min-height: 66px;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-primary-dark);
  text-decoration: none;
  transition: border-color .15s ease;
}

.nav-btn:hover {
  border-color: var(--color-primary);
}
.nav-btn img { flex: none; width: 16px; height: 16px; transition: transform .18s ease; }
.nav-btn:hover img { transform: translateX(-3px); }
.nav-btn--right:hover img { transform: translateX(3px); }
.nav-btn--right { justify-content: flex-end; text-align: right; }
.nav-btn--disabled { opacity: .35; pointer-events: none; }
.nav-btn__text { display: flex; flex-direction: column; gap: 5px; }
.nav-btn__dir { font-size: 14px; font-weight: 600; }
.nav-btn__date { color: var(--color-text-light); font-size: 13px; }

.view-switch {
  display: inline-flex;
  align-items: center;
}

.view-switch__track {
  display: inline-grid;
  align-items: center;
  gap: 8px;
}

.view-switch__track.is-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.view-switch__track.is-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.view-switch__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  background: var(--color-background);
  color: var(--color-text-light);
  min-width: 76px;
  padding: 7px 12px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: color .15s ease, background .15s ease;
}

.view-switch__option.active {
  color: var(--color-primary-dark);
  background: #eaf4e9;
}
.view-switch__icon { width: 16px; height: 16px; }

.view-switch__option:hover {
  color: var(--color-primary-dark);
}

.view-switch__option.active:hover {
  color: var(--color-primary-dark);
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
  border-radius: 4px;
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

}

@media (max-width: 560px) {
  .detail-header__right {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
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

}
</style>
