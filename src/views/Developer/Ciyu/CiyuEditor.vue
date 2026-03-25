<!-- CiyuEditor.vue -->

<script setup>
import { ref, computed, onMounted } from 'vue'
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

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

// 数据
const UpdateData = ref({
  id: null,
  ciyu: {sc: '', tc: ''},
  special: 0,
  mainPy: [],
  variantPy: [],
  similar: [],
  mean: []
})

const isNew = ref(!id || id === 'new')
const isLoading = ref(false)
const isSaving = ref(false)
const saveMessage = ref('')

// 加载词条详情
const loadCiyu = async (id) => {
  if (isNew.value) return
  isLoading.value = true
  try {
    const res = await fetch(`/api/edit/ciyu/get-info/${dialect.value}?id=${id}`)
    if (!res.ok) throw new Error('加载失败')
    const json = await res.json()
    if (!json.success || json.data.empty) throw new Error('未找到数据')

    const value = json.data.value

    // 直接使用后端对象
    UpdateData.value = {
      id: value.id,
      ciyu: value.ciyu,
      special: value.special ?? 0,
      mainPy: value.mainPy || [],
      variantPy: value.variantPy || [],
      similar: value.similar || [],
      mean: value.mean || []
    }
  } catch (err) {
    console.error(err)
    saveMessage.value = '加载失败：' + err.message
  }
  finally {
    isLoading.value = false
  }
}

// 保存
const saveData = async () => {
  isSaving.value = true
  saveMessage.value = ''
  try {
    const payload = {
      ...UpdateData.value,
      id: isNew.value ? null : UpdateData.value.id
    }

    const res = await fetch(`/api/edit/ciyu/submit/${dialect.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(`HTTP错误: ${res.status}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.message || '保存失败')
    saveMessage.value = '保存成功！'
  } catch (err) {
    console.error(err)
    saveMessage.value = '保存失败：' + err.message
  }
  finally {
    isSaving.value = false
  }
}

// 数组操作
const addArrayItem = (array, template = {}) => array.push({...template})
const removeArrayItem = (array, index) => array.splice(index, 1)

// 新增 variantPy
const addVariantPyItem = (idx) => {
  if (!UpdateData.value.variantPy[idx]) {
    UpdateData.value.variantPy[idx] = []
  }
  UpdateData.value.variantPy[idx].push({left: '', right: {sc: '', tc: ''}})
  if (!UpdateData.value.mainPy[idx]) UpdateData.value.mainPy[idx] = ''
}

// 初始化
onMounted(() => {
  if (!isNew.value) loadCiyu(id)
  else {
    // 新建词条：每个字至少有一个空拼音对象
    const chars = UpdateData.value.ciyu.sc.split('')
    UpdateData.value.mainPy = chars.map(() => '')
    UpdateData.value.variantPy = chars.map(() => [{left: '', right: {sc: '', tc: ''}}])
  }
})
</script>

<template>
  <div class="edit-page">

    <div class="nav-buttons">
      <BackButton buttonText="返回（不保存）" size="small"/>
      <button @click="saveData" :disabled="isSaving" class="dev-add-btn dev-btn-small">
        {{ isSaving ? '保存中...' : isNew ? '保存新增' : '保存修改' }}
      </button>
    </div>

    <div v-if="saveMessage" class="save-message" :class="{ error: saveMessage.includes('失败') }">
      {{ saveMessage }}
    </div>

    <LoadingIcon v-if="isLoading" :show-text="true"/>

    <div v-else class="edit-form">

      <!-- 繁简字 & special -->
      <div class="form-section">
        <div class="form-grid">
          <div class="form-field">
            <label>繁體字和简体字</label>
            <ScAndTcText
                v-model:traditionalText="UpdateData.ciyu.tc"
                v-model:simplifiedText="UpdateData.ciyu.sc"
                :layout="'small'" :dialect="dialect.toString()"
            />
          </div>
          <div class="form-field">
            <label>特殊标记</label>
            <select v-model="UpdateData.special" class="short-input">
              <option value="0">普通词语</option>
              <option value="1">特殊词语</option>
              <option value="2">固定用法</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 拼音 -->
      <div class="form-section">
        <div class="section-header">
          <h3>拼音</h3>
        </div>

        <!-- 遍历每个汉字 -->
        <div v-for="(char, idx) in Array.from(UpdateData.ciyu.sc)" :key="idx" class="char-pinyin-section">

          <!-- 主拼音选择 -->
          <div class="main-pinyin-selector">
            <span class="selector-label">{{ char }}：主拼音：</span>
            <div class="radio-group">
              <label v-for="(pyObj, i) in UpdateData.variantPy[idx]" :key="i">
                <input type="radio"
                       :name="'mainPy-' + idx"
                       :value="pyObj.left"
                       v-model="UpdateData.mainPy[idx]"/>
                {{ pyObj.left }}
              </label>
            </div>
          </div>

          <!-- 可拖拽拼音列表 -->
          <DraggableList
              v-model="UpdateData.variantPy[idx]"
              :createItem="() => ({ left: '', right: { sc: '', tc: '' } })"
          >
            <template #default="{ item, index }">
              <div class="draggable-item">
                <PinyinProofreadText v-model="item.left" class="short-input"/>
                <ScAndTcText
                    v-model:traditionalText="item.right.tc"
                    v-model:simplifiedText="item.right.sc"
                    :layout="'large'"
                    :dialect="dialect.toString()"
                />
              </div>
            </template>
          </DraggableList>

        </div>
      </div>

      <!-- 相似词语 -->
      <div class="form-section">
        <div class="section-header">
          <h3>相似词语</h3>
          <button class="dev-add-btn"
                  @click="addArrayItem(UpdateData.similar, { id: null, text: { sc: '', tc: '' }, type: '1' })">
            添加
          </button>
        </div>
        <div v-for="(item, index) in UpdateData.similar" :key="index" class="array-item complex-item">
          <ScAndTcText v-model:traditionalText="item.text.tc" v-model:simplifiedText="item.text.sc"
                       :layout="'small'" :dialect="dialect.toString()"/>
          <select v-model="item.type" class="short-input">
            <option value="1">仅展示</option>
            <option value="2">不展示</option>
            <option value="3">错误写法</option>
          </select>
          <button @click="removeArrayItem(UpdateData.similar, index)" class="dev-remove-btn dev-btn-small">刪除</button>
        </div>
      </div>

      <!-- 含义 -->
      <div class="form-section">
        <div class="section-header">
          <h3>含义</h3>
          <button class="dev-add-btn" @click="addArrayItem(UpdateData.mean, { sc: '', tc: '' })">添加</button>
        </div>
        <div v-for="(item, index) in UpdateData.mean" :key="index" class="array-item complex-item">
          <ScAndTcText v-model:traditionalText="item.tc" v-model:simplifiedText="item.sc"
                       :layout="'large'" :dialect="dialect.toString()"/>
          <button @click="removeArrayItem(UpdateData.mean, index)" class="dev-remove-btn">刪除</button>
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

.short-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 120px;
  min-width: 120px;
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

.drag-handle {
  cursor: move;
  padding: 4px 8px;
  color: #666;
  user-select: none;
}

.complex-item {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

button {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
</style>