<!-- PinyinNoteEditor.vue -->

<script setup>
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useRoute} from 'vue-router'
import {showError, showSuccess} from "../../../services/ToastService.js";
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import LoadingIcon from "../../../components/Status/LoadingIcon.vue";
import {useHead} from "@vueuse/head";
import CopyButton from "../../../components/Button/CopyButton.vue";

useHead({
  title: () => `拼音註釋編輯`
})

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const keyList = ref([])
const selectedKey = ref(null)

const note = ref({
  sc: '',
  tc: ''
})

const loadingKeys = ref(false)
const loadingNote = ref(false)
const saving = ref(false)

/* ========== 音频管理 ========== */
const audioList = ref([])
const audioFile = ref(null)
const loadingAudio = ref(false)
const uploadingAudio = ref(false)
const currentAudioUrl = ref('')

/* ========== 录音模块 ========== */
const isRecording = ref(false)
const recordingTime = ref(0)
const recordedBlob = ref(null)      // 录音生成的原始 blob（webm/mp4）
const recordedUrl = ref('')         // 录音试听地址
const converting = ref(false)       // 转码中
let mediaRecorder = null
let mediaStream = null
let recordChunks = []
let recordTimer = null


// 加载当前 key 的音频列表
const loadAudioList = async () => {
  if (!selectedKey.value) {
    audioList.value = []
    return
  }

  loadingAudio.value = true

  try {
    const res = await fetch(
        `/api/pinyin/audio/list?dialect=${dialect.value}&code=${encodeURIComponent(selectedKey.value)}`
    )

    if (!res.ok) throw new Error('加載音頻列表失敗')

    audioList.value = await res.json()
  }
  catch (err) {
    showError(err.message)
  }
  finally {
    loadingAudio.value = false
  }
}


// 选择音频文件
const onAudioFileChange = (e) => {
  audioFile.value = e.target.files[0]
}


// 上传音频（固定重命名为 pronunciation，与原始文件名无关）
const uploadAudio = async () => {
  if (!audioFile.value) {
    showError('請先選擇音頻文件')
    return
  }

  await uploadFile(audioFile.value)
  audioFile.value = null
}


// 通用上传：把 File/Blob 上传到当前拼音
const uploadFile = async (file) => {
  if (!selectedKey.value) {
    showError('請先選擇拼音')
    return false
  }

  uploadingAudio.value = true

  try {
    const form = new FormData()
    form.append('file', file)

    const res = await fetch(
        `/api/pinyin/audio/upload?dialect=${dialect.value}&code=${encodeURIComponent(selectedKey.value)}`,
        {
          method: 'POST',
          body: form
        }
    )

    if (!res.ok) throw new Error('上傳失敗')

    showSuccess('上傳成功')
    await loadAudioList()
    return true
  }
  catch (err) {
    showError(err.message)
    return false
  }
  finally {
    uploadingAudio.value = false
  }
}


/* ========== 录音逻辑 ========== */

// 开始录音
const startRecording = async () => {
  if (!selectedKey.value) {
    showError('請先選擇拼音')
    return
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({audio: true})

    // 优先用浏览器支持的音频格式；录制完成后会统一转成 wav
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '')

    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? {mimeType} : undefined)
    recordChunks = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordChunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      // 释放麦克风
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null

      const blob = new Blob(recordChunks, {type: mediaRecorder.mimeType || 'audio/webm'})
      recordedBlob.value = blob
      recordedUrl.value = URL.createObjectURL(blob)
    }

    mediaRecorder.start()
    isRecording.value = true
    recordingTime.value = 0
    recordTimer = setInterval(() => {
      recordingTime.value += 1
    }, 1000)
  }
  catch (err) {
    showError('無法訪問麥克風：' + err.message)
  }
}


// 结束录音
const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  isRecording.value = false
  clearInterval(recordTimer)
}


// 放弃录音
const discardRecording = () => {
  recordedBlob.value = null
  if (recordedUrl.value) {
    URL.revokeObjectURL(recordedUrl.value)
    recordedUrl.value = ''
  }
}


// 上传录音（转成 wav 后上传）
const uploadRecording = async () => {
  if (!recordedBlob.value) return

  converting.value = true
  try {
    const wavBlob = await convertToWav(recordedBlob.value)
    const file = new File([wavBlob], 'pronunciation.wav', {type: 'audio/wav'})
    const ok = await uploadFile(file)
    if (ok) discardRecording()
  }
  catch (err) {
    showError('音頻轉換失敗：' + err.message)
  }
  finally {
    converting.value = false
  }
}


// 把任意 blob 音频解码并编码为 wav（浏览器通用格式，后端白名单支持）
const convertToWav = (blob) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

    const handle = async () => {
      try {
        const arrayBuffer = await (await fetch(url)).arrayBuffer()
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
        const wavBlob = encodeWav(audioBuffer)
        resolve(wavBlob)
      }
      catch (e) {
        reject(e)
      }
      finally {
        URL.revokeObjectURL(url)
        audioCtx.close()
      }
    }

    handle()
  })
}


// 把 AudioBuffer 编码成 16bit PCM 单声道 wav
const encodeWav = (audioBuffer) => {
  const numChannels = 1
  const sampleRate = audioBuffer.sampleRate
  const samples = audioBuffer.getChannelData(0)   // 取第一个声道
  const bufferSize = 44 + samples.length * 2
  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, bufferSize - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)                    // fmt chunk size
  view.setUint16(20, 1, true)                     // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)  // byte rate
  view.setUint16(32, numChannels * 2, true)       // block align
  view.setUint16(34, 16, true)                    // bits per sample
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], {type: 'audio/wav'})
}


// 格式化录音时长 mm:ss
const formatRecordTime = (sec) => {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}


// 删除音频
const deleteAudio = async (id) => {
  try {
    const res = await fetch(`/api/pinyin/audio/${id}`, {method: 'DELETE'})

    if (!res.ok) throw new Error('刪除失敗')

    showSuccess('刪除成功')
    if (currentAudioUrl.value) currentAudioUrl.value = ''
    await loadAudioList()
  }
  catch (err) {
    showError(err.message)
  }
}


// 播放音频
const playAudio = (item) => {
  currentAudioUrl.value = item.url
}


// 加载全部 key
const loadKeys = async () => {
  loadingKeys.value = true

  try {
    const res = await fetch(
        `/api/edit/pinyin/filter/${dialect.value}`
    )

    if (!res.ok) throw new Error('加載失敗')

    keyList.value = await res.json()

    if (keyList.value.length > 0) {
      await selectKey(keyList.value[0])
    }
  }
  catch (err) {
    showError(err.message)
  }
  finally {
    loadingKeys.value = false
  }
}


// 选择 key
const selectKey = async (key) => {
  selectedKey.value = key

  loadingNote.value = true

  try {
    const res = await fetch(
        `/api/edit/pinyin/get-note/${dialect.value}?key=${encodeURIComponent(key)}`
    )

    if (!res.ok) throw new Error('讀取失敗')

    note.value = await res.json()
  }
  catch (err) {
    showError(err.message)
  }
  finally {
    loadingNote.value = false
  }

  await loadAudioList()
}


// 保存
const saveNote = async () => {
  if (!selectedKey.value) return

  saving.value = true

  try {
    const res = await fetch(
        `/api/edit/pinyin/update-note/${dialect.value}?key=${encodeURIComponent(selectedKey.value)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(note.value)
        }
    )

    if (!res.ok) throw new Error('保存失敗')

    showSuccess('保存成功')
  }
  catch (err) {
    showError(err.message)
  }
  finally {
    saving.value = false
  }
}

onMounted(loadKeys)

// 组件销毁时释放录音资源（麦克风、定时器、临时地址）
onUnmounted(() => {
  clearInterval(recordTimer)
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }
  if (recordedUrl.value) {
    URL.revokeObjectURL(recordedUrl.value)
  }
})
</script>

<template>
  <div class="broaden-layout pinyin-editor">

    <!-- 左侧 key 列表 -->
    <div class="key-panel">

      <h3>拼音列表</h3>

      <LoadingIcon
          v-if="loadingKeys"
          :show-text="true"
      />

      <div
          v-for="key in keyList"
          :key="key"
          class="key-item"
          :class="{ active: selectedKey === key }"
          @click="selectKey(key)"
          v-formatted-text="`[`+key+`]`"
      >
      </div>

    </div>

    <!-- 右侧编辑区 -->
    <div class="editor-panel">

      <div class="section-header">

        <h3 v-formatted-text="`[`+(selectedKey || '未選擇拼音')+`]`">

        </h3>

        <CopyButton text="__既可以读作[]（__音），也可以读作[]（__音），原因是___。" hint="多個讀音的說明模板"
                    class="dev-normal-button dev-btn-small"/>

        <button
            class="dev-add-btn dev-btn-small"
            :disabled="saving || !selectedKey"
            @click="saveNote"
        >
          {{ saving ? '保存中...' : '保存修改' }}
        </button>

      </div>

      <LoadingIcon
          v-if="loadingNote"
          :show-text="true"
      />

      <div
          v-else-if="selectedKey"
          class="form-section"
      >

        <ScAndTcText
            v-model:simplifiedText="note.sc"
            v-model:traditionalText="note.tc"
            :layout="'large'"
            :dialect="dialect.toString()"
            :rows=10
        />

        <!-- ===== 录音模块 ===== -->
        <div class="audio-section record-section">

          <h4>錄音</h4>

          <!-- 录音中 -->
          <div v-if="isRecording" class="record-row recording">
            <span class="record-dot"></span>
            <span class="record-time">{{ formatRecordTime(recordingTime) }}</span>
            <button class="dev-btn-small dev-remove-btn" @click="stopRecording">
              停止錄音
            </button>
          </div>

          <!-- 未在录音 -->
          <div v-else class="record-row">
            <button
                class="dev-btn-small dev-add-btn"
                :disabled="converting"
                @click="startRecording"
            >
              開始錄音
            </button>
          </div>

          <!-- 录音完成：试听 / 重录 / 上传 -->
          <div v-if="recordedUrl && !isRecording" class="record-result">

            <audio :src="recordedUrl" controls class="audio-player"/>

            <div class="record-actions">
              <button
                  class="dev-btn-small dev-add-btn"
                  :disabled="converting || uploadingAudio"
                  @click="uploadRecording"
              >
                {{ converting ? '轉換中...' : '上傳錄音' }}
              </button>

              <button
                  class="dev-btn-small dev-normal-button"
                  :disabled="converting"
                  @click="discardRecording"
              >
                重新錄製
              </button>
            </div>

          </div>

        </div>

        <!-- ===== 音频管理 ===== -->
        <div class="audio-section">

          <h4>音頻管理</h4>

          <!-- 上传 -->
          <div class="audio-upload">
            <input type="file" accept="audio/*" @change="onAudioFileChange"/>
            <button
                class="dev-add-btn dev-btn-small"
                :disabled="uploadingAudio"
                @click="uploadAudio"
            >
              {{ uploadingAudio ? '上傳中...' : '上傳音頻' }}
            </button>
          </div>

          <p class="audio-tip">
            不管原始文件名是什么，落盤後統一重命名為 pronunciation（後綴保留原格式）。
          </p>

          <!-- 列表 -->
          <div v-if="loadingAudio" class="audio-empty">加載中...</div>

          <div v-else-if="audioList.length === 0" class="audio-empty">
            暫無音頻
          </div>

          <div
              v-for="item in audioList"
              :key="item.id"
              class="audio-item"
          >
            <span class="audio-name">{{ item.name }}（{{ item.format }}）</span>

            <button class="dev-btn-small dev-add-btn" @click="playAudio(item)">
              播放
            </button>

            <button class="dev-btn-small dev-remove-btn" @click="deleteAudio(item.id)">
              刪除
            </button>
          </div>

          <!-- 播放器 -->
          <audio
              v-if="currentAudioUrl"
              :src="currentAudioUrl"
              controls
              class="audio-player"
          />

        </div>

      </div>

    </div>

  </div>
</template>

<style scoped>

.pinyin-editor {
  display: flex;
  gap: 20px;
}

.key-panel {
  width: 200px;
  flex-shrink: 0;

  border: 1px solid var(--color-text-lighter);
  border-radius: 6px;

  padding: 10px;

  max-height: 80vh;
  overflow-y: auto;
}

.key-item {
  padding: 8px 12px;
  margin-bottom: 4px;

  border-radius: 4px;

  cursor: pointer;

  transition: 0.2s;
}

.key-item:hover {
  background: #d3dfd5;
}

.key-item.active {
  background: #bcd2bf;
  font-weight: bold;
}

.editor-panel {
  flex: 1;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: 20px;
}

/* ===== 录音模块 ===== */
.record-section {
  background: #fafbfa;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e53935;
  animation: record-blink 1s infinite;
}

@keyframes record-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.record-time {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.record-result {
  margin-top: 10px;
}

.record-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

/* ===== 音频管理 ===== */
.audio-section {
  margin-top: 24px;
  padding: 14px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.audio-section h4 {
  margin: 0 0 10px;
}

.audio-upload {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.audio-tip {
  margin: 8px 0;
  font-size: 12px;
  color: #888;
}

.audio-empty {
  color: #999;
  font-size: 13px;
  padding: 8px 0;
}

.audio-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid #f0f0f0;
}

.audio-name {
  flex: 1;
  font-size: 14px;
}

.audio-player {
  margin-top: 10px;
  width: 100%;
}
</style>