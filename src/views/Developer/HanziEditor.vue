<!--HanziEditor.vue-->

<script setup>
import {ref, onMounted, watch, computed} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import AutoProofreadText from "../../components/Text/AutoProofreadText.vue";
import DictSelect from "../../components/Select/DictSelect.vue";
import PinyinProofreadText from "../../components/Text/PinyinProofreadText.vue";
import BackButton from "../../components/Button/BackButton.vue";

// 路由
const route = useRoute()
const router = useRouter()
const id = route.params.id

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/${path}`

const formData = ref({
  id: null,
  sc: '',
  tc: '',
  mainPy: '',
  special: 0,
  similar: [],
  variantPy: [],
  mandarin: [],
  ipa: [],
  mean: [],
  note: []
})

const prevId = ref(null)   // 前一个的编号
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
    const response = await fetch(`/api/edit/${dialect.value}/hanzi/by-id?id=${id}`)
    if (!response.ok) throw new Error('加载失败')
    const apiResponse = await response.json()
    if (!apiResponse.success) throw new Error(apiResponse.message || '加载失败')
    if (apiResponse.data.empty) throw new Error('未找到数据')

    console.log('完整响应:', apiResponse)
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
    const res = await fetch(`/api/edit/${dialect.value}/get-nearby?id=${id}`)
    if (!res.ok) throw new Error('加载上下文失败')

    const json = await res.json()
    if (!json.success) throw new Error(json.message)

    const data = json.data

    prevId.value = data.left.empty ? null : data.left.value
    nextId.value = data.right.empty ? null : data.right.value

  } catch (err) {
    console.error(err)
  }
}


// 方法：从后端数据转换到前端格式,，确保所有数组都存在
const transformDataFromBackend = (data) => {
  return {
    ...data,
    //
    similar: data.similar || [],
    variantPy: data.variantPy || [],
    mandarin: data.mandarin || [],
    ipa: data.ipa || [],
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
    mandarinId: item.mandarinId,
    dialectId: item.dialectId
  }))

  // 确保 ipa 数组中的对象有正确的结构
  backendData.ipa = backendData.ipa.map(item => ({
    left: item.left,
    right: item.right
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
  if (!formData.value.sc && !formData.value.tc) return

  try {
    const response = await fetch(`/api/edit/${dialect.value}/get-hanzi?sc=${formData.value.sc || ''}&tc=${formData.value.tc || ''}`)
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

  // 根据 info 字段进行匹配，或者根据 mandarinId 和 dialectId 进行匹配（更精确）
  // 如果找到匹配的选项，就添加到选中列表中
  originalMandarin.value.forEach(originalItem => {
    const matchedOption = options.find(option =>
        option.info === originalItem.info ||
        (option.mandarinId === originalItem.mandarinId && option.dialectId === originalItem.dialectId)
    )

    if (matchedOption) selectedItems.push(matchedOption)
  })
  formData.value.mandarin = selectedItems
}

// 切换到其他词条，清空保存的结果
const shiftToOther = async (newId) => {
  saveMessage.value = ''
  await router.replace(getPath(`edit/${newId}`))
}

// 方法：保存数据
const saveData = async () => {
  isSaving.value = true
  saveMessage.value = ''

  try {
    // 转换数据格式以匹配后端
    const backendData = transformDataToBackend(formData.value)

    console.log('准备保存的数据:', JSON.stringify(backendData, null, 2))

    const response = await fetch(`/api/edit/${dialect.value}/edit`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json',},
      body: JSON.stringify(backendData)
    })

    console.log('响应状态:', response.status)

    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)
    const result = await response.json()
    console.log('后端返回结果:', result)

    if (result.success) saveMessage.value = '保存成功！'
    else throw new Error(result.message || '保存失败')

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
const onVariantPyDragStart = (event, index) => {
  event.dataTransfer.setData('text/plain', index)
}

const onVariantPyDragOver = (event) => {
  event.preventDefault()
}

const onVariantPyDrop = (event, newIndex) => {
  event.preventDefault()
  const oldIndex = parseInt(event.dataTransfer.getData('text/plain'))

  if (oldIndex !== newIndex) {
    const item = formData.value.variantPy.splice(oldIndex, 1)[0]
    formData.value.variantPy.splice(newIndex, 0, item)

    // 重新计算排序序号
    formData.value.variantPy.forEach((item, index) => {
      item.sort = index + 1
    })
  }
}

// 监听简繁体变化，自动加载普通话选项，简繁体都有内容时才加载
watch([() => formData.value.sc, () => formData.value.tc], () => {
  if (formData.value.sc && formData.value.tc) loadMandarinOptions()
})

// 监听路由变化，当ID变化时重新加载数据
watch(() => route.params.id, (newId) => {
  if (newId && newId !== 'new') loadHanzi(newId)
})

// 监听多拼音数组的变化，更新标准拼音选项，检查当前选中的标准拼音是否还存在
watch(() => formData.value.variantPy, () => {
  if (formData.value.mainPy) {
    const exists = formData.value.variantPy.some(item =>
        item.pinyin && item.pinyin.trim() === formData.value.mainPy.trim())
    if (!exists) formData.value.mainPy = ''
  }
}, {deep: true})

// 监听多拼音条目的拼音变化
watch(() => formData.value.variantPy.map(item => item.pinyin), () => {
  // 当拼音内容变化时，检查当前选中的标准拼音是否还存在
  if (formData.value.mainPy) {
    const exists = formData.value.variantPy.some(item =>
        item.pinyin && item.pinyin.trim() === formData.value.mainPy.trim()
    )
    if (!exists) {
      formData.value.mainPy = ''
    }
  }
}, {deep: true})

// 初始化
onMounted(() => {
  if (!isNew.value) loadHanzi(id)
})
</script>

<template>
  <div class="edit-page">
    <div class="page-header">
      <h2>{{ isNew ? '新增' : '編輯' }}</h2>

      <div class="nav-buttons">
        <BackButton buttonText="返回（不保存）" size="small"/>

        <button
            v-if="!isNew"
            :disabled="!prevId"
            class="dev-nav-button"
            @click="shiftToOther(prevId)"
        >{{ prevId ? '上一条' : '第一条' }}
        </button>

        <button
            v-if="!isNew"
            :disabled="!nextId"
            class="dev-nav-button"
            @click="shiftToOther(nextId)"
        >{{ nextId ? '下一条' : '最后一条' }}
        </button>

        <button @click="saveData" :disabled="isSaving" class="dev-add-btn">
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
            <label>繁體字和简体字</label>
            <AutoProofreadText
                :disabled="!isNew"
                v-model:traditionalText="formData.tc"
                v-model:simplifiedText="formData.sc"
                :layout="'small'"
            />
          </div>

          <div class="form-field">
            <label>特殊性標記</label>
            <select v-model="formData.special" class="short-input">
              <option value="0">普通漢字</option>
              <option value="1">特殊方言字</option>
              <option value="2">占位字</option>
              <option value="3">不使用漢字</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>拼音</h3>
          <button class="dev-add-btn"
                  @click="addArrayItem(formData.variantPy, { sc: '', tc: '', pinyin: '', sort: formData.variantPy.length + 1 })">
            添加
          </button>
        </div>

        <!-- 主拼音单选按钮组 -->
        <div class="main-pinyin-selector">
          <span class="selector-label">主拼音：</span>
          <div class="radio-group">
            <div v-for="(item, index) in formData.variantPy" :key="index" class="radio-item">
              <template v-if="item.pinyin && item.pinyin.trim()">
                <input
                    type="radio"
                    :id="'mainPy-' + index"
                    :name="'mainPyRadio'"
                    :value="item.pinyin.trim()"
                    v-model="formData.mainPy"
                />
                <label :for="'mainPy-' + index">{{ item.pinyin.trim() }}</label>
              </template>
            </div>
          </div>
        </div>

        <div
            v-for="(item, index) in formData.variantPy"
            :key="index"
            class="array-item draggable-item"
            draggable="true"
            @dragstart="onVariantPyDragStart($event, index)"
            @dragover="onVariantPyDragOver($event)"
            @drop="onVariantPyDrop($event, index)"
        >
          <div class="drag-handle">⋮⋮</div>

          <label>排序顺序：{{ item.sort }}</label>
          <AutoProofreadText v-model:traditionalText="item.tc" v-model:simplifiedText="item.sc" :layout="'small'"/>
          <PinyinProofreadText v-model="item.pinyin" :placeholder="'拼音'"/>
          <button @click="removeArrayItem(formData.variantPy, index)" class="dev-remove-btn">刪除</button>

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
        <div v-else class="no-results-low">
          {{ formData.sc && formData.tc ? '暫無對應讀音' : '請先填寫簡繁體內容獲得讀音' }}
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>國際音標</h3>
          <button class="dev-add-btn" @click="addArrayItem(formData.ipa, { left: '', right: '' })">添加</button>
        </div>
        <div v-for="(item, index) in formData.ipa" :key="index" class="array-item">
          <DictSelect v-model="item.left" :placeholder="'请选择词典'"/>
          <input v-model="item.right" placeholder="內容"/>

          <button @click="removeArrayItem(formData.ipa, index)" class="dev-remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>相似漢字</h3>
          <button class="dev-add-btn" @click="addArrayItem(formData.similar, { sc: '', tc: '' })">添加</button>
        </div>
        <div v-for="(item, index) in formData.similar" :key="index" class="array-item">
          <AutoProofreadText v-model:traditionalText="item.tc" v-model:simplifiedText="item.sc" :layout="'small'"/>
          <button @click="removeArrayItem(formData.similar, index)" class="dev-remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>含義</h3>
          <button class="dev-add-btn" @click="addArrayItem(formData.mean, { left: '', right: '' })">添加</button>
        </div>
        <div v-for="(item, index) in formData.mean" :key="index" class="array-item complex-item">
          <AutoProofreadText v-model:traditionalText="item.right" v-model:simplifiedText="item.left" :layout="'large'"/>
          <button @click="removeArrayItem(formData.mean, index)" class="dev-remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>註釋</h3>
          <button class="dev-add-btn"
                  @click="addArrayItem(formData.note, { left: { left: '', right: '' }, right: { left: '', right: '' } })">
            添加
          </button>
        </div>
        <div v-for="(item, index) in formData.note" :key="index" class="array-item complex-item">

          <AutoProofreadText
              v-model:traditionalText="item.right.left" v-model:simplifiedText="item.left.left" :layout="'small'"/>
          <AutoProofreadText
              v-model:traditionalText="item.right.right" v-model:simplifiedText="item.left.right" :layout="'large'"/>

          <button @click="removeArrayItem(formData.note, index)" class="dev-remove-btn">刪除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
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

.form-actions {
  text-align: center;
  margin-top: 30px;
}

button {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
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