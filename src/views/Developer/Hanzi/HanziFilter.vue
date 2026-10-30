<script setup>
import {computed, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useI18n} from 'vue-i18n'
import {useHead} from '@vueuse/head'
import {showError} from '../../../services/ToastService.js'
import {getToken} from '../../../utils/auth.js'
import {request} from '../../../services/request.js'
import DeveloperQueryBar from '../DeveloperQueryBar.vue'
import HanziEditor from './HanziEditor.vue'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const editing = computed(() => route.name === 'HanziEditor' && !!route.params.id)
const searchText = ref('')
const searchResults = ref([])
const isLoading = ref(false)
const hasSearched = ref(false)
let searchVersion = 0

useHead({title: () => t('hanzi_editor.title')})

const runSearch = async term => {
  const version = ++searchVersion
  hasSearched.value = true
  isLoading.value = true
  try {
    const params = new URLSearchParams({hanzi: term})
    const result = await request(`/api/edit/hanzi/filter/${dialect.value}?${params}`, {
      headers: {'X-Auth-Token': getToken() || ''}
    })
    if (version === searchVersion) searchResults.value = result
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
  if (!term) return
  if (route.name === 'HanziFilter' && route.query.q === term) return runSearch(term)
  await router.push({name: 'HanziFilter', params: {language: language.value, dialect: dialect.value}, query: {q: term}})
}

watch([() => route.name, () => route.query.q, dialect], ([name, query]) => {
  searchText.value = typeof query === 'string' ? query : ''
  if (name === 'HanziFilter' && searchText.value.trim()) runSearch(searchText.value.trim())
}, {immediate: true})

watch(searchText, value => {
  if (value.trim()) return
  searchVersion++
  isLoading.value = false
  searchResults.value = []
  hasSearched.value = false
})
</script>

<template>
  <main class="entry-workspace">
    <div class="search-section">
      <DeveloperQueryBar v-model="searchText" :placeholder="t('hanzi_editor.search_placeholder')"
                         :loading="isLoading" @submit="performSearch"/>
    </div>

    <HanziEditor v-if="editing" :key="route.params.id"/>

    <div v-else-if="searchResults.length" class="results-section">
      <h2>{{ t('hanzi_editor.search_results') }}</h2>
      <router-link v-for="item in searchResults" :key="item.tag"
                   :to="{name: 'HanziEditor', params: {language, dialect, id: item.info.query}, query: {q: searchText}}"
                   class="result-item">
        <span class="item-display">{{ item.title }}</span>
        <span class="item-display" v-formatted-text="item.explain"/>
      </router-link>
    </div>
    <div v-else-if="hasSearched && !isLoading" class="no-results">
      {{ t('hanzi_editor.no_results') }}
    </div>
  </main>
</template>

<style scoped>
.entry-workspace { box-sizing: border-box; width: 100%; max-width: 1400px; min-width: 0; margin: 0 auto; padding: 0 24px 56px; }
.search-section { position: sticky; top: 0; z-index: 10; padding: 20px 0 16px; background: var(--color-background-alt); }
.results-section { max-width: 960px; margin: 16px auto 0; }
.results-section h2 { margin: 0 0 16px; color: var(--color-text); font-size: 20px; }
.result-item { display: flex; align-items: center; gap: 20px; min-height: 58px; padding: 10px 16px; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; color: var(--color-text); text-decoration: none; }
.result-item + .result-item { margin-top: 8px; }
.result-item:hover { border-color: #b8c9bc; background: #f7faf7; }
.item-display { min-width: 100px; font-size: 18px; }
.no-results { max-width: 960px; margin: 32px auto; color: var(--color-text-light); text-align: center; }
@media (max-width: 600px) {
  .entry-workspace { padding: 0 12px 36px; }
  .search-section { padding-top: 12px; }
  .result-item { flex-wrap: wrap; gap: 6px 12px; }
}
</style>
