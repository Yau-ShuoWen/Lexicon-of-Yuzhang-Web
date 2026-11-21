<script setup>
import {computed, ref, watch} from 'vue'
import {useRoute} from 'vue-router'
import {useHead} from '@vueuse/head'
import {request} from '../../../services/request.js'
import {showError} from '../../../services/ToastService.js'

// 路由切换会卸载页面，模块缓存保留各方言最近一次检查结果。
const resultCache = new Map()

const route = useRoute()
const dialect = computed(() => route.params.dialect)
const language = computed(() => route.params.language)
const findings = ref([])
const loading = ref(false)
const scanned = ref(false)
const selectedType = ref('ALL')
const page = ref(1)
const pageSize = 100
let requestVersion = 0

const types = [
  {value: 'ALL', label: '全部'},
  {value: 'CONFLICT', label: '读音冲突'},
  {value: 'VARIANT', label: '读音变体'},
  {value: 'MISSING_HANZI', label: '字表缺字'},
  {value: 'UNALIGNED', label: '无法对齐'},
  {value: 'INVALID_WORD_PINYIN', label: '词条读音无效'},
  {value: 'INVALID_HANZI_PINYIN', label: '字表读音无效'},
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
    const key = finding.character ? `${finding.character}\u0000${display}` : `unaligned-${finding.wordId}`
    if (!groups.has(key)) groups.set(key, {key, character: finding.character, display, items: []})
    groups.get(key).items.push(finding)
  }
  return [...groups.values()]
})
const visible = computed(() => grouped.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const reasonGroups = group => types.slice(1).map(type => ({
  type: type.value,
  label: type.label,
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

async function scan() {
  const version = ++requestVersion
  const currentDialect = dialect.value
  loading.value = true
  try {
    const result = await request(`/api/edit/hanzi/pronunciation-audit/${currentDialect}`)
    if (version !== requestVersion) return
    findings.value = Array.isArray(result) ? result : []
    resultCache.set(currentDialect, findings.value)
    scanned.value = true
    page.value = 1
  } catch (error) {
    if (version === requestVersion) showError(`检查失败：${error.message}`)
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(dialect, () => {
  requestVersion++
  const cached = resultCache.get(dialect.value)
  findings.value = cached || []
  scanned.value = !!cached
  selectedType.value = 'ALL'
  page.value = 1
  loading.value = false
  if (!cached) scan()
}, {immediate: true})
watch(selectedType, () => { page.value = 1 })
useHead({title: '读音数据检查'})
</script>

<template>
  <main class="audit-page">
    <header class="audit-header">
      <div>
        <h1>读音数据检查</h1>
        <p>比较词条的逐字读音与字表。结果只说明数据不一致，不判断哪一处正确。</p>
      </div>
      <button type="button" :disabled="loading" @click="scan">{{ loading ? '检查中…' : scanned ? '重新检查' : '开始检查' }}</button>
    </header>

    <div v-if="scanned" class="audit-summary">
      <button v-for="type in types" :key="type.value" type="button"
              :class="{'is-active': selectedType === type.value}" @click="selectedType = type.value">
        {{ type.label }} <strong>{{ counts[type.value] || 0 }}</strong>
      </button>
    </div>

    <p v-if="loading" class="audit-message" role="status">正在检查，请稍候。</p>
    <p v-if="scanned && !filtered.length" class="audit-message">此分类没有结果。</p>

    <div v-if="visible.length" class="audit-list">
      <article v-for="group in visible" :key="group.key" class="audit-item">
        <div class="audit-item__main">
          <router-link v-if="group.character" class="audit-character" :to="characterLink(group.items[0])">{{ group.character }}</router-link>
          <span v-else class="audit-character">—</span>
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
      <button type="button" :disabled="page === 1" @click="page--">上一页</button>
      <span>第 {{ page }} / {{ Math.ceil(grouped.length / pageSize) }} 页</span>
      <button type="button" :disabled="page * pageSize >= grouped.length" @click="page++">下一页</button>
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
.audit-item { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 18px; padding: 13px 16px; }
.audit-item + .audit-item { border-top: 1px solid var(--color-border); }
.audit-item__main { display: flex; align-items: baseline; gap: 12px; }
.audit-character { font-size: 34px; font-weight: 650; }
.audit-reading { font-size: 19px; }
.audit-item__details { display: grid; gap: 9px; min-width: 0; }
.audit-reason { display: flex; align-items: start; gap: 12px; }
.audit-type { flex: none; padding: 3px 9px; border: 1px solid #9a4918; border-radius: 999px; background: #fae8d8; color: #71340e; font-size: 12px; font-weight: 700; white-space: nowrap; }
.audit-type--variant { border-color: #2d648e; background: #e4f0fa; color: #214e72; }
.audit-type--missing_hanzi, .audit-type--unaligned { border-color: #59616a; background: #edf0f2; color: #3d454d; }
.audit-type--invalid_word_pinyin, .audit-type--invalid_hanzi_pinyin { border-color: #9d3c51; background: #f9e5e9; color: #76293c; }
.audit-words { display: flex; flex-wrap: wrap; gap: 6px 18px; min-width: 0; }
.audit-word { display: inline-flex; align-items: baseline; gap: 5px; white-space: nowrap; }
.audit-word mark { padding: 1px 2px; border-radius: 2px; background: #f6dfa0; color: inherit; }
.audit-word-reading { color: var(--color-text-light); font-size: 13px; }
.audit-item a { color: var(--color-primary-dark); }
.audit-pages { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 20px; }
@media (max-width: 700px) { .audit-page { padding: 20px 14px 45px; } .audit-header { display: block; } .audit-header > button { margin-top: 18px; } .audit-item { grid-template-columns: 110px minmax(0, 1fr); gap: 10px; padding: 10px; } .audit-item__main { flex-wrap: wrap; } .audit-reason { flex-wrap: wrap; gap: 5px; } }
</style>
