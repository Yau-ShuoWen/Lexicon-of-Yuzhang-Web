<script setup>
import { ref, onMounted } from "vue"
import axios from "axios"
import { showError } from "../../../services/ToastService.js"

const file = ref(null)
const audioList = ref([])
const currentUrl = ref("")

function onFileChange(e) {
  file.value = e.target.files[0]
}

async function upload() {
  try {
    if (!file.value) return

    const form = new FormData()
    form.append("file", file.value)

    await axios.post("/api/audio/upload", form, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    })

    await loadList()
  } catch (err) {
    showError(err)
  }
}

async function loadList() {
  try {
    const res = await axios.get("/api/audio/list")
    audioList.value = res.data
  } catch (err) {
    showError(err)
  }
}

function play(url) {
  currentUrl.value = url
}

async function remove(id) {
  try {
    await axios.delete(`/api/audio/${id}`)
    currentUrl.value = ""
    await loadList()
  } catch (err) {
    showError(err)
  }
}

onMounted(() => {
  loadList()
})
</script>

<template>
  <div style="padding:20px">
    <h2>Audio Management</h2>

    <div>
      <input type="file" @change="onFileChange"/>
    </div>

    <div style="margin-top:15px">
      <button class="dev-btn-small dev-add-btn" @click="upload">
        上传
      </button>
    </div>

    <div style="margin-top:20px">
      <h3>Audio List</h3>

      <div
          v-for="item in audioList"
          :key="item.id"
          style="margin-bottom:15px;padding:10px;border-bottom:1px solid #ddd"
      >
        <div>
          {{ item.name }} ({{ item.format }})
        </div>

        <div style="margin-top:8px;display:flex;gap:10px">
          <button class="dev-btn-small dev-add-btn" @click="play(item.url)">
            播放
          </button>

          <button class="dev-btn-small dev-remove-btn" @click="remove(item.id)">
            删除
          </button>
        </div>
      </div>
    </div>

    <div v-if="currentUrl" style="margin-top:20px">
      <p>Audio:</p>
      <audio :src="currentUrl" controls autoplay/>
    </div>
  </div>
</template>

<style scoped>
input {
  margin: 5px 0;
}
</style>