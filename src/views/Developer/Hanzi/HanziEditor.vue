<!--HanziEditor.vue-->

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (id) => `/${language.value}/${dialect.value}/hanzi-editor/${id}`

const updateData = ref({
  id: null,
  hanzi: {sc: '', tc: ''},
  mainPy: '',
  special: 0,
  similar: [],
  variantPy: [],
  mandarin: [],
  note: [],
  status: 1
})

const prevId = ref(null)   // 前一个的编号
const nextId = ref(null)       // 后一个的编号
const mandarinOptions = ref([])// 普通话读音的选择
const isLoading = ref(false)
const isSaving = ref(false)

const originalMandarin = ref([])        // 保存从后端加载的原始 mandarin 数据

const tagOptions = [
  {sc: "待定", tc: "待定"},
  {sc: "文读", tc: "文讀"},
  {sc: "白读", tc: "白讀"},
  {sc: "老派", tc: "老派"},
  {sc: "新派", tc: "新派"},
  {sc: "普化音", tc: "普化音"},
  {sc: "理论读音", tc: "理論讀音"},
  {sc: "连读音", tc: "連讀音"},
  {sc: "语流音变", tc: "語流音變"}
]

// 方法：加载汉字详情
const loadHanzi = async (id) => {

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
    updateData.value = data // 转换数据格式以匹配前端界面
    await loadMandarinOptions()                     // 加载详情后自动加载普通话选项并设置选中状态
    await loadNearBy(id)
  } catch (error) {
    console.error('加载汉字详情失败:', error)
    showError('加载失败：' + err.message)
  }
  finally {
    isLoading.value = false
  }
}

// 找到上一个和下一个词条
const loadNearBy = async (id) => {
  try {
    const res = await fetch(`/api/edit/hanzi/get-nearby/${dialect.value}?id=${id}`)
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
  try {
    const response = await fetch(`/api/edit/hanzi/get-mandarin/${dialect.value}?sc=${updateData.value.hanzi.sc}&tc=${updateData.value.hanzi.tc}`)
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
  updateData.value.mandarin = selectedItems
}

// 切换到其他词条，清空保存的结果
const shiftToOther = async (newId) => {
  await router.replace(getPath(`${newId}`))
}

// 方法：保存数据
const saveData = async () => {
  isSaving.value = true

  try {
    // 转换数据格式以匹配后端
    const backendData = updateData.value

    console.log('准备保存的数据:', JSON.stringify(backendData, null, 2))

    const response = await fetch(`/api/edit/hanzi/submit/${dialect.value}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json',},
      body: JSON.stringify(backendData)
    })
    const json = await response.json().catch(() => null)

    if (!response.ok) throw new Error(json?.message || `HTTP错误: ${response.status}`)
    if (!json.success) throw new Error(json.message || '保存失败')

    showSuccess('保存成功！')
  } catch (error) {
    showError(error.message)
    console.error('保存失败:', error)
  }
  finally {
    isSaving.value = false
  }
}

watch(
    [() => updateData.value.hanzi.sc, () => updateData.value.hanzi.tc],
    () => {
      if (updateData.value.hanzi.sc && updateData.value.hanzi.tc) loadMandarinOptions()
    }
)

// 监听路由变化，当ID变化时重新加载数据
watch(() => route.params.id, (newId) => {
  if (newId) loadHanzi(newId)
})

watch(
    () => updateData.value.variantPy.map(item => item.pinyin?.trim()),
    (newList) => {
      const validList = newList.filter(p => p)

      const current = updateData.value.mainPy?.trim()

      // 当前 mainPy 仍然有效 → 不动
      if (current && validList.includes(current)) return

      // 自动修正 mainPy
      if (validList.length > 0) updateData.value.mainPy = validList[0]
      else updateData.value.mainPy = ''
    },
    {deep: true, immediate: true}
)

// 初始化
onMounted(() => {
  loadHanzi(id)
})
</script>

<template>
  <div class="broaden-layout">

    <div class="nav-buttons">

      <button
          :disabled="!prevId"
          class="dev-nav-button dev-btn dev-btn-small"
          @click="shiftToOther(prevId)"
      >{{ prevId ? '上一条' : '第一条' }}
      </button>

      <button
          :disabled="!nextId"
          class="dev-nav-button dev-btn-small"
          @click="shiftToOther(nextId)"
      >{{ nextId ? '下一条' : '最后一条' }}
      </button>

      <button @click="saveData" :disabled="isSaving" class="dev-add-btn dev-btn-small">
        {{ isSaving ? '保存中...' : '保存修改' }}
      </button>
    </div>

    <LoadingIcon v-if="isLoading" :show-text="true"/>

    <div v-else class="edit-form">
      <div class="form-section">
        <div class="form-grid">

          <div class="form-field">
            <h4>繁體：{{ updateData.hanzi.tc }}</h4>
            <h4>簡體：{{ updateData.hanzi.sc }}</h4>
          </div>

          <div class="form-field">
            <label>特殊性標記</label>
            <select v-model="updateData.special" class="short-input">
              <option value="0">普通漢字</option>
              <option value="1">特殊方言字</option>
              <option value="2">罕見漢字</option>
              <option value="3">不使用漢字</option>
            </select>
          </div>

          <div class="form-field">
            <label>词条状态</label>
            <select v-model="updateData.status" class="short-input">

              <option value="1">刚刚创建词条</option>
              <option value="2">需要补充内容</option>
              <option value="3">基本完成</option>
              <option value="4">存疑</option>
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
            <div v-for="(item, index) in updateData.variantPy" :key="index" class="radio-item">
              <template v-if="item.pinyin && item.pinyin.trim()">
                <input type="radio" :id="'mainPy-' + index"
                    :name="'mainPyRadio'" :value="item.pinyin.trim()"
                    class="big-check" v-model="updateData.mainPy"
                />
                <label :for="'mainPy-' + index">{{ item.pinyin.trim() }}</label>
              </template>
            </div>
          </div>
        </div>

        <DraggableList
            v-model="updateData.variantPy"
            :createItem="() => ({tag: { sc: '待定', tc: '待定' },pinyin:'',sort: updateData.variantPy.length + 1})"
        >
          <template #default="{ item }">

            <div class="array-item">
              <span>{{ item.sort }}</span>

              <select
                  class="form-control small-input" :value="JSON.stringify(item.tag)"
                  @change="e => item.tag = JSON.parse(e.target.value)"
              >
                <option v-for="opt in tagOptions" :key="opt.sc" :value="JSON.stringify(opt)" v-text="opt.tc"/>
              </select>

              <input class="form-control small-input" type="text" v-model="item.pinyin">
              <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="true"
                        :model-value="item.pinyin"/>
            </div>
          </template>
        </DraggableList>
      </div>


      <div class="form-section">
        <h3>普通話讀音對應</h3>
        <div v-if="mandarinOptions.length > 0" class="checkbox-group">
          <div v-for="option in mandarinOptions" :key="option.info" class="checkbox-item">
            <input type="checkbox" :id="'mdr-' + option.info" :value="option"
                   v-model="updateData.mandarin" class="big-check"/>
            <label :for="'mdr-' + option.info" v-formatted-text="option.info"/>
          </div>
        </div>
        <div v-else class="no-results-low">
          {{ `${updateData.hanzi.sc} / ${updateData.hanzi.tc}:暫無對應讀音` }}
        </div>
      </div>

      <div class="form-section">
        <h3>相似漢字</h3>
        <DraggableList
            v-model="updateData.similar"
            :createItem="() => ({ text: { sc: '', tc: '' }})"
            :draggable="false"
        >
          <template #default="{ item, index }">
            <div class="array-item">

              <ScAndTcText v-model:traditionalText="item.text.tc" v-model:simplifiedText="item.text.sc"
                           :layout="'small'" :dialect="dialect.toString()"/>

            </div>
          </template>
        </DraggableList>
      </div>

      <div class="form-section">
        <h3>註釋</h3>
        <DraggableList
            v-model="updateData.note"
            :createItem="() => ({ left: { sc: '', tc: '' }, right: { sc: '', tc: '' }})"
        >
          <template #default="{ item, index }">
            <div class="array-item complex-item">

              <ScAndTcText v-model:traditionalText="item.left.tc" v-model:simplifiedText="item.left.sc"
                           :layout="'small'" :dialect="dialect.toString()"/>
              <ScAndTcText v-model:traditionalText="item.right.tc" v-model:simplifiedText="item.right.sc"
                           :layout="'large'" :dialect="dialect.toString()"/>

              <h4>预览</h4>
              <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                        :model-value="item.right.tc"/>
              <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                        :model-value="item.right.sc"/>
            </div>
          </template>
        </DraggableList>
      </div>
    </div>
  </div>
</template>

<style>
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

.array-item {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
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
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.big-check
{
  transform: scale(1.5);  /* 调整大小，比如 1.2 / 1.5 / 1.8 */
  margin-right: 6px;      /* 防止放大后贴太近 */
  cursor: pointer;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

</style>