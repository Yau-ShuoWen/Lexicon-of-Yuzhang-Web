<script setup>
import {computed, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useI18n} from 'vue-i18n'
import {useHead} from '@vueuse/head'
import {showError} from '../../../services/ToastService.js'
import {getToken} from '../../../utils/auth.js'
import {request} from '../../../services/request.js'
import {formatRichText} from '../../../utils/textFormatter.js'
import DeveloperQueryBar from '../DeveloperQueryBar.vue'
import HanziEditor from './HanziEditor.vue'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const editing = computed(() => route.name === 'HanziEditor' && !!route.params.id)
const searchText = ref('')
const activeQuery = ref('')
const searchResults = ref([])
const isLoading = ref(false)
const hasSearched = ref(false)
let searchVersion = 0
const hasMore = ref(true)

useHead({title: () => t('hanzi_editor.title')})

const runSearch = async (term, append = false) => {
  if (!append) activeQuery.value = term
  const version = ++searchVersion
  hasSearched.value = true
  isLoading.value = true
  try {
    const params = new URLSearchParams({query: activeQuery.value, afterId: String(append ? searchResults.value.at(-1)?.id || 0 : 0)})
    const result = await request(`/api/edit/hanzi/list/${dialect.value}?${params}`, {
      headers: {'X-Auth-Token': getToken() || ''}
    })
    if (version === searchVersion) {
      searchResults.value = append ? [...searchResults.value, ...result] : result
      hasMore.value = result.length === 50
    }
  } catch (error) {
    if (version !== searchVersion) return
    searchResults.value = []
    showError(t('hanzi_editor.search_failed', {message: error.message}))
  } finally {
    if (version === searchVersion) isLoading.value = false
  }
}

const performSearch = async () => {
  const term = searchText.value.trim()
  if (route.name === 'HanziFilter' && (route.query.q || '') === term) return runSearch(term)
  await router.push({name: 'HanziFilter', params: {language: language.value, dialect: dialect.value}, query: term ? {q: term} : {}})
}

const openEditor = item => router.push({name: 'HanziEditor',
  params: {language: language.value, dialect: dialect.value, id: item.editId},
  query: activeQuery.value ? {q: activeQuery.value} : {}})

watch([() => route.name, () => route.query.q, dialect], ([name, query]) => {
  searchText.value = typeof query === 'string' ? query : ''
  if (name === 'HanziFilter') runSearch(searchText.value.trim())
}, {immediate: true})
const noteText = note => note?.right?.[language.value] || ''
const notePreview = notes => {
  for (const note of notes || []) {
    const element = document.createElement('div')
    element.innerHTML = formatRichText(noteText(note))
    const content = element.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (!content) continue
    const sentenceEnd = content.search(/[。！？!?；;]/)
    if (sentenceEnd < 0) return content
    const firstSentence = content.slice(0, sentenceEnd + 1)
    return sentenceEnd + 1 < content.length ? `${firstSentence}…` : firstSentence
  }
  return ''
}
</script>

<template>
  <main class="entry-workspace">
    <div class="search-section">
      <DeveloperQueryBar v-model="searchText" :placeholder="t('hanzi_editor.search_placeholder')"
                         :loading="isLoading" @submit="performSearch"/>
    </div>

    <HanziEditor v-if="editing" :key="route.params.id"/>

    <div v-else class="results-section">
      <div class="table-frame"><div class="table-scroll"><table class="hanzi-table">
        <colgroup><col class="col-id"><col class="col-character"><col class="col-character"><col class="col-dialect"><col class="col-mandarin"><col class="col-note"></colgroup>
        <thead><tr><th scope="col">ID</th><th scope="col">简</th><th scope="col">繁</th><th scope="col">方言拼音</th><th scope="col">汉语拼音</th><th scope="col">说明</th></tr></thead>
        <tbody v-for="item in searchResults" :key="item.id">
          <tr v-for="(pronunciation, index) in (item.pinyin?.length ? item.pinyin : [null])" :key="index" @dblclick="openEditor(item)">
            <th v-if="index === 0" scope="row" :rowspan="Math.max(item.pinyin?.length || 0, 1)" class="id-cell">
              <router-link :to="{name: 'HanziEditor', params: {language, dialect, id: item.editId}, query: activeQuery ? {q: activeQuery} : {}}">{{ item.id }}</router-link>
            </th>
            <td v-if="index === 0" :rowspan="Math.max(item.pinyin?.length || 0, 1)" class="character-cell" :colspan="item.sc === item.tc ? 2 : 1">{{ item.sc }}</td>
            <td v-if="index === 0 && item.sc !== item.tc" :rowspan="Math.max(item.pinyin?.length || 0, 1)" class="character-cell">{{ item.tc }}</td>
            <td><div class="dialect-reading"><span v-formatted-text="pronunciation?.pinyin || ''"/><span v-if="pronunciation?.tag?.[language] && pronunciation.tag[language] !== '待定'" class="pinyin-tag">{{ pronunciation.tag[language] }}</span></div></td>
            <td v-formatted-text="pronunciation?.mandarin?.join('、') || ''"/>
            <td v-if="index === 0" :rowspan="Math.max(item.pinyin?.length || 0, 1)" class="note-cell">
              <div class="note-preview" :title="notePreview(item.note)">{{ notePreview(item.note) }}</div>
            </td>
          </tr>
        </tbody>
      </table></div></div>
      <div v-if="hasSearched && !isLoading && !searchResults.length" class="no-results">{{ t('hanzi_editor.no_results') }}</div>
      <div class="table-footer"><button v-if="hasMore" type="button" :disabled="isLoading" @click="runSearch(activeQuery, true)">{{ isLoading ? '加载中…' : '加载更多' }}</button></div>
    </div>
  </main>
</template>

<style scoped>
.entry-workspace { box-sizing: border-box; width: 100%; min-width: 0; margin: 0 auto; padding: 0 24px 56px; }
.search-section { position: sticky; top: 0; z-index: 10; padding: 20px 0 22px; }
.search-section::before { position: absolute; z-index: -1; inset: 0 -24px -28px; background: var(--app-bg-color, var(--color-background-alt)); content: ''; pointer-events: none; -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%); mask-image: linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%); }
.results-section { margin: 12px auto 0; }
.table-frame { border: 1px solid #b9cbbd; border-radius: 12px; overflow: hidden; background: #fff; }
.table-scroll { width: 100%; overflow-x: auto; }
.hanzi-table { width: 100%; min-width: 900px; table-layout: fixed; border-collapse: separate; border-spacing: 0; background: #fff; color: var(--color-text); text-align: left; }
.col-id { width: 72px; }
.col-character { width: 76px; }
.col-dialect { width: 240px; }
.col-mandarin { width: 300px; }
.hanzi-table th, .hanzi-table td { padding: 12px 14px; border: 0; border-right: 1px solid #d1ddd3; border-bottom: 1px solid #d1ddd3; vertical-align: middle; }
.hanzi-table thead th:last-child, .hanzi-table .note-cell { border-right: 0; }
.hanzi-table tbody:last-of-type tr:last-child > * { border-bottom: 0; }
.hanzi-table tbody:last-of-type tr:first-child > [rowspan] { border-bottom: 0; }
.hanzi-table thead { background: #e7efe9; }
.hanzi-table thead th { box-sizing: border-box; height: 72px; color: #21472b; font-size: 22px; }
.hanzi-table thead th:nth-child(2), .hanzi-table thead th:nth-child(3) { text-align: center; }
.hanzi-table tbody:nth-of-type(even) { background: #f7faf7; }
.hanzi-table tbody:hover { background: #edf5ee; cursor: pointer; }
.id-cell { font-weight: 500; }
.id-cell a { color: var(--color-primary-dark); text-decoration: underline; }
.character-cell { font-size: 22px; }
.dialect-reading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.pinyin-tag { display: inline-flex; align-items: center; min-height: 21px; padding: 1px 8px; border: 1px solid #c3d8c8; border-radius: 999px; background: #eaf4ec; color: #2c6038; font-size: 12px; line-height: 1.2; white-space: nowrap; }
.note-cell { min-width: 0; }
.note-preview { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.no-results { margin: 32px auto; color: var(--color-text-light); text-align: center; }
.table-footer { padding: 16px 0; text-align: center; }
.table-footer button { padding: 8px 24px; border: 1px solid var(--color-border); border-radius: 6px; background: #fff; color: var(--color-text); cursor: pointer; }
@media (max-width: 600px) {
  .entry-workspace { padding: 0 12px 36px; }
  .search-section { padding-top: 12px; }
  .search-section::before { right: -12px; left: -12px; }
}
</style>
