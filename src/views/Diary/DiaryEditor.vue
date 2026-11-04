<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import TextDiffEditor from '../../components/Compare/TextDiffEditor.vue'
import RichTextImageTextarea from '../../components/Text/RichTextImageTextarea.vue'
import { confirm } from '../../services/confirmService.js'
import { showError, showSuccess } from '../../services/ToastService.js'
import { hasPermission } from '../../utils/auth.js'
import { normalizeRichTextSyntax } from '../../utils/textFormatter.js'
import { getDiaryForEdit, updateDiary } from './diaryApi.js'
import './diarySkeleton.css'

const route = useRoute()
const router = useRouter()
const {t} = useI18n()
const diaryId = computed(() => String(route.params.id || ''))
const canEdit = computed(() => hasPermission('diary.edit'))

const visibilityOptions = computed(() => [
  { value: 'private', label: t('diary.editor.private') },
  { value: 'friend', label: t('diary.editor.friend') },
  { value: 'stranger', label: t('diary.editor.stranger') }
])

const form = ref(null)
const loading = ref(true)
const saving = ref(false)
const imageUploading = ref(false)
const activeVersion = ref('private')
const editorMode = ref('plain')
const dragPosition = ref(0)
const isDraggingVisibility = ref(false)
const loadError = ref('')
const visibilityLevels = ['private', 'friend', 'stranger']
const visibilityIndex = computed({
  get: () => Math.max(0, visibilityLevels.indexOf(form.value?.visibility || 'private')),
  set: index => setVisibility(visibilityLevels[Number(index)] || 'private')
})
const availableVersions = computed(() => visibilityOptions.value.slice(0, visibilityIndex.value + 1))

const friendEditorValue = computed({
  get: () => form.value?.forFriend ?? '',
  set: value => {
    if (form.value) form.value.forFriend = value
  }
})

const strangerEditorValue = computed({
  get: () => form.value?.forStranger ?? '',
  set: value => {
    if (form.value) form.value.forStranger = value
  }
})

const currentVisibility = computed(() => form.value?.visibility || 'private')
const currentVisibilityLabel = computed(() => (
  visibilityOptions.value.find(item => item.value === currentVisibility.value)?.label || t('diary.editor.private')
))
const fieldsToClearOnSave = computed(() => {
  if (!form.value) return []

  const fields = []
  if (currentVisibility.value === 'private') {
    if (form.value.forFriend !== null) fields.push(t('diary.editor.friend_version'))
    if (form.value.forStranger !== null) fields.push(t('diary.editor.stranger_version'))
  } else if (currentVisibility.value === 'friend' && form.value.forStranger !== null) {
    fields.push(t('diary.editor.stranger_version'))
  }
  return fields
})

useHead({
  title: () => form.value?.date ? `${form.value.date} - ${t('diary.editor.title')}` : t('diary.editor.title')
})

function normalizeForm(value) {
  return {
    id: value?.id ?? null,
    date: value?.date ?? '',
    sort: value?.sort ?? 1,
    content: normalizeRichTextSyntax(value?.content ?? ''),
    images: value?.images ?? {},
    forFriend: value?.forFriend ?? null,
    forStranger: value?.forStranger ?? null,
    startDate: value?.startDate ?? '',
    finalizeDate: value?.finalizeDate ?? '',
    visibility: value?.visibility || 'private'
  }
}

async function loadDiary() {
  if (!canEdit.value) {
    loading.value = false
    loadError.value = t('diary.editor.no_permission')
    return
  }

  loading.value = true
  loadError.value = ''
  try {
    form.value = normalizeForm(await getDiaryForEdit(diaryId.value))
    dragPosition.value = visibilityIndex.value
    activeVersion.value = 'private'
    editorMode.value = 'plain'
  } catch (error) {
    console.error(error)
    loadError.value = error.message || t('diary.editor.load_failed')
    showError(`${t('diary.editor.load_failed')}：${loadError.value}`)
  } finally {
    loading.value = false
  }
}

function setVisibility(value) {
  if (!form.value) return
  form.value.visibility = value
  if (visibilityLevels.indexOf(activeVersion.value) > visibilityLevels.indexOf(value)) {
    activeVersion.value = value
  }
  if (value !== 'private' && form.value.forFriend == null) {
    form.value.forFriend = ''
  }
  if (value === 'stranger' && form.value.forStranger == null) {
    form.value.forStranger = ''
  }
}

function moveVisibility(event) {
  dragPosition.value = Number(event.target.value)
  setVisibility(visibilityLevels[Math.round(dragPosition.value)])
}

function finishVisibilityDrag() {
  isDraggingVisibility.value = false
  dragPosition.value = visibilityIndex.value
}

function stepVisibility(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const next = Math.max(0, Math.min(2, visibilityIndex.value + (event.key === 'ArrowRight' ? 1 : -1)))
  setVisibility(visibilityLevels[next])
  dragPosition.value = next
}

function selectVersion(value) {
  if (!availableVersions.value.some(option => option.value === value)) return
  activeVersion.value = value
  editorMode.value = 'plain'
}

function buildPayload() {
  const visibility = currentVisibility.value
  return {
    date: form.value.date,
    sort: Number(form.value.sort),
    content: form.value.content,
    forFriend: visibility === 'private' ? null : form.value.forFriend,
    forStranger: visibility === 'stranger' ? form.value.forStranger : null,
    startDate: form.value.startDate || null,
    finalizeDate: form.value.finalizeDate || null,
    visibility
  }
}

async function saveDiary() {
  if (!form.value || saving.value) return
  if (imageUploading.value || form.value.content.includes('⟦图片上传中:')) {
    showError('图片仍在上传，请稍后保存')
    return
  }

  if (!form.value.date) {
    showError(t('diary.editor.date_required'))
    return
  }
  if (!Number.isInteger(Number(form.value.sort)) || Number(form.value.sort) <= 0) {
    showError(t('diary.editor.sort_invalid'))
    return
  }
  if (!String(form.value.content ?? '').trim()) {
    showError(t('diary.editor.content_required'))
    activeVersion.value = 'private'
    return
  }

  if (visibilityIndex.value >= 1 && !String(form.value.forFriend ?? '').trim()) {
    showError(t('diary.editor.version_required', { label: t('diary.editor.friend_version') }))
    activeVersion.value = 'friend'
    editorMode.value = 'plain'
    return
  }
  if (visibilityIndex.value >= 2 && !String(form.value.forStranger ?? '').trim()) {
    showError(t('diary.editor.version_required', { label: t('diary.editor.stranger_version') }))
    activeVersion.value = 'stranger'
    editorMode.value = 'plain'
    return
  }
  if (fieldsToClearOnSave.value.length) {
    const shouldClear = await confirm({
      title: t('diary.editor.lower_confirm_title'),
      message: t('diary.editor.lower_confirm', {labels: fieldsToClearOnSave.value.join('、')}),
      actions: [
        { key: true, text: t('diary.editor.clear_submit'), class: 'dev-btn-small dev-remove-btn' },
        { key: false, text: t('diary.editor.return_edit'), class: 'dev-btn-small dev-normal-button' }
      ]
    })
    if (!shouldClear) return
  }

  saving.value = true
  try {
    const saved = await updateDiary(diaryId.value, buildPayload())
    form.value = normalizeForm(saved)
    showSuccess(t('diary.editor.save_success'))
  } catch (error) {
    console.error(error)
    showError(`${t('diary.editor.save')}：${error.message || t('diary.editor.retry')}`)
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push({
    name: 'DiaryDetail',
    params: {
      language: route.params.language,
      dialect: route.params.dialect,
      id: diaryId.value
    },
    query: { view: 'self' }
  })
}

onMounted(loadDiary)
</script>

<template>
  <main class="broaden-layout diary-editor-page">
    <div class="diary-editor-header">
      <div>
        <h1>{{ $t('diary.editor.title') }}</h1>
      </div>
      <div class="diary-editor-header-actions">
        <button class="dev-normal-button dev-btn-small" type="button" @click="goBack">{{ $t('diary.editor.back_detail') }}</button>
        <button
          v-if="form"
          class="dev-add-btn dev-btn-small"
          type="button"
          :disabled="saving || imageUploading"
          @click="saveDiary"
        >
          {{ saving ? $t('diary.editor.saving') : $t('diary.editor.save') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="diary-editor-skeleton" aria-hidden="true">
      <section class="diary-editor-skeleton__panel panel">
        <div class="diary-meta-grid">
          <div v-for="item in 4" :key="item" class="diary-editor-skeleton__field">
            <span class="diary-editor-skeleton__label diary-skeleton-shimmer" />
            <span class="diary-editor-skeleton__input diary-skeleton-shimmer" />
          </div>
        </div>
      </section>
      <section class="diary-editor-skeleton__panel panel">
        <div class="diary-editor-skeleton__line diary-skeleton-shimmer" />
        <div class="diary-editor-skeleton__line diary-skeleton-shimmer" />
        <div class="diary-editor-skeleton__line diary-editor-skeleton__line--short diary-skeleton-shimmer" />
      </section>
    </div>
    <div v-else-if="loadError" class="diary-editor-state panel">
      <strong>{{ loadError }}</strong>
      <button class="dev-normal-button dev-btn-small" type="button" @click="goBack">{{ $t('diary.editor.back') }}</button>
    </div>

    <div v-else-if="form" class="diary-editor-form">
      <section class="diary-editor-panel panel">
        <div class="diary-meta-grid">
          <label class="diary-field">
            <span>{{ $t('diary.editor.date') }}</span>
            <input v-model="form.date" class="ordinary-input" type="date" required />
          </label>
          <label class="diary-field">
            <span>{{ $t('diary.editor.sort') }}</span>
            <input v-model.number="form.sort" class="ordinary-input" type="number" min="1" step="1" required />
          </label>
          <label class="diary-field">
            <span>{{ $t('diary.editor.start') }}</span>
            <input v-model="form.startDate" class="ordinary-input" type="date" />
          </label>
          <label class="diary-field">
            <span>{{ $t('diary.editor.finalize') }}</span>
            <input v-model="form.finalizeDate" class="ordinary-input" type="date" />
          </label>
        </div>

        <div class="diary-version-controls">
          <div class="diary-visibility">
            <div class="diary-visibility__arrows" :aria-label="$t('diary.editor.select_version')">
              <button v-for="(option, index) in availableVersions" :key="option.value" type="button" class="diary-visibility__arrow" :class="{ 'is-selected': activeVersion === option.value }" :style="{ left: ['18px', '50%', 'calc(100% - 18px)'][index] }" :aria-label="`${$t('diary.editor.select_version')}：${option.label}`" :aria-pressed="activeVersion === option.value" @click="selectVersion(option.value)" />
            </div>
            <div class="diary-visibility__track" :class="{ 'is-dragging': isDraggingVisibility }">
              <span class="diary-visibility__progress" :style="{ width: dragPosition === 0 ? '0' : `calc(36px + (100% - 36px) * ${dragPosition / 2})` }" />
              <span v-for="index in 3" :key="index" class="diary-visibility__tick" :class="{ 'is-reached': dragPosition >= index - 1 }" :style="{ left: ['18px', '50%', 'calc(100% - 18px)'][index - 1] }" />
              <input :value="dragPosition" type="range" min="0" max="2" step="0.01" :aria-label="$t('diary.editor.visibility')" :aria-valuetext="currentVisibilityLabel" @pointerdown="isDraggingVisibility = true" @input="moveVisibility" @change="finishVisibilityDrag" @pointercancel="finishVisibilityDrag" @keydown="stepVisibility" />
            </div>
            <div class="diary-visibility__labels" aria-hidden="true">
              <span v-for="option in visibilityOptions" :key="option.value" :class="{ 'is-editing': activeVersion === option.value }">{{ option.label }}</span>
            </div>
          </div>
        </div>

      </section>

      <section class="diary-editor-panel panel">
        <RichTextImageTextarea
          v-if="activeVersion === 'private'"
          v-model="form.content"
          :owner-id="diaryId"
          :images="form.images"
          :placeholder="$t('diary.editor.content_placeholder')"
          @upload-state-change="imageUploading = $event"
          @image-added="image => form.images = { ...form.images, [image.id]: image }"
        />
        <template v-else>
          <div class="diary-version-editor__head">
            <h2>{{ activeVersion === 'friend' ? $t('diary.editor.friend_version') : $t('diary.editor.stranger_version') }}</h2>
            <div class="diary-version-editor__modes" role="group" :aria-label="$t('diary.editor.edit_mode')">
              <button type="button" :class="{ active: editorMode === 'plain' }" @click="editorMode = 'plain'">{{ $t('diary.editor.plain_edit') }}</button>
              <button type="button" :class="{ active: editorMode === 'compare' }" @click="editorMode = 'compare'">{{ $t('diary.editor.compare_edit') }}</button>
            </div>
          </div>
          <textarea v-if="editorMode === 'plain' && activeVersion === 'friend'" v-model="friendEditorValue" class="diary-version-editor__textarea ordinary-input" :aria-label="$t('diary.editor.friend_version')" />
          <textarea v-else-if="editorMode === 'plain'" v-model="strangerEditorValue" class="diary-version-editor__textarea ordinary-input" :aria-label="$t('diary.editor.stranger_version')" />
          <TextDiffEditor
            v-else-if="activeVersion === 'friend'"
            v-model:source="form.content"
            v-model:target="friendEditorValue"
            :source-label="$t('diary.editor.main_version')"
            :target-label="$t('diary.editor.friend_version')"
            compare-url="/api/diary/edit/diff"
          />
          <TextDiffEditor
            v-else
            v-model:source="form.content"
            v-model:target="strangerEditorValue"
            :source-label="$t('diary.editor.main_version')"
            :target-label="$t('diary.editor.stranger_version')"
            compare-url="/api/diary/edit/diff"
          />
        </template>
      </section>

    </div>

  </main>
</template>

<style scoped>
.diary-editor-page {
  max-width: 1540px;
  padding-top: 32px;
  padding-bottom: 48px;
}

.diary-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.diary-editor-header {
  align-items: flex-start;
  margin-bottom: 20px;
}

.diary-editor-header h1 {
  margin: 0;
  color: var(--color-primary-dark, #24582b);
}

.diary-editor-header h1 {
  font-size: clamp(1.45rem, 2.2vw, 2rem);
}

.diary-editor-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
}

.diary-editor-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 170px;
  color: var(--color-text-light, #6d7480);
}

.diary-editor-skeleton { display: flex; flex-direction: column; gap: 16px; }
.diary-editor-skeleton__field { display: flex; flex-direction: column; gap: 7px; }
.diary-editor-skeleton__label,
.diary-editor-skeleton__input,
.diary-editor-skeleton__line { display: block; border-radius: 4px; }
.diary-editor-skeleton__label { width: 72px; height: 14px; }
.diary-editor-skeleton__input { width: 100%; height: 40px; }
.diary-editor-skeleton__line { width: 100%; height: 17px; margin-bottom: 16px; }
.diary-editor-skeleton__line--short { width: 70%; }

.diary-editor-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.diary-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 0px;
}

.diary-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: var(--color-text, #30353b);
  font-size: 0.84rem;
  font-weight: 600;
}

.ordinary-input {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #cad8cc;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  color: #252a31;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.ordinary-input {
  min-height: 38px;
  padding: 7px 10px;
}

.ordinary-input:focus {
  border-color: var(--color-primary, #2e7d32);
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.1);
}

.diary-version-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(300px, 100%);
  margin-top: 24px;
  margin-left: auto;
  padding-top: 24px;
}

.diary-visibility { width: 100%; margin-top: 0; }
.diary-visibility__arrows { position: relative; height: 24px; margin-bottom: 6px; }
.diary-visibility__arrow { position: absolute; top: 0; width: 28px; height: 24px; padding: 2px 4px; border: 0; background: transparent; color: #a3aca4; cursor: pointer; transform: translateX(-50%); }
.diary-visibility__arrow::before { content: ''; display: block; width: 20px; height: 20px; background: currentColor; -webkit-mask: url('../../assets/icons/to-down.svg') center / contain no-repeat; mask: url('../../assets/icons/to-down.svg') center / contain no-repeat; }
.diary-visibility__arrow:hover { color: var(--color-primary-dark); }
.diary-visibility__arrow.is-selected { color: var(--color-primary); }
.diary-visibility__track { position: relative; height: 36px; overflow: hidden; border: 1px solid var(--color-border); border-radius: 999px; background: #e6ebe6; }
.diary-visibility__progress { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; background: #9bcda0; transition: width .15s ease; }
.diary-visibility__track.is-dragging .diary-visibility__progress { transition: none; }
.diary-visibility__tick { position: absolute; top: 50%; z-index: 1; width: 6px; height: 6px; border-radius: 50%; background: #97a69a; transform: translate(-50%, -50%); pointer-events: none; }
.diary-visibility__tick.is-reached { background: #f5fff5; }
.diary-visibility input[type="range"] { position: absolute; z-index: 2; inset: 0; display: block; width: 100%; height: 100%; margin: 0; appearance: none; background: transparent; cursor: pointer; }
.diary-visibility input[type="range"]::-webkit-slider-thumb { width: 34px; height: 34px; appearance: none; border: 2px solid var(--color-primary); border-radius: 50%; background: #fff; }
.diary-visibility input[type="range"]::-moz-range-thumb { width: 30px; height: 30px; border: 2px solid var(--color-primary); border-radius: 50%; background: #fff; }
.diary-visibility__labels { display: flex; justify-content: space-between; margin-top: 10px; color: var(--color-text-light); font-size: .8rem; }
.diary-visibility__labels .is-editing { color: var(--color-primary-dark); font-weight: 700; }

.diary-version-editor__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.diary-version-editor__head h2 { margin: 0; color: var(--color-primary-dark); font-size: 1.1rem; }
.diary-version-editor__modes { display: inline-flex; gap: 4px; padding: 3px; border: 1px solid var(--color-border); border-radius: 8px; }
.diary-version-editor__modes button { padding: 6px 12px; border: 0; border-radius: 5px; background: transparent; color: var(--color-text-light); font: inherit; cursor: pointer; }
.diary-version-editor__modes button.active { background: #e9f3e9; color: var(--color-primary-dark); }
.diary-version-editor__textarea { display: block; min-height: 420px; padding: 14px; resize: vertical; font: inherit; line-height: 1.7; }


@media (max-width: 900px) {
  .diary-editor-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .diary-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

}

@media (max-width: 600px) {
  .diary-editor-page {
    padding: 24px 12px 36px;
  }

  .diary-editor-header-actions,
  .diary-editor-header-actions button {
    width: 100%;
  }

  .diary-editor-panel {
    padding: 16px;
  }

  .diary-meta-grid {
    grid-template-columns: 1fr;
  }

  .diary-version-editor__head { align-items: flex-start; flex-direction: column; }
}
</style>
