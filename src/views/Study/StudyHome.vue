<script setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'
import { getToken } from '../../utils/auth'
import StreakSummary from './StreakSummary.vue'

const route = useRoute()
const router = useRouter()
const starting = ref(false)
const error = ref('')

useHead({title: '学习路线 · 词典'})

const startStudy = async () => {
  if (starting.value) return

  const token = getToken()
  if (!token) {
    error.value = '请先登录后再开始学习。'
    return
  }

  starting.value = true
  // 先切换到关卡页面，由关卡页面展示统一的加载状态并创建 attempt。
  try {
    await router.push({
      name: 'StudyQuestion',
      params: {
        language: route.params.language,
        dialect: route.params.dialect
      }
    })
  } catch (e) {
    starting.value = false
    error.value = '暂时无法打开学习页面，请稍后再试。'
  }
}

</script>

<template>
  <StreakSummary />

  <main class="study-home">



    <section class="start-card">
      <p class="page-kicker">STUDY</p>
      <h1>开始学习</h1>
      <p class="intro">用一组词语配对练习，熟悉当前方言的读音。</p>
      <button class="start-button" :disabled="starting" @click="startStudy">
        {{ starting ? '准备中……' : '开始学习' }}
      </button>
      <p v-if="error" class="error-message">{{ error }}</p>
    </section>


  </main>
</template>

<style scoped>
.study-home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 112px 24px 56px;
}

.start-card {
  width: min(520px, 100%);
  box-sizing: border-box;
  padding: 44px 34px;
  border: 1px solid rgba(255, 255, 255, .86);
  border-radius: 30px;
  text-align: center;
  background: rgba(255, 255, 255, .72);
  box-shadow: 0 24px 65px rgba(46, 125, 50, .14);
}

.page-kicker {
  margin: 0 0 10px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .2em;
}

h1 {
  margin: 0;
  color: var(--color-primary-dark);
  font-size: clamp(2.2rem, 7vw, 3.8rem);
  letter-spacing: -.06em;
}

.intro {
  margin: 16px auto 30px;
  color: var(--color-text-light);
  line-height: 1.7;
}

.start-button {
  min-width: 170px;
  padding: 13px 26px;
  border: 0;
  border-radius: 999px;
  color: white;
  font: inherit;
  font-weight: 700;
  background: var(--color-primary);
  box-shadow: 0 9px 20px rgba(46, 125, 50, .24);
  cursor: pointer;
}

.start-button:hover { background: var(--color-primary-dark); }
.start-button:disabled { opacity: .6; cursor: default; }

.error-message {
  margin: 18px 0 0;
  color: var(--color-error);
  font-size: .88rem;
}

@media (max-width: 600px) {
  .study-home { padding: 92px 12px 36px; }
  .start-card { padding: 36px 22px; }
}
</style>
