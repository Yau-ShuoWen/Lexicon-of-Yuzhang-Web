<script setup>
import {ref, onMounted, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import FlexibleTextField from "../components/FlexibleTextField.vue";

const route = useRoute()
const router = useRouter()
const id = route.params.id   // 从路由获取ID

const formData = ref({
  id: null,
  hanzi: '',
  hantz: '',
  stdPy: '',
  special: 0,
  similar: [],
  mulPy: [],
  mandarin: [],
  ipaExp: [],
  mean: [],
  note: []
})

const previousId = ref(null)   // 前一个的编号
const nextId = ref(null)       // 后一个的编号
const mandarinOptions = ref([])// 普通话读音的选择
const isLoading = ref(false)
const isSaving = ref(false)
const saveMessage = ref('')

const isNew = ref(!id || id === 'new')  // 判断是否为新增模式
const originalMandarin = ref([])        // 保存从后端加载的原始 mandarin 数据

// 方法：加载汉字详情
const loadHanzi = async (id) => {
  if (isNew.value) return

  isLoading.value = true
  try {
    const response = await fetch(`/api/edit/nam/hanzi/by-id?id=${id}`)
    if (!response.ok) throw new Error('加载失败')

    const apiResponse = await response.json()
    console.log('完整响应:', apiResponse)

    if (!apiResponse.success) throw new Error(apiResponse.message || '加载失败')
    if (apiResponse.data.empty) throw new Error('未找到数据')
    const data = apiResponse.data.value


    originalMandarin.value = data.mandarin || []    // 保存原始的 mandarin 数据
    formData.value = transformDataFromBackend(data) // 转换数据格式以匹配前端界面
    await loadMandarinOptions()                     // 加载详情后自动加载普通话选项并设置选中状态
    await loadNearBy(id)
  } catch (error) {
    console.error('加载汉字详情失败:', error)
    saveMessage.value = '加载失败：' + error.message
  } finally {
    isLoading.value = false
  }
}

// 找到上一个和下一个词条
const loadNearBy = async (id) => {
  try {
    const res = await fetch(`/api/edit/nam/get-nearby?id=${id}`)
    if (!res.ok) throw new Error('加载上下文失败')

    const json = await res.json()
    if (!json.success) throw new Error(json.message)

    const data = json.data

    previousId.value = data.left.empty ? null : data.left.value
    nextId.value = data.right.empty ? null : data.right.value

  } catch (err) {
    console.error(err)
  }
}


// 方法：从后端数据转换到前端格式
const transformDataFromBackend = (data) => {
  return {
    ...data,
    // 确保所有数组都存在
    similar: data.similar || [],
    mulPy: data.mulPy || [],
    mandarin: data.mandarin || [],
    ipaExp: data.ipaExp || [],
    mean: data.mean || [],
    note: data.note || []
  }
}

// 方法：从前端数据转换到后端格式
const transformDataToBackend = (data) => {
  // 对于新增模式，id 应该为 null
  const backendData = {
    ...data,
    id: isNew.value ? null : data.id
  }

  // 确保 mandarin 数组中的对象有正确的结构
  backendData.mandarin = backendData.mandarin.map(item => ({
    info: item.info,
    leftId: item.leftId,
    rightId: item.rightId
  }))

  // 确保 ipaExp 数组中的对象有正确的结构
  backendData.ipaExp = backendData.ipaExp.map(item => ({
    alpha: item.alpha,
    beta: item.beta,
    gamma: item.gamma,
    delta: item.delta
  }))

  // 确保 mean 数组中的对象有正确的结构
  backendData.mean = backendData.mean.map(item => ({
    left: item.left,
    right: item.right
  }))

  // 确保 note 数组中的对象有正确的结构
  backendData.note = backendData.note.map(item => ({
    left: {
      left: item.left?.left || '',
      right: item.left?.right || ''
    },
    right: {
      left: item.right?.left || '',
      right: item.right?.right || ''
    }
  }))

  return backendData
}

// 方法：加载普通话选项并设置选中状态
const loadMandarinOptions = async () => {
  if (!formData.value.hanzi && !formData.value.hantz) return

  try {
    const response = await fetch(`/api/edit/nam/get-hanzi?hanzi=${formData.value.hanzi || ''}&hantz=${formData.value.hantz || ''}`)
    if (response.ok) {
      const options = await response.json()
      mandarinOptions.value = options

      // 设置选中状态：将后端返回的 mandarin 数据与选项列表匹配
      setMandarinSelection(options)
    }
  } catch (error) {
    console.error('加载普通话选项失败:', error)
  }
}

// 方法：设置普通话读音的选中状态
const setMandarinSelection = (options) => {
  if (isNew.value) {
    // 新增模式，清空选中状态
    formData.value.mandarin = []
    return
  }

  // 编辑模式：将原始 mandarin 数据与选项列表匹配
  const selectedItems = []

  // 遍历原始 mandarin 数据，找到对应的选项
  originalMandarin.value.forEach(originalItem => {
    // 在选项列表中查找匹配的项
    const matchedOption = options.find(option =>
        // 根据 info 字段进行匹配
        option.info === originalItem.info ||
        // 或者根据 leftId 和 rightId 进行匹配（更精确）
        (option.leftId === originalItem.leftId && option.rightId === originalItem.rightId)
    )

    if (matchedOption) {
      // 如果找到匹配的选项，就添加到选中列表中
      selectedItems.push(matchedOption)
    }
  })

  // 更新 formData 中的 mandarin
  formData.value.mandarin = selectedItems
}

// 方法：保存数据
const saveData = async () => {
  isSaving.value = true
  saveMessage.value = ''

  try {
    // 转换数据格式以匹配后端
    const backendData = transformDataToBackend(formData.value)

    console.log('准备保存的数据:', JSON.stringify(backendData, null, 2))

    const response = await fetch('/api/edit/nam/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendData)
    })

    console.log('响应状态:', response.status)

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const result = await response.json()
    console.log('后端返回结果:', result)

    if (result.success) {
      saveMessage.value = '保存成功！'
      // 如果是新增，更新ID并留在编辑页面
      if (isNew.value && result.data) {
        formData.value.id = result.data.id
        isNew.value = false
        // 更新原始 mandarin 数据
        originalMandarin.value = formData.value.mandarin
        // 更新URL但不跳转
        router.replace(`/edit/${formData.value.id}`)
      }
    } else {
      throw new Error(result.message || '保存失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
    saveMessage.value = '保存失败：' + error.message
  } finally {
    isSaving.value = false
  }
}

// 数组操作方法
const addArrayItem = (array, template = {}) => {
  array.push({...template})
}

const removeArrayItem = (array, index) => {
  array.splice(index, 1)
}

// 多拼音拖拽排序方法
const onMulPyDragStart = (event, index) => {
  event.dataTransfer.setData('text/plain', index)
}

const onMulPyDragOver = (event) => {
  event.preventDefault()
}

const onMulPyDrop = (event, newIndex) => {
  event.preventDefault()
  const oldIndex = parseInt(event.dataTransfer.getData('text/plain'))

  if (oldIndex !== newIndex) {
    const item = formData.value.mulPy.splice(oldIndex, 1)[0]
    formData.value.mulPy.splice(newIndex, 0, item)

    // 重新计算排序序号
    formData.value.mulPy.forEach((item, index) => {
      item.sort = index + 1
    })
  }
}

// 监听简繁体变化，自动加载普通话选项
watch([() => formData.value.hanzi, () => formData.value.hantz], () => {
  // 简繁体都有内容时才加载
  if (formData.value.hanzi && formData.value.hantz) {
    loadMandarinOptions()
  }
})

// 监听路由变化，当ID变化时重新加载数据
watch(() => route.params.id, (newId) => {
  if (newId && newId !== 'new') {
    loadHanzi(newId)
  }
})

// 监听多拼音数组的变化，更新标准拼音选项
watch(() => formData.value.mulPy, () => {
  // 当多拼音数组变化时，检查当前选中的标准拼音是否还存在
  if (formData.value.stdPy) {
    const exists = formData.value.mulPy.some(item =>
        item.pinyin && item.pinyin.trim() === formData.value.stdPy.trim()
    )
    if (!exists) {
      formData.value.stdPy = ''
    }
  }
}, { deep: true })

// 监听多拼音条目的拼音变化
watch(() => formData.value.mulPy.map(item => item.pinyin), () => {
  // 当拼音内容变化时，检查当前选中的标准拼音是否还存在
  if (formData.value.stdPy) {
    const exists = formData.value.mulPy.some(item =>
        item.pinyin && item.pinyin.trim() === formData.value.stdPy.trim()
    )
    if (!exists) {
      formData.value.stdPy = ''
    }
  }
}, { deep: true })

// 初始化
onMounted(() => {
  if (!isNew.value) {
    loadHanzi(id)
  }
})
</script>

<template>
  <div class="edit-page">
    <div class="page-header">
      <h2>{{ isNew ? '新增' : '編輯' }}</h2>

      <div class="nav-buttons">
        <button
            :disabled="!previousId"
            @click="router.push(`/edit/${previousId}`)"
        >上一条
        </button>

        <button
            :disabled="!nextId"
            @click="router.push(`/edit/${nextId}`)"
        >下一条
        </button>
      </div>
    </div>


    <div class="page-header">
      <div class="form-actions">
        <button @click="saveData" :disabled="isSaving" class="save-btn">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <div v-if="saveMessage" class="save-message" :class="{ error: saveMessage.includes('失败') }">
      {{ saveMessage }}
    </div>

    <div v-if="isLoading" class="loading">加載中...</div>

    <div v-else class="edit-form">
      <div class="form-section">
        <div class="form-grid">
          <div class="form-field">
            <label>繁體字</label>
            <input v-model="formData.hantz" type="text" class="short-input"/>
          </div>
          <div class="form-field">
            <label>簡體字</label>
            <input v-model="formData.hanzi" type="text" class="short-input"/>
          </div>
          <div class="form-field">
            <label>標準拼音</label>
            <input v-model="formData.stdPy" type="text" class="short-input" readonly/>
          </div>
          <div class="form-field">
            <label>特殊性標記</label>
            <select v-model="formData.special" class="short-input">
              <option value="0">普通漢字</option>
              <option value="1">特殊方言字</option>
              <option value="2">占位字</option>
              <option value="-1">不使用漢字</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>多拼音</h3>
          <button
              @click="addArrayItem(formData.mulPy, { sc: '', tc: '', pinyin: '', sort: formData.mulPy.length + 1 })">添加
          </button>
        </div>

        <!-- 主拼音单选按钮组 -->
        <div class="main-pinyin-selector">
          <span class="selector-label">主拼音：</span>
          <div class="radio-group">
            <div v-for="(item, index) in formData.mulPy" :key="index" class="radio-item">
              <template v-if="item.pinyin && item.pinyin.trim()">
                <input
                    type="radio"
                    :id="'stdPy-' + index"
                    :name="'stdPyRadio'"
                    :value="item.pinyin.trim()"
                    v-model="formData.stdPy"
                />
                <label :for="'stdPy-' + index">{{ item.pinyin.trim() }}</label>
              </template>
            </div>
          </div>
        </div>

        <div
            v-for="(item, index) in formData.mulPy"
            :key="index"
            class="array-item draggable-item"
            draggable="true"
            @dragstart="onMulPyDragStart($event, index)"
            @dragover="onMulPyDragOver($event)"
            @drop="onMulPyDrop($event, index)"
        >
          <div class="drag-handle">⋮⋮</div>

          <FlexibleTextField
              v-model:traditionalText="item.tc"
              v-model:simplifiedText="item.sc"
              :layout="'small'"
          />
          <input v-model="item.pinyin" placeholder="拼音" class="short-input"/>
          <input v-model="item.sort" type="number" placeholder="排序" class="short-input" disabled/>
          <button @click="removeArrayItem(formData.mulPy, index)" class="remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <h3>普通話讀音對應</h3>
        <div v-if="mandarinOptions.length > 0" class="checkbox-group">
          <div v-for="option in mandarinOptions" :key="option.info" class="checkbox-item">
            <input
                type="checkbox"
                :id="'mdr-' + option.info"
                :value="option"
                v-model="formData.mandarin"
            />
            <label :for="'mdr-' + option.info">{{ option.info }}</label>
          </div>
        </div>
        <div v-else class="no-options">
          {{ formData.hanzi && formData.hantz ? '暫無對應讀音' : '請先填寫簡繁體內容獲得讀音' }}
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>國際音標</h3>
          <button @click="addArrayItem(formData.ipaExp, { alpha: '', beta: '', gamma: '', delta: '' })">添加</button>
        </div>
        <div v-for="(item, index) in formData.ipaExp" :key="index" class="array-item">
          <FlexibleTextField
              v-model:traditionalText="item.beta"
              v-model:simplifiedText="item.alpha"
              :layout="'small'"
          />
          <input v-model="item.gamma" placeholder="標籤" class="short-input"/>
          <input v-model="item.delta" placeholder="內容" class="long-input"/>
          <button @click="removeArrayItem(formData.ipaExp, index)" class="remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>相似漢字</h3>
          <button @click="addArrayItem(formData.similar, { hanzi: '', hantz: '' })">添加</button>
        </div>
        <div v-for="(item, index) in formData.similar" :key="index" class="array-item">
          <FlexibleTextField
              v-model:traditionalText="item.hantz"
              v-model:simplifiedText="item.hanzi"
              :layout="'small'"
          />
          <button @click="removeArrayItem(formData.similar, index)" class="remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>含義</h3>
          <button @click="addArrayItem(formData.mean, { left: '', right: '' })">添加</button>
        </div>
        <div v-for="(item, index) in formData.mean" :key="index" class="array-item complex-item">
          <FlexibleTextField
              v-model:traditionalText="item.right"
              v-model:simplifiedText="item.left"
              :layout="'large'"
          />
          <button @click="removeArrayItem(formData.mean, index)" class="remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>註釋</h3>
          <button
              @click="addArrayItem(formData.note, { left: { left: '', right: '' }, right: { left: '', right: '' } })">添加
          </button>
        </div>
        <div v-for="(item, index) in formData.note" :key="index" class="array-item complex-item">

          <FlexibleTextField
              v-model:traditionalText="item.right.left"
              v-model:simplifiedText="item.left.left"
              :layout="'small'"
          />

          <FlexibleTextField
              v-model:traditionalText="item.right.right"
              v-model:simplifiedText="item.left.right"
              :layout="'large'"
          />

          <button @click="removeArrayItem(formData.note, index)" class="remove-btn">刪除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.save-message {
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 4px;
  background: #e8f5e8;
  color: #2e7d32;
}

.save-message.error {
  background: #ffebee;
  color: #d32f2f;
}

.form-section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

/* 主拼音选择器样式 */
.main-pinyin-selector {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}

.selector-label {
  font-weight: bold;
  color: #333;
  margin-right: 10px;
  white-space: nowrap;
}

.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.radio-item input[type="radio"] {
  margin: 0;
}

.radio-item label {
  cursor: pointer;
  user-select: none;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.form-field {
  display: flex;
  flex-direction: column;
}

.form-field label {
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

/* 输入框样式 */
.short-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 120px;
  min-width: 120px;
}

.long-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  flex: 1;
  min-width: 200px;
}

.form-field input,
.form-field select {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* 标准拼音输入框只读样式 */
input[readonly] {
  background-color: #f5f5f5;
  cursor: not-allowed;
  color: #666;
}

.array-item {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}

.draggable-item {
  cursor: move;
  padding: 8px;
  border: 1px dashed #ccc;
  border-radius: 4px;
  background: #fafafa;
}

.draggable-item:hover {
  background: #f0f0f0;
}

.drag-handle {
  cursor: move;
  padding: 4px 8px;
  color: #666;
  user-select: none;
}

.array-item input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.complex-item {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.note-part {
  display: flex;
  gap: 8px;
  align-items: center;
}

.note-part label {
  min-width: 40px;
  font-weight: normal;
  font-size: 12px;
  color: #666;
}

.remove-btn {
  padding: 4px 8px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  min-width: 50px;
}

.checkbox-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.no-options {
  color: #666;
  font-style: italic;
  padding: 10px;
  text-align: center;
}

.form-actions {
  text-align: center;
  margin-top: 30px;
}

.save-btn {
  padding: 12px 30px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
}

.save-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

button {
  padding: 6px 12px;
  border: 1px solid #007cba;
  background: #007cba;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background: #005a87;
}

.nav-buttons {
  display: flex;
  gap: 10px;
}

.nav-buttons button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

</style>