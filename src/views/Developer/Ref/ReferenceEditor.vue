<!-- src/views/ref/RefEditor.vue -->
<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingIcon from "../../../components/Status/LoadingIcon.vue"
import { confirm } from "../../../services/confirmService.js"
import { showError, showSuccess } from "../../../services/ToastService.js"

import DraggableList from "../../../components/Layout/DraggableList.vue"
import ScAndTcText from "../../../components/Text/ScAndTcText.vue"
import RichText from "../../../components/Text/RichText.vue"

const route = useRoute()
const router = useRouter()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const dictionary = computed(() => route.params.dictionary)
const sortParam = computed(() => route.params.sort)

const getPath = (newSort) => `/${language.value}/${dialect.value}/ref-editor/${dictionary.value}/${newSort}`

const page = ref(null)
const backupPage = ref(null)     // 用于检测是否有未保存修改
const loading = ref(false)
const saving = ref(false)
const prevSort = ref(null)
const nextSort = ref(null)

const pageInfoTitle = ref('')
const pageInfoNumber = ref('')

// ==================== 是否有未保存修改 ====================
const hasUnsavedChanges = computed(() => {
  if (!page.value || !backupPage.value) return false

  // 简单深比较（JSON 字符串化对比）
  return JSON.stringify(page.value) !== JSON.stringify(backupPage.value)
})

// ==================== 加载页面 ====================
async function loadPage() {
  loading.value = true
  try {
    const res = await fetch(`/api/ref/get-page/${dictionary.value}?sort=${encodeURIComponent(sortParam.value)}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.message || '加载失败')

    page.value = json.data
    backupPage.value = JSON.parse(JSON.stringify(json.data))   // 深拷贝作为备份

    await loadNearby()
  } catch (e) {
    showError('加载失败：' + e.message)
  }
  finally {
    loading.value = false
  }
}

async function loadNearby() {
  if (!page.value) return
  const body = {left: page.value.frontSort, right: page.value.endSort}
  try {
    const res = await fetch(`/api/ref/get-nearby/${dictionary.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    })
    const json = await res.json()
    if (json.success) {
      prevSort.value = json.data.left?.empty ? null : json.data.left?.value
      nextSort.value = json.data.right?.empty ? null : json.data.right?.value
    }
  } catch (e) {
    console.error(e)
  }
}

// ==================== 页码同步 ====================
watch(() => page.value?.pageInfo, (val) => {
  if (!val) return
  pageInfoTitle.value = val.left || ''
  pageInfoNumber.value = (val.right != null && val.right !== -1) ? String(val.right) : ''
}, {immediate: true})

function syncPageInfo() {
  if (!page.value) return
  const num = pageInfoNumber.value === '' ? -1 : Number(pageInfoNumber.value)
  page.value.pageInfo = {left: pageInfoTitle.value || '', right: isNaN(num) ? -1 : num}
}

// ==================== 保存逻辑 ====================
async function saveDraft() {
  if (page.value?.type !== 'draft') return
  saving.value = true
  try {
    syncPageInfo()
    const res = await fetch(`/api/ref/update-page/${dictionary.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(page.value)
    })
    const json = await res.json()

    if (json.success) {
      showSuccess('草稿保存成功')
      backupPage.value = JSON.parse(JSON.stringify(page.value))  // 保存成功后更新备份
    } else {
      showError(json.message)
    }
  } catch (e) {
    showError('保存失败：' + e.message)
  }
  finally {
    saving.value = false
  }
}

async function saveProof() {
  if (page.value?.type !== 'proof') return
  saving.value = true
  try {
    syncPageInfo()
    const res = await fetch(`/api/ref/edit-page/${dictionary.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(page.value)
    })
    const json = await res.json()

    if (json.success) {
      showSuccess('校对保存成功')
      backupPage.value = JSON.parse(JSON.stringify(page.value))
    } else {
      showError(json.message)
    }
  } catch (e) {
    showError('保存失败：' + e.message)
  }
  finally {
    saving.value = false
  }
}

// ==================== 带未保存检查的导航操作 ====================
async function safeNavigate(newSort) {
  if (hasUnsavedChanges.value) {
    const ok = await confirm({
      title: '有未保存的修改',
      message: '当前页面有未保存的内容，确定要离开吗？',
      actions: [
        {key: true, text: '离开（放弃修改）', class: 'dev-btn-small dev-remove-btn'},
        {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
      ]
    })
    if (!ok) return
  }
  await router.replace(getPath(newSort))
}

async function safeLockPage() {
  if (hasUnsavedChanges.value) {
    const ok = await confirm({
      title: '有未保存的修改',
      message: '锁定前请先保存当前修改，否则修改将会丢失。确定要继续锁定吗？',
      actions: [
        {key: true, text: '继续锁定（放弃修改）', class: 'dev-btn-small dev-add-btn'},
        {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
      ]
    })
    if (!ok) return
  }
  await lockPage()
}

async function safeInsert() {
  if (hasUnsavedChanges.value) {
    const ok = await confirm({
      title: '有未保存的修改',
      message: '新增页面前请先保存，确定要继续吗？',
      actions: [
        {key: true, text: '继续新增（放弃修改）', class: 'dev-btn-small dev-add-btn'},
        {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
      ]
    })
    if (!ok) return
  }
  openInsertConfirm()
}

async function safeDelete() {
  if (hasUnsavedChanges.value) {
    const ok = await confirm({
      title: '有未保存的修改',
      message: '删除页面前请先保存当前修改，确定要继续删除吗？',
      actions: [
        {key: true, text: '继续删除（放弃修改）', class: 'dev-btn-small dev-remove-btn'},
        {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
      ]
    })
    if (!ok) return
  }
  deleteCurrentPage()
}

// ==================== 原有操作（内部调用 safe 版本） ====================
async function lockPage() {
  const ok = await confirm({
    title: '确认锁定为校对模式',
    message: '锁定后页面将转为精细校对结构。此操作不可撤销，确定继续？',
    actions: [
      {key: true, text: '确认锁定', class: 'dev-btn-small dev-add-btn'},
      {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
    ]
  })
  if (!ok) return

  loading.value = true
  try {
    const res = await fetch(`/api/ref/lock-page/${dictionary.value}?sort=${encodeURIComponent(page.value.frontSort)}`, {method: 'POST'})
    const json = await res.json()
    if (json.success) {
      page.value = json.data
      backupPage.value = JSON.parse(JSON.stringify(json.data))
      showSuccess('已切换到校对模式')
    } else {
      throw new Error(json.message || '锁定失败')
    }
  } catch (e) {
    showError('锁定失败：' + e.message)
  }
  finally {
    loading.value = false
  }
}

async function openInsertConfirm() {
  if (!page.value) return

  const result = await confirm({
    title: '新增页面',
    message: '请选择新增位置',
    actions: [
      {key: 'before', text: '加在本页前', class: 'dev-btn-small dev-add-btn'},
      {key: 'after', text: '加在本页后', class: 'dev-btn-small dev-add-btn'},
      {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
    ]
  })

  if (result === 'before') await insertPage(true)
  if (result === 'after') await insertPage(false)
}

async function insertPage(before) {
  if (!page.value) return
  const params = new URLSearchParams({
    sort: before ? page.value.frontSort : page.value.endSort,
    before: before.toString()
  })

  try {
    const res = await fetch(`/api/ref/create-page/${dictionary.value}?${params}`, {method: 'POST'})
    const json = await res.json()
    if (json.success) {
      await router.replace(getPath(json.data.frontSort))
      showSuccess('新页面创建成功')
    } else {
      showError(json.message || '创建失败')
    }
  } catch (e) {
    showError('插入失败：' + e.message)
  }
}

async function deleteCurrentPage() {
  if (!page.value) return
  const ok = await confirm({
    title: '确认删除',
    message: '确定删除当前页面？此操作不可撤销。',
    actions: [
      {key: true, text: '确认删除', class: 'dev-btn-small dev-remove-btn'},
      {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
    ]
  })
  if (!ok) return

  loading.value = true
  try {
    const res = await fetch(`/api/ref/delete-page/${dictionary.value}?frontSort=${encodeURIComponent(page.value.frontSort)}`, {method: 'POST'})
    const json = await res.json()
    if (json.success) {
      await router.replace(getPath(json.data.frontSort))
      showSuccess('页面删除成功')
    } else {
      showError(json.message || '删除失败')
    }
  } catch (e) {
    showError('删除失败：' + e.message)
  }
  finally {
    loading.value = false
  }
}

// ==================== 监听路由变化 ====================
watch(() => route.params.sort, () => {
  if (hasUnsavedChanges.value) {
    // 这里不需要额外提示，因为导航按钮已经通过 safeNavigate 处理
  }
  loadPage()
}, {immediate: true})
</script>

<template>
  <div class="ref-editor">


    <div class="editor-header">
      <div class="nav-left">
        <button :disabled="!prevSort" class="dev-btn-small dev-nav-button" @click="safeNavigate(prevSort)">上一页
        </button>
        <button :disabled="!nextSort" class="dev-btn-small dev-nav-button" @click="safeNavigate(nextSort)">下一页
        </button>
        <button :disabled="saving || !page" class="dev-btn-small dev-add-btn"
                @click="page?.type === 'draft' ? saveDraft() : saveProof()">
          {{ saving ? '保存中……' : '保存数据' }}
        </button>
        <div v-if="hasUnsavedChanges" class="dev-btn-small dev-war-btn">
          未保存的修改
        </div>
      </div>

      <div class="nav-right">
        <div class="page-info">
          页码：
          <select v-model="pageInfoTitle" class="dev-btn-small">
            <option value="">请选择</option>
            <option v-for="t in ['正文','附錄','索引','前言','凡例']" :key="t" :value="t">{{ t }}</option>
          </select>
          第 <input v-model="pageInfoNumber" type="number" class="dev-btn-small page-num" min="1"/> 頁
        </div>

        <button
            :disabled="page?.type === 'proof' || saving"
            class="dev-btn-small dev-add-btn"
            @click="safeLockPage"
        >
          {{ page?.type === 'proof' ? '已经是校对模式' : '锁定为校对模式' }}
        </button>


        <button class="dev-btn-small dev-add-btn" @click="safeInsert">新增页面</button>
        <button class="dev-btn-small dev-remove-btn" @click="safeDelete">删除本页</button>

      </div>
    </div>

    <LoadingIcon v-if="loading"/>

    <div v-else-if="page" class="editor-body">
      <!-- Draft 模式 -->
      <div v-if="page.type === 'draft'" class="draft-mode">
        <textarea v-model="page.content" class="draft-textarea" placeholder="使用空行分段..."/>
      </div>

      <!-- Proof 模式 -->
      <div v-else-if="page.type === 'proof'" class="proof-mode">
        <DraggableList
            v-model="page.contents"
            :createItem="() => ({ id: null, source: '', text: { sc: '', tc: '' }, note: { sc: '', tc: '' } })"
        >
          <template #default="{ item }">
            <div class="proof-item">
              <div class="source-section">
                <h4>原始文本</h4>
                <textarea v-model="item.source" class="source-textarea form-control" rows="2"/>
                <RichText :dialect="dialect.toString()" :language="language.toString()"
                          :dict="dictionary.toString()" :model-value="item.source"/>
              </div>

              <div class="sc-tc-section">
                <h4>正文</h4>
                <ScAndTcText v-model:traditionalText="item.text.tc" v-model:simplifiedText="item.text.sc"
                             layout="large" :rows="5" :dialect="dialect.toString()"/>

                <RichText :dialect="dialect.toString()" :language="language.toString()"
                          :model-value="item.text.tc" :dict="dictionary.toString()"/>
                <RichText :dialect="dialect.toString()" :language="language.toString()"
                          :model-value="item.text.sc" :dict="dictionary.toString()"/>
              </div>


              <div class="note-section">
                <h4>注释</h4>
                <ScAndTcText v-model:traditionalText="item.note.tc" v-model:simplifiedText="item.note.sc"
                             layout="large" :rows="3" :dialect="dialect.toString()"/>
                <RichText :dialect="dialect.toString()" :language="language.toString()"
                          :model-value="item.note.tc" :dict="dictionary.toString()"/>
                <RichText :dialect="dialect.toString()" :language="language.toString()"
                          :model-value="item.note.sc" :dict="dictionary.toString()"/>

              </div>
            </div>
          </template>
        </DraggableList>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ref-editor {
  padding: 20px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.nav-left, .nav-right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.page-info {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.page-num {
  width: 80px;
}

.draft-textarea {
  width: 100%;
  min-height: 650px;
  font-size: 18px;
  line-height: 1.8;
  padding: 16px;
  border: 1px solid #ccc;
  border-radius: 6px;
  resize: vertical;
}

.proof-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
  margin-bottom: 12px;
}

.source-textarea {
  width: 100%;
  min-height: 60px;
  margin-bottom: 16px;
  padding: 10px;
  border: 1px solid #bbb;
  border-radius: 4px;
  font-size: 16px;
}
</style>