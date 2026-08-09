<script setup>
import { ref, onMounted } from "vue"
import axios from "axios"
import { showError, showSuccess, showWarning } from "../../../services/ToastService.js"

/* ========== OSS 连接测试 ========== */
const ossTestResult = ref("")

async function testOss() {
  ossTestResult.value = "测试中..."
  try {
    const res = await axios.get("/oss/test")
    ossTestResult.value = res.data
    showSuccess(res.data)
  } catch (err) {
    ossTestResult.value = "连接失败：" + (err?.response?.data || err.message)
    showError(err)
  }
}

/* ========== OSS 通用上传（任意路径） ========== */
const ossPath = ref("")
const ossFile = ref(null)
const lastObjectName = ref("")
const uploading = ref(false)

function onOssFileChange(e) {
  ossFile.value = e.target.files[0]
}

async function uploadOss() {
  if (!ossFile.value) {
    showWarning("请先选择文件")
    return
  }
  uploading.value = true
  try {
    const form = new FormData()
    form.append("file", ossFile.value)

    const res = await axios.post("/upload", form, {
      params: { path: ossPath.value || undefined },
      headers: { "Content-Type": "multipart/form-data" }
    })

    lastObjectName.value = res.data
    showSuccess("上传成功：" + res.data)
    ossPath.value = ""
    ossFile.value = null
    await loadOssList()
  } catch (err) {
    showError(err)
  } finally {
    uploading.value = false
  }
}

/* ========== OSS 对象浏览 / 查询 ========== */
const ossPrefix = ref("")
const ossList = ref([])
const ossLoading = ref(false)
const previewUrl = ref("")
const previewName = ref("")

async function loadOssList() {
  ossLoading.value = true
  try {
    const res = await axios.get("/upload/list", {
      params: { prefix: ossPrefix.value || undefined }
    })
    ossList.value = res.data
  } catch (err) {
    showError(err)
  } finally {
    ossLoading.value = false
  }
}

async function getOssUrl(objectName) {
  try {
    const res = await axios.get("/upload/url", { params: { objectName } })
    return res.data
  } catch (err) {
    showError(err)
    return ""
  }
}

async function preview(objectName) {
  const url = await getOssUrl(objectName)
  if (url) {
    previewName.value = objectName
    previewUrl.value = url
  }
}

async function copyOssUrl(objectName) {
  const url = await getOssUrl(objectName)
  if (url) await copyText(url)
}

async function deleteOss(objectName) {
  try {
    await axios.delete("/upload", { params: { objectName } })
    showSuccess("已删除：" + objectName)
    if (previewName.value === objectName) {
      previewName.value = ""
      previewUrl.value = ""
    }
    await loadOssList()
  } catch (err) {
    showError(err)
  }
}

/* ========== 音频上传 / 查询 ========== */
const audioFolder = ref("")
const audioFile = ref(null)
const audioList = ref([])
const audioLoading = ref(false)
const currentAudioUrl = ref("")
const currentAudioName = ref("")

function onAudioFileChange(e) {
  audioFile.value = e.target.files[0]
}

async function uploadAudio() {
  if (!audioFile.value) {
    showWarning("请先选择音频文件")
    return
  }
  try {
    const form = new FormData()
    form.append("file", audioFile.value)

    const res = await axios.post("/api/audio/upload", form, {
      params: { folder: audioFolder.value || undefined },
      headers: { "Content-Type": "multipart/form-data" }
    })

    showSuccess("音频上传成功：" + res.data.name)
    audioFile.value = null
    await loadAudioList()
  } catch (err) {
    showError(err)
  }
}

async function loadAudioList() {
  audioLoading.value = true
  try {
    const res = await axios.get("/api/audio/list", {
      params: { folder: audioFolder.value || undefined }
    })
    audioList.value = res.data
  } catch (err) {
    showError(err)
  } finally {
    audioLoading.value = false
  }
}

function playAudio(item) {
  currentAudioUrl.value = item.url
  currentAudioName.value = item.name
}

async function deleteAudio(id) {
  try {
    await axios.delete(`/api/audio/${id}`)
    showSuccess("已删除音频 #" + id)
    currentAudioUrl.value = ""
    await loadAudioList()
  } catch (err) {
    showError(err)
  }
}

/* ========== 工具 ========== */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess("已复制到剪贴板")
  } catch (e) {
    // http 等非安全环境回退到 textarea
    const ta = document.createElement("textarea")
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand("copy")
    document.body.removeChild(ta)
    showSuccess("已复制到剪贴板")
  }
}

function formatSize(bytes) {
  if (bytes == null) return "-"
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / 1024 / 1024).toFixed(2) + " MB"
}

function formatTime(dateStr) {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  return d.toLocaleString()
}

function isImage(name) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
}

function isAudio(name) {
  return /\.(mp3|wav|aac|m4a|ogg|flac)$/i.test(name)
}

onMounted(() => {
  loadOssList()
  loadAudioList()
})
</script>

<template>
  <div class="test-oss">
    <h2>OSS / 音频 上传测试</h2>

    <!-- ========== OSS 连接测试 ========== -->
    <section class="card">
      <h4>OSS 连接测试</h4>
      <div class="row">
        <button class="dev-btn-small dev-add-btn" @click="testOss">测试连接</button>
        <span v-if="ossTestResult" class="result">{{ ossTestResult }}</span>
      </div>
    </section>

    <!-- ========== OSS 通用上传 ========== -->
    <section class="card">
      <h4>OSS 通用上传（任意路径）</h4>
      <div class="row">
        <input
            v-model="ossPath"
            class="path-input"
            placeholder="OSS key，如 test/abc.png（留空自动生成）"
        />
      </div>
      <div class="row">
        <input type="file" @change="onOssFileChange"/>
      </div>
      <div class="row">
        <button class="dev-btn-small dev-add-btn" :disabled="uploading" @click="uploadOss">
          {{ uploading ? "上传中..." : "上传" }}
        </button>
      </div>
      <div v-if="lastObjectName" class="result">
        objectName：{{ lastObjectName }}
        <button class="dev-btn-small dev-normal-button" @click="copyText(lastObjectName)">复制</button>
      </div>
    </section>

    <!-- ========== OSS 对象浏览 ========== -->
    <section class="card">
      <h4>OSS 对象浏览 / 查询</h4>
      <div class="row">
        <input
            v-model="ossPrefix"
            class="path-input"
            placeholder="前缀，如 audio/wuh/（留空列出全部）"
            @keyup.enter="loadOssList"
        />
        <button class="dev-btn-small dev-add-btn" :disabled="ossLoading" @click="loadOssList">
          {{ ossLoading ? "查询中..." : "查询" }}
        </button>
      </div>

      <table class="data-table" v-if="ossList.length">
        <thead>
        <tr>
          <th>objectName</th>
          <th>大小</th>
          <th>修改时间</th>
          <th>操作</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="item in ossList" :key="item.objectName">
          <td class="name-cell">{{ item.objectName }}</td>
          <td>{{ formatSize(item.size) }}</td>
          <td>{{ formatTime(item.lastModified) }}</td>
          <td class="ops">
            <button class="dev-btn-small dev-normal-button" @click="copyOssUrl(item.objectName)">复制URL</button>
            <button class="dev-btn-small dev-normal-button" @click="preview(item.objectName)">预览</button>
            <button class="dev-btn-small dev-remove-btn" @click="deleteOss(item.objectName)">删除</button>
          </td>
        </tr>
        </tbody>
      </table>
      <p v-else-if="!ossLoading" class="empty">暂无对象</p>

      <div v-if="previewUrl" class="preview">
        <p class="preview-title">{{ previewName }}</p>
        <img v-if="isImage(previewName)" :src="previewUrl" alt="preview"/>
        <audio v-else-if="isAudio(previewName)" :src="previewUrl" controls/>
        <a v-else :href="previewUrl" target="_blank" rel="noopener">{{ previewUrl }}</a>
      </div>
    </section>

    <!-- ========== 音频上传 / 查询 ========== -->
    <section class="card">
      <h4>音频上传 / 查询</h4>
      <div class="row">
        <input
            v-model="audioFolder"
            class="path-input"
            placeholder="虚拟文件夹，如 wuh/char/114514（留空放 audio/ 根目录）"
        />
      </div>
      <div class="row">
        <input type="file" accept="audio/*" @change="onAudioFileChange"/>
      </div>
      <div class="row">
        <button class="dev-btn-small dev-add-btn" @click="uploadAudio">上传音频</button>
      </div>

      <div class="row">
        <input
            v-model="audioFolder"
            class="path-input"
            placeholder="按文件夹查询列表（与上传使用同一个文件夹输入框）"
            @keyup.enter="loadAudioList"
        />
        <button class="dev-btn-small dev-add-btn" :disabled="audioLoading" @click="loadAudioList">
          {{ audioLoading ? "查询中..." : "查询" }}
        </button>
      </div>

      <div v-for="item in audioList" :key="item.id" class="audio-item">
        <div class="audio-info">
          {{ item.name }}（{{ item.format }}，{{ formatSize(item.size) }}）
          <span v-if="item.folderPath" class="tag">{{ item.folderPath }}</span>
        </div>
        <div class="ops">
          <button class="dev-btn-small dev-add-btn" @click="playAudio(item)">播放</button>
          <button class="dev-btn-small dev-remove-btn" @click="deleteAudio(item.id)">删除</button>
        </div>
      </div>
      <p v-if="!audioLoading && !audioList.length" class="empty">暂无音频</p>

      <div v-if="currentAudioUrl" class="preview">
        <p class="preview-title">{{ currentAudioName }}</p>
        <audio :src="currentAudioUrl" controls autoplay/>
      </div>
    </section>
  </div>
</template>

<style scoped>
.test-oss {
  max-width: 860px;
  margin: 0 auto;
  padding: 20px;
}

.card {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.card h4 {
  margin: 0 0 12px;
}

.row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.path-input {
  flex: 1;
  min-width: 260px;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.result {
  color: #2d6a4f;
  font-size: 13px;
  word-break: break-all;
}

.empty {
  color: #999;
  font-size: 13px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 13px;
}

.data-table th,
.data-table td {
  border: 1px solid #e5e5e5;
  padding: 6px 8px;
  text-align: left;
}

.data-table th {
  background: #f7f7f7;
}

.name-cell {
  max-width: 320px;
  word-break: break-all;
}

.ops {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.audio-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  flex-wrap: wrap;
}

.audio-info {
  font-size: 14px;
}

.tag {
  margin-left: 8px;
  font-size: 12px;
  color: #666;
  background: #f0f0f0;
  border-radius: 4px;
  padding: 1px 6px;
}

.preview {
  margin-top: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}

.preview-title {
  margin: 0 0 8px;
  font-size: 12px;
  color: #666;
  word-break: break-all;
}

.preview img {
  max-width: 100%;
  max-height: 300px;
  border-radius: 4px;
}
</style>
