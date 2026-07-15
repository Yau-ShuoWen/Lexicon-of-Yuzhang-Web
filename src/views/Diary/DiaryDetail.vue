<script setup>
import { computed, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute } from 'vue-router'
import LoadingIcon from '../../components/Status/LoadingIcon.vue'
import LanguageSelector from '../../components/Select/LanguageSelector.vue'
import { showError } from '../../services/ToastService.js'
import {
  formatDateLabel,
  formatDateTimeLabel,
  getDiaryById
} from './diaryApi.js'

const route = useRoute()

const language = computed(() => String(route.params.language || 'sc'))
const dialect = computed(() => String(route.params.dialect || 'lac'))
const diaryId = computed(() => route.params.id ? String(route.params.id) : '')

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
      updatedTime: '最後更新'
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
      updatedTime: '最后更新'
    }
))

const loading = ref(true)
const diary = ref(null)

const backQuery = computed(() => {
  const query = {}
  if (route.query.year) query.year = String(route.query.year)
  if (route.query.month) query.month = String(route.query.month)
  if (route.query.startDate) query.startDate = String(route.query.startDate)
  if (route.query.endDate) query.endDate = String(route.query.endDate)
  if (route.query.limit) query.limit = String(route.query.limit)
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

async function loadDiary() {
  loading.value = true
  try {
    diary.value = diaryId.value
      ? await getDiaryById(language.value, diaryId.value)
      : null
  } catch (error) {
    console.error(error)
    showError(error.message || '加载详情失败')
    diary.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [language.value, diaryId.value],
  loadDiary,
  { immediate: true }
)
</script>

<template>
  <div class="broaden-layout diary-detail">
    <div class="detail-header">
      <router-link :to="backToList" class="back-link">
        {{ text.back }}
      </router-link>
      <LanguageSelector />
    </div>

    <LoadingIcon v-if="loading" />

    <div v-else-if="diary" class="detail-body panel">
      <h1 class="detail-title">{{ formatDateLabel(diary.date) }}</h1>

      <div class="detail-meta">
        <span v-if="diary.startDate">{{ text.startDate }}: {{ formatDateLabel(diary.startDate) }}</span>
        <span v-if="diary.finalizeDate">{{ text.finalizeDate }}: {{ formatDateLabel(diary.finalizeDate) }}</span>
        <span v-if="diary.createdTime">{{ text.createdTime }}: {{ formatDateTimeLabel(diary.createdTime) }}</span>
        <span v-if="diary.updatedTime">{{ text.updatedTime }}: {{ formatDateTimeLabel(diary.updatedTime) }}</span>
      </div>

<!--      <section v-if="diary.abridge" class="content-block">-->
<!--        <div class="content-block__title" v-formatted-text="text.summary" />-->
<!--        <div class="content-block__body" v-formatted-text="diary.abridge" />-->
<!--      </section>-->

      <section class="content-block">
<!--        <div class="content-block__title" v-formatted-text="text.content" />-->
        <div
          v-if="diary.content"
          class="content-block__body content-block__body--article"
          v-formatted-text="diary.content"
        />
        <div v-else class="empty-box" v-formatted-text="text.noContent" />
      </section>
    </div>

    <div v-else class="empty-box panel" v-formatted-text="text.notFound" />
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
  margin-bottom: 20px;
}

.back-link {
  color: var(--color-primary-dark);
  text-decoration: none;
  font-weight: 600;
}

.panel {
  background: var(--color-background);
  border: 2px solid var(--color-primary-light);
  border-radius: var(--border-radius-md);
  padding: 30px;
}

.detail-title {
  margin: 0 0 12px;
  color: var(--color-primary-dark);
  font-size: 32px;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  margin-bottom: 20px;
  color: var(--color-text-light);
  font-size: 14px;
}

.content-block + .content-block {
  margin-top: 22px;
}

.content-block__title {
  margin-bottom: 12px;
  font-size: 22px;
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
</style>
