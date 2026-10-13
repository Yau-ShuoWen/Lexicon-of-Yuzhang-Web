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
import KeywordEnhancer from "./KeywordEnhancer.vue";
import { request } from '../../../services/request.js'

const route = useRoute()
const router = useRouter()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const dictionary = computed(() => route.params.dictionary)
const sortParam = computed(() => route.params.sort)

const getPath = (newSort) => `/${language.value}/${dialect.value}/dev/ref-editor/${dictionary.value}/${newSort}`

const page = ref(null)
const backupPage = ref(null)     // 用于检测是否有未保存修改
const loading = ref(false)
const saving = ref(false)
const prevSort = ref(null)
const nextSort = ref(null)

const pageInfoTitle = ref('')
const pageInfoNumber = ref('')

const pageImage = ref(null)
const imageLoading = ref(false)
const imageUploading = ref(false)
const imageInput = ref(null)
const pendingImage = ref(null)
const imageDropActive = ref(false)
let imageDragDepth = 0
const viewerOpen = ref(false)
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })
const draggingImage = ref(false)
let dragOrigin = null

const imageEndpoint = computed(() => `/api/ref/page-image/${encodeURIComponent(dictionary.value)}`)
const imageError = (error) => error?.message || "操作失败"

function resetViewer() {
  zoom.value = 1
  offset.value = { x: 0, y: 0 }
}

function setZoom(value) {
  zoom.value = Math.min(5, Math.max(0.25, value))
  if (zoom.value <= 1) offset.value = { x: 0, y: 0 }
}

function onViewerWheel(event) {
  setZoom(zoom.value + (event.deltaY < 0 ? 0.2 : -0.2))
}

function startImageDrag(event) {
  if (zoom.value <= 1) return
  draggingImage.value = true
  dragOrigin = { x: event.clientX - offset.value.x, y: event.clientY - offset.value.y }
  event.currentTarget.setPointerCapture(event.pointerId)
}

function moveImage(event) {
  if (!draggingImage.value || !dragOrigin) return
  offset.value = { x: event.clientX - dragOrigin.x, y: event.clientY - dragOrigin.y }
}

function stopImageDrag() {
  draggingImage.value = false
  dragOrigin = null
}

async function loadPageImage() {
  if (!page.value?.frontSort) return
  imageLoading.value = true
  try {
    const params = new URLSearchParams({sort: page.value.frontSort})
    pageImage.value = await request(`${imageEndpoint.value}?${params}`)
  } catch (error) {
    pageImage.value = null
    showError("原件加载失败：" + imageError(error))
  } finally {
    imageLoading.value = false
  }
}

function selectPageImage(file) {
  if (!file) return
  pendingImage.value = null
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    showError("只支持 10 MB 以内的 JPEG、PNG、WebP 图片")
    return
  }
  pendingImage.value = file
}

function onImageInputChange(event) {
  selectPageImage(event.target.files?.[0])
  event.target.value = ""
}

function openImagePicker() {
  if (!imageUploading.value) imageInput.value?.click()
}

function onImageDragEnter(event) {
  event.preventDefault()
  if (imageUploading.value) return
  imageDragDepth += 1
  imageDropActive.value = true
}

function onImageDragLeave(event) {
  event.preventDefault()
  imageDragDepth = Math.max(0, imageDragDepth - 1)
  if (!imageDragDepth) imageDropActive.value = false
}

function onImageDrop(event) {
  event.preventDefault()
  imageDragDepth = 0
  imageDropActive.value = false
  if (!imageUploading.value) selectPageImage(event.dataTransfer?.files?.[0])
}

async function uploadPageImage() {
  const file = pendingImage.value
  if (!file || !page.value) return
  if (pageImage.value) {
    const ok = await confirm({
      title: "替换页面原件",
      message: "新图片上传成功后会替换当前原件，确定继续吗？",
      actions: [
        { key: true, text: "确认替换", class: "dev-btn-small dev-add-btn" },
        { key: false, text: "取消", class: "dev-btn-small dev-normal-button" }
      ]
    })
    if (!ok) return
  }
  imageUploading.value = true
  try {
    const form = new FormData()
    form.append("file", file)
    const params = new URLSearchParams({sort: page.value.frontSort})
    pageImage.value = await request(`${imageEndpoint.value}?${params}`, {
      method: 'POST',
      body: form
    })
    pendingImage.value = null
    viewerOpen.value = true
    resetViewer()
    showSuccess("原件已保存")
  } catch (error) {
    showError("原件上传失败：" + imageError(error))
  } finally {
    imageUploading.value = false
  }
}

// ==================== 是否有未保存修改 ====================
const hasUnsavedChanges = computed(() => {
  if (!page.value || !backupPage.value) return false

  // 简单深比较（JSON 字符串化对比）
  return JSON.stringify(page.value) !== JSON.stringify(backupPage.value)
})

// ==================== 加载页面 ====================
async function loadPage() {
  loading.value = true
  pendingImage.value = null
  imageDropActive.value = false
  imageDragDepth = 0
  viewerOpen.value = false
  pageImage.value = null
  resetViewer()
  try {
    const data = await request(`/api/ref/get-page/${dictionary.value}?sort=${encodeURIComponent(sortParam.value)}`)
    page.value = data
    backupPage.value = JSON.parse(JSON.stringify(data))   // 深拷贝作为备份

    await loadNearby()
    await loadPageImage()
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
    const nearby = await request(`/api/ref/get-nearby/${dictionary.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    })
    prevSort.value = nearby.left
    nextSort.value = nearby.right
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
    await request(`/api/ref/update-page/${dictionary.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(page.value)
    })
    showSuccess('草稿保存成功')
    backupPage.value = JSON.parse(JSON.stringify(page.value))  // 保存成功后更新备份
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
    await request(`/api/ref/edit-page/${dictionary.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(page.value)
    })
    showSuccess('校对保存成功')
    backupPage.value = JSON.parse(JSON.stringify(page.value))
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
    const data = await request(`/api/ref/lock-page/${dictionary.value}?sort=${encodeURIComponent(page.value.frontSort)}`, {
      method: 'POST'
    })
    page.value = data
    backupPage.value = JSON.parse(JSON.stringify(data))
    showSuccess('已切换到校对模式')
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
    const data = await request(`/api/ref/create-page/${dictionary.value}?${params}`, {
      method: 'POST'
    })
    await router.replace(getPath(data.frontSort))
    showSuccess('新页面创建成功')
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
    const data = await request(`/api/ref/delete-page/${dictionary.value}?frontSort=${encodeURIComponent(page.value.frontSort)}`, {
      method: 'POST'
    })
    await router.replace(getPath(data.frontSort))
    showSuccess('页面删除成功')
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

// ==================== Proof 模式弹窗相关 ====================
const currentEditingItem = ref(null)

// 判断条目文本中是否包含关键词标记 {词}，决定是否显示关键词区
function hasKeywords(item) {
  const text = (item.source || '') + '\n' + (item.note?.tc || '')
  return /\{[^\s{}]+\}/.test(text)
}

// ==================== 高级编辑模式开关 ====================
// 默认关闭 = 简单展示模式（隐藏列表的「添加 / 拖动 / 删除」）；
// 打开后恢复完整编辑功能
const advancedMode = ref(false)

function openProofEditor(item) {
  // 确保只有一个弹窗打开
  if (currentEditingItem.value) {
    currentEditingItem.value = null
  }
  currentEditingItem.value = item   // 直接引用同一个 item 对象
}

function closeProofEditor() {
  currentEditingItem.value = null
}

// 可选：支持 ESC 键关闭
watch(currentEditingItem, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleEscClose)
  } else {
    document.removeEventListener('keydown', handleEscClose)
  }
})

function handleEscClose(e) {
  if (e.key === 'Escape' && currentEditingItem.value) {
    closeProofEditor()
  }
}
</script>

<template>
  <div class="ref-editor">

    <!-- 高级编辑模式开关（仅 proof 模式有列表，故仅此时显示） -->
    <div v-if="page?.type === 'proof'" class="editor-mode-bar">
      <label class="mode-toggle">
        <input type="checkbox" v-model="advancedMode" class="mode-switch-input"/>
        <span class="mode-switch-track"></span>
        <span class="mode-switch-text">
          高级编辑模式
          <small>显示新增 / 拖动 / 删除</small>
        </span>
      </label>
    </div>

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
      <aside class="source-sidebar">
        <h3>页面原件</h3>
        <button
          class="source-tab"
          :class="{ active: !viewerOpen }"
          @click="viewerOpen = false"
        >文字编辑</button>
        <button
          class="source-tab"
          :class="{ active: viewerOpen }"
          :disabled="!pageImage"
          @click="viewerOpen = true; resetViewer()"
        >{{ pageImage ? "查看原件" : "暂无原件" }}</button>
        <div v-if="pageImage" class="source-thumb" @click="viewerOpen = true; resetViewer()">
          <img :src="pageImage.url" alt="本页原件缩略图"/>
        </div>
        <p v-if="imageLoading" class="source-note">正在读取原件…</p>
        <p v-else-if="!pageImage" class="source-note">本页尚未上传原件。</p>
        <input ref="imageInput" class="source-file-input" type="file" accept="image/jpeg,image/png,image/webp" @change="onImageInputChange"/>
        <div
          class="source-drop-zone"
          :class="{ 'source-drop-zone--active': imageDropActive, 'source-drop-zone--disabled': imageUploading }"
          role="button"
          tabindex="0"
          :aria-disabled="imageUploading"
          @click="openImagePicker"
          @keydown.enter.prevent="openImagePicker"
          @keydown.space.prevent="openImagePicker"
          @dragenter="onImageDragEnter"
          @dragover.prevent
          @dragleave="onImageDragLeave"
          @drop="onImageDrop"
        >
          <span class="source-drop-icon" aria-hidden="true">＋</span>
          <strong>{{ imageDropActive ? "松开即可选中图片" : pendingImage ? pendingImage.name : "点击选择，或拖入图片" }}</strong>
          <span>{{ pendingImage ? "点击可重新选择" : "JPEG、PNG、WebP · 最大 10 MB" }}</span>
        </div>
        <button class="dev-btn-small dev-add-btn source-upload" :disabled="imageUploading || !pendingImage" @click="uploadPageImage">
          {{ imageUploading ? "上传中…" : pageImage ? "替换原件" : "上传原件" }}
        </button>
      </aside>

      <main class="editor-main">
      <div v-if="viewerOpen && pageImage" class="source-viewer">
        <div class="viewer-toolbar">
          <strong>页面原件</strong>
          <div class="viewer-actions">
            <button class="dev-btn-small dev-normal-button" @click="setZoom(zoom - 0.25)">缩小</button>
            <span>{{ Math.round(zoom * 100) }}%</span>
            <button class="dev-btn-small dev-normal-button" @click="setZoom(zoom + 0.25)">放大</button>
            <button class="dev-btn-small dev-normal-button" @click="resetViewer">复位</button>
          </div>
        </div>
        <div
          class="viewer-canvas"
          :class="{ 'viewer-canvas--dragging': draggingImage, 'viewer-canvas--zoomed': zoom > 1 }"
          @wheel.prevent="onViewerWheel"
          @pointerdown="startImageDrag"
          @pointermove="moveImage"
          @pointerup="stopImageDrag"
          @pointercancel="stopImageDrag"
          @dblclick="resetViewer"
        >
          <img
            :src="pageImage.url"
            alt="页面原件"
            draggable="false"
            :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }"
          />
        </div>
      </div>
      <template v-else>
      <!-- Draft 模式 -->
      <div v-if="page.type === 'draft'" class="draft-mode">
        <textarea v-model="page.content" class="draft-textarea" placeholder="使用空行分段..."/>
      </div>

      <!-- Proof 模式 -->
      <div v-else-if="page.type === 'proof'" class="proof-mode">
        <DraggableList
            v-model="page.contents"
            unboxed
            :show-add="advancedMode"
            :draggable="advancedMode"
            :show-delete="advancedMode"
            :createItem="() => ({ id: null, source: '', text: { sc: '', tc: '' }, note: { sc: '', tc: '' } })"
        >

          <template #default="{ item }">

            <!-- 统一条目卡片：关键词区 + 可点击预览区 -->
            <div class="proof-card" @click="openProofEditor(item)">

              <!-- 关键词区（顶部浅色条） -->
              <div v-if="hasKeywords(item)" class="card-keywords" @click.stop>
                <KeywordEnhancer
                    :source="item.source"
                    :note="item.note.tc"
                    :dialect="dialect.toString()"
                    :language="language.toString()"
                    :dict="dictionary.toString()"
                />
              </div>

              <!-- 点击预览区 -->
              <div class="card-preview">
                <div class="preview-block">
                  <h4>原始文本</h4>
                  <RichText
                      :dialect="dialect.toString()"
                      :language="language.toString()"
                      :dict="dictionary.toString()"
                      :model-value="item.source"
                  />
                </div>

                <div class="preview-block" v-if="item.note.tc">
                  <h4>注释（繁体）</h4>
                  <RichText
                      :dialect="dialect.toString()"
                      :language="language.toString()"
                      :dict="dictionary.toString()"
                      :model-value="item.note.tc"
                  />
                </div>
              </div>

            </div>

            <!-- ==================== 专属弹窗（v-show 关键！） ==================== -->
            <div
                v-show="currentEditingItem === item"
                class="proof-editor-modal"
            >
              <!-- 遮罩层 -->
              <div
                  class="modal-overlay"
                  @click="closeProofEditor"
              ></div>

              <!-- 弹窗内容 -->
              <div class="modal-content">
                <div class="modal-header">
                  <h3>编辑条目</h3>
                  <button class="close-btn" @click="closeProofEditor">×</button>
                </div>

                <!-- 这里完整搬过来你原来的 proof-item 内容 -->
                <div class="proof-item">
                  <div class="source-section">

                    <h4>原始文本</h4>
                    <textarea
                        v-model="item.source"
                        class="source-textarea form-control"
                        rows="4"
                    />
                    <RichText
                        :dialect="dialect.toString()"
                        :language="language.toString()"
                        :dict="dictionary.toString()"
                        :model-value="item.source"
                    />
                  </div>

                  <!-- text 部分（你原来注释说留给未来扩展，先保留） -->
                  <div class="text-section" v-if="item.text">
                    <!-- 如果以后要加 text.sc / text.tc 可以在这里扩展 -->
                  </div>

                  <div class="note-section">
                    <h4>注释</h4>
                    <ScAndTcText
                        v-model:traditionalText="item.note.tc"
                        v-model:simplifiedText="item.note.sc"
                        layout="large"
                        :rows="5"
                        :dialect="dialect.toString()"
                    />

                    <RichText
                        :dialect="dialect.toString()"
                        :language="language.toString()"
                        :dict="dictionary.toString()"
                        :model-value="item.note.tc"
                    />

                    <RichText
                        :dialect="dialect.toString()"
                        :language="language.toString()"
                        :dict="dictionary.toString()"
                        :model-value="item.note.sc"
                    />
                  </div>
                </div>

                <div class="modal-footer">
                  <button class="dev-btn-small dev-normal-button" @click="closeProofEditor">
                    关闭
                  </button>
                  <!-- 如果需要可以在这里加“保存”按钮，但因为实时绑定，通常不需要 -->
                </div>
              </div>
            </div>
          </template>
        </DraggableList>
      </div>
      </template>
      </main>

    </div>
  </div>
</template>

<style scoped>
.ref-editor {
  padding: 20px;
}

.editor-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 18px; align-items: start; }
.source-sidebar { position: sticky; top: 20px; padding: 16px; border: 1px solid #dce4dc; border-radius: 10px; background: #fff; }
.source-sidebar h3 { margin: 0 0 14px; font-size: 16px; }
.source-tab { display: block; width: 100%; margin-bottom: 7px; padding: 8px 10px; border: 1px solid #d4ded5; border-radius: 6px; background: #fff; text-align: left; cursor: pointer; }
.source-tab.active { border-color: #438754; background: #edf6ee; color: #276439; font-weight: 600; }
.source-tab:disabled { color: #999; cursor: default; }
.source-thumb { margin: 12px 0; border: 1px solid #e2e8e2; border-radius: 6px; cursor: pointer; overflow: hidden; }
.source-thumb img { display: block; width: 100%; max-height: 160px; object-fit: contain; }
.source-note { color: #768177; font-size: 12px; line-height: 1.5; }
.source-file-input { display: none; }
.source-upload { width: 100%; margin-top: 8px; }
.source-drop-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 150px; padding: 14px 8px; border: 2px dashed #a9c6b0; border-radius: 12px; background: #f8fbf8; text-align: center; cursor: pointer; transition: background .15s, border-color .15s; }
.source-drop-zone:hover, .source-drop-zone--active { border-color: #397a48; background: #eaf5ec; }
.source-drop-zone:focus-visible { outline: 3px solid #82b98d; outline-offset: 3px; }
.source-drop-zone--disabled { opacity: .6; cursor: default; }
.source-drop-zone strong { max-width: 100%; color: #284c32; font-size: 13px; overflow-wrap: anywhere; }
.source-drop-zone span:last-child { color: #66736b; font-size: 12px; }
.source-drop-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #dceee0; color: #397a48; font-size: 2rem; line-height: 1; }
.editor-main { min-width: 0; }
.source-viewer { width: 100%; min-height: 650px; border: 1px solid #dce4dc; border-radius: 10px; overflow: hidden; background: #f7f8f7; }
.viewer-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #dce4dc; background: #fff; }
.viewer-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.viewer-actions span { min-width: 48px; text-align: center; }
.viewer-canvas { display: flex; align-items: center; justify-content: center; height: min(75vh, 900px); min-height: 560px; overflow: hidden; cursor: default; touch-action: none; }
.viewer-canvas--zoomed { cursor: grab; }
.viewer-canvas--dragging { cursor: grabbing; }
.viewer-canvas img { max-width: 100%; max-height: 100%; object-fit: contain; transform-origin: center; user-select: none; pointer-events: none; }
@media (max-width: 800px) {
  .editor-body { grid-template-columns: 1fr; }
  .source-sidebar { position: static; }
  .viewer-canvas { min-height: 430px; }
}

/* 顶部高级编辑模式开关 */
.editor-mode-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

/* 隐藏原生 checkbox，用自定义开关代替 */
.mode-switch-input {
  display: none;
}

.mode-switch-track {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: #ccc;
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s;
}

.mode-switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s;
}

.mode-switch-input:checked + .mode-switch-track {
  background: #4caf50;
}

.mode-switch-input:checked + .mode-switch-track::after {
  transform: translateX(18px);
}

.mode-switch-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  font-size: 14px;
  color: #555;
}

.mode-switch-text small {
  font-size: 12px;
  color: #999;
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

/* ==================== 条目卡片（统一布局，不再套多层框） ==================== */
.proof-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.proof-card:hover {
  border-color: #b5c8f0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

/* 关键词区：顶部浅色条，关键词显示为小标签 */
.card-keywords {
  background: #f7f9fc;
  border-bottom: 1px solid #eee;
  padding: 8px 14px;
}

.card-keywords :deep(.keyword-link) {
  display: inline-block;
  margin: 2px 8px 2px 0;
  padding: 2px 10px;
  border-radius: 4px;
  background: #e8f0fe;
  color: #2a6df4;
  font-size: 20px;
  text-decoration: none;
}

.card-keywords :deep(.keyword-link:hover) {
  text-decoration: underline;
}

.card-keywords :deep(.keyword-missing) {
  display: inline-block;
  margin: 2px 8px 2px 0;
  padding: 2px 10px;
  border-radius: 4px;
  background: #f0f0f0;
  color: #888;
  font-size: 13px;
}

/* 点击预览区 */
.card-preview {
  padding: 12px 14px 14px;
}

.preview-block {
  margin-bottom: 10px;
}

.preview-block:last-child {
  margin-bottom: 0;
}

.preview-block h4 {
  margin: 0 0 6px 0;
  font-size: 12px;
  font-weight: 600;
  color: #999;
}

/* ==================== 弹窗样式 ==================== */
.proof-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1;
}

.modal-content {
  position: relative;
  z-index: 2;
  background: white;
  width: 90%;
  max-width: 960px;
  max-height: 92vh;
  overflow-y: auto;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  padding: 20px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: #999;
}

.close-btn:hover {
  color: #333;
}

.modal-footer {
  margin-top: 20px;
  text-align: right;
}
</style>
