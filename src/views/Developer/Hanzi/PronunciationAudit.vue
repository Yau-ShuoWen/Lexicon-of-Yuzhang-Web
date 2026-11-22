<script setup>
import {computed, ref, watch} from 'vue'
import {useRoute} from 'vue-router'
import {useHead} from '@vueuse/head'
import {useI18n} from 'vue-i18n'
import {request} from '../../../services/request.js'
import {showError} from '../../../services/ToastService.js'

// 路由切换会卸载页面，模块缓存保留各方言最近一次检查结果。
const resultCache = new Map()
const pendingRequests = new Map()
const viewCache = new Map()
const storageKey = dialect => `pronunciation-audit:v2:${dialect}`
const viewKey = dialect => `${storageKey(dialect)}:view`

function cachedView(dialect) {
  if (viewCache.has(dialect)) return viewCache.get(dialect)
  try {
    const saved = JSON.parse(sessionStorage.getItem(viewKey(dialect)) || 'null')
    if (saved && typeof saved.type === 'string' && Number.isInteger(saved.page)) return saved
  } catch (_) { /* 浏览器可能禁止会话存储。 */ }
  return null
}

function cachedResults(dialect) {
  if (resultCache.has(dialect)) return resultCache.get(dialect)
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(dialect)) || 'null')
    if (Array.isArray(saved)) {
      resultCache.set(dialect, saved)
      return saved
    }
  } catch (_) { /* 浏览器可能禁止会话存储。 */ }
  return null
}

function loadResults(dialect, refresh) {
  if (!refresh) {
    const saved = cachedResults(dialect)
    if (saved) return Promise.resolve(saved)
    if (pendingRequests.has(dialect)) return pendingRequests.get(dialect)
  }
  const pending = request(`/api/edit/hanzi/pronunciation-audit/${dialect}`)
    .then(result => {
      const rows = Array.isArray(result) ? result : []
      resultCache.set(dialect, rows)
      try { sessionStorage.setItem(storageKey(dialect), JSON.stringify(rows)) } catch (_) { /* 超出容量时保留内存缓存。 */ }
      return rows
    })
    .finally(() => {
      if (pendingRequests.get(dialect) === pending) pendingRequests.delete(dialect)
    })
  pendingRequests.set(dialect, pending)
  return pending
}

const route = useRoute()
const {t} = useI18n()
const dialect = computed(() => route.params.dialect)
const language = computed(() => route.params.language)
const findings = ref([])
const loading = ref(false)
const scanned = ref(false)
const selectedType = ref('ALL')
const page = ref(1)
const pageSize = 100
let requestVersion = 0
let restoringView = false

const types = [
  {value: 'ALL', key: 'all'},
  {value: 'CONFLICT', key: 'conflict'},
  {value: 'VARIANT', key: 'variant'},
  {value: 'MISSING_HANZI', key: 'missing_hanzi'},
  {value: 'FORM_MISMATCH', key: 'form_mismatch'},
  {value: 'MISSING_HANZI_PINYIN', key: 'missing_hanzi_pinyin'},
  {value: 'UNALIGNED', key: 'unaligned'},
  {value: 'INVALID_WORD_PINYIN', key: 'invalid_word_pinyin'},
  {value: 'INVALID_HANZI_PINYIN', key: 'invalid_hanzi_pinyin'},
]
const counts = computed(() => {
  const result = {ALL: findings.value.length}
  for (const finding of findings.value) result[finding.type] = (result[finding.type] || 0) + 1
  return result
})
const filtered = computed(() => selectedType.value === 'ALL'
  ? findings.value : findings.value.filter(item => item.type === selectedType.value))
const grouped = computed(() => {
  const groups = new Map()
  for (const finding of filtered.value) {
    const display = [...(finding.hanziDisplays || [])].sort().join('、')
    const key = finding.character ? `${finding.character}\u0000${finding.traditionalCharacter}\u0000${display}` : `unaligned-${finding.wordId}`
    if (!groups.has(key)) groups.set(key, {key, character: finding.character, traditionalCharacter: finding.traditionalCharacter, display, items: []})
    groups.get(key).items.push(finding)
  }
  return [...groups.values()]
})
const visible = computed(() => grouped.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const reasonGroups = group => types.slice(1).map(type => ({
  type: type.value,
  label: t(`pronunciation_audit.${type.key}`),
  items: group.items.filter(item => item.type === type.value),
})).filter(reason => reason.items.length)
const wordParts = finding => {
  const characters = Array.from(finding.word || '')
  const position = finding.position
  if (position < 0 || position >= characters.length) return {before: finding.word || '—', highlighted: '', after: ''}
  return {before: characters.slice(0, position).join(''), highlighted: characters[position], after: characters.slice(position + 1).join('')}
}
const wordLink = finding => ({name: 'CiyuEditor', params: {language: language.value, dialect: dialect.value, id: finding.wordId}})
const characterLink = finding => finding.hanziId
  ? {name: 'HanziEditor', params: {language: language.value, dialect: dialect.value, id: finding.hanziId}}
  : {name: 'HanziFilter', params: {language: language.value, dialect: dialect.value}, query: {q: finding.character}}

async function scan(refresh = false) {
  const version = ++requestVersion
  const currentDialect = dialect.value
  loading.value = true
  try {
    const result = await loadResults(currentDialect, refresh)
    if (version !== requestVersion) return
    findings.value = result
    scanned.value = true
    if (refresh) page.value = 1
  } catch (error) {
    if (version === requestVersion) showError(t('pronunciation_audit.failed', {message: error.message}))
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(dialect, () => {
  requestVersion++
  const cached = cachedResults(dialect.value)
  const savedView = cachedView(dialect.value)
  findings.value = cached || []
  scanned.value = cached !== null
  restoringView = true
  selectedType.value = savedView?.type || 'ALL'
  page.value = savedView?.page || 1
  restoringView = false
  loading.value = false
  if (cached === null) scan()
}, {immediate: true})
watch(selectedType, () => { if (!restoringView) page.value = 1 }, {flush: 'sync'})
watch([selectedType, page], () => {
  const state = {type: selectedType.value, page: page.value}
  viewCache.set(dialect.value, state)
  try { sessionStorage.setItem(viewKey(dialect.value), JSON.stringify(state)) } catch (_) { /* 内存状态仍可使用。 */ }
})
useHead({title: () => t('pronunciation_audit.title')})
</script>

<template>
  <main class="audit-page">
    <header class="audit-header">
      <div>
        <h1>{{ t('pronunciation_audit.title') }}</h1>
        <p>{{ t('pronunciation_audit.description') }}</p>
      </div>
      <button type="button" :disabled="loading" @click="scan(true)">{{ t(`pronunciation_audit.${loading ? 'checking' : scanned ? 'refresh' : 'start'}`) }}</button>
    </header>

    <div v-if="scanned" class="audit-summary">
      <button v-for="type in types" :key="type.value" type="button"
              :class="{'is-active': selectedType === type.value}" @click="selectedType = type.value">
        {{ t(`pronunciation_audit.${type.key}`) }} <strong>{{ counts[type.value] || 0 }}</strong>
      </button>
    </div>

    <p v-if="loading" class="audit-message" role="status">{{ t('pronunciation_audit.loading') }}</p>
    <p v-if="scanned && !filtered.length" class="audit-message">{{ t('pronunciation_audit.empty') }}</p>

    <div v-if="visible.length" class="audit-list">
      <article v-for="group in visible" :key="group.key" class="audit-item">
        <div class="audit-item__main">
          <router-link v-if="group.character" class="audit-character" :to="characterLink(group.items[0])">{{ group.character }}</router-link>
          <span v-else class="audit-character">—</span>
          <span v-if="group.traditionalCharacter && group.traditionalCharacter !== group.character" class="audit-pair-separator">／</span>
          <router-link v-if="group.traditionalCharacter && group.traditionalCharacter !== group.character" class="audit-character" :to="characterLink(group.items[0])">{{ group.traditionalCharacter }}</router-link>
          <span class="audit-reading" v-formatted-text="group.display || '—'" />
        </div>
        <div class="audit-item__details">
          <div v-for="reason in reasonGroups(group)" :key="reason.type" class="audit-reason">
            <span class="audit-type" :class="`audit-type--${reason.type.toLowerCase()}`">{{ reason.label }}</span>
            <div class="audit-words">
              <span v-for="(item, index) in reason.items" :key="`${item.wordId}-${item.position}-${index}`" class="audit-word">
                <router-link :to="wordLink(item)"><template v-if="wordParts(item).highlighted">{{ wordParts(item).before }}<mark>{{ wordParts(item).highlighted }}</mark>{{ wordParts(item).after }}</template><template v-else>{{ item.word || '—' }}</template></router-link>
                <span v-if="item.wordDisplay" class="audit-word-reading" v-formatted-text="item.wordDisplay" />
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>
    <div v-if="grouped.length > pageSize" class="audit-pages">
      <button type="button" :disabled="page === 1" @click="page--">{{ t('pronunciation_audit.previous') }}</button>
      <span>{{ t('pronunciation_audit.page', {current: page, total: Math.ceil(grouped.length / pageSize)}) }}</span>
      <button type="button" :disabled="page * pageSize >= grouped.length" @click="page++">{{ t('pronunciation_audit.next') }}</button>
    </div>
  </main>
</template>

<style scoped>
.audit-page { max-width: 1320px; margin: 0 auto; padding: 32px 28px 60px; color: var(--color-text); }
.audit-header { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 24px; }
.audit-header h1 { margin: 0 0 8px; font-size: 25px; }
.audit-header p { margin: 0; color: var(--color-text-light); line-height: 1.6; }
.audit-header > button, .audit-pages button { border: 1px solid var(--color-primary-dark); border-radius: 6px; background: var(--color-primary-dark); color: white; padding: 9px 17px; cursor: pointer; }
button:disabled { opacity: .55; cursor: default; }
.audit-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.audit-summary button { border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-background-alt); color: var(--color-text); padding: 8px 12px; cursor: pointer; }
.audit-summary button.is-active { border-color: var(--color-primary-dark); font-weight: 700; }
.audit-summary strong { margin-left: 7px; }
.audit-message { padding: 22px 0; color: var(--color-text-light); }
.audit-list { border: 1px solid var(--color-border); border-radius: 7px; background: #fff; }
.audit-item { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 18px; padding: 13px 16px; }
.audit-item + .audit-item { border-top: 1px solid var(--color-border); }
.audit-item__main { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
.audit-character { font-size: 26px; font-weight: 650; line-height: 1.25; }
.audit-pair-separator { color: var(--color-text-light); font-size: 16px; }
.audit-reading { font-size: 18px; }
.audit-item__details { display: grid; gap: 9px; min-width: 0; }
.audit-reason { display: flex; align-items: start; gap: 12px; }
.audit-type { flex: none; padding: 3px 9px; border: 1px solid #9a4918; border-radius: 999px; background: #fae8d8; color: #71340e; font-size: 12px; font-weight: 700; white-space: nowrap; }
.audit-type--variant { border-color: #2d648e; background: #e4f0fa; color: #214e72; }
.audit-type--missing_hanzi, .audit-type--form_mismatch, .audit-type--missing_hanzi_pinyin, .audit-type--unaligned { border-color: #59616a; background: #edf0f2; color: #3d454d; }
.audit-type--invalid_word_pinyin, .audit-type--invalid_hanzi_pinyin { border-color: #9d3c51; background: #f9e5e9; color: #76293c; }
.audit-words { display: flex; flex-wrap: wrap; gap: 6px 18px; min-width: 0; }
.audit-word { display: inline-flex; align-items: baseline; gap: 5px; white-space: nowrap; }
.audit-word mark { padding: 1px 2px; border-radius: 2px; background: #f6dfa0; color: inherit; }
.audit-word-reading { color: var(--color-text-light); font-size: 13px; }
.audit-item a { color: var(--color-primary-dark); }
.audit-pages { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 20px; }
@media (max-width: 700px) { .audit-page { padding: 20px 14px 45px; } .audit-header { display: block; } .audit-header > button { margin-top: 18px; } .audit-item { grid-template-columns: 130px minmax(0, 1fr); gap: 10px; padding: 10px; } .audit-reason { flex-wrap: wrap; gap: 5px; } }
</style>
