<script setup>
import {ref, computed, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import BackButton from "../../components/Button/BackButton.vue";

const route = useRoute()
const router = useRouter()

const dictionary = computed(() => route.params.dictionary)
const sort = computed(() => route.params.sort)

// 页面数据
const page = ref(null)

// nearby
const prevSort = ref(null)
const nextSort = ref(null)

// UI 状态
const loading = ref(false)
const saving = ref(false)
const message = ref('')

async function loadPage() {
  loading.value = true

  try {
    const response = await fetch(`/api/ref/get-page/${dictionary.value}?sort=${encodeURIComponent(sort.value)}`)
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message || '加载失败')

    page.value = json.data
    await loadNearby()

  } catch (error) {
    console.error('加载页面失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadNearby() {
  if (!page.value) return

  try {
    const requestBody = {
      'left': page.value.frontSort,
      'right': page.value.endSort
    }
    console.log(requestBody)
    const response = await fetch(`/api/ref/get-nearby/${dictionary.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestBody)
    })
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message || '获取 nearby 失败')

    const data = json.data
    console.log(data)

    prevSort.value = data.left.empty ? null : data.left.value
    nextSort.value = data.right.empty ? null : data.right.value


  } catch (error) {
    console.error('加载相邻页失败:', error)
  }
}


async function savePage() {
  if (!page.value) return

  saving.value = true
  message.value = ''

  try {
    const response = await fetch(
        `/api/ref/update-page/${dictionary.value}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(page.value)
        }
    )

    if (!response.ok)
      throw new Error(`HTTP错误: ${response.status}`)

    const result = await response.json()

    if (result.success) {
      message.value = '已保存'
    } else {
      throw new Error(result.message || '保存失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
    message.value = '保存失败：' + error.message
  } finally {
    saving.value = false
  }
}

function goPrev() {
  if (!prevSort.value) return

  router.replace({
    params: {
      dictionary: dictionary.value,
      sort: prevSort.value
    }
  })
}

function goNext() {
  if (!nextSort.value) return

  router.replace({
    params: {
      dictionary: dictionary.value,
      sort: nextSort.value
    }
  })
}

async function insert(before) {
  if (!page.value) return

  try {
    const params = new URLSearchParams({
      sort: before ? page.value.frontSort : page.value.endSort,
      before: before
    })

    const response = await fetch(
        `/api/ref/create-page/${dictionary.value}?${params.toString()}`,
        {method: 'POST'}
    )
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message)

    const newPage = json.data
    await router.replace({
      params: {
        dictionary: dictionary.value,
        sort: newPage.frontSort
      }
    })

  } catch (error) {
    console.error('插入新页失败:', error)
  }
}


watch(
    () => route.params.sort,
    () => {
      page.value = null
      loadPage()
    },
    {immediate: true}
)
</script>

<template>
  <div class="ref-editor">
    <!-- 顶部控制栏 -->
    <div class="editor-header">

      <div class="nav-buttons">
        <BackButton buttonText="返回（不保存）" size="small"/>

        <button :disabled="!page" class="dev-btn-small dev-add-btn" @click="insert(true)">
          ←新增页面
        </button>
        <button :disabled="!page" class="dev-btn-small dev-add-btn" @click="insert(false)">
          →新增页面
        </button>

        <button :disabled="!prevSort" class="dev-btn-small dev-nav-button" @click="goPrev">
          {{ prevSort ? '上一页' : '第一页' }}
        </button>

        <button :disabled="!nextSort" class="dev-btn-small dev-nav-button" @click="goNext">
          {{ nextSort ? '下一页' : '最后一页' }}
        </button>

        <button :disabled="!page || saving" class="dev-btn-small dev-add-btn" @click="savePage">保存</button>
      </div>
    </div>

    <div v-if="loading">加载中…</div>

    <!-- 编辑区 -->
    <div v-if="page" class="editor-body">
      <textarea
          v-model="page.content"
          class="text-editor"
          placeholder="使用空行分段"
      />


        <!-- 预览占位 -->
    </div>

    <div class="message">{{ message }}</div>
  </div>
</template>

<style>
.editor-body {
  display: flex;
  gap: 16px;
}

.text-editor {
  flex: 1;
  min-height: 400px;
  font-size: 18px;
  line-height: 1.6;
}

.nav-buttons {
  display: flex;
  gap: 10px;
}

</style>