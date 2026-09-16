<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { getToken } from '../../utils/auth'
import LoadingPage from '../../components/Status/LoadingPage.vue'
import { prepareLoadingText } from '../../services/loadingTextCache.js'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const phase = ref('loading')
const loadingText = ref(t('study.question.loading_text'))
const loadingComplete = ref(false)
const attemptId = ref('')
const questions = ref([])
const currentQuestionIndex = ref(0)
const currentQuestion = computed(() => questions.value[currentQuestionIndex.value] || null)
const currentCards = computed(() => currentQuestion.value?.cards || [])
const questionResults = ref([])
const mistakeCount = ref(0)

const leftCards = ref([])
const rightCards = ref([])
const leftSelected = ref(null)
const rightSelected = ref(null)
const matched = ref(new Set())
const wrongPair = ref(null)

const error = ref('')
const report = ref(null)

const EXPECTED_LOADING_DURATION_MS = 3000

useHead({title: () => t('study.common.page_title')})

const completedQuestionCount = computed(() => questionResults.value.filter(Boolean).length)
const progress = computed(() => questions.value.length === 0
    ? 0
    : Math.round((completedQuestionCount.value / questions.value.length) * 100))
const isLastQuestion = computed(() => currentQuestionIndex.value === questions.value.length - 1)

const shuffle = (items) => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const clearSelections = () => {
  leftSelected.value = null
  rightSelected.value = null
}

const beginQuestion = (index) => {
  currentQuestionIndex.value = index
  const cards = currentQuestion.value?.cards || []
  leftCards.value = shuffle(cards)
  rightCards.value = shuffle(cards)
  matched.value = new Set()
  clearSelections()
  wrongPair.value = null
  phase.value = 'playing'
}

const loadLevel = async () => {
  const token = getToken()
  if (!token) {
    phase.value = 'error'
    error.value = t('study.common.login_required')
    return
  }

  phase.value = 'loading'
  loadingComplete.value = false
  loadingText.value = prepareLoadingText(language.value, dialect.value)
  error.value = ''
  attemptId.value = ''
  questions.value = []
  questionResults.value = []
  currentQuestionIndex.value = 0
  matched.value = new Set()
  clearSelections()
  mistakeCount.value = 0
  report.value = null

  try {
    const configuredLevelId = route.query.levelId
    const levelPath = configuredLevelId
        ? `/api/study/level/start/${language.value}/${dialect.value}/${encodeURIComponent(configuredLevelId)}`
        : `/api/study/level/start/${language.value}/${dialect.value}`
    const response = await fetch(
        `${levelPath}?t=${encodeURIComponent(token)}`,
        {method: 'POST'}
    )
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || t('study.question.load_failed'))
    }

    const data = result.data || {}
    attemptId.value = data.attemptId || ''
    questions.value = Array.isArray(data.questions) ? data.questions : []
    if (!attemptId.value) throw new Error(t('study.question.attempt_failed'))
    if (questions.value.length === 0) throw new Error(t('study.question.empty'))

    loadingComplete.value = true
  } catch (e) {
    console.error(e)
    phase.value = 'error'
    error.value = e.message || t('study.question.unavailable')
  }
}

const choose = (side, card) => {
  if (phase.value !== 'playing' || matched.value.has(card.id)) return

  if (side === 'left') {
    leftSelected.value = leftSelected.value === card.id ? null : card.id
  } else {
    rightSelected.value = rightSelected.value === card.id ? null : card.id
  }

  if (leftSelected.value !== null && rightSelected.value !== null) {
    checkPair()
  }
}

const checkPair = () => {
  const left = leftSelected.value
  const right = rightSelected.value

  if (left === right) {
    matched.value = new Set([...matched.value, left])
    clearSelections()
    if (matched.value.size === currentCards.value.length) {
      const results = [...questionResults.value]
      results[currentQuestionIndex.value] = 'correct'
      questionResults.value = results
      phase.value = 'question-result'
    }
    return
  }

  // 当前配对题没有独立的错误结果，只保留旧版的短暂红色抖动反馈。
  mistakeCount.value += 1
  wrongPair.value = `${left}-${right}`
  window.setTimeout(() => {
    if (wrongPair.value === `${left}-${right}`) {
      wrongPair.value = null
      clearSelections()
    }
  }, 550)
}

const continueQuestion = () => {
  if (phase.value !== 'question-result') return
  if (isLastQuestion.value) {
    finishLevel()
    return
  }
  beginQuestion(currentQuestionIndex.value + 1)
}

const finishLevel = async () => {
  if (!['question-result', 'finish-error'].includes(phase.value) || !attemptId.value) return

  phase.value = 'finishing'
  error.value = ''
  try {
    const response = await fetch(
        `/api/study/level/finish?t=${encodeURIComponent(getToken())}`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({attemptId: attemptId.value})
        }
    )
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || t('study.question.save_failed'))
    }

    report.value = {
      questionCount: questions.value.length,
      completedCount: completedQuestionCount.value,
      mistakeCount: mistakeCount.value,
      results: [...questionResults.value],
      streakSettled: result.data?.streakSettled === true
    }
    phase.value = 'result'
  } catch (e) {
    error.value = e.message || t('study.question.save_retry')
    phase.value = 'finish-error'
  }
}

const cardClass = (side, card) => ({
  selected: (side === 'left' ? leftSelected.value : rightSelected.value) === card.id,
  matched: matched.value.has(card.id),
  wrong: side === 'left'
      ? wrongPair.value?.startsWith(`${card.id}-`)
      : wrongPair.value?.endsWith(`-${card.id}`)
})

const restart = () => loadLevel()
const backToHome = () => router.push({name: 'StudyMe'})
const finishInitialLoading = () => {
  if (phase.value === 'loading' && loadingComplete.value) beginQuestion(0)
}

onMounted(loadLevel)
</script>

<template>
  <main class="question-page" :class="{'is-loading': phase === 'loading'}">
    <LoadingPage
        v-if="phase === 'loading'"
        :text="loadingText"
        :expected-duration="EXPECTED_LOADING_DURATION_MS"
        :complete="loadingComplete"
        @finished="finishInitialLoading"
    />

    <section v-else-if="phase === 'error'" class="question-state error-state">
      <h1>{{ $t('study.question.cannot_start') }}</h1>
      <p>{{ error }}</p>
      <button class="question-button" @click="loadLevel">{{ $t('study.question.restart') }}</button>
    </section>

    <section v-else-if="phase === 'question-result'" class="question-state question-result-state">
      <p class="question-kicker">{{ $t('study.question.number', {number: currentQuestionIndex + 1}) }}</p>
      <div class="result-icon" aria-hidden="true">✓</div>
      <h1>{{ $t('study.question.correct') }}</h1>
      <p>{{ $t('study.question.completed_hint') }}</p>
      <div class="question-result-progress">{{ $t('study.question.completed_progress', {completed: completedQuestionCount, total: questions.length}) }}</div>
      <button class="question-button" @click="continueQuestion">
        {{ isLastQuestion ? $t('study.question.view_report') : $t('study.question.next') }}
      </button>
    </section>

    <section v-else-if="phase === 'finishing'" class="question-state loading-state">
      <div class="loading-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1>{{ $t('study.question.saving') }}</h1>
      <p>{{ $t('study.question.almost_done') }}</p>
    </section>

    <section v-else-if="phase === 'result'" class="question-state result-state">
      <h1>{{ $t('study.question.group_completed') }}</h1>
      <p>{{ $t('study.question.all_completed', {count: report.questionCount}) }}</p>
      <div class="result-summary">
        <div><strong>{{ report.completedCount }}</strong><span>{{ $t('study.question.completed_items') }}</span></div>
        <div><strong>{{ report.mistakeCount }}</strong><span>{{ $t('study.question.retries') }}</span></div>
      </div>
      <p class="streak-message">{{ report.streakSettled ? $t('study.question.streak_recorded') : $t('study.question.streak_not_updated') }}</p>
      <div class="result-actions">
        <button class="question-button" @click="restart">{{ $t('study.question.another_group') }}</button>
        <button class="question-button secondary-button" @click="backToHome">{{ $t('study.question.back_home') }}</button>
      </div>
    </section>

    <section v-else-if="phase === 'finish-error'" class="question-state error-state">
      <h1>{{ $t('study.question.finished') }}</h1>
      <p>{{ error }}</p>
      <button class="question-button" @click="finishLevel">{{ $t('study.question.save_again') }}</button>
    </section>

    <template v-else>
      <header class="question-header">
        <h1>{{ $t('study.question.matching') }}</h1>
        <p>{{ $t('study.question.position', {current: currentQuestionIndex + 1, total: questions.length}) }}</p>
      </header>

      <div class="question-progress" :aria-label="$t('study.question.progress')">

        <div class="progress-track"><span :style="{width: `${progress}%`}"></span></div>
      </div>

      <section class="match-board">
        <div class="card-column">
          <button
              v-for="card in leftCards"
              :key="`left-${card.id}`"
              class="match-card mandarin-card"
              :class="cardClass('left', card)"
              @click="choose('left', card)"
          >{{ card.putonghua }}
          </button>
        </div>
        <div class="card-column">

          <button
              v-for="card in rightCards"
              :key="`right-${card.id}`"
              class="match-card dialect-card"
              :class="cardClass('right', card)"
              @click="choose('right', card)"
          >
            <span v-formatted-text="card.pinyin"></span>
            <small v-if="matched.has(card.id)">{{ card.word }}</small>
          </button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.question-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 50px 24px 56px;
}

.question-page.is-loading {
  padding: 0;
}

.question-header, .match-board, .question-progress, .question-state {
  max-width: 920px;
  margin-left: auto;
  margin-right: auto;
}

.question-header {
  margin-bottom: 28px;
  text-align: center;
}

.question-kicker {
  color: var(--color-primary);
  font-size: 12px;
  letter-spacing: .18em;
  font-weight: 700;
}

.question-header h1, .question-state h1 {
  margin: 8px 0;
  color: var(--color-primary-dark);
  font-size: 30px;
}

.question-header p:last-child, .question-state p {
  color: var(--color-text-light);
}

.question-progress {
  margin-bottom: 14px;
}

.progress-copy {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--color-text-light);
  font-size: .9rem;
}

.progress-copy strong {
  color: var(--color-primary-dark);
}

.progress-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #dcebdc;
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
  transition: width .25s ease;
}

.match-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.card-column {
  padding: 15px;
  border-radius: 24px;
  background: transparent;
  box-shadow: 0 18px 40px rgba(46, 125, 50, .1);
}

.column-label {
  margin: 2px 4px 12px;
  color: var(--color-text-light);
  font-size: 13px;
  letter-spacing: .08em;
}

.match-card {
  width: 100%;
  height: 76px;
  box-sizing: border-box;
  margin-bottom: 10px;
  padding: 12px 16px;
  border: 2px solid transparent;
  border-radius: 16px;
  color: var(--color-text);
  background: white;
  font: inherit;
  cursor: pointer;
  transition: transform .2s, border-color .2s, background .2s, opacity .2s;
}

.match-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-primary-light);
}

.match-card.selected {
  border-color: var(--color-primary);
  background: #edf8ed;
}

.match-card.matched {
  border-color: #72b879;
  background: #e4f4e5;
  opacity: .82;
  cursor: default;
}

.match-card.wrong {
  border-color: var(--color-error);
  background: #fff0ef;
  animation: shake .28s linear;
}

.mandarin-card {
  font-size: 1.35rem;
  font-weight: 650;
}

.dialect-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 1.1rem;
}

.dialect-card small {
  color: var(--color-primary-dark);
  font-size: .95rem;
}

.question-state {
  padding: 60px 20px;
  text-align: center;
}

.question-state h1 {
  font-size: 30px;
}

.loading-state {
  padding-top: 20vh;
}

.error-state p {
  color: var(--color-error);
}

.question-button {
  padding: 10px 19px;
  border: 0;
  border-radius: 999px;
  color: white;
  background: var(--color-primary);
  font: inherit;
  cursor: pointer;
}

.question-button:hover {
  background: var(--color-primary-dark);
}

.loading-orbit {
  position: relative;
  width: 62px;
  height: 62px;
  margin: 0 auto 24px;
  animation: orbit 1.5s linear infinite;
}

.loading-orbit span {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary);
}

.loading-orbit span:nth-child(1) {
  top: 0;
  left: 24px;
}

.loading-orbit span:nth-child(2) {
  right: 0;
  bottom: 5px;
  opacity: .65;
}

.loading-orbit span:nth-child(3) {
  bottom: 5px;
  left: 0;
  opacity: .35;
}

@keyframes orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes shake {
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

.result-icon {
  width: 68px;
  height: 68px;
  margin: 0 auto 18px;
  border-radius: 50%;
  color: white;
  background: var(--color-primary);
  font-size: 2.5rem;
  line-height: 68px;
}

.question-result-progress {
  margin: 22px 0;
  color: var(--color-primary-dark);
  font-weight: 700;
}

.result-summary {
  display: flex;
  justify-content: center;
  gap: 48px;
  margin: 28px 0 16px;
}

.result-summary div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.result-summary strong {
  color: var(--color-primary);
  font-size: 2rem;
}

.result-summary span {
  color: var(--color-text-light);
  font-size: .82rem;
}

.streak-message {
  color: var(--color-primary-dark) !important;
  font-weight: 700;
}

.result-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.secondary-button {
  color: var(--color-primary-dark);
  background: #e5f2e5;
}

.secondary-button:hover {
  background: #d2e8d3;
}

@media (max-width: 600px) {
  .question-header h1, .question-state h1 {
    font-size: 20px
  }

  .question-page {
    padding: 50px 10px 36px;
  }

  .match-board {
    gap: 8px;
  }

  .card-column {
    padding: 9px;
    border-radius: 16px;
  }

  .match-card {
    height: 66px;
    padding: 10px 6px;
  }

  .mandarin-card {
    font-size: 1.1rem;
  }

  .dialect-card {
    font-size: .9rem;
  }

  .result-summary {
    gap: 30px;
  }
}
</style>
