<!-- CiyuEditor.vue -->

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingIcon from "../../../components/Status/LoadingIcon.vue";
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import DraggableList from "../../../components/Layout/DraggableList.vue";
import { showError, showSuccess } from "../../../services/ToastService.js";
import RichText from "../../../components/Text/RichText.vue";

// 路由
const route = useRoute()
const router = useRouter()
const id = route.params.id

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

// 数据
const updateData = ref({
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
    updateData.value = {
      id: value.id,
      ciyu: value.ciyu,
      special: value.special,
      mainPy: value.mainPy,
      variantPy: value.variantPy,
      similar: value.similar,
      mean: value.mean
    }
  } catch (err) {
    console.error(err)
    showError('加载失败：' + err.message)
  }
  finally {
    isLoading.value = false
  }
}

// 保存
const saveData = async () => {
  isSaving.value = true

  try {
    const payload = {
      ...updateData.value,
      id: isNew.value ? null : updateData.value.id
    }

    const response = await fetch(`/api/edit/ciyu/submit/${dialect.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    })

    const json = await response.json().catch(() => null)

    if (!response.ok) throw new Error(json?.message || `HTTP错误: ${response.status}`)
    if (!json.success) throw new Error(json.message || '保存失败')

    showSuccess('保存成功！')

  } catch (err) {
    showError(err.message)
    console.error(err)
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
  if (!updateData.value.variantPy[idx]) {
    updateData.value.variantPy[idx] = []
  }
  updateData.value.variantPy[idx].push({left: '', right: {sc: '', tc: ''}})
  if (!updateData.value.mainPy[idx]) updateData.value.mainPy[idx] = ''
}

// 初始化
onMounted(() => {
  if (!isNew.value) loadCiyu(id)
  else {
    // 新建词条：每个字至少有一个空拼音对象
    const chars = updateData.value.ciyu.sc.split('')
    updateData.value.mainPy = chars.map(() => '')
    updateData.value.variantPy = chars.map(() => [{left: '', right: {sc: '', tc: ''}}])
  }
})
</script>

<template>
  <div class="edit-page">

    <div class="nav-buttons">
      <button @click="saveData" :disabled="isSaving" class="dev-add-btn dev-btn-small">
        {{ isSaving ? '保存中...' : isNew ? '保存新增' : '保存修改' }}
      </button>
    </div>


    <LoadingIcon v-if="isLoading" :show-text="true"/>

    <div v-else class="edit-form">


      <!-- 繁简字 & special -->
      <div class="form-section">
        <div class="form-grid">
          <div class="form-field">
            <h4>繁體：{{ updateData.ciyu.tc }}</h4>
            <h4>簡體：{{ updateData.ciyu.sc }}</h4>
          </div>
          <div class="form-field">
            <label>特殊标记</label>
            <select v-model="updateData.special" class="short-input">
              <option value="0">普通詞語</option>
              <option value="1">特殊詞語</option>
              <option value="2">固定用法</option>
              <option value="4">百科</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>拼音</h3>
        <div class="array-item">
          <input class="form-control small-middle-input" type="text" v-model="updateData.mainPy">
          <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="true"
                    :model-value="updateData.mainPy.toString()"/>
        </div>

        <h3>拼音說明</h3>
        <DraggableList
            v-model="updateData.variantPy"
            :createItem="() => ({ text: { sc: '', tc: '' }})"
        >
          <template #default="{ item, index }">
            <div class="array-item complex-item">

              <ScAndTcText v-model:traditionalText="item.text.tc" v-model:simplifiedText="item.text.sc"
                           :layout="'large'" :dialect="dialect.toString()"/>

            </div>
          </template>
        </DraggableList>
      </div>

      <!-- 相似词语 -->
      <div class="form-section">
        <div class="section-header">
          <h3>相似词语</h3>
          <button class="dev-add-btn"
                  @click="addArrayItem(updateData.similar, { id: null, text: { sc: '', tc: '' }, type: '1' })">
            添加
          </button>
        </div>
        <DraggableList
            v-model="updateData.similar"
            :createItem="() => ({ text: { sc: '', tc: '' }})"
        >
          <template #default="{ item, index }">
            <div class="array-item">

              <select v-model="item.type" class="short-input">
                <option value="1">同義詞</option>
                <option value="2">不展示</option>
                <option value="3">错误写法</option>
              </select>
              <ScAndTcText v-model:traditionalText="item.text.tc" v-model:simplifiedText="item.text.sc"
                           :layout="'small'" :dialect="dialect.toString()"/>

            </div>
          </template>
        </DraggableList>
      </div>

      <div class="form-section">
        <h3>含義</h3>
        <DraggableList v-model="updateData.mean" :createItem="() => ({ sc: '', tc: '' })">
          <template #default="{ item, index }">

            <ScAndTcText v-model:traditionalText="item.tc" v-model:simplifiedText="item.sc"
                         :layout="'large'" :dialect="dialect.toString()"/>

          </template>
        </DraggableList>
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