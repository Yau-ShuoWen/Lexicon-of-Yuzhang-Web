<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@vueuse/head'
import TextDiffEditor from '../../components/Compare/TextDiffEditor.vue'
import { confirm } from '../../services/confirmService.js'
import { showError, showSuccess } from '../../services/ToastService.js'
import { hasPermission } from '../../utils/auth.js'
import { getDiaryForEdit, updateDiary } from './diaryApi.js'

const route = useRoute()
const router = useRouter()
const diaryId = computed(() => String(route.params.id || ''))
const canEdit = computed(() => hasPermission('blog.edit'))

const visibilityOptions = [
  { value: 'private', label: '私人', hint: '只保存主版本' },
  { value: 'friend', label: '朋友', hint: '保存主版本和朋友版本' },
  { value: 'stranger', label: '陌生人', hint: '保存三个层级版本' }
]

const form = ref(null)
const loading = ref(true)
const saving = ref(false)
const activePublicModal = ref(null)
const loadError = ref('')

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
  visibilityOptions.find(item => item.value === currentVisibility.value)?.label || '私人'
))
const showFriendVersion = computed(() => Boolean(
  form.value && (currentVisibility.value !== 'private' || form.value.forFriend !== null)
))
const showStrangerVersion = computed(() => Boolean(
  form.value && (currentVisibility.value === 'stranger' || form.value.forStranger !== null)
))
const canEditFriendVersion = computed(() => currentVisibility.value !== 'private')
const canEditStrangerVersion = computed(() => currentVisibility.value === 'stranger')
const fieldsToClearOnSave = computed(() => {
  if (!form.value) return []

  const fields = []
  if (currentVisibility.value === 'private') {
    if (form.value.forFriend !== null) fields.push('朋友版本')
    if (form.value.forStranger !== null) fields.push('陌生人版本')
  } else if (currentVisibility.value === 'friend' && form.value.forStranger !== null) {
    fields.push('陌生人版本')
  }
  return fields
})

useHead({
  title: () => form.value?.date ? `${form.value.date} - 编辑日记` : '编辑日记'
})

function normalizeForm(value) {
  return {
    id: value?.id ?? null,
    date: value?.date ?? '',
    sort: value?.sort ?? 1,
    content: value?.content ?? '',
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
    loadError.value = '没有日记编辑权限'
    return
  }

  loading.value = true
  loadError.value = ''
  try {
    form.value = normalizeForm(await getDiaryForEdit(diaryId.value))
  } catch (error) {
    console.error(error)
    loadError.value = error.message || '加载日记失败'
    showError(`加载日记失败：${loadError.value}`)
  } finally {
    loading.value = false
  }
}

function changeVisibility() {
  if (!form.value) return

  if (form.value.visibility === 'private') {
    return
  }

  if (form.value.forFriend === null || form.value.forFriend === undefined) {
    form.value.forFriend = ''
  }

  if (form.value.visibility === 'friend') {
    return
  }

  if (form.value.forStranger === null || form.value.forStranger === undefined) {
    form.value.forStranger = ''
  }
}

function openPublicEditor(version) {
  if (currentVisibility.value === 'private') return
  if (version === 'stranger' && currentVisibility.value !== 'stranger') return
  activePublicModal.value = version
}

function closePublicEditor() {
  if (!saving.value) activePublicModal.value = null
}

function publicEmptyLabels() {
  if (!form.value || currentVisibility.value === 'private') return []

  const labels = []
  if (!String(form.value.forFriend ?? '').trim()) labels.push('朋友版本')
  if (currentVisibility.value === 'stranger' && !String(form.value.forStranger ?? '').trim()) {
    labels.push('陌生人版本')
  }
  return labels
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

  if (!form.value.date) {
    showError('请选择日记日期')
    return
  }
  if (!Number.isInteger(Number(form.value.sort)) || Number(form.value.sort) <= 0) {
    showError('sort 必须是大于 0 的整数')
    return
  }
  if (form.value.content === null || form.value.content === undefined) {
    showError('正文不能为空')
    return
  }

  const emptyLabels = publicEmptyLabels()
  if (fieldsToClearOnSave.value.length) {
    const shouldClear = await confirm({
      title: '确认降低公开范围',
      message: `${fieldsToClearOnSave.value.join('、')}将在确认提交后保存为 null，当前内容会被清除。确定继续吗？`,
      actions: [
        { key: true, text: '确认提交并清除', class: 'dev-btn-small dev-remove-btn' },
        { key: false, text: '返回修改', class: 'dev-btn-small dev-normal-button' }
      ]
    })
    if (!shouldClear) return
  }

  if (emptyLabels.length) {
    const shouldSubmitEmpty = await confirm({
      title: '公开版本为空',
      message: `${emptyLabels.join('、')}为空，确定仍然提交吗？`,
      actions: [
        { key: true, text: '仍然提交', class: 'dev-btn-small dev-add-btn' },
        { key: false, text: '返回修改', class: 'dev-btn-small dev-normal-button' }
      ]
    })
    if (!shouldSubmitEmpty) {
      activePublicModal.value = emptyLabels.includes('朋友版本') ? 'friend' : 'stranger'
      return
    }
  }

  saving.value = true
  try {
    const saved = await updateDiary(diaryId.value, buildPayload())
    form.value = normalizeForm(saved)
    activePublicModal.value = null
    showSuccess('日记保存成功')
  } catch (error) {
    console.error(error)
    showError(`保存日记失败：${error.message || '请稍后重试'}`)
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
    }
  })
}

onMounted(loadDiary)
</script>

<template>
  <main class="broaden-layout diary-editor-page">
    <div class="diary-editor-header">
      <div>
        <h1>编辑日记</h1>
      </div>
      <div class="diary-editor-header-actions">
        <button class="dev-normal-button dev-btn-small" type="button" @click="router.back()">返回详情</button>
        <button
          v-if="form"
          class="dev-add-btn dev-btn-small"
          type="button"
          :disabled="saving"
          @click="saveDiary"
        >
          {{ saving ? '保存中……' : '保存修改' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="diary-editor-state panel">正在加载日记……</div>
    <div v-else-if="loadError" class="diary-editor-state panel">
      <strong>{{ loadError }}</strong>
      <button class="dev-normal-button dev-btn-small" type="button" @click="goBack">返回</button>
    </div>

    <div v-else-if="form" class="diary-editor-form">
      <section class="diary-editor-panel panel">
        <div class="diary-meta-grid">
          <label class="diary-field">
            <span>日期</span>
            <input v-model="form.date" class="ordinary-input" type="date" required />
          </label>
          <label class="diary-field">
            <span>排序 sort</span>
            <input v-model.number="form.sort" class="ordinary-input" type="number" min="1" step="1" required />
          </label>
          <label class="diary-field">
            <span>开始写作</span>
            <input v-model="form.startDate" class="ordinary-input" type="date" />
          </label>
          <label class="diary-field">
            <span>完成时间</span>
            <input v-model="form.finalizeDate" class="ordinary-input" type="date" />
          </label>
        </div>

        <div class="diary-settings-row">
          <div class="visibility-setting">
            <div class="visibility-options" role="radiogroup" aria-label="公开范围">
              <label
                v-for="option in visibilityOptions"
                :key="option.value"
                class="visibility-option"
                :class="{ active: form.visibility === option.value }"
              >
                <input v-model="form.visibility" type="radio" :value="option.value" @change="changeVisibility" />
                <span>
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.hint }}</small>
                </span>
              </label>
            </div>
          </div>

          <div class="diary-public-version-setting">
            <div v-if="!showFriendVersion && !showStrangerVersion" class="public-empty-state">
              当前为私人模式，朋友版和陌生人版保存为 <code>null</code>。
            </div>
            <div v-else class="public-version-summary">
              <div v-if="showFriendVersion" class="public-version-summary__item">
                <span>朋友版本</span>
                <strong :class="{ 'is-empty': !String(form.forFriend ?? '').trim() }">
                  {{ String(form.forFriend ?? '').trim() ? '已填写' : '暂为空' }}
                </strong>
                <em v-if="!canEditFriendVersion" class="public-version-summary__pending">提交后清除</em>
                <button
                  v-if="canEditFriendVersion"
                  class="dev-normal-button dev-btn-small"
                  type="button"
                  @click="openPublicEditor('friend')"
                >
                  编辑
                </button>
              </div>
              <div v-if="showStrangerVersion" class="public-version-summary__item">
                <span>陌生人版本</span>
                <strong :class="{ 'is-empty': !String(form.forStranger ?? '').trim() }">
                  {{ String(form.forStranger ?? '').trim() ? '已填写' : '暂为空' }}
                </strong>
                <em v-if="!canEditStrangerVersion" class="public-version-summary__pending">提交后清除</em>
                <button
                  v-if="canEditStrangerVersion"
                  class="dev-normal-button dev-btn-small"
                  type="button"
                  @click="openPublicEditor('stranger')"
                >
                  编辑
                </button>
              </div>
            </div>
          </div>
        </div>

      </section>

      <section class="diary-editor-panel panel">
        <textarea
          v-model="form.content"
          class="diary-main-input"
          rows="18"
          placeholder="在这里编辑完整日记内容……"
          spellcheck="false"
        ></textarea>
      </section>

    </div>

    <div v-if="activePublicModal && form" class="diary-modal-backdrop" @click.self="closePublicEditor">
      <section
        class="diary-public-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`public-editor-title-${activePublicModal}`"
      >
        <header class="diary-modal-header">
          <div>
            <h2 :id="`public-editor-title-${activePublicModal}`">
              {{ activePublicModal === 'friend' ? '编辑朋友版本' : '编辑陌生人版本' }}
            </h2>
          </div>
          <button
            class="diary-modal-close"
            type="button"
            :disabled="saving"
            aria-label="关闭版本编辑窗口"
            @click="closePublicEditor"
          >×</button>
        </header>

        <div class="diary-modal-body">
          <TextDiffEditor
            v-if="activePublicModal === 'friend'"
            v-model:source="form.content"
            v-model:target="friendEditorValue"
            source-label="主版本（自己）"
            target-label="朋友版本"
            compare-url="/api/diary/edit/diff"
          />

          <TextDiffEditor
            v-else
            v-model:source="form.content"
            v-model:target="strangerEditorValue"
            source-label="主版本（自己）"
            target-label="陌生人版本"
            compare-url="/api/diary/edit/diff"
          />
        </div>

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

.diary-editor-header,
.diary-panel-title,
.diary-modal-header,
.public-version-summary,
.visibility-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.diary-settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  align-items: start;
  gap: 18px;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #e2ebe3;
}

.diary-editor-header {
  align-items: flex-start;
  margin-bottom: 20px;
}

.diary-editor-header h1,
.diary-panel-title h2,
.diary-modal-header h2 {
  margin: 0;
  color: var(--color-primary-dark, #24582b);
}

.diary-editor-header h1 {
  font-size: clamp(1.45rem, 2.2vw, 2rem);
}

.diary-editor-kicker,
.diary-editor-section-kicker {
  margin: 0 0 7px;
  color: var(--color-primary, #2e7d32);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.diary-editor-hint,
.diary-section-hint,
.visibility-setting p,
.diary-modal-header p {
  margin: 7px 0 0;
  color: var(--color-text-light, #6d7480);
  font-size: 0.88rem;
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

.diary-editor-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.diary-panel-title {
  align-items: flex-start;
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

.ordinary-input,
.diary-main-input {
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

.ordinary-input:focus,
.diary-main-input:focus {
  border-color: var(--color-primary, #2e7d32);
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.1);
}

.visibility-setting {
  min-width: 0;
  align-items: flex-start;
}

.diary-public-version-setting {
  min-width: 0;
}

.diary-field-label {
  display: block;
  color: var(--color-text, #30353b);
  font-size: 0.84rem;
  font-weight: 700;
}

.visibility-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.visibility-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 122px;
  padding: 9px 12px;
  border: 1px solid #d1ddd3;
  border-radius: 10px;
  background: #fafdfb;
  color: #59636a;
  cursor: pointer;
}

.visibility-option.active {
  border-color: #8eb994;
  background: #eef8ef;
  color: #24582b;
}

.visibility-option input {
  accent-color: var(--color-primary, #2e7d32);
}

.visibility-option span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.visibility-option small {
  color: #7d8780;
  font-size: 0.7rem;
  font-weight: 400;
}

.version-badge {
  padding: 5px 10px;
  border-radius: 999px;
  color: #526276;
  background: #edf2f7;
  font-size: 0.78rem;
}

.version-badge--private {
  color: #2d6e38;
  background: #eaf6ed;
}

.diary-main-input {
  display: block;
  min-height: 360px;
  margin-top: 16px;
  padding: 14px;
  resize: vertical;
  font-size: 16px;
  white-space: pre-wrap;
}

.public-version-panel {
  padding-bottom: 20px;
}

.public-empty-state {
  margin-top: 0;
  padding: 16px;
  border: 1px dashed #cbdccc;
  border-radius: 9px;
  color: #637267;
  background: #f7fbf7;
}

.public-empty-state code {
  color: #356a3b;
}

.public-version-summary {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 0;
}

.public-version-summary__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #f5f8f5;
  color: #56625a;
  font-size: 0.82rem;
}

.public-version-summary__item strong {
  color: #2e7d32;
}

.public-version-summary__item strong.is-empty {
  color: #a2671d;
}

.public-version-summary__pending {
  color: #a2671d;
  font-size: 0.74rem;
  font-style: normal;
}

.diary-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: rgba(20, 38, 24, 0.46);
  backdrop-filter: blur(5px);
}

.diary-public-modal {
  display: flex;
  flex-direction: column;
  width: min(1800px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 18px;
  background: #f5faf6;
  box-shadow: 0 28px 80px rgba(15, 37, 19, 0.34);
}

.diary-modal-header {
  flex: 0 0 auto;
  padding: 10px 22px;
}

.diary-modal-header {
  align-items: flex-start;
  border-bottom: 1px solid #d7e8d8;
}

.diary-modal-header h2 {
  font-size: 1.25rem;
}

.diary-modal-close {
  border: 0;
  background: transparent;
  color: #6a756d;
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
}

.diary-modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  padding: 10px 22px;
  overflow: auto;
}

@media (max-width: 900px) {
  .diary-editor-header,
  .visibility-setting {
    align-items: flex-start;
    flex-direction: column;
  }

  .diary-settings-row {
    grid-template-columns: 1fr;
  }

  .diary-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .visibility-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .visibility-options {
    grid-template-columns: 1fr;
  }

  .diary-panel-title,
  .public-version-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .diary-modal-backdrop {
    padding: 6px;
  }

  .diary-public-modal {
    width: calc(100vw - 12px);
    max-height: calc(100vh - 12px);
    border-radius: 13px;
  }

  .diary-modal-header,
  .diary-modal-body {
    padding-left: 12px;
    padding-right: 12px;
  }
}
</style>
