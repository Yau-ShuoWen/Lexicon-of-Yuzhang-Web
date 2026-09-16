<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getToken } from '../../utils/auth'
import bookIcon from '../../assets/icons/calendar/book.svg'
import bookGrayIcon from '../../assets/icons/calendar/book-gray.svg'
import bookmarkIcon from '../../assets/icons/calendar/bookmark.svg'

const props = defineProps({
  modelValue: {type: Boolean, default: false}
})
const emit = defineEmits(['update:modelValue'])
const {t, tm} = useI18n()
const visible = computed({get: () => props.modelValue, set: value => emit('update:modelValue', value)})

const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = formatDate(new Date())
const currentMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const records = ref({})
const loading = ref(false)
const error = ref('')
const weekdays = computed(() => tm('study.streak.weekdays'))

const monthTitle = computed(() => t('study.streak.month_title', {
  year: currentMonth.value.getFullYear(),
  month: currentMonth.value.getMonth() + 1
}))
const monthRange = computed(() => {
  const first = currentMonth.value
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const firstOffset = (first.getDay() + 6) % 7
  const lastOffset = 6 - ((last.getDay() + 6) % 7)
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - firstOffset)
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + lastOffset)
  return {start, end, from: formatDate(start), to: formatDate(end)}
})
const statusOf = (date) => records.value[formatDate(date)] || 'empty'
const isCurrentMonth = (date) => date.getMonth() === currentMonth.value.getMonth() && date.getFullYear() === currentMonth.value.getFullYear()
const weeks = computed(() => {
  const result = []
  const cursor = new Date(monthRange.value.start)
  while (cursor <= monthRange.value.end) {
    const days = Array.from({length: 7}, () => {
      const date = new Date(cursor)
      cursor.setDate(cursor.getDate() + 1)
      const key = formatDate(date)
      return {
        date,
        key,
        number: date.getDate(),
        status: statusOf(date),
        isToday: key === today,
        isCurrentMonth: isCurrentMonth(date)
      }
    })
    const allCompleted = days.every(day => day.status === 'completed')
    const segments = []
    let start = null
    days.forEach((day, index) => {
      const connected = day.status === 'completed' || day.status === 'protected'
      if (connected && start === null) start = index
      if ((!connected || index === 6) && start !== null) {
        const end = connected && index === 6 ? index : index - 1
        segments.push({start, length: end - start + 1})
        start = null
      }
    })
    result.push({days, fullWeek: allCompleted, segments})
  }
  return result
})

const load = async () => {
  loading.value = true;
  error.value = ''
  try {
    const {from, to} = monthRange.value
    const response = await fetch(`/api/study/streak?t=${encodeURIComponent(getToken())}&from=${from}&to=${to}`)
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || t('study.streak.load_failed'))
    records.value = Object.fromEntries((result.data.records || []).map(item => [item.date, item.status]))
  } catch (e) {
    error.value = e.message || t('study.streak.load_failed')
  }
  finally {
    loading.value = false
  }
}
const changeMonth = (offset) => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + offset, 1)
}
watch([visible, currentMonth], () => {
  if (visible.value) load()
}, {immediate: true})
</script>

<template>
  <div v-if="visible" class="calendar-backdrop" @click.self="visible = false">
    <section class="calendar-dialog" role="dialog" aria-modal="true" :aria-label="$t('study.streak.calendar')">
      <header class="calendar-header">
        <button class="month-button" :aria-label="$t('study.streak.previous_month')" @click="changeMonth(-1)">‹</button>
        <h2>{{ monthTitle }}</h2>
        <button class="month-button" :aria-label="$t('study.streak.next_month')" @click="changeMonth(1)">›</button>
        <button class="close-button" :aria-label="$t('study.streak.close_calendar')" @click="visible = false">×</button>
      </header>
      <div class="weekday-row"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
      <p v-if="loading" class="calendar-state">{{ $t('study.streak.loading') }}</p>
      <p v-else-if="error" class="calendar-state error">{{ error }}</p>
      <div v-else class="calendar-grid">
        <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="calendar-week">
          <span v-if="week.fullWeek" class="streak-pill full-pill" aria-hidden="true"/>
          <span v-else v-for="segment in week.segments" :key="`${segment.start}-${segment.length}`"
                class="streak-pill light-pill"
                :style="{left: `${segment.start * (100 / 7)}%`, width: `${segment.length * (100 / 7)}%`}"
                aria-hidden="true"/>
          <div v-for="day in week.days" :key="day.key" class="calendar-day"
               :class="{outside: !day.isCurrentMonth, protected: day.status === 'protected', completed: day.status === 'completed', missed: day.status === 'missed', today: day.isToday}">
            <img v-if="day.status === 'protected'" class="calendar-icon bookmark-icon" :src="bookmarkIcon"
                 :alt="$t('study.streak.protected_day')"/>
            <img v-else-if="day.isToday" class="calendar-icon"
                 :src="day.status === 'completed' ? bookIcon : bookGrayIcon"
                 :alt="day.status === 'completed' ? $t('study.streak.today_completed') : $t('study.streak.today_incomplete')"/>
            <span v-else class="day-number">{{ day.number }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.calendar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(32, 59, 36, .35);
  backdrop-filter: blur(5px);
}

.calendar-dialog {
  width: min(620px, 100%);
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, .9);
  border-radius: 25px;
  background: #fbfffb;
  box-shadow: 0 25px 80px rgba(30, 70, 35, .25);
}

.calendar-header {
  display: grid;
  grid-template-columns: 40px 1fr 40px 36px;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

h2 {
  margin: 0;
  color: #24522c;
  text-align: center;
  font-size: 1.25rem;
}

.month-button, .close-button {
  border: 0;
  border-radius: 50%;
  color: #397345;
  background: #edf7ed;
  cursor: pointer;
}

.month-button {
  width: 36px;
  height: 36px;
  font-size: 1.8rem;
  line-height: 1;
}

.close-button {
  width: 30px;
  height: 30px;
  font-size: 1.4rem;
}

.weekday-row, .calendar-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.weekday-row {
  margin-bottom: 7px;
  color: #89a08d;
  font-size: .75rem;
  text-align: center;
}

.calendar-week {
  position: relative;
  min-height: 54px;
}

.calendar-day {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  color: #58715d;
  font-size: .9rem;
}

.calendar-day.outside {
  color: #c3cec4;
}

.calendar-day.today {
  color: transparent;
}

.day-number {
  position: relative;
  z-index: 2;
}

.calendar-day.completed .day-number {
  color: white;
  font-weight: 700;
}

.calendar-icon {
  position: relative;
  z-index: 2;
  width: 29px;
  height: 29px;
  object-fit: contain;
}

.bookmark-icon {
  width: 25px;
  height: 30px;
}

.streak-pill {
  position: absolute;
  top: 7px;
  bottom: 7px;
  z-index: 0;
  border-radius: 999px;
  pointer-events: none;
}

.full-pill {
  left: 0;
  width: 100%;
  background: #438951;
}

.light-pill {
  background: #a8d3a9;
}

.calendar-state {
  padding: 45px 0;
  color: #77907b;
  text-align: center;
}

.calendar-state.error {
  color: #b76055;
}

@media (max-width: 520px) {
  .calendar-backdrop {
    padding: 10px;
  }

  .calendar-dialog {
    padding: 17px 11px;
    border-radius: 20px;
  }

  .calendar-day {
    min-height: 46px;
  }

  .calendar-week {
    min-height: 46px;
  }

  .calendar-icon {
    width: 25px;
    height: 25px;
  }

  .bookmark-icon {
    width: 22px;
    height: 27px;
  }
}
</style>
