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
const partId = computed(() => Number(route.params.partId))
const chapters = ref([])
const loading = ref(true)
const saving = ref(false)
const editingKey = ref(null)
const deletingId = ref(null)

useHead({title: '編輯章節'})

const createChapter = () => ({
  id: null,
  localKey: `new-${Date.now()}-${Math.random()}`,
  sort: chapters.value.length + 1,
  title: {sc: '', tc: ''},
  description: {sc: '', tc: ''},
  contentState: 'EMPTY',
  deletable: true
})

const url = () => `/api/study/curriculum/manage/${dialect.value}/parts/${partId.value}/chapters?t=${encodeURIComponent(getToken() || '')}`

const load = async () => {
  loading.value = true
  try {
    const response = await fetch(url())
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '加载失败')
    chapters.value = (result.data || []).map((chapter, index) => ({...chapter, sort: index + 1}))
  } catch (error) {
    showError(`加载章节失败：${error.message}`)
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    const payload = chapters.value.map((chapter, index) => ({
      id: chapter.id,
      chapterOrder: index + 1,
      title: chapter.title,
      description: chapter.description
    }))
    const response = await fetch(url(), {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '保存失败')
    showSuccess('章节保存成功')
    await load()
  } catch (error) {
    showError(`保存章节失败：${error.message}`)
  } finally {
    saving.value = false
  }
}

const keyOf = chapter => chapter.id || chapter.localKey

const removeChapter = async chapter => {
  if (!window.confirm('确定删除这个空章节吗？')) return
  if (!chapter.id) {
    chapters.value.splice(chapters.value.indexOf(chapter), 1)
    return
  }
  deletingId.value = chapter.id
  try {
    const response = await fetch(`${url().replace(/\?.*$/, '')}/${chapter.id}?t=${encodeURIComponent(getToken() || '')}`, {method: 'DELETE'})
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || '删除失败')
    showSuccess('章节删除成功')
    await load()
  } catch (error) {
    showError(`删除章节失败：${error.message}`)
  } finally {
    deletingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <main class="chapter-editor-page">
    <header class="editor-toolbar">
      <div>
        <router-link class="back-link" :to="{name: 'StudyCurriculumEditor', params: {language: route.params.language, dialect}}">← 返回部分</router-link>
        <h1>編輯章節</h1>
      </div>
      <button type="button" :disabled="saving || loading" @click="save">{{ saving ? '保存中……' : '保存全部' }}</button>
    </header>

    <LoadingIcon v-if="loading" :show-text="true" />
    <template v-else>
      <DraggableList v-model="chapters" :create-item="createChapter" :show-delete="false">
        <template #default="{item, index}">
          <article v-if="editingKey !== keyOf(item)" class="chapter-summary">
            <span class="chapter-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="chapter-copy"><h2>{{ item.title.sc || '未命名章节' }}</h2><p>{{ item.description.sc || '暂无描述' }}</p></div>
            <div class="chapter-actions">
              <button type="button" class="secondary-button" @click="editingKey = keyOf(item)">编辑说明</button>
              <button type="button" class="next-button" disabled>编辑课程</button>
              <button type="button" class="delete-button" :disabled="item.id != null && deletingId === item.id" @click="removeChapter(item)">删除</button>
            </div>
          </article>

          <div v-else class="chapter-edit">
            <header class="edit-heading"><h2>第 {{ index + 1 }} 章</h2><button type="button" @click="editingKey = null">完成编辑</button></header>
            <h3>章节标题</h3>
            <ScAndTcText v-model:traditional-text="item.title.tc" v-model:simplified-text="item.title.sc" layout="small" :dialect="dialect" />
            <h3>章节描述</h3>
            <ScAndTcText v-model:traditional-text="item.description.tc" v-model:simplified-text="item.description.sc" :dialect="dialect" :rows="4" />
          </div>
        </template>
      </DraggableList>
    </template>
  </main>
</template>

<style scoped>
.chapter-editor-page { max-width: 920px; margin: 0 auto; padding: 96px 24px 72px; color: #263a2c; }
.editor-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }.editor-toolbar h1 { margin: 7px 0 0; color: var(--color-primary-dark); font-size: 1.8rem; }.editor-toolbar > button { padding: 10px 20px; border: 0; border-radius: 999px; color: #fff; background: var(--color-primary); font: inherit; font-size: .78rem; font-weight: 700; cursor: pointer; }.editor-toolbar > button:disabled { opacity: .55; cursor: default; }
.back-link { display: inline-block; margin-bottom: 25px; color: #5f8466; font-size: .78rem; text-decoration: none; }
.page-header { margin-bottom: 28px; }.eyebrow { margin: 0 0 8px; color: var(--color-primary); font-family: var(--font-family-mono); font-size: .68rem; font-weight: 700; letter-spacing: .16em; }.page-header h1 { margin: 0; color: var(--color-primary-dark); font-size: clamp(2rem, 5vw, 2.8rem); letter-spacing: -.04em; }.page-header > p:last-child { max-width: 640px; margin: 10px 0 0; color: var(--color-text-light); font-size: .86rem; line-height: 1.7; }
.chapter-editor-page :deep(.draggable-wrapper) { gap: 18px; }.chapter-editor-page :deep(.add-bar) { margin: 0 0 4px; padding-bottom: 18px; border-bottom: 1px solid #dce9dd; }.chapter-editor-page :deep(.add-bar button) { padding: 9px 17px; border: 1px solid #a8cbaa; border-radius: 999px; color: var(--color-primary-dark); background: #fff; font-weight: 700; }.chapter-editor-page :deep(.draggable-item) { align-items: center; gap: 14px; padding: 14px 18px; border: 1px solid #d8e8d9; border-radius: 18px; background: rgba(255,255,255,.9); box-shadow: 0 10px 28px rgba(45,91,54,.07); }.chapter-editor-page :deep(.draggable-item:hover) { border-color: #b6d5b9; background: #fff; }.chapter-editor-page :deep(.drag-handle) { padding: 9px 8px; border: 1px solid #d6e5d7; color: #739078; background: #f0f7f0; }
.chapter-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }.chapter-heading span { color: #70a077; font-family: var(--font-family-mono); font-size: .65rem; font-weight: 700; letter-spacing: .13em; }.chapter-heading h2 { margin: 5px 0 0; color: #355d3d; font-size: 1.3rem; }.chapter-heading em { padding: 6px 10px; border: 1px solid #dce6dd; border-radius: 999px; color: #869889; background: #f6f8f6; font-size: .68rem; font-style: normal; white-space: nowrap; }
.field-section { padding: 16px; border: 1px solid #e1ece2; border-radius: 13px; background: #fbfefb; }.field-section + .field-section { margin-top: 13px; }.field-section h3 { margin: 0; color: #4f6f55; font-size: .86rem; }.field-section > p { margin: 5px 0 13px; color: #89998c; font-size: .72rem; }
.save-bar { position: sticky; bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 24px; padding: 13px 16px; border: 1px solid #cfe0d1; border-radius: 15px; background: rgba(255,255,255,.94); box-shadow: 0 10px 30px rgba(39,80,47,.13); backdrop-filter: blur(10px); }.save-bar span { color: #718575; font-size: .76rem; }.save-bar button { padding: 10px 20px; border: 0; border-radius: 999px; color: #fff; background: var(--color-primary); font: inherit; font-size: .78rem; font-weight: 700; cursor: pointer; }.save-bar button:disabled { opacity: .55; cursor: default; }
.chapter-summary { display: grid; grid-template-columns: 48px minmax(0,1fr) auto; align-items: center; gap: 16px; min-height: 70px; }.chapter-index { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 13px; color: #4d8b57; background: #edf7ee; font-family: var(--font-family-mono); font-size: .74rem; font-weight: 700; }.chapter-copy { min-width: 0; }.chapter-copy h2 { margin: 0 0 7px; overflow: hidden; color: #315a38; font-size: 1.08rem; text-overflow: ellipsis; white-space: nowrap; }.chapter-copy p { display: -webkit-box; margin: 0; overflow: hidden; color: #7b8d7e; font-size: .78rem; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.chapter-actions { display: flex; align-items: center; gap: 7px; }.chapter-actions button, .edit-heading button { padding: 8px 12px; border-radius: 999px; font: inherit; font-size: .7rem; font-weight: 700; cursor: pointer; }.secondary-button, .edit-heading button { border: 1px solid #b9d2bc; color: #47784f; background: #fff; }.next-button { border: 1px solid #d7dfd8; color: #9ba69d; background: #f1f4f1; }.next-button:disabled { cursor: not-allowed; }.delete-button { border: 1px solid #e0bbbb; color: #a84e4e; background: #fff8f8; }.chapter-edit h3 { margin: 18px 0 10px; color: #4f6f55; font-size: .86rem; }.edit-heading { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid #e0ebe1; }.edit-heading h2 { margin: 0; color: #355d3d; font-size: 1.15rem; }
@media (max-width: 640px) { .chapter-editor-page { padding: 82px 12px 54px; }.editor-toolbar { align-items: flex-start; }.chapter-editor-page :deep(.draggable-item) { padding: 14px 12px; }.chapter-summary { grid-template-columns: 42px minmax(0,1fr); }.chapter-actions { grid-column: 1 / -1; flex-wrap: wrap; } }
</style>
