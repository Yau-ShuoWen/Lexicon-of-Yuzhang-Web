<script setup>
import {computed, onMounted, ref} from 'vue'
import {useHead} from '@vueuse/head'
import {useRoute} from 'vue-router'
import DraggableList from '../../../components/Layout/DraggableList.vue'
import ScAndTcText from '../../../components/Text/ScAndTcText.vue'
import LoadingIcon from '../../../components/Status/LoadingIcon.vue'
import {getToken} from '../../../utils/auth.js'
import {showError, showSuccess} from '../../../services/ToastService.js'

const route = useRoute()
const dialect = computed(() => route.params.dialect)
const parts = ref([])
const loading = ref(true)
const saving = ref(false)
const editingKey = ref(null)
const deletingId = ref(null)

useHead({title: '關卡編輯器'})

const createPart = () => ({
  id: null,
  localKey: `new-${Date.now()}-${Math.random()}`,
  sort: parts.value.length + 1,
  title: {sc: '', tc: ''},
  description: {sc: '', tc: ''},
  contentState: 'EMPTY',
  deletable: true
})

const url = () => `/api/study/curriculum/manage/${dialect.value}/parts?t=${encodeURIComponent(getToken() || '')}`

const load = async () => {
  loading.value = true
  try {
    const response = await fetch(url())
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '加载失败')
    parts.value = (result.data || []).map((part, index) => ({...part, sort: index + 1}))
  } catch (error) {
    showError(`加载学习部分失败：${error.message}`)
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    const payload = parts.value.map((part, index) => ({
      id: part.id,
      partOrder: index + 1,
      title: part.title,
      description: part.description
    }))
    const response = await fetch(url(), {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '保存失败')
    showSuccess('部分保存成功')
    await load()
  } catch (error) {
    showError(`保存部分失败：${error.message}`)
  } finally {
    saving.value = false
  }
}

const keyOf = part => part.id || part.localKey

const removePart = async (part) => {
  if (!part.deletable) {
    showError('这个部分中已经有章节，必须先清空章节后才能删除。')
    return
  }
  if (!window.confirm('确定删除这个空部分吗？')) return
  if (!part.id) {
    parts.value.splice(parts.value.indexOf(part), 1)
    return
  }
  deletingId.value = part.id
  try {
    const response = await fetch(`/api/study/curriculum/manage/${dialect.value}/parts/${part.id}?t=${encodeURIComponent(getToken() || '')}`, {method: 'DELETE'})
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '删除失败')
    showSuccess('部分删除成功')
    await load()
  } catch (error) {
    showError(`删除部分失败：${error.message}`)
  } finally {
    deletingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <main class="dev-editor-page">
    <header class="editor-toolbar">
      <h1>關卡編輯器</h1>
      <button type="button" :disabled="saving || loading" @click="save">
        {{ saving ? '保存中……' : '保存全部' }}
      </button>
    </header>

    <LoadingIcon v-if="loading" :show-text="true" />

    <template v-else>
      <DraggableList
        v-model="parts"
        :create-item="createPart"
        :show-delete="false"
      >
        <template #default="{item, index}">
          <article v-if="editingKey !== keyOf(item)" class="part-summary">
            <span class="part-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="part-copy">
              <h2>{{ item.title.sc || '未命名部分' }}</h2>
              <p>{{ item.description.sc || '暂无描述' }}</p>
            </div>
            <div class="part-actions">
              <button type="button" class="secondary-button" @click="editingKey = keyOf(item)">编辑说明</button>
              <router-link v-if="item.id" class="primary-link" :to="{name: 'StudyChapterEditor', params: {language: route.params.language, dialect, partId: item.id}}">编辑章节</router-link>
              <button v-else type="button" class="primary-link" disabled>保存后编辑章节</button>
              <button type="button" class="delete-button" :class="{'delete-button--blocked': !item.deletable}" :disabled="item.id != null && deletingId === item.id" @click="removePart(item)">删除</button>
            </div>
          </article>

          <div v-else class="part-edit">
            <header class="edit-heading"><h2>部分 {{ index + 1 }}</h2><button type="button" @click="editingKey = null">完成编辑</button></header>
            <h3>部分标题</h3>
            <ScAndTcText
              v-model:traditional-text="item.title.tc"
              v-model:simplified-text="item.title.sc"
              layout="small"
              :dialect="dialect"
            />
            <h3>部分描述</h3>
            <ScAndTcText
              v-model:traditional-text="item.description.tc"
              v-model:simplified-text="item.description.sc"
              :dialect="dialect"
              :rows="4"
            />
          </div>
        </template>
      </DraggableList>

    </template>
  </main>
</template>

<style scoped>
.dev-editor-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 96px 24px 72px;
  color: #263a2c;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.editor-toolbar h1 {
  margin: 0;
  color: var(--color-primary-dark);
  font-size: 1.8rem;
}

.editor-toolbar button {
  padding: 10px 20px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: var(--color-primary);
  font: inherit;
  font-size: .78rem;
  font-weight: 700;
  cursor: pointer;
}

.editor-toolbar button:disabled {
  opacity: .55;
  cursor: default;
}

.page-header {
  margin-bottom: 28px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--color-primary);
  font-family: var(--font-family-mono);
  font-size: .68rem;
  font-weight: 700;
  letter-spacing: .16em;
}

.page-header h1 {
  margin: 0;
  color: var(--color-primary-dark);
  font-size: clamp(2rem, 5vw, 2.8rem);
  letter-spacing: -.04em;
}

.introduction {
  max-width: 640px;
  margin: 10px 0 0;
  color: var(--color-text-light);
  font-size: .86rem;
  line-height: 1.7;
}

.dev-editor-page :deep(.draggable-wrapper) {
  gap: 18px;
}

.dev-editor-page :deep(.add-bar) {
  margin: 0 0 4px;
  padding-bottom: 18px;
  border-bottom: 1px solid #dce9dd;
}

.dev-editor-page :deep(.add-bar button) {
  padding: 9px 17px;
  border: 1px solid #a8cbaa;
  border-radius: 999px;
  color: var(--color-primary-dark);
  background: #fff;
  font-weight: 700;
}

.dev-editor-page :deep(.draggable-item) {
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border: 1px solid #d8e8d9;
  border-radius: 18px;
  background: rgba(255, 255, 255, .9);
  box-shadow: 0 10px 28px rgba(45, 91, 54, .07);
}

.dev-editor-page :deep(.draggable-item:hover) {
  border-color: #b6d5b9;
  background: #fff;
}

.dev-editor-page :deep(.drag-handle) {
  padding: 9px 8px;
  border: 1px solid #d6e5d7;
  color: #739078;
  background: #f0f7f0;
}

.part-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.part-number {
  color: #70a077;
  font-family: var(--font-family-mono);
  font-size: .65rem;
  font-weight: 700;
  letter-spacing: .13em;
}

.part-heading h2 {
  margin: 5px 0 0;
  color: #355d3d;
  font-size: 1.3rem;
}

.part-state {
  padding: 6px 10px;
  border: 1px solid #dce6dd;
  border-radius: 999px;
  color: #869889;
  background: #f6f8f6;
  font-size: .68rem;
  white-space: nowrap;
}

.part-state--filled {
  border-color: #b9d8bc;
  color: #4b8354;
  background: #eef8ef;
}

.part-heading-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}

.chapter-link {
  padding: 7px 11px;
  border-radius: 999px;
  color: #fff;
  background: var(--color-primary);
  font-size: .7rem;
  font-weight: 700;
  text-decoration: none;
}

.chapter-link--disabled {
  color: #96a298;
  background: #edf1ed;
}

.field-section {
  padding: 16px;
  border: 1px solid #e1ece2;
  border-radius: 13px;
  background: #fbfefb;
}

.field-section + .field-section {
  margin-top: 13px;
}

.field-section h3 {
  margin: 0;
  color: #4f6f55;
  font-size: .86rem;
}

.field-section > p {
  margin: 5px 0 13px;
  color: #89998c;
  font-size: .72rem;
}

.save-bar {
  position: sticky;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 24px;
  padding: 13px 16px;
  border: 1px solid #cfe0d1;
  border-radius: 15px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 10px 30px rgba(39, 80, 47, .13);
  backdrop-filter: blur(10px);
}

.save-bar span {
  color: #718575;
  font-size: .76rem;
}

.save-bar button {
  padding: 10px 20px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: var(--color-primary);
  font: inherit;
  font-size: .78rem;
  font-weight: 700;
  cursor: pointer;
}

.save-bar button:disabled {
  opacity: .55;
  cursor: default;
}

.part-summary {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  min-height: 70px;
}

.part-index {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  color: #4d8b57;
  background: #edf7ee;
  font-family: var(--font-family-mono);
  font-size: .74rem;
  font-weight: 700;
}

.part-copy {
  min-width: 0;
}

.part-copy h2 {
  margin: 0 0 7px;
  overflow: hidden;
  color: #315a38;
  font-size: 1.08rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.part-copy p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: #7b8d7e;
  font-size: .78rem;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.part-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.part-actions button,
.primary-link,
.edit-heading button {
  padding: 8px 12px;
  border-radius: 999px;
  font: inherit;
  font-size: .7rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.secondary-button,
.edit-heading button {
  border: 1px solid #b9d2bc;
  color: #47784f;
  background: #fff;
}

.primary-link {
  border: 1px solid var(--color-primary);
  color: #fff;
  background: var(--color-primary);
}

.primary-link:disabled {
  border-color: #d7dfd8;
  color: #9ba69d;
  background: #f1f4f1;
  cursor: not-allowed;
}

.delete-button {
  border: 1px solid #e0bbbb;
  color: #a84e4e;
  background: #fff8f8;
}

.delete-button:disabled {
  border-color: #e0e4e0;
  color: #a8b0a9;
  background: #f5f6f5;
  cursor: not-allowed;
}

.delete-button--blocked {
  border-color: #dfe3df;
  color: #a4ada6;
  background: #f2f4f2;
}

.part-edit h3 {
  margin: 18px 0 10px;
  color: #4f6f55;
  font-size: .86rem;
}

.edit-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid #e0ebe1;
}

.edit-heading h2 {
  margin: 0;
  color: #355d3d;
  font-size: 1.15rem;
}

@media (max-width: 640px) {
  .dev-editor-page {
    padding: 82px 12px 54px;
  }

  .dev-editor-page :deep(.draggable-item) {
    padding: 14px 12px;
  }

  .part-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .part-heading-actions {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .field-section {
    padding: 12px;
  }

  .part-summary {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .part-actions {
    grid-column: 1 / -1;
    flex-wrap: wrap;
  }
}
</style>
