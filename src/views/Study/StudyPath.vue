<script setup>
import { computed, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StreakSummary from './StreakSummary.vue'
import { request } from '../../services/request.js'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const parts = ref([])
const chapters = ref([])
const loading = ref(true)
const chapterLoading = ref(false)
const error = ref('')

useHead({title: () => t('study.home.page_title')})

const text = (value) => typeof value === 'string' ? value : value?.[language.value] || value?.tc || value?.sc || ''
// 学习进度接力：目前后端只有课程目录和临时的关卡 attempt，没有按用户持久化的目录进度。
// 需要新增一个按登录用户读取的进度接口，至少返回当前 partId、chapterId，以及各章节的完成状态；
// 完成练习时还要写入进度，并定义重做旧章节、跨部分与内容被删除时的定位规则。
// /study/me 在该接口完成前暂时落到目录中的第一个部分；不能用连胜天数推断学习位置。
const activePart = computed(() => route.name === 'StudyMe'
  ? parts.value[0] || null
  : parts.value.find(part => String(part.id) === String(route.params.partId)) || null)
const activeChapter = computed(() => chapters.value.find(chapter => String(chapter.id) === String(route.params.chapterId)) || null)

const load = async (_, __, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })
  loading.value = true
  error.value = ''
  try {
    const data = await request(`/api/study/curriculum/${language.value}/${dialect.value}`)
    if (!cancelled) parts.value = Array.isArray(data) ? [...data].sort((a, b) => a.partOrder - b.partOrder) : []
  } catch (e) {
    if (!cancelled) error.value = e.message || '学习路线暂时无法加载'
  } finally {
    if (!cancelled) loading.value = false
  }
}

const openPart = part => router.push({name: 'StudyPartPath', params: {language: language.value, dialect: dialect.value, partId: part.id}})
const backToParts = () => router.push({name: 'StudyParts', params: {language: language.value, dialect: dialect.value}})
const openChapter = chapter => router.push({name: 'StudyChapterPath', params: {language: language.value, dialect: dialect.value, partId: activePart.value.id, chapterId: chapter.id}})
const backToPart = () => router.push({name: 'StudyPartPath', params: {language: language.value, dialect: dialect.value, partId: activePart.value.id}})

watch([activePart, language, dialect], async ([part], _, onCleanup) => {
  chapters.value = []
  if (!part) {
    error.value = ''
    return
  }
  let cancelled = false
  onCleanup(() => { cancelled = true })
  chapterLoading.value = true
  error.value = ''
  try {
    const data = await request(`/api/study/curriculum/${language.value}/${dialect.value}/parts/${part.id}/chapters`)
    if (!cancelled) chapters.value = Array.isArray(data) ? [...data].sort((a, b) => a.chapterOrder - b.chapterOrder) : []
  } catch (e) {
    if (!cancelled) error.value = e.message || '章节暂时无法加载'
  } finally {
    if (!cancelled) chapterLoading.value = false
  }
})

watch([language, dialect], load, {immediate: true})
</script>

<template>
  <main class="study-route-page">
    <div class="study-route-shell">
      <header class="study-route-top">
        <div>
          <p class="study-route-label">学习路线</p>
          <h1>{{ activeChapter ? text(activeChapter.title) : activePart ? text(activePart.title) : $t(`dialect.${dialect}`) }}</h1>
        </div>
        <StreakSummary />
      </header>

      <template v-if="route.name === 'StudyParts'">
        <div v-if="loading" class="study-route-message">{{ $t('study.path.loading') }}</div>
        <div v-else-if="error" class="study-route-message">{{ error }}</div>
        <div v-else-if="!parts.length" class="study-route-message">{{ $t('study.path.empty') }}</div>
        <div v-else class="part-list">
          <button v-for="part in parts" :key="part.id" class="part-card" @click="openPart(part)">
            <span class="part-card-order">第 {{ part.partOrder }} 部分</span>
            <strong>{{ text(part.title) }}</strong>
            <span class="part-card-description">{{ text(part.description) }}</span>
          </button>
        </div>
      </template>

      <div v-else-if="loading" class="study-route-message">{{ $t('study.path.loading') }}</div>
      <div v-else-if="!activePart" class="study-route-message">没有找到这个部分</div>
      <template v-else-if="route.name === 'StudyChapterPath'">
        <button class="back-button" type="button" @click="backToPart">← 返回章节</button>
        <!-- 下一层课程路径尚未建立数据关联，当前不绘制模拟节点。 -->
      </template>
      <template v-else>
        <button class="back-button" type="button" @click="backToParts">← 返回学习路线</button>
        <p class="part-description">{{ text(activePart.description) }}</p>
        <div v-if="chapterLoading" class="study-route-message">{{ $t('study.path.loading') }}</div>
        <div v-else-if="error" class="study-route-message">{{ error }}</div>
        <div v-else class="part-list">
          <button v-for="chapter in chapters" :key="chapter.id" class="part-card" @click="openChapter(chapter)">
            <span class="part-card-order">第 {{ chapter.chapterOrder }} 章</span>
            <strong>{{ text(chapter.title) }}</strong>
            <span class="part-card-description">{{ text(chapter.description) }}</span>
          </button>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.study-route-page { min-height: 100vh; padding: 42px 24px 96px; color: #294533; }
.study-route-shell { max-width: 960px; margin: 0 auto; }
.study-route-top { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 32px; }
.study-route-label { margin: 0 0 8px; color: #698b70; font-size: .78rem; }
.study-route-top h1 { margin: 0; color: #275632; font-size: clamp(1.8rem, 4vw, 2.6rem); }
.study-route-top :deep(.streak-card) { width: auto; margin: 0; padding: 6px 12px; }
.study-route-top :deep(.streak-card img) { width: 30px; height: 30px; }
.study-route-message { padding: 38px 20px; color: #687d6c; text-align: center; }
.part-list { display: grid; gap: 16px; }
.part-card { display: flex; flex-direction: column; align-items: flex-start; gap: 13px; width: 100%; padding: 28px 32px; border: 1px solid #dce8dd; border-radius: 20px; color: #294533; background: #fff; text-align: left; font: inherit; cursor: pointer; }
.part-card:focus-visible, .back-button:focus-visible { outline: 3px solid #75a881; outline-offset: 3px; }
.part-card-order { color: #4f875a; font-size: .8rem; font-weight: 700; }
.part-card strong { font-size: 1.5rem; }
.part-card-description { color: #687d6c; line-height: 1.6; }
.back-button { margin: 0 0 22px; padding: 8px 0; border: 0; color: #467d51; background: none; font: inherit; cursor: pointer; }
.part-description { margin: 0 0 24px; color: #687d6c; line-height: 1.6; }
@media (max-width: 640px) { .study-route-page { padding: 26px 16px 70px; }.study-route-top { align-items: flex-start; }.part-card { padding: 22px; } }
</style>
