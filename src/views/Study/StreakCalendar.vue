<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UnifiedModal from '../../components/Window/UnifiedModal.vue'
import { getToken } from '../../utils/auth'
import { request } from '../../services/request.js'
import bookIcon from '../../assets/icons/calendar/book.svg'
import bookGrayIcon from '../../assets/icons/calendar/book-gray.svg'
import bookmarkIcon from '../../assets/icons/calendar/bookmark.svg'
import toLeftIcon from '../../assets/icons/to-left.svg'
import toRightIcon from '../../assets/icons/to-right.svg'

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
    const data = await request(`/api/study/streak?t=${encodeURIComponent(getToken())}&from=${from}&to=${to}`)
    records.value = Object.fromEntries((data.records || []).map(item => [item.date, item.status]))
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
  <UnifiedModal
    v-model="visible"
    :title="$t('study.streak.calendar')"
    size="medium"
    lock-top
  >
    <div class="calendar-toolbar">
      <button type="button" class="month-button" :aria-label="$t('study.streak.previous_month')" @click="changeMonth(-1)">
        <img :src="toLeftIcon" alt="" aria-hidden="true">
      </button>
      <h3>{{ monthTitle }}</h3>
      <button type="button" class="month-button" :aria-label="$t('study.streak.next_month')" @click="changeMonth(1)">
        <img :src="toRightIcon" alt="" aria-hidden="true">
      </button>
    </div>
    <div class="weekday-row"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
    <div
      class="calendar-grid-shell"
      :class="`calendar-grid-shell--${weeks.length}`"
    >
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
    </div>
  </UnifiedModal>
</template>

<style scoped>
.calendar-toolbar {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.calendar-toolbar h3 {
  margin: 0;
  color: #24522c;
  text-align: center;
  font-size: 1.25rem;
}

.month-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.month-button img {
  display: block;
  width: 16px;
  height: 16px;
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

.calendar-grid-shell {
  position: relative;
  overflow: hidden;
  transition: height .2s cubic-bezier(.22, .8, .3, 1);
}

.calendar-grid-shell--4 { height: 216px; }
.calendar-grid-shell--5 { height: 270px; }
.calendar-grid-shell--6 { height: 324px; }

.calendar-grid { height: 100%; }

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
  display: grid;
  height: 100%;
  place-items: center;
  padding: 0;
  color: #77907b;
  text-align: center;
}

.calendar-state.error {
  color: #b76055;
}

@media (max-width: 520px) {
  .calendar-grid-shell--4 { height: 184px; }
  .calendar-grid-shell--5 { height: 230px; }
  .calendar-grid-shell--6 { height: 276px; }

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
