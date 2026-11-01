<script setup>
import {computed, onMounted, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useI18n} from 'vue-i18n'
import LoadingIcon from '../../../components/Status/LoadingIcon.vue'
import ScTcEditorLab from '../../../components/Text/ScTcEditorLab.vue'
import DraggableList from '../../../components/Layout/DraggableList.vue'
import HanziSortable from './HanziSortable.vue'
import RichText from '../../../components/Text/RichText.vue'
import {showError, showSuccess} from '../../../services/ToastService.js'
import {getToken} from '../../../utils/auth.js'
import {request} from '../../../services/request.js'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = id => ({name: 'HanziEditor', params: {language: language.value, dialect: dialect.value, id}, query: route.query})

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
const mandarinOptions = ref([])
const wordSuggestions = ref([])
const suggestionsLoading = ref(false)
const suggestionsFailed = ref(false)
const prevId = ref(null)
const nextId = ref(null)
const isLoading = ref(false)
const isSaving = ref(false)
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

const loadNearBy = async id => {
  const params = new URLSearchParams({id})
  const nearby = await request(`/api/edit/hanzi/get-nearby/${dialect.value}?${params}`, {
    headers: {'X-Auth-Token': getToken() || ''}
  })
  prevId.value = nearby.left
  nextId.value = nearby.right
}

const loadWordSuggestions = async id => {
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
    console.error('词语读音建议加载失败', error)
  } finally {
    suggestionsLoading.value = false
  }
}

const loadHanzi = async id => {
  isLoading.value = true
  openedNoteItem.value = null
  noteDraft.value = null
  try {
    const params = new URLSearchParams({id})
    updateData.value = await request(`/api/edit/hanzi/get-info/${dialect.value}?${params}`, {
      headers: {'X-Auth-Token': getToken() || ''}
    })
    updateData.value.pinyin ??= []
    updateData.value.pinyin.forEach(item => item.mandarin ??= [])
    await Promise.all([loadMandarinOptions(), loadNearBy(id), loadWordSuggestions(id)])
  } catch (error) {
    showError(t('hanzi_editor.load_failed', {message: error.message}))
  } finally {
    isLoading.value = false
  }
}

const usedByOther = (mandarinId, currentIndex) => updateData.value.pinyin.some(
    (item, index) => index !== currentIndex && item.mandarin?.includes(mandarinId))

const saveData = async () => {
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

watch(() => route.params.id, id => id && loadHanzi(id))
watch([() => updateData.value.hanzi.sc, () => updateData.value.hanzi.tc], () => {
  loadMandarinOptions().catch(error => showError(error.message))
})
onMounted(() => loadHanzi(route.params.id))
</script>

<template>
  <div class="hanzi-editor-page">
    <div class="nav-buttons">
      <button :disabled="!prevId" class="dev-nav-button dev-btn dev-btn-small" @click="router.replace(getPath(prevId))">
        {{ prevId ? t('hanzi_editor.previous') : t('hanzi_editor.first') }}
      </button>
      <button :disabled="!nextId" class="dev-nav-button dev-btn-small" @click="router.replace(getPath(nextId))">
        {{ nextId ? t('hanzi_editor.next') : t('hanzi_editor.last') }}
      </button>
      <button :disabled="isSaving" class="dev-add-btn dev-btn-small" @click="saveData">
        {{ isSaving ? t('hanzi_editor.saving') : t('hanzi_editor.save') }}
      </button>
    </div>

    <LoadingIcon v-if="isLoading" :show-text="true"/>
    <div v-else class="edit-form">
      <div class="form-section form-grid">
        <div><h4>{{ t('hanzi_editor.traditional') }}{{ updateData.hanzi.tc }}</h4><h4>{{ t('hanzi_editor.simplified') }}{{ updateData.hanzi.sc }}</h4></div>
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

      <div class="form-section">
        <h3>{{ t('hanzi_editor.pinyin') }}</h3>
        <HanziSortable v-model="updateData.pinyin" layout="grid" :item-label="t('hanzi_editor.pinyin')"
          :create-item="() => ({tag:{sc:'待定',tc:'待定'},pinyin:'',code:null,mandarin:[]})">
          <template #default="{item,index}">
            <div class="pinyin-item">
              <div class="array-item pinyin-input-row" :class="{'pinyin-input-row--no-preview': !item.pinyin}">
                <select class="form-control small-input" :value="JSON.stringify(item.tag)"
                        @change="e => item.tag=JSON.parse(e.target.value)">
                  <option v-for="opt in tagOptions" :key="opt.sc" :value="JSON.stringify(opt)">{{ opt[language] }}</option>
                </select>
                <input v-model="item.pinyin" class="form-control pinyin-input" type="text" :aria-label="t('hanzi_editor.pinyin')">
                <span v-if="item.pinyin" class="pinyin-arrow" aria-hidden="true">→</span>
                <div v-if="item.pinyin" class="pinyin-preview">
                  <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="true"
                            :model-value="item.pinyin" :plain="true"/>
                </div>
              </div>

              <div class="mandarin-line">
                <span class="mandarin-label">{{ t('hanzi_editor.mandarin') }}</span>
                <div v-if="isAutomaticMapping" class="gray-text compact-hint">
                  <span v-formatted-text="mandarinOptions[0].info"/>{{ t('hanzi_editor.automatic') }}
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

        <div class="word-suggestions">
          <h4>{{ t('hanzi_editor.suggestions_title') }}</h4>
          <p class="suggestion-hint">{{ t('hanzi_editor.suggestions_hint') }}</p>
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
      </div>

      <div class="form-section">
        <h3>{{ t('hanzi_editor.similar') }}</h3>
        <DraggableList v-model="updateData.similar" :createItem="() => ({text:{sc:'',tc:''}})" :draggable="false">
          <template #default="{item,index}">
            <div class="array-item"><ScTcEditorLab :ref="editor => setPairEditor(`similar:${index}`, editor)"
              :pair="item.text" :dialect="dialect.toString()" layout="small" :rich-text="false"
              @update:pair="item.text = $event"/></div>
          </template>
        </DraggableList>
      </div>

      <div class="form-section">
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
.hanzi-editor-page { min-width: 0; width: 100%; padding: 12px 0 56px; }
.nav-buttons { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
.nav-buttons .dev-add-btn { margin-left: auto; }
.edit-form { display: flex; flex-direction: column; gap: 18px; }
.form-section { min-width: 0; margin: 0; padding: 20px; border: 1px solid var(--color-border); border-radius: 12px; background: rgba(255,255,255,.75); }
.form-section h3 { margin: 0 0 18px; color: var(--color-primary-dark); font-size: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(200px,1fr)); align-items: center; gap: 18px; }
.form-grid h4 { margin: 4px 0; color: var(--color-text); font-size: 18px; }
.form-field { display: flex; flex-direction: column; gap: 7px; }
.form-field label { color: var(--color-text-light); font-size: 14px; }
.short-input { width: 100%; max-width: 190px; min-height: 38px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-background); color: var(--color-text); }
.short-input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.pinyin-item { min-width: 0; }
.array-item { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 10px; }
.array-item input { padding: 7px 10px; }
.pinyin-input-row { display: grid; grid-template-columns: 120px minmax(105px, 1fr) 18px minmax(90px, .65fr); align-items: center; }
.pinyin-input-row--no-preview .pinyin-input { grid-column: 2 / -1; }
.pinyin-input-row select { width: 100%; min-width: 0; height: 36px; border: 1px solid #c8d2ca; border-radius: 6px; }
.pinyin-input { box-sizing: border-box; width: 100%; min-width: 0; height: 36px; border: 1px solid #c8d2ca; border-radius: 6px; background: #fff; box-shadow: none; outline: none; }
.pinyin-input:focus, .pinyin-input:focus-visible { border-color: #6f8775; box-shadow: none; outline: none; }
.pinyin-arrow { color: var(--color-text-light); text-align: center; }
.pinyin-preview { box-sizing: border-box; display: flex; align-items: center; min-width: 0; height: 36px; padding: 2px 9px; border: 1px solid #c8d2ca; border-radius: 6px; background: #fff; color: var(--color-text); overflow: hidden; }
.pinyin-preview :deep(.result) { min-width: 0; line-height: 1.2; white-space: nowrap; }
.pinyin-preview :deep(.rt-pinyin) { line-height: 1.2; }
.note-item { display: grid; grid-template-columns: minmax(140px, 190px) minmax(0, 1fr); align-items: start; gap: 14px; min-width: 0; }
.note-item .short-input { max-width: none; }
.note-preview { min-width: 0; min-height: 42px; cursor: pointer; color: var(--color-text); }
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
.mandarin-label { color: var(--color-text-light); font-size: 14px; white-space: nowrap; }
.compact-hint { font-size: 14px; }
.mandarin-options { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.checkbox-item { display: flex; align-items: center; gap: 6px; }
.big-check { transform: scale(1.3); }
.word-suggestions { margin-top: 20px; padding: 16px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-background-alt); }
.word-suggestions h4 { margin: 0 0 4px; color: var(--color-primary-dark); }
.suggestion-hint { margin: 0 0 12px; color: var(--color-text-light); font-size: 13px; }
.suggestion-list { display: flex; flex-direction: column; gap: 10px; }
.suggestion-item { display: flex; align-items: flex-start; gap: 14px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-background); }
.suggestion-item > strong { min-width: 72px; color: var(--color-primary-dark); }
.suggestion-words { display: flex; flex-wrap: wrap; gap: 8px; }
.suggestion-word { display: inline-flex; align-items: baseline; gap: 5px; }
.suggestion-word small { color: var(--color-text-light); }
@media (max-width: 600px) {
  .hanzi-editor-page { padding: 12px 0 36px; }
  .form-section { padding: 14px; }
  .array-item:not(.pinyin-input-row) { align-items: stretch; flex-direction: column; }
  .pinyin-input-row { grid-template-columns: 100px minmax(90px, 1fr) 18px minmax(75px, .6fr); }
  .note-item { grid-template-columns: minmax(0, 1fr); }
  .note-modal { padding: 18px; }
  .mandarin-line { align-items: flex-start; }
  .nav-buttons .dev-add-btn { margin-left: 0; }
}
@media (max-width: 440px) {
  .pinyin-input-row { grid-template-columns: 1fr 18px 1fr; }
  .pinyin-input-row select { grid-column: 1 / -1; }
  .pinyin-input-row--no-preview .pinyin-input { grid-column: 1 / -1; }
}
</style>
