<script setup>
import { computed, onMounted, ref } from 'vue'
import { getToken } from '../../utils/auth'
import StreakCalendar from './StreakCalendar.vue'
import bookIcon from '../../assets/icons/calendar/book.svg'
import bookGrayIcon from '../../assets/icons/calendar/book-gray.svg'

const streak = ref(0)
const todayStatus = ref(null)
const loaded = ref(false)
const calendarVisible = ref(false)
const todayCompleted = computed(() => todayStatus.value === 'completed')

const loadStreak = async () => {
  const token = getToken()
  if (!token) return

  try {
    const response = await fetch(`/api/study/streak?t=${encodeURIComponent(token)}`)
    const result = await response.json()
    if (response.ok && result.success) {
      streak.value = result.data?.currentStreak || 0
      todayStatus.value = result.data?.todayStatus || null
      loaded.value = true
    }
  } catch (e) {
    // 连胜信息只是首页辅助内容，读取失败时继续保持占位但不显示错误状态。
  }
}

onMounted(loadStreak)
</script>

<template>
  <button
    class="streak-card"
    :class="{'is-loaded': loaded}"
    aria-label="查看连胜日历"
    @click="calendarVisible = true"
  >
    <img :src="todayCompleted ? bookIcon : bookGrayIcon" alt="连胜" />
    <strong :class="{'is-inactive': !todayCompleted}">{{ streak }}</strong>
  </button>

  <StreakCalendar v-model="calendarVisible" />
</template>

<style scoped>
.streak-card {
  width: min(520px, 100%);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
  padding: 12px 20px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  cursor: pointer;
  visibility: hidden;
}

.streak-card.is-loaded { visibility: visible; }
.streak-card img { width: 38px; height: 38px; object-fit: contain; }
.streak-card strong { color: var(--color-primary-dark); font-size: 1.65rem; line-height: 1; }
.streak-card strong.is-inactive { color: #aaaaaa; }
.streak-card:focus-visible { outline: 3px solid rgba(46, 125, 50, .28); outline-offset: 4px; }
</style>
