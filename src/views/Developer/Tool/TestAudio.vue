<script setup>
import { useRoute } from "vue-router"
import { ref, computed } from "vue"
import axios from "axios"
import { showError } from "../../../services/ToastService.js";

const route = useRoute()
const dialect = computed(() => route.params.dialect)

const pinyinKey = ref("")
const file = ref(null)

const audioUrl = ref("")
const exists = ref(false)
const loading = ref(false)

function onFileChange(e) {
  file.value = e.target.files[0]
}

/** 查询是否存在 */
async function checkExists() {
  try {
    if (!pinyinKey.value) return

    const res = await axios.get("/api/audio/pinyin/exists", {
      params: {
        dialect: dialect.value,
        pinyinKey: pinyinKey.value
      }
    })

    exists.value = res.data
  } catch (err) {
    showError(err)
  }
}

/** 上传 */
async function upload() {
  try {
    const form = new FormData()
    form.append("file", file.value)
    form.append("dialect", dialect.value)
    form.append("pinyinKey", pinyinKey.value)

    const res = await axios.post("/api/audio/pinyin/upload", form, {
      headers: { "Content-Type": "multipart/form-data" }
    })

    audioUrl.value = res.data
    await checkExists()
  } catch (error) {
    console.error(error)
    showError(error)
  }
}

/** 播放（走后端流） */
function play() {
  audioUrl.value =
      `/api/audio/pinyin/play?dialect=${dialect.value}&key=${pinyinKey.value}`
}

/** 删除 */
async function remove() {
  try {
    await axios.delete("/api/audio/pinyin/delete", {
      params: {
        dialect: dialect.value,
        key: pinyinKey.value
      }
    })

    audioUrl.value = ""
    exists.value = false
  } catch (err) {
    showError(err)
  }
}

/** 替换 */
async function replace() {
  try {
    const form = new FormData()
    form.append("file", file.value)
    form.append("dialect", dialect.value)
    form.append("pinyinKey", pinyinKey.value)

    const res = await axios.post("/api/audio/pinyin/replace", form, {
      headers: { "Content-Type": "multipart/form-data" }
    })

    audioUrl.value = res.data
    await checkExists()
  } catch (err) {
    showError(err)
  }
}
</script>

<template>
  <div style="padding:20px">

    <h2>Dialect: {{ dialect }}</h2>

    <div>
      <input
          v-model="pinyinKey"
          placeholder="pinyin key"
          class="search-input form-control"
          @keydown.enter.exact.prevent="checkExists"
          @blur="checkExists"
      />
    </div>

    <div style="margin-top:10px">
      <input type="file" @change="onFileChange" />
    </div>

    <!-- 状态提示 -->
    <div style="margin-top:10px">
      <b>Status:</b>
      <span v-if="exists" style="color:green">EXISTS</span>
      <span v-else style="color:red">NOT FOUND</span>
    </div>

    <!-- 操作按钮 -->
    <div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap">

      <button class="dev-btn-small dev-add-btn" @click="checkExists">检查</button>

      <button class="dev-btn-small dev-add-btn"  @click="upload">上传</button>

      <button class="dev-btn-small dev-add-btn" @click="play">播放</button>

      <button class="dev-btn-small dev-war-btn" @click="replace">
        替换
      </button>

      <button class="dev-btn-small dev-remove-btn" @click="remove">
        删除
      </button>

    </div>

    <!-- 播放器 -->
    <div v-if="audioUrl" style="margin-top:20px">
      <p>Audio:</p>
      <audio :src="audioUrl" controls autoplay />
    </div>

  </div>
</template>
<style scoped>
input {
  margin: 5px 0;
}
</style>