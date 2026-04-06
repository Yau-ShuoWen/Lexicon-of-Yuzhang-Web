<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackButton from "../../../components/Button/BackButton.vue";
import LoadingIcon from "../../../components/Status/LoadingIcon.vue";
import { confirm } from "../../../services/confirmService.js";
import { showError, showSuccess } from "../../../services/ToastService.js";

// 路由
const route = useRoute()
const router = useRouter()

// 字典、序号和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const dictionary = computed(() => route.params.dictionary)
const sort = computed(() => route.params.sort)
const getPath = (sort) => `/${language.value}/${dialect.value}/ref-editor/${dictionary.value}/${sort}`

const page = ref(null)
const prevSort = ref(null)
const nextSort = ref(null)
const loading = ref(false)
const saving = ref(false)
const message = ref('')

async function loadPage() {
  loading.value = true
  try {
    const response = await fetch(`/api/ref/get-page/${dictionary.value}?sort=${encodeURIComponent(sort.value)}`)
    const json = await response.json()
    page.value = json.data
    await loadNearby()
  }
  finally {
    loading.value = false
  }
}

const pageInfoTitle = ref('')
const pageInfoNumber = ref('')

const titleOptions = [
  {label: '正文', value: '正文'},
  {label: '附錄', value: '附錄'},
  {label: '索引', value: '索引'},
  {label: '前言', value: '前言'},
  {label: '凡例', value: '凡例'}
]

watch(() => page.value?.pageInfo, (newVal) => {
  if (!newVal) {
    pageInfoTitle.value = ''
    pageInfoNumber.value = ''
    return
  }
  try {
    pageInfoTitle.value = newVal.left || ''
    pageInfoNumber.value = (newVal.right != null && newVal.right !== -1) ? String(newVal.right) : ''
  } catch (e) {
    console.warn('解析 pageInfo 失敗', e)
    pageInfoTitle.value = ''
    pageInfoNumber.value = ''
  }
}, {immediate: true})

function syncPageInfoToPage() {
  if (!page.value) return
  const rawNum = pageInfoNumber.value
  const pageNum = (rawNum === '' || rawNum == null) ? -1 : Number(rawNum)

  page.value.pageInfo = ({
    left: pageInfoTitle.value || '',
    right: isNaN(pageNum) ? -1 : pageNum
  })
}

async function loadNearby() {
  if (!page.value) return
  const requestBody = {
    left: page.value.frontSort,
    right: page.value.endSort
  }
  console.log(requestBody)
  const response = await fetch(`/api/ref/get-nearby/${dictionary.value}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(requestBody)
  })
  const json = await response.json()
  prevSort.value = json.data.left.empty ? null : json.data.left.value
  nextSort.value = json.data.right.empty ? null : json.data.right.value
}

async function savePage() {
  if (!page.value) return
  saving.value = true
  try {
    syncPageInfoToPage()
    await fetch(`/api/ref/update-page/${dictionary.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(page.value)
    })
    showSuccess('已保存')
  } catch (e) {
    console.error(e)
    showError(e.message)
  }
  finally {
    saving.value = false
  }
}

const shiftToOther = async (newId) => {
  await router.replace(getPath(`${newId}`))
}

async function insert(before) {
  if (!page.value) return
  const params = new URLSearchParams({
    sort: before ? page.value.frontSort : page.value.endSort,
    before: before
  })
  const response = await fetch(
      `/api/ref/create-page/${dictionary.value}?${params.toString()}`,
      {method: 'POST'}
  )
  const json = await response.json()
  await shiftToOther(json.data.frontSort)
  showSuccess('页面创建成功')
}

async function deletePage() {
  if (!page.value) return

  loading.value = true

  try {
    const params = new URLSearchParams({frontSort: page.value.frontSort})

    const response = await fetch(
        `/api/ref/delete-page/${dictionary.value}?${params.toString()}`,
        {method: 'POST'}
    )
    const json = await response.json()

    if (!response.ok) throw new Error(json?.message || `HTTP错误: ${response.status}`)
    if (!json.success) throw new Error(json.message || '保存失败')

    await shiftToOther(json.data.frontSort)
    showSuccess( '页面删除成功')
  }
  catch (e) {
    showError('刪除失敗\n'+e.message)
  }
  finally {
    loading.value = false
  }
}


async function openDeleteConfirm() {

  const ok = await confirm({
    title: '确认删除',
    message: '确定要删除当前页面吗？此操作不可撤销。',
    actions: [
      {key: true, text: '确认删除', class: 'dev-btn-small dev-remove-btn'},
      {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
    ]
  })

  if (ok) await deletePage()
}

async function openInsertConfirm() {

  const result = await confirm({
    title: '新增页面',
    message: '请选择新增位置',
    actions: [
      {key: 'before', text: '加在本页前', class: 'dev-btn-small dev-add-btn'},
      {key: 'after', text: '加在本页后', class: 'dev-btn-small dev-add-btn'},
      {key: false, text: '取消', class: 'dev-btn-small dev-normal-button'}
    ]
  })

  if (result === 'before') await insert(true)
  if (result === 'after') await insert(false)

}

watch(() => route.params.sort, () => {
  page.value = null
  loadPage()
}, {immediate: true})
</script>

<template>
  <div class="ref-editor">

    <div class="editor-header">

      <div class="nav-buttons ">

        <BackButton buttonText="返回（不保存）" size="small"/>

        <button
            :disabled="!prevSort"
            class="dev-btn-small dev-nav-button"
            @click="shiftToOther(prevSort)">
          {{ prevSort ? '上一页' : '第一页' }}
        </button>

        <button
            :disabled="!nextSort"
            class="dev-btn-small dev-nav-button"
            @click="shiftToOther(nextSort)">
          {{ nextSort ? '下一页' : '最后一页' }}
        </button>
      </div>

      <div class="nav-buttons">
        <button
            :disabled="!page || loading"
            class="dev-btn-small dev-add-btn"
            @click="openInsertConfirm">
          新增页面
        </button>

        <button
            :disabled="!page || loading"
            class="dev-btn-small dev-remove-btn"
            @click="openDeleteConfirm">
          删除页面
        </button>

        <button
            :disabled="!page || saving"
            class="dev-btn-small dev-add-btn"
            @click="savePage">
          保存
        </button>

        <div>
          设置页码：
          <select v-model="pageInfoTitle" class="dev-btn-small">
            <option value=""> </option>
            <option v-for="opt in titleOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          第
          <input type="number" v-model="pageInfoNumber" class="dev-btn-small page-num"
                 placeholder="" min="1"/>
          頁
        </div>

      </div>
    </div>

    <LoadingIcon v-if="loading" :showText="false"/>
    <div v-else>
      <div v-if="page" class="editor-body">
        <textarea v-model="page.content" class="text-editor form-control" placeholder="使用空行分段"/>
      </div>
    </div>


    <div class="message" :class="{ 'error-message': message.includes('失败') }">
      {{ message }}
    </div>

  </div>
</template>


<style>
.editor-body {
  display: flex;
  gap: 16px;
}

.text-editor {
  flex: 1;
  min-height: 600px;
  font-size: 18px;
  line-height: 1.6;
}

.page-num {
  width: 70px;
}
</style>
