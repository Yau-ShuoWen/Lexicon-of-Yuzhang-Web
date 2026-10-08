<script setup>
import { onMounted, ref } from "vue"
import axios from "axios"
import { getToken } from "../../../utils/auth.js"
import { showError, showSuccess, showWarning } from "../../../services/ToastService.js"

const file = ref(null)
const fileInput = ref(null)
const dragging = ref(false)
let dragDepth = 0
const uploading = ref(false)
const loading = ref(false)
const images = ref([])
const selected = ref(null)

const headers = () => ({ "X-Auth-Token": getToken() || "" })

function reportError(error, action) {
  const data = error?.response?.data
  const status = error?.response?.status
  const reason = typeof data === "string" ? data
    : data?.message || (status === 400 ? "图片或请求参数不符合要求"
      : status === 403 ? "管理员权限不足"
        : status === 413 ? "图片大小超过上传限制" : error?.message)
  showError(`${action}失败：${reason || "请稍后重试"}`)
}

function onFileChange(event) {
  selectFile(event.target.files?.[0])
  event.target.value = ""
}

function selectFile(candidate) {
  if (!candidate) return
  file.value = null
  if (candidate.size > 10 * 1024 * 1024) {
    showWarning("图片不能超过 10 MB")
    return
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(candidate.type)) {
    showWarning("只支持 JPEG、PNG、WebP 图片")
    return
  }
  file.value = candidate
}

function openFilePicker() {
  if (!uploading.value) fileInput.value?.click()
}

function onDragEnter(event) {
  event.preventDefault()
  if (uploading.value) return
  dragDepth += 1
  dragging.value = true
}

function onDragLeave(event) {
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event) {
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  if (uploading.value) return
  selectFile(event.dataTransfer?.files?.[0])
  if (fileInput.value) fileInput.value.value = ""
}

async function loadImages() {
  loading.value = true
  try {
    const response = await axios.get("/api/image/list", { headers: headers() })
    if (!response.data.success) throw new Error(response.data.message)
    images.value = response.data.data || []
  } catch (error) {
    reportError(error, "查询图片")
  } finally {
    loading.value = false
  }
}

async function upload() {
  if (!file.value) {
    showWarning("请先选择图片")
    return
  }
  if (file.value.size > 10 * 1024 * 1024) {
    showWarning("图片不能超过 10 MB")
    return
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.value.type)) {
    showWarning("只支持 JPEG、PNG、WebP 图片")
    return
  }
  uploading.value = true
  try {
    const form = new FormData()
    form.append("file", file.value)
    const response = await axios.post("/api/image/upload", form, { headers: headers() })
    if (!response.data.success) throw new Error(response.data.message)
    file.value = null
    if (fileInput.value) fileInput.value.value = ""
    selected.value = response.data.data
    showSuccess("图片上传成功")
    await loadImages()
  } catch (error) {
    reportError(error, "上传图片")
  } finally {
    uploading.value = false
  }
}

async function view(image) {
  try {
    const response = await axios.get(`/api/image/${image.id}`, { headers: headers() })
    if (!response.data.success) throw new Error(response.data.message)
    selected.value = response.data.data
  } catch (error) {
    reportError(error, "查看图片")
  }
}

async function remove(image) {
  if (!window.confirm(`确定删除图片“${image.originalName}”吗？`)) return
  try {
    const response = await axios.delete(`/api/image/${image.id}`, { headers: headers() })
    if (!response.data.success) throw new Error(response.data.message)
    if (selected.value?.id === image.id) selected.value = null
    showSuccess("图片已删除")
    await loadImages()
  } catch (error) {
    reportError(error, "删除图片")
  }
}

function formatSize(size) {
  return size < 1024 * 1024 ? (size / 1024).toFixed(1) + " KB"
    : (size / 1024 / 1024).toFixed(2) + " MB"
}

onMounted(loadImages)
</script>

<template>
  <div class="image-test">
    <h1>图片存储测试</h1>
    <p class="hint">上传后会保存到 OSS 和数据库；点击查看会重新获取图片地址。</p>

    <section class="panel">
      <h2>上传图片</h2>
      <input ref="fileInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp" @change="onFileChange"/>
      <div
        class="drop-zone"
        :class="{ 'drop-zone--active': dragging, 'drop-zone--disabled': uploading }"
        role="button"
        tabindex="0"
        :aria-disabled="uploading"
        @click="openFilePicker"
        @keydown.enter.prevent="openFilePicker"
        @keydown.space.prevent="openFilePicker"
        @dragenter="onDragEnter"
        @dragover.prevent
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <span class="drop-icon" aria-hidden="true">＋</span>
        <strong>{{ dragging ? "松开即可选中图片" : file ? file.name : "点击选择图片，或将图片拖到这里" }}</strong>
        <span>{{ file ? formatSize(file.size) + " · 点击可重新选择" : "支持 JPEG、PNG、WebP，最大 10 MB" }}</span>
      </div>
      <div class="upload-actions">
        <button :disabled="uploading || !file" @click="upload">{{ uploading ? "上传中..." : "上传图片" }}</button>
      </div>
    </section>

    <section class="panel">
      <div class="row heading">
        <h2>已上传图片</h2>
        <button :disabled="loading" @click="loadImages">{{ loading ? "查询中..." : "刷新" }}</button>
      </div>
      <p v-if="!loading && !images.length" class="hint">暂无图片</p>
      <div v-for="image in images" :key="image.id" class="item">
        <div>
          <strong>{{ image.originalName }}</strong>
          <span class="hint">编号 {{ image.id }} · {{ formatSize(image.size) }}{{ image.status === 2 ? " · 删除未完成" : "" }}</span>
        </div>
        <div class="row">
          <button v-if="image.status === 1" @click="view(image)">查看</button>
          <button class="danger" @click="remove(image)">{{ image.status === 2 ? "重试删除" : "删除" }}</button>
        </div>
      </div>
    </section>

    <section v-if="selected" class="panel">
      <h2>图片预览</h2>
      <p class="hint">{{ selected.originalName }}</p>
      <img :src="selected.url" alt="图片预览"/>
    </section>
  </div>
</template>

<style scoped>
.image-test { max-width: 860px; margin: 0 auto; padding: 28px 20px 60px; }
h1 { font-size: 1.7rem; margin: 0 0 8px; }
h2 { font-size: 1.1rem; margin: 0 0 14px; }
.hint { color: #66736b; font-size: .9rem; margin: 4px 0 14px; }
.panel { padding: 20px; margin-top: 20px; border: 1px solid #dce6dd; border-radius: 12px; background: #fff; }
.file-input { display: none; }
.drop-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; min-height: 180px; padding: 20px; border: 2px dashed #a9c6b0; border-radius: 12px; background: #f8fbf8; text-align: center; cursor: pointer; transition: background .15s, border-color .15s; }
.drop-zone:hover, .drop-zone--active { border-color: #397a48; background: #eaf5ec; }
.drop-zone:focus-visible { outline: 3px solid #82b98d; outline-offset: 3px; }
.drop-zone--disabled { opacity: .6; cursor: default; }
.drop-zone strong { color: #284c32; overflow-wrap: anywhere; }
.drop-zone span:last-child { color: #66736b; font-size: .88rem; }
.drop-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #dceee0; color: #397a48; font-size: 2rem; line-height: 1; }
.upload-actions { margin-top: 14px; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.heading { justify-content: space-between; }
.heading h2 { margin: 0; }
button { border: 1px solid #397a48; border-radius: 7px; background: #397a48; color: white; padding: 7px 15px; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
button.danger { background: #fff; color: #b23c3c; border-color: #d9abab; }
.item { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 13px 0; border-bottom: 1px solid #edf1ed; }
.item strong { display: block; overflow-wrap: anywhere; }
.item .hint { display: block; margin: 4px 0 0; }
img { display: block; max-width: 100%; max-height: 500px; border-radius: 8px; }
@media (max-width: 600px) { .item { align-items: flex-start; flex-direction: column; } }
</style>
