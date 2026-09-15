<script setup>
import {computed, ref, watch} from 'vue'
import axios from 'axios'
import {useHead} from '@vueuse/head'
import {getToken} from '../../../utils/auth.js'
import {showError, showSuccess} from '../../../services/ToastService.js'
import bookIcon from '../../../assets/icons/calendar/book.svg'
import bookGrayIcon from '../../../assets/icons/calendar/book-gray.svg'
import bookmarkIcon from '../../../assets/icons/calendar/bookmark.svg'

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const now = new Date()
const today = formatDate(now)
const currentMonth = ref(new Date(now.getFullYear(), now.getMonth(), 1))
const keyword = ref('')
const users = ref([])
const selectedUser = ref(null)
const records = ref({})
const overview = ref(null)
const selectedDate = ref(null)
const selectedStatus = ref('completed')
const loadingUsers = ref(false)
const loadingOverview = ref(false)
const saving = ref(false)
const error = ref('')
const weekdays = ['一', '二', '三', '四', '五', '六', '日']

const statusOptions = [
  {value: 'completed', label: '完成'},
  {value: 'protected', label: '保护'},
  {value: 'missed', label: '错过'}
]

const statusLabel = (status) => statusOptions.find(item => item.value === status)?.label || '未记录'
const sourceLabel = (source) => source === 'admin' ? '管理员调整' : '自然产生'
const selectedUserLabel = computed(() => {
  if (!selectedUser.value) return ''
  return `${selectedUser.value.username}（用户 ID：${selectedUser.value.id}）`
})
const monthTitle = computed(() => `${currentMonth.value.getFullYear()} 年 ${currentMonth.value.getMonth() + 1} 月`)
const canGoNext = computed(() => {
  const current = currentMonth.value
  return current.getFullYear() < now.getFullYear()
    || (current.getFullYear() === now.getFullYear() && current.getMonth() < now.getMonth())
})
const monthRange = computed(() => {
  const first = currentMonth.value
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const firstOffset = (first.getDay() + 6) % 7
  const lastOffset = 6 - ((last.getDay() + 6) % 7)
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - firstOffset)
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + lastOffset)
  return {start, end, from: formatDate(start), to: formatDate(end)}
})
const recordOf = (date) => records.value[formatDate(date)] || null
const isCurrentMonth = (date) => date.getMonth() === currentMonth.value.getMonth()
  && date.getFullYear() === currentMonth.value.getFullYear()
const weeks = computed(() => {
  const result = []
  const cursor = new Date(monthRange.value.start)
  while (cursor <= monthRange.value.end) {
    const days = Array.from({length: 7}, () => {
      const date = new Date(cursor)
      cursor.setDate(cursor.getDate() + 1)
      const key = formatDate(date)
      const record = recordOf(date)
      return {
        key,
        number: date.getDate(),
        status: record?.status || 'empty',
        recordSource: record?.recordSource || null,
        isToday: key === today,
        isFuture: key > today,
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
const selectedRecord = computed(() => selectedDate.value ? records.value[selectedDate.value] || null : null)

const searchUsers = async () => {
  if (!keyword.value.trim()) {
    error.value = '请输入用户名、手机号或用户编号'
    users.value = []
    return
  }

  loadingUsers.value = true
  error.value = ''
  try {
    const response = await axios.get('/api/admin/study/streak/users', {
      params: {t: getToken(), keyword: keyword.value.trim()}
    })
    if (!response.data.success) throw new Error(response.data.message || '查询用户失败')
    users.value = response.data.data || []
    if (users.value.length === 0) error.value = '没有找到匹配的用户'
  } catch (e) {
    error.value = e.response?.data?.message || e.message || '查询用户失败'
  } finally {
    loadingUsers.value = false
  }
}

const loadOverview = async () => {
  if (!selectedUser.value) return
  loadingOverview.value = true
  error.value = ''
  try {
    const {from, to} = monthRange.value
    const response = await axios.get(`/api/admin/study/streak/${selectedUser.value.id}/overview`, {
      params: {t: getToken(), from, to}
    })
    if (!response.data.success) throw new Error(response.data.message || '读取连胜数据失败')
    overview.value = response.data.data
    records.value = Object.fromEntries((overview.value.records || []).map(record => [record.date, record]))
  } catch (e) {
    error.value = e.response?.data?.message || e.message || '读取连胜数据失败'
  } finally {
    loadingOverview.value = false
  }
}

const selectUser = (user) => {
  selectedUser.value = user
  currentMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
  overview.value = null
  records.value = {}
  selectedDate.value = null
}

const changeMonth = (offset) => {
  if (offset > 0 && !canGoNext.value) return
  selectedDate.value = null
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + offset, 1)
}

const selectDay = (day) => {
  if (day.isFuture) return
  selectedDate.value = day.key
  selectedStatus.value = day.status === 'empty' ? 'completed' : day.status
}

const closeEditor = () => {
  selectedDate.value = null
}

const saveSelectedDate = async () => {
  if (!selectedUser.value || !selectedDate.value) return
  saving.value = true
  error.value = ''
  try {
    const response = await axios.patch(
      `/api/admin/study/streak/${selectedUser.value.id}/record`,
      {date: selectedDate.value, status: selectedStatus.value},
      {params: {t: getToken()}}
    )
    if (!response.data.success) throw new Error(response.data.message || '修改连胜记录失败')
    const changedDate = selectedDate.value
    await loadOverview()
    selectedDate.value = null
    showSuccess(`${changedDate} 已修改为${statusLabel(selectedStatus.value)}`)
  } catch (e) {
    error.value = e.response?.data?.message || e.message || '修改连胜记录失败'
    showError(error.value)
  } finally {
    saving.value = false
  }
}

watch(currentMonth, () => {
  if (selectedUser.value) loadOverview()
})

useHead({title: '用户连胜管理'})
</script>

<template>
  <div class="broaden-layout streak-admin">
    <header class="page-header">
      <h1>用户连胜管理</h1>
      <p>选择用户后，直接在日历中点击需要调整的日期。</p>
    </header>

    <section class="panel search-panel">
      <form class="search-form" @submit.prevent="searchUsers">
        <input v-model="keyword" class="ordinary-input" placeholder="用户名、手机号或用户 ID" />
        <button type="submit" :disabled="loadingUsers">{{ loadingUsers ? '查询中……' : '查询用户' }}</button>
      </form>
      <div v-if="users.length" class="user-list">
        <button v-for="user in users" :key="user.id" class="user-item"
                :class="{selected: selectedUser?.id === user.id}" @click="selectUser(user)">
          <strong>{{ user.username }}</strong>
          <span>ID：{{ user.id }} · {{ user.phone || '未绑定手机号' }}</span>
        </button>
      </div>
    </section>

    <p v-if="error" class="error-text">{{ error }}</p>

    <template v-if="selectedUser">
      <section class="panel selected-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">当前用户</p>
            <h2>{{ selectedUserLabel }}</h2>
          </div>
          <button :disabled="loadingOverview" @click="loadOverview">
            {{ loadingOverview ? '读取中……' : '刷新数据' }}
          </button>
        </div>

        <div v-if="overview" class="metrics">
          <div><strong>{{ overview.currentStreak }}</strong><span>当前连胜</span></div>
          <div><strong>{{ overview.longestStreak }}</strong><span>最长连胜</span></div>
          <div><strong>{{ overview.completedDays }}</strong><span>完成天数</span></div>
          <div><strong>{{ overview.protectedDays }}</strong><span>保护天数</span></div>
          <div><strong>{{ overview.protectionBalance }}</strong><span>保护次数</span></div>
        </div>
      </section>

      <section class="panel calendar-panel">
        <div class="calendar-workspace">
          <div class="calendar-main">
            <header class="calendar-header">
              <button class="month-button" aria-label="上个月" @click="changeMonth(-1)">‹</button>
              <h2>{{ monthTitle }}</h2>
              <button class="month-button" aria-label="下个月" :disabled="!canGoNext" @click="changeMonth(1)">›</button>
            </header>

            <div class="calendar-legend">
              <span><i class="legend-dot completed-dot" />完成</span>
              <span><i class="legend-dot protected-dot" />保护</span>
              <span><i class="legend-dot missed-dot" />错过</span>
              <span><i class="admin-mark legend-admin">管</i>管理员调整</span>
            </div>
            <div class="weekday-row"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>

            <p v-if="loadingOverview && !overview" class="calendar-state">正在读取……</p>
            <div v-else class="calendar-grid" :class="{loading: loadingOverview}">
              <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="calendar-week">
                <span v-if="week.fullWeek" class="streak-pill full-pill" aria-hidden="true" />
                <span v-else v-for="segment in week.segments" :key="`${segment.start}-${segment.length}`"
                      class="streak-pill light-pill"
                      :style="{left: `${segment.start * (100 / 7)}%`, width: `${segment.length * (100 / 7)}%`}"
                      aria-hidden="true" />
                <button v-for="day in week.days" :key="day.key" class="calendar-day"
                        :class="{
                          outside: !day.isCurrentMonth,
                          protected: day.status === 'protected',
                          completed: day.status === 'completed',
                          missed: day.status === 'missed',
                          today: day.isToday,
                          selected: selectedDate === day.key
                        }"
                        :disabled="day.isFuture || loadingOverview"
                        :aria-label="`${day.key}，${statusLabel(day.status)}${day.recordSource === 'admin' ? '，管理员调整' : ''}`"
                        @click="selectDay(day)">
                  <img v-if="day.status === 'protected'" class="calendar-icon bookmark-icon" :src="bookmarkIcon" alt="" />
                  <img v-else-if="day.isToday" class="calendar-icon"
                       :src="day.status === 'completed' ? bookIcon : bookGrayIcon" alt="" />
                  <span v-else class="day-number">{{ day.number }}</span>
                  <i v-if="day.recordSource === 'admin'" class="admin-mark">管</i>
                </button>
              </div>
            </div>

            <p class="calendar-hint">未来日期不可调整；点击日期即可查看并修改当天状态。</p>
          </div>

          <aside class="date-editor" aria-label="日期调整区">
            <template v-if="selectedDate">
              <header>
                <div>
                  <p class="eyebrow">调整连胜日期</p>
                  <h2>{{ selectedDate }}</h2>
                </div>
                <button class="close-button" aria-label="取消选择" @click="closeEditor">×</button>
              </header>

              <div class="record-summary">
                <span>当前状态<strong>{{ statusLabel(selectedRecord?.status) }}</strong></span>
                <span>记录来源<strong>{{ selectedRecord ? sourceLabel(selectedRecord.recordSource) : '尚无记录' }}</strong></span>
              </div>

              <fieldset>
                <legend>修改为</legend>
                <label v-for="item in statusOptions" :key="item.value"
                       :class="{selected: selectedStatus === item.value}">
                  <input v-model="selectedStatus" type="radio" :value="item.value" />
                  {{ item.label }}
                </label>
              </fieldset>

              <p class="source-notice">保存后，本次记录来源将标记为“管理员调整”。</p>
              <div class="editor-actions">
                <button class="secondary-button" :disabled="saving" @click="closeEditor">取消</button>
                <button class="primary-button" :disabled="saving" @click="saveSelectedDate">
                  {{ saving ? '保存中……' : '保存调整' }}
                </button>
              </div>
            </template>
            <div v-else class="editor-empty">
              <span class="empty-calendar-icon">日</span>
              <h2>选择一个日期</h2>
              <p>点击左侧日历中的日期，在这里查看记录来源并调整当天状态。</p>
            </div>
          </aside>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.streak-admin { max-width: 980px; margin: 0 auto; padding-top: 34px; padding-bottom: 60px; color: var(--color-text); }
.page-header { margin-bottom: 28px; }
.page-header h1 { margin: 0 0 8px; color: var(--color-primary-dark); }
.page-header p { margin: 0; color: var(--color-text-light); }
.eyebrow { margin: 0 0 6px; color: var(--color-primary); font-size: 12px; letter-spacing: .16em; font-weight: 700; }
.panel { margin-top: 20px; padding: 24px; border: 1px solid #d7e8d8; border-radius: 20px; background: rgba(255,255,255,.8); box-shadow: 0 12px 30px rgba(46,125,50,.08); }
.search-form { display: flex; gap: 10px; }
.search-form input { flex: 1; min-width: 0; }
button { padding: 9px 16px; border: 0; border-radius: 999px; color: var(--color-primary-dark); background: #e9f5e9; cursor: pointer; }
button:hover:not(:disabled) { background: #d7ecd8; }
button:disabled { cursor: not-allowed; opacity: .45; }
.search-form button, .primary-button { color: white; background: var(--color-primary); }
.user-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 16px; }
.user-item { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; text-align: left; border: 1px solid #d7e8d8; border-radius: 12px; }
.user-item.selected { border-color: var(--color-primary); background: #e4f3e5; }
.user-item span, .calendar-hint { color: var(--color-text-light); font-size: .85rem; }
.error-text { margin: 18px 0 0; color: #b42318; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
h2 { margin: 0; color: var(--color-primary-dark); font-size: 1.25rem; }
input.ordinary-input { min-height: 38px; padding: 0 12px; border: 1px solid #c7dfc9; border-radius: 9px; font: inherit; color: var(--color-text); background: white; }
.metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-top: 24px; text-align: center; }
.metrics div { display: flex; flex-direction: column; gap: 5px; padding: 12px 8px; border-radius: 12px; background: #f1f8f1; }
.metrics strong { color: var(--color-primary); font-size: 1.7rem; }
.metrics span { color: var(--color-text-light); font-size: .8rem; }
.calendar-panel { overflow: hidden; }
.calendar-workspace { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(285px, .8fr); gap: 24px; }
.calendar-main { min-width: 0; padding: 4px 8px 0; }
.calendar-header { display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; gap: 8px; margin-bottom: 14px; }
.calendar-header h2 { text-align: center; }
.month-button, .close-button { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border-radius: 50%; font-size: 1.7rem; line-height: 1; }
.calendar-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 18px; margin-bottom: 18px; color: var(--color-text-light); font-size: .78rem; }
.calendar-legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend-dot { width: 9px; height: 9px; border-radius: 50%; }
.completed-dot { background: #438951; }
.protected-dot { background: #a8d3a9; }
.missed-dot { background: #c7796e; }
.legend-admin { position: static !important; }
.weekday-row, .calendar-week { display: grid; grid-template-columns: repeat(7, 1fr); }
.weekday-row { margin-bottom: 7px; color: #89a08d; font-size: .75rem; text-align: center; }
.calendar-grid.loading { opacity: .5; pointer-events: none; }
.calendar-week { position: relative; min-height: 58px; }
.calendar-day { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 58px; padding: 0; border: 2px solid transparent; border-radius: 14px; color: #58715d; font: inherit; background: transparent; }
.calendar-day:hover:not(:disabled) { background: rgba(46,125,50,.1); }
.calendar-day:disabled { opacity: .35; }
.calendar-day.outside { color: #c3cec4; }
.calendar-day.today { color: transparent; }
.calendar-day.selected { border-color: var(--color-primary); }
.calendar-day.missed .day-number { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; color: #a44e45; background: #f8e8e5; font-weight: 700; }
.day-number { position: relative; z-index: 2; }
.calendar-day.completed .day-number { color: white; font-weight: 700; }
.calendar-icon { position: relative; z-index: 2; width: 29px; height: 29px; object-fit: contain; }
.bookmark-icon { width: 25px; height: 30px; }
.streak-pill { position: absolute; top: 7px; bottom: 7px; z-index: 0; border-radius: 999px; pointer-events: none; }
.full-pill { left: 0; width: 100%; background: #438951; }
.light-pill { background: #a8d3a9; }
.admin-mark { position: absolute; top: 2px; right: 3px; z-index: 3; display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; color: white; background: #8166b1; font-size: 9px; font-style: normal; font-weight: 700; }
.calendar-state { padding: 70px 0; color: #77907b; text-align: center; }
.calendar-hint { margin: 16px 0 0; text-align: center; }
.date-editor { min-height: 390px; padding: 22px; border: 1px solid #d7e8d8; border-radius: 18px; background: #f8fcf8; box-shadow: inset 0 1px 0 rgba(255,255,255,.9); }
.date-editor > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.record-summary { display: grid; grid-template-columns: 1fr; gap: 10px; margin: 22px 0; }
.record-summary span { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: 12px; color: var(--color-text-light); background: #f1f8f1; font-size: .78rem; }
.record-summary strong { color: var(--color-primary-dark); font-size: .95rem; }
fieldset { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin: 0; padding: 0; border: 0; }
legend { margin-bottom: 9px; color: var(--color-text-light); font-size: .8rem; font-weight: 700; }
fieldset label { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 8px; border: 1px solid #c7dfc9; border-radius: 11px; cursor: pointer; }
fieldset label.selected { border-color: var(--color-primary); color: var(--color-primary-dark); background: #e4f3e5; font-weight: 700; }
.source-notice { margin: 16px 0; color: var(--color-text-light); font-size: .82rem; }
.editor-actions { display: flex; justify-content: flex-end; gap: 10px; }
.secondary-button { background: #edf3ed; }
.editor-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 345px; padding: 20px; color: var(--color-text-light); text-align: center; }
.editor-empty h2 { margin-top: 14px; }
.editor-empty p { max-width: 230px; margin: 9px 0 0; font-size: .86rem; line-height: 1.65; }
.empty-calendar-icon { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 16px; color: var(--color-primary); background: #e4f3e5; font-size: 1.2rem; font-weight: 700; }
@media (max-width: 840px) {
  .calendar-workspace { grid-template-columns: 1fr; }
  .date-editor { min-height: 0; }
  .record-summary { grid-template-columns: 1fr 1fr; }
  .editor-empty { min-height: 150px; }
}
@media (max-width: 700px) {
  .streak-admin { padding-top: 20px; padding-bottom: 40px; }
  .panel { padding: 18px; }
  .section-heading { flex-direction: column; }
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .calendar-panel { padding-right: 12px; padding-left: 12px; }
  .calendar-week, .calendar-day { min-height: 48px; }
  .calendar-icon { width: 25px; height: 25px; }
  .admin-mark { top: 0; right: 0; }
}
@media (max-width: 460px) {
  .search-form { flex-direction: column; }
  .record-summary { grid-template-columns: 1fr; }
  fieldset { grid-template-columns: 1fr; }
}
</style>
