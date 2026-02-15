<script setup>
import {ref, computed, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import BackButton from "../../components/Button/BackButton.vue";
import LoadingIcon from "../../components/Status/LoadingIcon.vue";

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
const showDeleteConfirm = ref(false) // 控制删除确认弹窗

async function loadPage() {
  loading.value = true

  try {
    const response = await fetch(`/api/ref/get-page/${dictionary.value}?sort=${encodeURIComponent(sort.value)}`)
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message || '加载失败')

    page.value = json.data
    loading.value = false
    await loadNearby()

  } catch (error) {
    console.error('加载页面失败:', error)
    message.value = '加载失败：' + error.message
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
    message.value = '加载相邻页失败：' + error.message
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
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(page.value)
        }
    )

    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const result = await response.json()

    if (result.success) message.value = '已保存'
    else throw new Error(result.message || '保存失败')

  } catch (error) {
    console.error('保存失败:', error)
    message.value = '保存失败：' + error.message
  } finally {
    saving.value = false
  }
}

const shiftToOther = async (newId) => {
  message.value = ''
  await router.replace(getPath(`${newId}`))
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

    await shiftToOther(newPage.frontSort)
    message.value = '页面创建成功'

  } catch (error) {
    console.error('插入新页失败:', error)
    message.value = '插入新页失败：' + error.message
  }
}

// 删除页面功能
async function deletePage() {
  if (!page.value) return

  showDeleteConfirm.value = false
  loading.value = true
  message.value = ''

  try {
    const params = new URLSearchParams({
      frontSort: page.value.frontSort
    })

    const response = await fetch(
        `/api/ref/delete-page/${dictionary.value}?${params.toString()}`,
        {method: 'POST'}
    )

    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

    const json = await response.json()
    if (!json.success) throw new Error(json.message || '删除失败')

    // 删除成功，跳转到返回的新页面
    const newPage = json.data
    await shiftToOther(newPage.frontSort)
    message.value = '页面删除成功'

  } catch (error) {
    console.error('删除页面失败:', error)
    message.value = '删除页面失败：' + error.message
    loading.value = false // 出错时恢复loading状态
  }
}

// 打开删除确认弹窗
function openDeleteConfirm() {
  showDeleteConfirm.value = true
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

        <button
            :disabled="!page || loading"
            class="dev-btn-small dev-remove-btn"
            @click="openDeleteConfirm"
        >
          删除页面
        </button>

        <button :disabled="!prevSort"
                class="dev-btn-small dev-nav-button"
                @click="shiftToOther(prevSort)"
        >{{ prevSort ? '上一页' : '第一页' }}
        </button>

        <button :disabled="!nextSort"
                class="dev-btn-small dev-nav-button"
                @click="shiftToOther(nextSort)"
        >{{ nextSort ? '下一页' : '最后一页' }}
        </button>

        <button :disabled="!page || saving"
                class="dev-btn-small dev-add-btn"
                @click="savePage"
        >保存
        </button>

      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-content">
        <h3>确认删除</h3>
        <p>确定要删除当前页面吗？此操作不可撤销。</p>
        <div class="modal-actions">
          <button class="dev-btn-small dev-remove-btn" @click="deletePage">确认删除</button>
          <button class="dev-btn-small" @click="showDeleteConfirm = false">取消</button>
        </div>
      </div>
    </div>

    <LoadingIcon v-if="loading" :showText="false"/>

    <!-- 编辑区 -->
    <div v-if="page" class="editor-body">
      <textarea
          v-model="page.content"
          class="text-editor"
          placeholder="使用空行分段"
      />


      <!-- 预览占位 -->
    </div>

    <div class="message" :class="{ 'error-message': message.includes('失败') }">{{ message }}</div>
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

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.modal-content h3 {
  margin: 0 0 16px 0;
  color: #333;
}

.modal-content p {
  margin: 0 0 24px 0;
  color: #666;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-actions button {
  min-width: 80px;
}
</style>
