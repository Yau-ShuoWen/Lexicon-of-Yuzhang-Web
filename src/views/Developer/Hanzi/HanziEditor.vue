<!--HanziEditor.vue-->

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PinyinProofreadText from "../../../components/Text/PinyinProofreadText.vue";
import BackButton from "../../../components/Button/BackButton.vue";
import LoadingIcon from "../../../components/Status/LoadingIcon.vue";
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import DraggableList from "../../../components/Layout/DraggableList.vue";

// 路由
const route = useRoute()
const router = useRouter()
const id = route.params.id

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (id) => `/${language.value}/${dialect.value}/hanzi-editor/${id}`

const UpdateData = ref({
  id: null,
  hanzi: {sc: '', tc: ''},
  mainPy: '',
  special: 0,
  similar: [],
  variantPy: [],
  mandarin: [],
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
    const response = await fetch(`/api/edit/hanzi/get-info/${dialect.value}?id=${id}`)
    if (!response.ok) throw new Error('加载失败')
    const apiResponse = await response.json()
    if (!apiResponse.success) throw new Error(apiResponse.message || '加载失败')
    if (apiResponse.data.empty) throw new Error('未找到数据')

    console.log('完整响应:', apiResponse)
    const data = apiResponse.data.value


    originalMandarin.value = data.mandarin || []    // 保存原始的 mandarin 数据
    UpdateData.value = data // 转换数据格式以匹配前端界面
    await loadMandarinOptions()                     // 加载详情后自动加载普通话选项并设置选中状态
    await loadNearBy(id)
  } catch (error) {
    console.error('加载汉字详情失败:', error)
    saveMessage.value = '加载失败：' + error.message
  }
  finally {
    isLoading.value = false
  }
}

// 找到上一个和下一个词条
const loadNearBy = async (id) => {
  try {
    const res = await fetch(`/api/edit/get-nearby?/${dialect.value}id=${id}`)
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

// 方法：加载普通话选项并设置选中状态
const loadMandarinOptions = async () => {
  if (!UpdateData.value.hanzi.sc && !UpdateData.value.hanzi.tc) return

  try {
    const response = await fetch(`/api/edit/get-mandarin/${dialect.value}?sc=${UpdateData.value.hanzi.sc}&tc=${UpdateData.value.hanzi.tc}`)
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
    UpdateData.value.mandarin = []
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
  UpdateData.value.mandarin = selectedItems
}

// 切换到其他词条，清空保存的结果
const shiftToOther = async (newId) => {
  saveMessage.value = ''
  await router.replace(getPath(`${newId}`))
}

// 方法：保存数据
const saveData = async () => {
  isSaving.value = true
  saveMessage.value = ''

  try {
    // 转换数据格式以匹配后端
    const backendData = UpdateData.value
    backendData.id = isNew.value ? null : UpdateData.value.id   // 对于新增模式，id 应该为 null

    console.log('准备保存的数据:', JSON.stringify(backendData, null, 2))

    const response = await fetch(`/api/edit/submit/${dialect.value}`, {
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
  }
  finally {
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

watch(
    [() => UpdateData.value.hanzi.sc, () => UpdateData.value.hanzi.tc],
    () => {
      if (UpdateData.value.hanzi.sc && UpdateData.value.hanzi.tc) loadMandarinOptions()
    }
)

// 监听路由变化，当ID变化时重新加载数据
watch(() => route.params.id, (newId) => {
  if (newId && newId !== 'new') loadHanzi(newId)
})

// 监听多拼音数组的变化，更新标准拼音选项，检查当前选中的标准拼音是否还存在
watch(() => UpdateData.value.variantPy, () => {
  if (UpdateData.value.mainPy) {
    const exists = UpdateData.value.variantPy.some(item =>
        item.pinyin && item.pinyin.trim() === UpdateData.value.mainPy.trim())
    if (!exists) UpdateData.value.mainPy = ''
  }
}, {deep: true})

// 监听多拼音条目的拼音变化
watch(() => UpdateData.value.variantPy.map(item => item.pinyin), () => {
  // 当拼音内容变化时，检查当前选中的标准拼音是否还存在
  if (UpdateData.value.mainPy) {
    const exists = UpdateData.value.variantPy.some(item =>
        item.pinyin && item.pinyin.trim() === UpdateData.value.mainPy.trim()
    )
    if (!exists) {
      UpdateData.value.mainPy = ''
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

    <div class="nav-buttons">
      <BackButton buttonText="返回（不保存）" size="small"/>

      <button
          v-if="!isNew"
          :disabled="!prevId"
          class="dev-nav-button dev-btn dev-btn-small"
          @click="shiftToOther(prevId)"
      >{{ prevId ? '上一条' : '第一条' }}
      </button>

      <button
          v-if="!isNew"
          :disabled="!nextId"
          class="dev-nav-button dev-btn-small"
          @click="shiftToOther(nextId)"
      >{{ nextId ? '下一条' : '最后一条' }}
      </button>

      <button @click="saveData" :disabled="isSaving" class="dev-add-btn dev-btn-small">
        {{ isSaving ? '保存中...' : isNew ? '保存新增' : '保存修改' }}
      </button>
    </div>


    <div v-if="saveMessage" class="save-message" :class="{ error: saveMessage.includes('失败') }">
      {{ saveMessage }}
    </div>

    <LoadingIcon v-if="isLoading" :show-text="true"/>

    <div v-else class="edit-form">
      <div class="form-section">
        <div class="form-grid">

          <div class="form-field">
            <label>繁體字和简体字</label>

            <ScAndTcText :disabled="!isNew"
                         v-model:traditionalText="UpdateData.hanzi.tc"
                         v-model:simplifiedText="UpdateData.hanzi.sc"
                         :layout="'small'" :dialect="dialect.toString()"
            />
          </div>

          <div class="form-field">
            <label>特殊性標記</label>
            <select v-model="UpdateData.special" class="short-input">
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
        </div>

        <!-- 主拼音单选按钮组 -->
        <div class="main-pinyin-selector">
          <span class="selector-label">主拼音：</span>
          <div class="radio-group">
            <div v-for="(item, index) in UpdateData.variantPy" :key="index" class="radio-item">
              <template v-if="item.pinyin && item.pinyin.trim()">
                <input
                    type="radio"
                    :id="'mainPy-' + index"
                    :name="'mainPyRadio'"
                    :value="item.pinyin.trim()"
                    v-model="UpdateData.mainPy"
                />
                <label :for="'mainPy-' + index">{{ item.pinyin.trim() }}</label>
              </template>
            </div>
          </div>
        </div>

        <DraggableList
            v-model="UpdateData.variantPy"
            :createItem="() => ({tag:{sc:'', tc:''},pinyin:'',sort: UpdateData.variantPy.length + 1})"
        >
          <template #default="{ item }">

            <div class="array-item">
              <span>{{ item.sort }}</span>

              <ScAndTcText v-model:traditionalText="item.tag.tc" v-model:simplifiedText="item.tag.sc"
                  :layout="'small'" :dialect="dialect.toString()"/>
              <PinyinProofreadText v-model="item.pinyin"/>
            </div>
          </template>
        </DraggableList>
      </div>


      <div class="form-section">
        <h3>普通話讀音對應</h3>
        <div v-if="mandarinOptions.length > 0" class="checkbox-group">
          <div v-for="option in mandarinOptions" :key="option.info" class="checkbox-item">
            <input
                type="checkbox"
                :id="'mdr-' + option.info"
                :value="option"
                v-model="UpdateData.mandarin"
            />
            <label :for="'mdr-' + option.info">{{ option.info }}</label>
          </div>
        </div>
        <div v-else class="no-results-low">
          {{
            UpdateData.hanzi.sc && UpdateData.hanzi.tc ? `${UpdateData.hanzi.sc} / ${UpdateData.hanzi.tc}:暫無對應讀音` : '請先填寫簡繁體內容獲得讀音'
          }}
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>相似漢字</h3>
          <button class="dev-add-btn"
                  @click="addArrayItem(UpdateData.similar, {id: null, text: { sc: '', tc: '' }})">添加
          </button>
        </div>
        <div v-for="(item, index) in UpdateData.similar" :key="index" class="array-item">
          <ScAndTcText v-model:traditionalText="item.text.tc" v-model:simplifiedText="item.text.sc"
                       :layout="'small'" :dialect="dialect.toString()"/>
          <button @click="removeArrayItem(UpdateData.similar, index)" class="dev-remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>含義</h3>
          <button class="dev-add-btn" @click="addArrayItem(UpdateData.mean, { sc: '', tc: '' })">添加</button>
        </div>
        <div v-for="(item, index) in UpdateData.mean" :key="index" class="array-item complex-item">

          <ScAndTcText
              v-model:traditionalText="item.tc" v-model:simplifiedText="item.sc"
              :layout="'large'" :dialect="dialect.toString()"/>

          <button @click="removeArrayItem(UpdateData.mean, index)" class="dev-remove-btn">刪除</button>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>註釋</h3>
          <button class="dev-add-btn"
                  @click="addArrayItem(UpdateData.note, { left: { sc: '', tc: '' }, right: { sc: '', tc: '' } })">
            添加
          </button>
        </div>
        <div v-for="(item, index) in UpdateData.note" :key="index" class="array-item complex-item">

          <ScAndTcText
              v-model:traditionalText="item.left.tc"
              v-model:simplifiedText="item.left.sc"
              :layout="'small'" :dialect="dialect.toString()"
          />
          <ScAndTcText
              v-model:traditionalText="item.right.tc"
              v-model:simplifiedText="item.right.sc"
              :layout="'large'" :dialect="dialect.toString()"
          />

          <button @click="removeArrayItem(UpdateData.note, index)" class="dev-remove-btn dev-btn-small">刪除</button>
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

/* 输入框样式 */
.short-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 120px;
  min-width: 120px;
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

button {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

</style>