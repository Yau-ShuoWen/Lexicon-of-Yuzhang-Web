<script setup>
import { computed, onMounted, ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StreakSummary from './StreakSummary.vue'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const parts = ref([])
const loading = ref(true)
const usingDemo = ref(false)
const expandedLevel = ref(null)

useHead({title: () => t('study.home.page_title')})

const demo = [{
  id: 'demo-part-1', partOrder: 1,
  title: {sc: '完成入门', tc: '完成入門'},
  description: {sc: '从熟悉的生活场景开始，认识最常用的方言表达。', tc: '從熟悉的生活場景開始，認識最常用的方言表達。'},
  levels: [
    {id: 'demo-level-1', levelOrder: 1, title: {sc: '认识问候', tc: '認識問候'}, description: {sc: '从一句问候开始认识发音。', tc: '從一句問候開始認識發音。'}, questionCount: 3, state: 'completed'},
    {id: 'demo-level-2', levelOrder: 2, title: {sc: '简单回应', tc: '簡單回應'}, description: {sc: '听懂问候，并作出自然回应。', tc: '聽懂問候，並作出自然回應。'}, questionCount: 3, state: 'current'},
    {id: 'demo-level-3', levelOrder: 3, title: {sc: '完成对话', tc: '完成對話'}, description: {sc: '把学过的词语放进一段小对话。', tc: '把學過的詞語放進一段小對話。'}, questionCount: 4, state: 'locked'}
  ]
}]

const text = (value) => typeof value === 'string' ? value : value?.[language.value] || value?.tc || value?.sc || ''
const activePart = computed(() => parts.value[0] || null)
const levels = computed(() => activePart.value?.levels || [])
const completed = computed(() => levels.value.filter(level => level.state === 'completed').length)
const progress = computed(() => levels.value.length ? Math.round(completed.value / levels.value.length * 100) : 0)
const current = computed(() => levels.value.find(level => level.state === 'current') || levels.value.find(level => level.state !== 'locked'))

const normalize = (part) => ({
  ...part,
  levels: (part.levels || []).map((level, index) => ({
    ...level,
    state: level.state || (index === 0 ? 'current' : 'locked')
  }))
})

const load = async () => {
  try {
    const response = await fetch(`/api/study/curriculum/${language.value}/${dialect.value}`)
    const result = await response.json()
    if (!response.ok || !result.success || !Array.isArray(result.data) || !result.data.length) throw new Error()
    parts.value = result.data.map(normalize)
  } catch {
    parts.value = demo
    usingDemo.value = true
  } finally {
    expandedLevel.value = current.value?.id || null
    loading.value = false
  }
}

const start = (level) => {
  if (!level || level.state === 'locked') return
  const query = String(level.id).startsWith('demo-') ? {} : {levelId: level.id}
  router.push({name: 'StudyQuestion', params: {language: language.value, dialect: dialect.value}, query})
}

// 后端学习路线尚未完成时，主入口不依赖路线数据，直接进入学习界面。
const continueStudy = () => router.push({
  name: 'StudyQuestion',
  params: {language: language.value, dialect: dialect.value}
})

onMounted(load)
</script>

<template>
  <main class="study-path-page">
    <div class="study-path-shell">
      <header class="study-path-topbar">
        <div>
          <p class="study-path-eyebrow">{{ $t('study.path.eyebrow') }}</p>
          <p class="study-path-breadcrumb">{{ $t('study.path.breadcrumb') }} <span>/</span> {{ $t(`dialect.${dialect}`) }}</p>
        </div>
        <StreakSummary />
      </header>

      <section class="study-path-hero">
        <div>
          <span class="study-path-tag">{{ $t('study.path.tag') }}</span>
          <h1>{{ $t('study.path.hero_before') }}<br /><em>{{ $t('study.path.hero_emphasis') }}</em>{{ $t('study.path.hero_after') }}</h1>
          <p>{{ $t('study.path.intro') }}</p>
          <button class="study-path-continue" @click="continueStudy">{{ $t('study.path.continue') }} <b>→</b></button>
        </div>
        <div class="study-path-art" aria-hidden="true">
          <div class="study-path-circle"></div>
          <div class="study-path-card">
            <small>{{ $t('study.path.current_part') }}</small>
            <strong>{{ activePart ? text(activePart.title) : $t('study.path.default_part') }}</strong>
            <div class="study-path-bar"><span :style="{width: `${progress}%`}"></span></div>
            <small>{{ $t('study.path.levels_completed', {completed, total: levels.length}) }}</small>
          </div>
          <i class="study-path-note note-one">{{ $t('study.path.note_listen') }}</i><i class="study-path-note note-two">{{ $t('study.path.note_speak') }}</i>
        </div>
      </section>

      <p v-if="usingDemo" class="study-path-demo">{{ $t('study.path.demo_notice') }}</p>

      <section class="study-path-content">
        <div class="study-path-heading">
          <div><p class="study-path-eyebrow">{{ $t('study.path.your_path') }}</p><h2>{{ $t('study.path.title') }}</h2></div>
          <span>{{ $t('study.path.level_count', {completed, total: levels.length}) }}</span>
        </div>

        <section v-if="activePart" class="study-part-panel">
          <header class="study-part-header">
            <div class="study-part-number">{{ String(activePart.partOrder).padStart(2, '0') }}</div>
            <div><small>{{ $t('study.path.part_number', {number: activePart.partOrder}) }}</small><h3>{{ text(activePart.title) }}</h3><p>{{ text(activePart.description) }}</p></div>
            <strong>{{ progress }}%</strong>
          </header>
          <div class="study-level-list">
            <article v-for="level in levels" :key="level.id" class="study-level" :class="`level-${level.state}`">
              <button class="study-level-button" :disabled="level.state === 'locked'" @click="expandedLevel = expandedLevel === level.id ? null : level.id">
                <span class="study-level-icon"><span v-if="level.state === 'completed'">✓</span><span v-else-if="level.state === 'locked'">···</span><span v-else>{{ level.levelOrder }}</span></span>
                <span class="study-level-info"><small>{{ $t('study.path.level_number', {number: String(level.levelOrder).padStart(2, '0')}) }}</small><b>{{ text(level.title) }}</b><em>{{ text(level.description) }}</em></span>
                <span class="study-level-meta">{{ $t('study.path.exercise_count', {count: level.questionCount || 3}) }}<br /><strong>{{ level.state === 'completed' ? $t('study.path.completed') : level.state === 'locked' ? $t('study.path.locked') : $t('study.path.start') }}</strong></span>
                <span class="study-level-arrow" :class="{open: expandedLevel === level.id}">⌄</span>
              </button>
              <div v-if="expandedLevel === level.id && level.state !== 'locked'" class="study-level-detail">
                <p>{{ text(level.description) }}</p><button @click="start(level)">{{ level.state === 'completed' ? $t('study.path.practice_again') : $t('study.path.enter_level') }} →</button>
              </div>
            </article>
          </div>
        </section>
        <div v-else-if="loading" class="study-path-empty">{{ $t('study.path.loading') }}</div>
        <div v-else class="study-path-empty">{{ $t('study.path.empty') }}</div>
      </section>

      <footer class="study-path-footer">{{ $t('study.path.footer_part') }} <i>→</i> {{ $t('study.path.footer_level') }} <i>→</i> {{ $t('study.path.footer_exercise') }} <span>{{ $t('study.path.unlock_hint') }}</span></footer>
    </div>
  </main>
</template>

<style scoped>
.study-path-page { min-height: 100vh; padding: 42px 24px 70px; background: radial-gradient(circle at 50% -10%, #fbfff9 0, #eef8ee 47%, #dfeee1 100%); color: #24402b; }
.study-path-shell { max-width: 1080px; margin: 0 auto; }
.study-path-topbar, .study-path-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.study-path-topbar { margin-bottom: 54px; }
.study-path-topbar :deep(.streak-card) { width: auto; margin: 0; padding: 6px 12px; }
.study-path-topbar :deep(.streak-card img) { width: 30px; height: 30px; }
.study-path-topbar :deep(.streak-card strong) { font-size: 1.2rem; }
.study-path-eyebrow { margin: 0 0 6px; color: #5b9665; font-family: var(--font-family-mono); font-size: .66rem; font-weight: 700; letter-spacing: .18em; }
.study-path-breadcrumb { margin: 0; color: #708473; font-size: .84rem; }.study-path-breadcrumb span { margin: 0 7px; color: #b1c7b3; }
.study-path-hero { display: grid; grid-template-columns: 1fr 420px; align-items: center; gap: 64px; margin-bottom: 36px; }
.study-path-tag { display: inline-block; padding: 6px 11px; border: 1px solid #cfe3d0; border-radius: 999px; color: #5d8e64; background: #ffffff8c; font-size: .74rem; }
.study-path-hero h1 { margin: 17px 0 14px; color: #25432b; font-size: clamp(2.55rem, 6vw, 4.6rem); letter-spacing: -.08em; line-height: 1.08; }.study-path-hero h1 em { color: #4c9a59; font-style: normal; }
.study-path-hero p { max-width: 440px; margin: 0 0 24px; color: #718474; font-size: .9rem; line-height: 1.8; }
.study-path-continue { display: inline-flex; align-items: center; gap: 24px; padding: 12px 16px 12px 20px; border: 0; border-radius: 999px; color: #fff; background: #357e47; box-shadow: 0 10px 23px #347e4736; font: inherit; font-size: .84rem; font-weight: 700; cursor: pointer; }.study-path-continue b { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 50%; background: #ffffff2b; font-size: 1rem; }.study-path-continue:disabled { opacity: .5; cursor: default; }
.study-path-art { position: relative; min-height: 300px; }.study-path-circle { position: absolute; top: 0; right: 16px; width: 290px; height: 290px; border: 1px solid #70ad792f; border-radius: 50%; background: #ffffff36; }.study-path-card { position: absolute; top: 64px; right: 43px; display: flex; flex-direction: column; width: 250px; padding: 24px; border: 1px solid #ffffffeb; border-radius: 22px; background: #ffffffe0; box-shadow: 0 20px 43px #2c68361f; transform: rotate(4deg); }.study-path-card small { color: #85a08a; font-size: .7rem; }.study-path-card strong { margin: 8px 0 20px; color: #2f703d; font-size: 1.55rem; }.study-path-bar { height: 7px; overflow: hidden; border-radius: 99px; background: #dfedde; }.study-path-bar span { display: block; height: 100%; border-radius: inherit; background: #60a76a; }.study-path-card strong + .study-path-bar + small { margin-top: 9px; }.study-path-note { position: absolute; padding: 7px 12px; border: 1px solid #efd0bb; border-radius: 999px; color: #a57051; background: #fff8f0e8; font-size: .7rem; box-shadow: 0 7px 18px #ae734818; }.note-one { top: 22px; right: 10px; transform: rotate(10deg); }.note-two { right: 214px; bottom: 12px; transform: rotate(-8deg); }
.study-path-demo { margin: -5px 0 25px; color: #7d927f; font-size: .76rem; }.study-path-content { margin-top: 16px; }.study-path-heading { align-items: flex-end; margin-bottom: 17px; }.study-path-heading h2 { margin: 0; color: #2c4832; font-size: 1.75rem; letter-spacing: -.05em; }.study-path-heading > span { color: #719176; font-size: .76rem; }
.study-part-panel { overflow: hidden; border: 1px solid #ffffffeb; border-radius: 26px; background: #ffffffe0; box-shadow: 0 18px 43px #2b6c3518; }.study-part-header { display: grid; grid-template-columns: 62px 1fr auto; align-items: center; gap: 18px; padding: 27px 30px; }.study-part-number { display: grid; place-items: center; width: 58px; height: 58px; border: 1px solid #c4dfc5; border-radius: 18px; color: #4d9458; background: #f0faf0; font-weight: 700; }.study-part-header small { color: #78a17c; font-size: .7rem; }.study-part-header h3 { margin: 5px 0 7px; color: #326c3d; font-size: 1.38rem; }.study-part-header p { margin: 0; color: #788d7b; font-size: .78rem; }.study-part-header > strong { color: #40884c; font-size: 1.5rem; }.study-level-list { display: flex; flex-direction: column; gap: 10px; padding: 17px 21px 21px; border-top: 1px solid #e0ede1; }.study-level { overflow: hidden; border: 1px solid #dcebdd; border-radius: 17px; background: #ffffff9e; }.level-current { border-color: #a7d1aa; box-shadow: 0 8px 20px #3e8c4b12; }.level-locked { opacity: .6; }.study-level-button { display: grid; grid-template-columns: 44px 1fr auto 18px; align-items: center; gap: 13px; width: 100%; padding: 15px 17px; border: 0; background: transparent; text-align: left; font: inherit; cursor: pointer; }.study-level-button:disabled { cursor: not-allowed; }.study-level-icon { display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid #c5dfc7; border-radius: 13px; color: #4c9157; background: #f2faf2; font-weight: 700; }.level-completed .study-level-icon { color: #fff; border-color: #61a76b; background: #61a76b; }.level-locked .study-level-icon { color: #aab7aa; border-color: #d8e3d9; background: #f3f6f3; }.study-level-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.study-level-info small { color: #82a087; font-size: .65rem; letter-spacing: .08em; }.study-level-info b { overflow: hidden; color: #315d38; font-size: .95rem; text-overflow: ellipsis; white-space: nowrap; }.study-level-info em { overflow: hidden; color: #829283; font-size: .73rem; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }.study-level-meta { color: #9aae9c; font-size: .66rem; text-align: right; line-height: 1.7; }.study-level-meta strong { color: #4e9460; }.level-completed .study-level-meta strong { color: #85a18a; }.level-locked .study-level-meta strong { color: #aab5aa; }.study-level-arrow { color: #82a184; font-size: 1.1rem; transition: transform .2s; }.study-level-arrow.open { transform: rotate(180deg); }.study-level-detail { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 0 17px 15px 74px; padding: 13px 15px; border-radius: 12px; background: #f3faf3; }.study-level-detail p { margin: 0; color: #5a765f; font-size: .75rem; }.study-level-detail button { flex: 0 0 auto; padding: 8px 12px; border: 1px solid #abd2ae; border-radius: 999px; color: #408550; background: #fff; font: inherit; font-size: .7rem; font-weight: 700; cursor: pointer; }.study-path-empty { padding: 60px 20px; border: 1px dashed #c9dfca; border-radius: 20px; color: #78907c; text-align: center; }.study-path-footer { display: flex; gap: 9px; margin-top: 22px; color: #8ba38e; font-size: .7rem; }.study-path-footer i { color: #bfd2c0; font-style: normal; }.study-path-footer span { margin-left: auto; }
@media (max-width: 760px) { .study-path-page { padding: 30px 13px 48px; }.study-path-topbar { margin-bottom: 32px; }.study-path-hero { display: block; }.study-path-art { min-height: 270px; margin-top: 8px; }.study-path-circle { right: 50%; transform: translateX(50%); }.study-path-card { right: 50%; transform: translateX(50%) rotate(4deg); }.note-one { right: calc(50% - 145px); }.note-two { right: calc(50% + 70px); }.study-part-header { grid-template-columns: 52px 1fr; padding: 21px 18px; }.study-part-number { width: 50px; height: 50px; border-radius: 15px; }.study-part-header > strong { grid-column: 2; text-align: left; }.study-level-list { padding: 13px 10px 15px; }.study-level-button { grid-template-columns: 39px 1fr 17px; padding: 13px 8px; gap: 10px; }.study-level-icon { width: 35px; height: 35px; border-radius: 11px; }.study-level-meta { display: none; }.study-level-detail { align-items: flex-start; flex-direction: column; margin-left: 57px; }.study-path-footer { flex-wrap: wrap; }.study-path-footer span { width: 100%; margin-left: 0; } }
</style>
