<script setup>
import {computed, onMounted, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useI18n} from 'vue-i18n'
import LoadingIcon from '../../../components/Status/LoadingIcon.vue'
import ScTcEditorLab from '../../../components/Text/ScTcEditorLab.vue'
import HanziSortable from './HanziSortable.vue'
import RichText from '../../../components/Text/RichText.vue'
import {showError, showSuccess} from '../../../services/ToastService.js'
import {confirm} from '../../../services/confirmService.js'
import {getToken} from '../../../utils/auth.js'
import {request} from '../../../services/request.js'
import saveIcon from '../../../assets/icons/save.svg'
import backIcon from '../../../assets/icons/to-left.svg'
import tagIcon from '../../../assets/icons/calendar/bookmark.svg'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const returnToPrevious = () => {
  if (window.history.state?.back) return router.back()
  return router.push({name: 'HanziFilter', params: {language: language.value, dialect: dialect.value},
    query: route.query.q ? {q: route.query.q} : {}})
}

const emptyData = () => ({
  id: null,
  hanzi: {sc: '', tc: ''},
  pinyin: [],
  special: 0,
  similar: [],
  note: [],
  status: 1
})

const updateData = ref(emptyData())
const originalData = ref(null)
const hasChanges = computed(() => originalData.value !== null &&
    JSON.stringify(updateData.value) !== originalData.value)
const mandarinOptions = ref([])
const wordSuggestions = ref([])
const suggestionsLoading = ref(false)
const suggestionsFailed = ref(false)
const suggestionsLoaded = ref(false)
const isLoading = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const pairEditors = new Map()
const openedNoteItem = ref(null)
const noteDraft = ref(null)
const noteEditorRef = ref(null)
const closingNote = ref(false)
const setNoteEditor = editor => { noteEditorRef.value = editor }
const setPairEditor = (key, editor) => {
  if (editor) pairEditors.set(key, editor)
  else pairEditors.delete(key)
}

const tagOptions = [
  {sc: '待定', tc: '待定'}, {sc: '文读', tc: '文讀'}, {sc: '白读', tc: '白讀'},
  {sc: '老派', tc: '老派'}, {sc: '新派', tc: '新派'}, {sc: '普化音', tc: '普化音'},
  {sc: '理论读音', tc: '理論讀音'}, {sc: '连读音', tc: '連讀音'}, {sc: '语流音变', tc: '語流音變'}
]

const noteTags = [
  'usage', 'pronun', 'struct', 'source', 'history', 'proverb'
]

const isKnownNoteTag = value => noteTags.includes(value)

function openNote(item) {
  openedNoteItem.value = item
  noteDraft.value = JSON.parse(JSON.stringify(item.right))
}

async function closeNote() {
  if (closingNote.value) return
  closingNote.value = true
  try {
    if (noteEditorRef.value?.hasPendingChanges() && !await noteEditorRef.value.synchronize()) return
    if (openedNoteItem.value && noteDraft.value) openedNoteItem.value.right = noteDraft.value
    openedNoteItem.value = null
    noteDraft.value = null
    noteEditorRef.value = null
  } finally {
    closingNote.value = false
  }
}

const isAutomaticMapping = computed(() =>
    updateData.value.pinyin.length === 1 && mandarinOptions.value.length === 1)

const loadMandarinOptions = async () => {
  const {sc, tc} = updateData.value.hanzi
  if (!sc || !tc) return
  const params = new URLSearchParams({sc, tc})
  mandarinOptions.value = await request(`/api/edit/hanzi/get-mandarin/${dialect.value}?${params}`, {
    headers: {'X-Auth-Token': getToken() || ''}
  })
}

const loadWordSuggestions = async id => {
  suggestionsLoaded.value = true
  suggestionsLoading.value = true
  suggestionsFailed.value = false
  try {
    const params = new URLSearchParams({id, language: language.value})
    wordSuggestions.value = await request(`/api/edit/hanzi/get-word-suggestions/${dialect.value}?${params}`, {
      headers: {'X-Auth-Token': getToken() || ''}
    })
  } catch (error) {
    wordSuggestions.value = []
    suggestionsFailed.value = true
    suggestionsLoaded.value = false
    console.error('词语读音建议加载失败', error)
  } finally {
    suggestionsLoading.value = false
  }
}

const onSuggestionsToggle = event => {
  if (event.target.open && !suggestionsLoaded.value) loadWordSuggestions(route.params.id)
}

const loadHanzi = async id => {
  isLoading.value = true
  originalData.value = null
  suggestionsLoaded.value = false
  wordSuggestions.value = []
  openedNoteItem.value = null
  noteDraft.value = null
  try {
    const params = new URLSearchParams({id})
    updateData.value = await request(`/api/edit/hanzi/get-info/${dialect.value}?${params}`, {
      headers: {'X-Auth-Token': getToken() || ''}
    })
    updateData.value.pinyin ??= []
    updateData.value.pinyin.forEach(item => item.mandarin ??= [])
    await loadMandarinOptions()
    originalData.value = JSON.stringify(updateData.value)
  } catch (error) {
    showError(t('hanzi_editor.load_failed', {message: error.message}))
  } finally {
    isLoading.value = false
  }
}

const usedByOther = (mandarinId, currentIndex) => updateData.value.pinyin.some(
    (item, index) => index !== currentIndex && item.mandarin?.includes(mandarinId))

const saveData = async () => {
  if (isLoading.value || isSaving.value || isDeleting.value || !hasChanges.value) return
  isSaving.value = true
  try {
    for (const editor of pairEditors.values()) {
      if (editor.hasPendingChanges() && !await editor.synchronize()) return
    }
    if (isAutomaticMapping.value) updateData.value.pinyin[0].mandarin = []
    await request(`/api/edit/hanzi/submit/${dialect.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Auth-Token': getToken() || ''},
      body: JSON.stringify(updateData.value)
    })
    showSuccess(t('hanzi_editor.save_success'))
    await loadHanzi(route.params.id)
  } catch (error) {
    showError(error.message)
  } finally {
    isSaving.value = false
  }
}

const deleteHanzi = async () => {
  if (isLoading.value || isSaving.value || isDeleting.value || !originalData.value) return
  const character = updateData.value.hanzi.sc === updateData.value.hanzi.tc
      ? updateData.value.hanzi.sc
      : `${updateData.value.hanzi.sc} / ${updateData.value.hanzi.tc}`
  const accepted = await confirm({
    title: '删除汉字',
    message: `确定删除“${character}”及其相似汉字记录吗？此操作无法撤销。`,
    actions: [
      {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'},
      {key: true, text: '确认删除', class: 'dev-btn-small dev-remove-btn'}
    ]
  })
  if (!accepted) return
  isDeleting.value = true
  try {
    await request(`/api/edit/hanzi/${dialect.value}/${route.params.id}`, {
      method: 'DELETE', headers: {'X-Auth-Token': getToken() || ''}
    })
    showSuccess('汉字已删除')
    await router.replace({name: 'HanziFilter', params: {language: language.value, dialect: dialect.value},
      query: route.query.q ? {q: route.query.q} : {}})
  } catch (error) {
    showError(error.message)
  } finally {
    isDeleting.value = false
  }
}

watch(() => route.params.id, id => id && loadHanzi(id))
watch([() => updateData.value.hanzi.sc, () => updateData.value.hanzi.tc], () => {
  loadMandarinOptions().catch(error => showError(error.message))
})
onMounted(() => loadHanzi(route.params.id))
</script>

<template>
  <div class="hanzi-editor-page">
    <div class="nav-buttons">
      <button type="button" class="editor-action return-link" @click="returnToPrevious"><img class="back-icon" :src="backIcon" alt="" aria-hidden="true" />返回</button>
      <button type="button" :disabled="isLoading || isSaving || isDeleting || !hasChanges" class="editor-action dev-add-btn" @click="saveData">
        <img class="save-icon" :src="saveIcon" alt="" aria-hidden="true" />{{ isSaving ? t('hanzi_editor.saving') : t('hanzi_editor.save') }}
      </button>
      <button type="button" :disabled="isLoading || isSaving || isDeleting || !originalData" class="editor-action delete-entry" @click="deleteHanzi">
        <svg class="delete-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg>{{ isDeleting ? '正在删除……' : '删除汉字' }}
      </button>
    </div>

    <LoadingIcon v-if="isLoading" :show-text="true"/>
    <div v-else class="edit-form">
      <section class="entry-heading">
        <h3>基本信息</h3>
        <span class="entry-identity__id">ID {{ updateData.id }}</span>
        <div class="basic-fields">
          <div class="entry-identity">
            <div class="entry-identity__value">
              <span class="entry-identity__character">{{ updateData.hanzi.sc }}</span>
              <template v-if="updateData.hanzi.sc !== updateData.hanzi.tc">
                <span class="entry-identity__separator">/</span>
                <span class="entry-identity__character">{{ updateData.hanzi.tc }}</span>
              </template>
            </div>
          </div>
          <div class="form-field">
            <label>{{ t('hanzi_editor.special') }}</label>
            <select v-model.number="updateData.special" class="short-input">
              <option :value="0">{{ t('hanzi_editor.normal_hanzi') }}</option><option :value="1">{{ t('hanzi_editor.dialect_hanzi') }}</option>
              <option :value="2">{{ t('hanzi_editor.rare_hanzi') }}</option><option :value="3">{{ t('hanzi_editor.unused_hanzi') }}</option>
              <option :value="4">{{ t('hanzi_editor.migration_conflict') }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>{{ t('hanzi_editor.status') }}</label>
            <select v-model.number="updateData.status" class="short-input">
              <option :value="1">{{ t('hanzi_editor.newly_created') }}</option><option :value="2">{{ t('hanzi_editor.needs_content') }}</option>
              <option :value="3">{{ t('hanzi_editor.basically_complete') }}</option><option :value="4">{{ t('hanzi_editor.uncertain') }}</option>
            </select>
          </div>
        </div>
      </section>

      <section class="form-section form-section--primary">
        <h3>{{ t('hanzi_editor.pinyin') }}</h3>
        <HanziSortable v-model="updateData.pinyin" layout="grid" :item-label="t('hanzi_editor.pinyin')"
          :create-item="() => ({tag:{sc:'待定',tc:'待定'},pinyin:'',code:null,mandarin:[]})">
          <template #default="{item,index}">
            <div class="pinyin-item">
              <div class="array-item pinyin-input-row">
                <label class="pinyin-tag-control" aria-label="读音类型"><img class="pinyin-tag-icon" :src="tagIcon" alt=""><select class="form-control small-input" :value="JSON.stringify(item.tag)"
                        @change="e => item.tag=JSON.parse(e.target.value)">
                  <option v-for="opt in tagOptions" :key="opt.sc" :value="JSON.stringify(opt)">{{ opt[language] }}</option>
                </select></label>
                <label class="pinyin-control"><input v-model="item.pinyin" class="form-control pinyin-input" type="text" aria-label="方言拼音"></label>
                <span class="pinyin-arrow" aria-hidden="true">→</span>
                <div class="pinyin-control"><div class="pinyin-preview">
                  <RichText v-if="item.pinyin" :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="true"
                            :model-value="item.pinyin" :plain="true"/>
                </div></div>
              </div>

              <div class="mandarin-line">
                <span class="mandarin-label">{{ t('hanzi_editor.mandarin') }}</span>
                <div v-if="isAutomaticMapping" class="mandarin-auto">
                  <span class="mandarin-reading" v-formatted-text="mandarinOptions[0].info"/><span class="automatic-hint">{{ t('hanzi_editor.automatic') }}</span>
                </div>
                <div v-else-if="mandarinOptions.length" class="mandarin-options">
                  <label v-for="option in mandarinOptions" :key="option.mandarinId" class="checkbox-item">
                    <input v-model="item.mandarin" type="checkbox" :value="option.mandarinId"
                           :disabled="usedByOther(option.mandarinId,index)" class="big-check">
                    <span v-formatted-text="option.info"/>
                  </label>
                </div>
                <div v-else class="gray-text compact-hint">{{ t('hanzi_editor.none') }}</div>
              </div>
            </div>
          </template>
        </HanziSortable>

        <details class="word-suggestions" @toggle="onSuggestionsToggle">
          <summary>{{ t('hanzi_editor.suggestions_title') }}</summary>
          <div class="suggestion-content">
          <div v-if="suggestionsLoading" class="gray-text compact-hint">{{ t('hanzi_editor.suggestions_loading') }}</div>
          <div v-else-if="suggestionsFailed" class="gray-text compact-hint">{{ t('hanzi_editor.suggestions_failed') }}</div>
          <div v-else-if="wordSuggestions.length" class="suggestion-list">
            <div v-for="suggestion in wordSuggestions" :key="suggestion.pinyin" class="suggestion-item">
              <strong v-formatted-text="suggestion.pinyin"/>
              <div class="suggestion-words">
                <span v-for="word in suggestion.words" :key="word.id" class="suggestion-word">
                  <span v-formatted-text="word.word"/>
                  <small v-formatted-text="word.pinyin"/>
                </span>
              </div>
            </div>
          </div>
          <div v-else class="gray-text compact-hint">{{ t('hanzi_editor.suggestions_empty') }}</div>
          </div>
        </details>
      </section>

      <div class="secondary-sections">
      <section class="form-section form-section--similar">
        <h3>{{ t('hanzi_editor.similar') }}</h3>
        <HanziSortable v-model="updateData.similar" layout="list" :item-label="t('hanzi_editor.similar')" :auto-sort="true"
          :create-item="() => ({text:{sc:'',tc:''},sort:null})">
          <template #default="{item,index}">
            <div class="similar-item"><span class="similar-number">{{ index + 1 }}</span><ScTcEditorLab :ref="editor => setPairEditor(`similar:${index}`, editor)"
              :pair="item.text" :dialect="dialect.toString()" layout="small" :rich-text="false"
              @update:pair="item.text = $event"/></div>
          </template>
        </HanziSortable>
      </section>

      <section class="form-section">
        <h3>{{ t('hanzi_editor.notes') }}</h3>
        <HanziSortable v-model="updateData.note" layout="list" :item-label="t('hanzi_editor.notes')" :auto-sort="true"
          :create-item="() => ({left:'usage',right:{sc:'',tc:''}})">
          <template #default="{item}">
            <div class="note-item">
              <select v-model="item.left" class="short-input">
                <option v-if="!isKnownNoteTag(item.left)" :value="item.left">
                  {{ t('hanzi_editor.unresolved_tag', {tag: item.left || t('hanzi_editor.empty_tag')}) }}
                </option>
                <option v-for="tag in noteTags" :key="tag" :value="tag">{{ t(`hanzi_editor.${tag}`) }}</option>
              </select>
              <div class="note-preview" role="button" tabindex="0" :aria-label="`${t('hanzi_editor.notes')}：打开编辑`"
                   @click="openNote(item)" @keydown.enter.prevent="openNote(item)" @keydown.space.prevent="openNote(item)">
                <RichText :language="language.toString()" :dialect="dialect.toString()" :model-value="item.right?.[language] || ''" :request-backend="false" plain />
                <span v-if="!item.right?.[language]" class="note-preview__empty">点击编辑注释</span>
              </div>
            </div>
          </template>
        </HanziSortable>
      </section>
      </div>
    </div>
    <div v-if="openedNoteItem && noteDraft" class="note-modal-backdrop" @pointerdown.self="closeNote" @keydown.esc="closeNote">
      <section class="note-modal" role="dialog" aria-modal="true" :aria-label="t('hanzi_editor.notes')">
        <header class="note-modal__header"><h2>{{ t('hanzi_editor.notes') }}</h2><button type="button" aria-label="关闭" @click="closeNote">×</button></header>
        <ScTcEditorLab :ref="setNoteEditor" :pair="noteDraft" :dialect="dialect.toString()" layout="large"
                       @update:pair="noteDraft = $event" />
        <footer class="note-modal__footer"><button type="button" @click="closeNote">完成</button></footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hanzi-editor-page { box-sizing: border-box; width: 100%; max-width: 980px; min-width: 0; margin: 0 auto; padding: 12px 0 48px; }
.nav-buttons { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.editor-action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 8px 14px; border-radius: 6px; font: inherit; font-size: 14px; line-height: 1; cursor: pointer; }
.return-link { border: 1px solid #c6d4c9; background: #fff; color: var(--color-primary-dark); }
.return-link:hover { background: #edf5ee; }
.nav-buttons .dev-add-btn { border: 1px solid #4caf50; }
.delete-entry { margin-left: auto; border: 1px solid #c76868; background: #fff; color: #a63838; }
.delete-entry:hover:not(:disabled) { background: #fff1f1; }
.delete-entry:disabled { opacity: .5; cursor: not-allowed; }
.delete-icon { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.back-icon { width: 16px; height: 16px; }
.save-icon { width: 18px; height: 18px; filter: brightness(0) invert(1); }
.dev-add-btn:disabled .save-icon { filter: brightness(0); opacity: .55; }
.edit-form { display: block; overflow: hidden; border: 1px solid #cbd9ce; border-radius: 9px; background: #fff; }
.entry-heading { position: relative; min-width: 0; padding: 24px 30px; }
.entry-heading h3 { margin: 0 0 20px; color: var(--color-primary-dark); font-size: 24px; font-weight: 750; }
.basic-fields { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: end; }
.entry-identity { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.entry-identity__value { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; min-height: 38px; }
.entry-identity__id { position: absolute; top: 26px; right: 30px; color: var(--color-text-light); font-size: 11px; font-weight: 400; white-space: nowrap; }
.entry-identity__character { color: var(--color-primary-dark); font-size: 29px; font-weight: 750; line-height: 1.15; }
.entry-identity__separator { color: #809185; font-size: 21px; font-weight: 400; }
.form-section { min-width: 0; margin: 0; padding: 24px 30px; border: 0; border-top: 1px solid #dfe8e1; background: #fff; }
.form-section h3 { margin: 0 0 20px; color: var(--color-primary-dark); font-size: 24px; font-weight: 750; }
.secondary-sections { display: block; }
.form-field { display: flex; flex-direction: column; gap: 7px; }
.form-field label, .field-label { color: #405a46; font-size: 14px; font-weight: 650; }
.short-input { width: 100%; min-height: 38px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-background); color: var(--color-text); }
.short-input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.pinyin-item { min-width: 0; }
.array-item { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 10px; }
.array-item input { padding: 7px 10px; }
.pinyin-input-row { display: grid; grid-template-columns: 158px 120px 18px 150px; align-items: center; }
.pinyin-control { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.pinyin-tag-control { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pinyin-tag-icon { flex: none; width: 19px; height: 19px; }
.pinyin-tag-control select { flex: 1; }
.pinyin-input-row select { width: 100%; min-width: 0; height: 36px; border: 1px solid #c8d2ca; border-radius: 6px; }
.pinyin-input { box-sizing: border-box; width: 100%; min-width: 0; height: 36px; border: 1px solid #c8d2ca; border-radius: 6px; background: #fff; box-shadow: none; outline: none; }
.pinyin-input:focus, .pinyin-input:focus-visible { border-color: #6f8775; box-shadow: none; outline: none; }
.pinyin-arrow { color: var(--color-text-light); text-align: center; }
.pinyin-preview { box-sizing: border-box; display: flex; align-items: center; min-width: 0; height: 36px; padding: 2px 9px; border: 1px solid #c8d2ca; border-radius: 6px; background: #fff; color: var(--color-text); overflow: hidden; }
.pinyin-preview :deep(.result) { min-width: 0; line-height: 1.2; white-space: nowrap; }
.pinyin-preview :deep(.rt-pinyin) { line-height: 1.2; }
.note-item { display: grid; grid-template-columns: minmax(140px, 190px) minmax(0, 1fr); align-items: start; gap: 14px; min-width: 0; }
.similar-item { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: start; gap: 10px; min-width: 0; }
.similar-number { padding-top: 9px; color: var(--color-text-light); font-size: 14px; text-align: center; }
.similar-item :deep(.lab-editor) { min-width: 0; }
.note-item .short-input { max-width: none; }
.note-preview { min-width: 0; min-height: 42px; max-height: 110px; overflow: hidden; cursor: pointer; color: var(--color-text); }
.note-preview:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.note-preview :deep(.result) { padding: 0; margin: 0; }
.note-preview__empty { color: var(--color-text-light); }
.note-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: #15281a80; }
.note-modal { box-sizing: border-box; width: min(1080px, 100%); max-height: min(90vh, 900px); overflow: auto; padding: 28px; border-radius: 16px; background: #fff; box-shadow: 0 18px 50px #1126184d; }
.note-modal__header, .note-modal__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.note-modal__header { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #dfe8e1; }
.note-modal__header h2 { margin: 0; color: #34495e; font-size: 21px; }
.note-modal__header button { border: 0; background: transparent; font-size: 25px; cursor: pointer; }
.note-modal :deep(.lab-editor) { padding: 0; border: 0; border-radius: 0; box-shadow: none; }
.note-modal__footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e0e9e2; }
.note-modal__footer button { padding: 7px 11px; border: 1px solid #b7d1bc; border-radius: 7px; background: #f5faf5; color: #326d3b; cursor: pointer; }
.mandarin-line { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 28px; }
.mandarin-label { color: #405a46; font-size: 14px; font-weight: 650; white-space: nowrap; }
.mandarin-reading, .mandarin-options { color: var(--color-text); font-size: 19px; }
.mandarin-auto { display: flex; align-items: baseline; flex-wrap: wrap; gap: 5px; }
.automatic-hint { color: var(--color-text-light); font-size: 13px; }
.compact-hint { font-size: 14px; }
.mandarin-options { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.checkbox-item { display: flex; align-items: center; gap: 6px; }
.big-check { transform: scale(1.3); }
.word-suggestions { margin-top: 14px; padding-top: 11px; border-top: 1px solid #e0e9e2; }
.word-suggestions summary { width: fit-content; color: var(--color-text-light); font-size: 14px; cursor: pointer; }
.word-suggestions summary:hover { color: var(--color-primary-dark); }
.suggestion-content { padding-top: 12px; }
.suggestion-list { display: flex; flex-direction: column; gap: 10px; }
.suggestion-item { display: flex; align-items: flex-start; gap: 14px; padding: 8px 0; border-bottom: 1px solid #e7ede8; }
.suggestion-item > strong { min-width: 72px; color: var(--color-primary-dark); }
.suggestion-words { display: flex; flex-wrap: wrap; gap: 8px; }
.suggestion-word { display: inline-flex; align-items: baseline; gap: 5px; }
.suggestion-word small { color: var(--color-text-light); }
.form-section--primary :deep(.hanzi-sortable--grid) { grid-template-columns: minmax(0, 1fr); }
.form-section--primary :deep(.hanzi-sortable__card) { padding: 14px; border-radius: 6px; }
.form-section :deep(.hanzi-sortable__add) { justify-self: end; width: 42px; height: 42px; border-radius: 7px; }
.form-section :deep(.hanzi-sortable__add img) { width: 20px; height: 20px; }
.form-section :deep(.hanzi-sortable__remove) { width: 42px; height: 42px; border: 1px solid #e4b7b7; border-radius: 7px; background: #fff; }
.form-section :deep(.hanzi-sortable__remove:hover) { background: #fff1f1; }
.form-section :deep(.hanzi-sortable__remove svg) { width: 20px; height: 20px; }
@media (max-width: 600px) {
  .hanzi-editor-page { padding: 12px 0 36px; }
  .form-section, .entry-heading { padding: 20px 16px; }
  .entry-identity__id { top: 22px; right: 16px; }
  .basic-fields { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .entry-identity { grid-column: 1 / -1; }
  .array-item:not(.pinyin-input-row) { align-items: stretch; flex-direction: column; }
  .pinyin-input-row { grid-template-columns: 138px minmax(80px, 120px) 18px minmax(90px, 150px); }
  .note-item { grid-template-columns: minmax(0, 1fr); }
  .note-modal { padding: 18px; }
  .mandarin-line { align-items: flex-start; }
}
@media (max-width: 440px) {
  .pinyin-input-row { grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr); }
  .pinyin-input-row .pinyin-tag-control { grid-column: 1 / -1; }
}
</style>
