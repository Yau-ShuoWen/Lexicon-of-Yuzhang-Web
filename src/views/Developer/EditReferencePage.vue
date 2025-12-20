<!-- EditReferencePage.vue -->
<script setup>
import {ref, reactive, onMounted, computed} from 'vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import {Edit, Delete, Plus} from '@element-plus/icons-vue'
import DictSelect from '../../components/Select/DictSelect.vue'  // 导入 DictSelect 组件

// 响应式数据
const searchForm = reactive({keyword: '', dictionary: ''})
const searchResults = ref([])
const loading = ref(false)
const selectedCitiao = ref(null)
const citiaoContext = ref([])
const isEditing = ref(false)
const editForm = reactive({page: 1, content: ''})
const showAddInputAt = ref(-1)
const isAdding = ref(false)
const newCitiaoForm = reactive({content: '', page: 1})
const showSearchResults = ref(true)

// API响应调试
const debugAPIResponse = async (response) => {
  console.log('API响应状态:', response.status)
  console.log('API响应头:', Object.fromEntries(response.headers.entries()))
  const text = await response.text()
  console.log('API响应原始内容:', text)
  try {
    const parsed = JSON.parse(text)
    console.log('API响应解析后:', parsed)
    return parsed
  } catch (e) {
    console.error('API响应JSON解析失败:', e)
    throw new Error(`响应不是有效的JSON: ${text}`)
  }
}

// API调用方法（移除了 getDictionaries 方法）
const api = {
  async search(keyword, dict) {
    try {
      const response = await fetch(
          `/api/refer/search?keyword=${encodeURIComponent(keyword)}&dict=${encodeURIComponent(dict)}`
      )
      const apiResponse = await debugAPIResponse(response)
      if (apiResponse.success !== undefined) {
        if (!apiResponse.success) throw new Error(apiResponse.message || '搜索失败')
        return apiResponse.data || []
      } else if (Array.isArray(apiResponse)) {
        return apiResponse
      } else {
        throw new Error(`搜索API未知响应格式: ${JSON.stringify(apiResponse)}`)
      }
    } catch (error) {
      throw new Error(`搜索失败: ${error.message}`)
    }
  },

  async getContext(id, dict) {
    try {
      const response = await fetch(`/api/refer/context/${id}?dict=${encodeURIComponent(dict)}`)
      const apiResponse = await debugAPIResponse(response)
      if (apiResponse.success !== undefined) {
        if (!apiResponse.success) throw new Error(apiResponse.message || '获取上下文失败')
        return apiResponse.data || []
      } else if (Array.isArray(apiResponse)) {
        return apiResponse
      } else {
        throw new Error(`上下文API未知响应格式: ${JSON.stringify(apiResponse)}`)
      }
    } catch (error) {
      throw new Error(`获取上下文失败: ${error.message}`)
    }
  },

  async batchUpdate(left, right) {
    try {
      const updates = {left: left || [], right: right || []}
      const response = await fetch('/api/refer/batch-update', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates)
      })
      const apiResponse = await debugAPIResponse(response)
      if (!apiResponse.success) throw new Error(apiResponse.message || '批量更新失败')
      return apiResponse.data
    } catch (error) {
      throw new Error(`批量更新失败: ${error.message}`)
    }
  },

  async fullWidth(text) {
    const response = await fetch(`/api/transfer/full-width?s=${encodeURIComponent(text)}`)
    const result = await response.json()
    return result.text  // 直接返回 text 字段
  }
}

// 数据处理方法
const processSearchResults = (data) => {
  if (!data || !Array.isArray(data)) return []
  return data.map(item => {
    if (item.id !== undefined) {
      return {
        id: item.id,
        dictionary: item.dictionary,
        page: item.page,
        content: item.content,
        sort: item.sort,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    } else {
      return item
    }
  })
}

const buildCitiaoEdit = (citiao) => ({
  id: citiao.id || 0,
  dictionary: citiao.dictionary,
  page: citiao.page || 1,
  content: citiao.content?.toString() || '',
  sort: citiao.sort || ''
})

// 计算属性
const contextWithAddButtons = computed(() => {
  if (!citiaoContext.value.length) return []
  const result = [{type: 'content', data: citiaoContext.value[0], index: 0}]
  for (let i = 1; i < citiaoContext.value.length; i++) {
    result.push({type: 'add-button', index: i - 1})
    result.push({type: 'content', data: citiaoContext.value[i], index: i})
  }
  return result
})

const filteredResults = computed(() => {
  if (!searchForm.keyword.trim()) return searchResults.value
  const keyword = searchForm.keyword.toLowerCase()
  return searchResults.value.filter(
      item => item.content?.toString().toLowerCase().includes(keyword) || keyword.includes(item.page)
  )
})

// 核心业务方法（移除了 loadDictionaries 方法）
const handleDictionaryChange = (dictInfo) => {
  ElMessage.success(`已选择词典: ${dictInfo.name}`)
}

const handleSearch = async () => {
  if (!searchForm.keyword.trim()) return ElMessage.warning('请输入搜索关键词')
  if (!searchForm.dictionary) return ElMessage.warning('请选择词典')

  loading.value = true
  try {
    const data = await api.search(searchForm.keyword, searchForm.dictionary)
    const processedResults = processSearchResults(data)
    searchResults.value = processedResults
    showSearchResults.value = true
    selectedCitiao.value = null
    citiaoContext.value = []
    isEditing.value = false
    isAdding.value = false
    showAddInputAt.value = -1

    if (processedResults.length === 0) {
      ElMessage.info('未找到相关词条')
    } else {
      ElMessage.success(`找到 ${processedResults.length} 个相关词条`)
    }
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

const handleFullWidthConversion = async (field) => {
  try {
    let currentText = ''
    if (field === 'edit') {
      currentText = editForm.content
    } else if (field === 'add') {
      currentText = newCitiaoForm.content
    }

    if (!currentText.trim()) {
      ElMessage.warning('请输入要转换的文本')
      return
    }

    const convertedText = await api.fullWidth(currentText)

    if (field === 'edit') {
      editForm.content = convertedText
    } else if (field === 'add') {
      newCitiaoForm.content = convertedText
    }

    ElMessage.success('全角转换完成')
  } catch (error) {
    ElMessage.error('全角转换失败: ' + error.message)
  }
}

const handleClearSearch = () => {
  searchForm.keyword = ''
  searchResults.value = []
  selectedCitiao.value = null
  citiaoContext.value = []
  isEditing.value = false
  isAdding.value = false
  showAddInputAt.value = -1
  showSearchResults.value = true
}

const handleCitiaoClick = async (citiao) => {
  selectedCitiao.value = citiao
  isEditing.value = false
  isAdding.value = false
  showAddInputAt.value = -1
  showSearchResults.value = false
  editForm.page = citiao.page || 1
  editForm.content = citiao.content?.toString() || ''

  try {
    const data = await api.getContext(citiao.id, searchForm.dictionary)
    citiaoContext.value = processSearchResults(data)
  } catch (error) {
    ElMessage.error('获取上下文失败: ' + error.message)
  }
}

const handleContextCitiaoClick = async (citiao) => {
  await handleCitiaoClick(citiao)
}

const handleBackToSearch = () => {
  showSearchResults.value = true
  selectedCitiao.value = null
  citiaoContext.value = []
  isEditing.value = false
  isAdding.value = false
  showAddInputAt.value = -1
}

const handleEdit = () => {
  if (!selectedCitiao.value) return ElMessage.warning('请先选择要编辑的词条')
  isEditing.value = true
  isAdding.value = false
  showAddInputAt.value = -1
}

const handleCancelEdit = () => {
  if (selectedCitiao.value) {
    editForm.page = selectedCitiao.value.page || 1
    editForm.content = selectedCitiao.value.content?.toString() || ''
  }
  isEditing.value = false
}

const handleSave = async () => {
  if (!editForm.content.trim()) return ElMessage.warning('请输入词条内容')
  if (!selectedCitiao.value) return ElMessage.warning('没有选中的词条')

  try {
    const currentIndex = citiaoContext.value.findIndex(item => item.id === selectedCitiao.value.id)
    if (currentIndex === -1) throw new Error('无法找到当前词条在上下文中的位置')

    const previousItem = currentIndex > 0 ? citiaoContext.value[currentIndex - 1] : null
    const nextItem = currentIndex < citiaoContext.value.length - 1 ? citiaoContext.value[currentIndex + 1] : null

    const left = [], right = []
    if (previousItem) left.push(buildCitiaoEdit(previousItem))
    left.push(buildCitiaoEdit(selectedCitiao.value))
    if (nextItem) left.push(buildCitiaoEdit(nextItem))

    if (previousItem) right.push(buildCitiaoEdit(previousItem))
    right.push(buildCitiaoEdit({...selectedCitiao.value, page: editForm.page, content: editForm.content}))
    if (nextItem) right.push(buildCitiaoEdit(nextItem))

    await api.batchUpdate(left, right)
    ElMessage.success('更新成功')
    isEditing.value = false
    await handleCitiaoClick(selectedCitiao.value)
  } catch (error) {
    ElMessage.error('更新失败: ' + error.message)
  }
}

const handleDelete = async () => {
  if (!selectedCitiao.value) return ElMessage.warning('请先选择要删除的词条')

  try {
    await ElMessageBox.confirm('确定要删除这个词条吗？此操作不可恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })

    const currentIndex = citiaoContext.value.findIndex(item => item.id === selectedCitiao.value.id)
    if (currentIndex === -1) throw new Error('无法找到当前词条在上下文中的位置')

    const previousItem = currentIndex > 0 ? citiaoContext.value[currentIndex - 1] : null
    const nextItem = currentIndex < citiaoContext.value.length - 1 ? citiaoContext.value[currentIndex + 1] : null

    const left = [], right = []
    if (previousItem) left.push(buildCitiaoEdit(previousItem))
    left.push(buildCitiaoEdit(selectedCitiao.value))
    if (nextItem) left.push(buildCitiaoEdit(nextItem))

    if (previousItem) right.push(buildCitiaoEdit(previousItem))
    if (nextItem) right.push(buildCitiaoEdit(nextItem))

    await api.batchUpdate(left, right)
    ElMessage.success('删除成功')

    // 从搜索结果中移除被删除的词条
    searchResults.value = searchResults.value.filter(item => item.id !== selectedCitiao.value.id)

    // 从上下文中移除被删除的词条
    citiaoContext.value = citiaoContext.value.filter(item => item.id !== selectedCitiao.value.id)

    // 自动选择上一个或下一个词条
    let newSelectedCitiao = null
    if (previousItem) {
      // 优先选择上一个词条
      newSelectedCitiao = previousItem
    } else if (nextItem) {
      // 如果没有上一个，选择下一个词条
      newSelectedCitiao = nextItem
    }

    if (newSelectedCitiao) {
      // 选中新的词条
      selectedCitiao.value = newSelectedCitiao
      editForm.page = newSelectedCitiao.page || 1
      editForm.content = newSelectedCitiao.content?.toString() || ''

      // 如果上下文只剩一个词条，重新获取上下文
      if (citiaoContext.value.length === 1) {
        const data = await api.getContext(newSelectedCitiao.id, searchForm.dictionary)
        citiaoContext.value = processSearchResults(data)
      }
    } else {
      // 如果没有可选的词条（理论上不会发生），返回搜索结果
      handleBackToSearch()
    }
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('删除失败: ' + error.message)
  }
}

const handleShowAddInput = (index) => {
  showAddInputAt.value = index
  isAdding.value = true
  isEditing.value = false
  newCitiaoForm.content = ''
  newCitiaoForm.page = 1
}

const handleCancelAdd = () => {
  isAdding.value = false
  showAddInputAt.value = -1
  newCitiaoForm.content = ''
  newCitiaoForm.page = 1
}

const handleAddCitiao = async () => {
  if (!newCitiaoForm.content.trim()) return ElMessage.warning('请输入词条内容')
  if (!selectedCitiao.value) return ElMessage.warning('请先选择参考词条')
  if (showAddInputAt.value === -1) return ElMessage.error('无法确定插入位置')

  try {
    const previousItem = citiaoContext.value[showAddInputAt.value]
    const nextItem = citiaoContext.value[showAddInputAt.value + 1]
    if (!previousItem || !nextItem) return ElMessage.error('无法确定插入位置')

    const left = [buildCitiaoEdit(previousItem), buildCitiaoEdit(nextItem)]
    const newCitiao = {
      id: 0,
      dictionary: selectedCitiao.value.dictionary,
      page: newCitiaoForm.page,
      content: newCitiaoForm.content,
      sort: ''
    }
    const right = [
      buildCitiaoEdit(previousItem),
      buildCitiaoEdit(newCitiao),
      buildCitiaoEdit(nextItem)
    ]

    await api.batchUpdate(left, right)
    ElMessage.success('新增词条成功')
    isAdding.value = false
    showAddInputAt.value = -1

    // 重置新增表单
    const addedContent = newCitiaoForm.content
    const addedPage = newCitiaoForm.page
    newCitiaoForm.content = ''
    newCitiaoForm.page = 1

    // 重新获取上下文，以便获取新创建词条的完整信息（包括ID）
    const data = await api.getContext(selectedCitiao.value.id, searchForm.dictionary)
    citiaoContext.value = processSearchResults(data)

    // 在上下文中找到新创建的词条
    const addedCitiao = citiaoContext.value.find(item =>
        item.content === addedContent && item.page === addedPage
    )

    if (addedCitiao) {
      // 跳转到新创建的词条
      await handleCitiaoClick(addedCitiao)
    } else {
      // 如果找不到新创建的词条，刷新当前选中的词条
      await handleCitiaoClick(selectedCitiao.value)
    }
  } catch (error) {
    ElMessage.error('新增失败: ' + error.message)
  }
}

const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleString('sc') : '-'
</script>

<template>
  <div class="reference-page">
    <div class="search-section">
      <el-card>
        <template #header>
          <span class="card-header">
                {{ '尽量使用电脑版查看，否则屏幕空间不足' }}
          </span>
        </template>
        <el-form :model="searchForm" inline>
          <!-- 使用 DictSelect 组件替换原来的词典选择代码 -->
          <DictSelect
              v-model="searchForm.dictionary"
              :width="'200px'"
              :placeholder="'请选择词典'"
              :cache-key="'selectedDictionary'"
              @change="handleDictionaryChange"
          />

          <el-form-item label="搜索关键词" required>
            <el-input v-model="searchForm.keyword" placeholder="输入词条内容关键词" style="width: 300px"
                      @keyup.enter="handleSearch"
                      clearable @clear="handleClearSearch"/>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch" :loading="loading">
              {{ loading ? '搜索中...' : '搜索' }}
            </el-button>
            <el-button @click="handleClearSearch">清空</el-button>
            <el-button v-if="!showSearchResults && selectedCitiao" @click="handleBackToSearch" type="info">
              返回搜索结果
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <div class="search-results-section" v-if="showSearchResults">
      <el-card>
        <template #header>
          <span class="card-header">
            搜索结果 <span class="results-count">({{ filteredResults.length }})</span>
          </span>
        </template>
        <div class="results-list" v-loading="loading">
          <div v-for="item in filteredResults" :key="item.id"
               :class="['result-item', { active: selectedCitiao?.id === item.id }]"
               @click="handleCitiaoClick(item)">
            <div class="content-preview">{{ item.content?.toString() || '无内容' }}</div>
            <div class="item-meta">
              <span>页码: {{ item.page || '-' }}</span>
              <el-tag size="small" type="info">{{ item.dictionary || '-' }}</el-tag>
            </div>
          </div>
          <div v-if="!loading && searchResults.length === 0" class="empty-state">
            <el-empty description="暂无数据"/>
          </div>
        </div>
      </el-card>
    </div>

    <div class="detail-context-section" v-if="!showSearchResults && selectedCitiao">
      <div class="left-panel">
        <el-card class="context-card">
          <div class="context-list">
            <div v-for="(item, listIndex) in contextWithAddButtons" :key="`${item.type}-${item.index}`" :class="[
              'context-item',
              {
                current: item.type === 'content' && item.data.id === selectedCitiao.id,
                'add-button': item.type === 'add-button',
                'highlight-insert': item.type === 'add-button' && showAddInputAt.value === item.index
              }
            ]">
              <div v-if="item.type === 'content'" class="content-wrapper"
                   @click="handleContextCitiaoClick(item.data)"
                   :class="{ clickable: item.data.id !== selectedCitiao.id }">
                <div class="context-content">{{ item.data.content?.toString() || '无内容' }}</div>
                <div class="item-meta">
                  <span>页码: {{ item.data.page || '-' }}</span>
                </div>
              </div>
              <div v-else-if="item.type === 'add-button'" class="add-button-wrapper">
                <el-button type="primary" link class="add-btn" @click="handleShowAddInput(item.index)">
                  <el-icon>
                    <Plus/>
                  </el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <div class="right-panel">
        <el-card class="detail-card">
          <template #header>
            <div class="detail-header">
              <span class="card-header">
                {{ isAdding ? '新增词条' : isEditing ? '编辑词条' : '词条详情' }}
              </span>
              <div class="action-buttons" v-if="!isEditing && !isAdding">
                <el-button type="primary" :icon="Edit" size="small" @click="handleEdit">编辑</el-button>
                <el-button type="danger" :icon="Delete" size="small" @click="handleDelete">删除</el-button>
              </div>
              <div class="action-buttons" v-else-if="isEditing">
                <el-button type="primary" size="small" @click="handleSave">保存</el-button>
                <el-button size="small" @click="handleCancelEdit">取消</el-button>
              </div>
              <div class="action-buttons" v-else-if="isAdding">
                <el-button type="primary" size="small" @click="handleAddCitiao">确认添加</el-button>
                <el-button size="small" @click="handleCancelAdd">取消</el-button>
              </div>
            </div>
          </template>

          <div class="citiao-detail">
            <div v-if="isEditing" class="edit-form">
              <el-form :model="editForm" label-width="80px">
                <el-form-item label="页码" required>
                  <el-input-number v-model="editForm.page" :min="1" :max="9999" controls-position="right"/>
                </el-form-item>

                <el-form-item label="内容" required>
                  <el-input v-model="editForm.content" type="textarea" :rows="6" placeholder="请输入词条内容"
                            maxlength="1000"
                            show-word-limit/>
                </el-form-item>

                <el-button type="info" size="small" @click="handleFullWidthConversion('edit')"
                           style="align-self: flex-end;">
                  半角转全角
                </el-button>
              </el-form>
            </div>
            <div v-else-if="isAdding" class="edit-form">
              <el-form :model="newCitiaoForm" label-width="80px">
                <el-form-item label="页码" required>
                  <el-input-number v-model="newCitiaoForm.page" :min="1" :max="9999" controls-position="right"/>
                </el-form-item>
                <el-form-item label="内容" required>
                  <el-input v-model="newCitiaoForm.content" type="textarea" :rows="6" placeholder="请输入新词条内容"
                            maxlength="1000" show-word-limit/>
                </el-form-item>
              </el-form>
            </div>
            <div v-else>
              <div class="content-display">
                <h3 class="citiao-content">{{ selectedCitiao.content?.toString() || '无内容' }}</h3>
              </div>
              <div class="detail-meta">
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item label="页码">{{ selectedCitiao.page || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="创建时间">{{formatDate(selectedCitiao.createdAt) }}</el-descriptions-item>
                  <el-descriptions-item label="更新时间">{{formatDate(selectedCitiao.updatedAt) }}</el-descriptions-item>
                </el-descriptions>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reference-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  background-color: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.search-section {
  margin-bottom: 20px;
}

.search-results-section {
  margin-bottom: 20px;
}

.detail-context-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  min-height: 600px;
}

.left-panel,
.right-panel {
  display: flex;
  flex-direction: column;
}

.card-header {
  font-weight: 600;
  color: #303133;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.results-count {
  color: #909399;
  font-size: 14px;
  font-weight: normal;
  margin-left: 8px;
}

.results-list {
  max-height: 600px;
  overflow-y: auto;
  min-height: 200px;
}

.result-item {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.result-item:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
  transform: translateY(2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.result-item.active {
  border-color: #409eff;
  background-color: #ecf5ff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.content-preview {
  font-weight: 500;
  margin-bottom: 8px;
  color: #303133;
  line-height: 1.5;
  word-break: break-word;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #909399;
}

.empty-state {
  padding: 40px 0;
}

.detail-card,
.context-card {
  height: fit-content;
}

.citiao-detail {
  padding: 8px 0;
}

.edit-form {
  padding: 8px 0;
}

.content-display {
  margin-bottom: 20px;
}

.citiao-content {
  margin: 0 0 20px 0;
  color: #303133;
  font-size: 18px;
  line-height: 1.6;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #409eff;
  word-break: break-word;
}

.detail-meta {
  margin-top: 16px;
}

.context-list {
  max-height: 600px;
  overflow-y: auto;
}

.context-item {
  margin-bottom: 1px;
  transition: all 0.3s ease;
}

.context-item.current .content-wrapper {
  border-left-color: #409eff;
  background-color: #ecf5ff;
}

.content-wrapper {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-left: 4px solid #e4e7ed;
  background: white;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.content-wrapper.clickable {
  cursor: pointer;
}

.content-wrapper.clickable:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.context-content {
  margin-bottom: 8px;
  line-height: 1.5;
  word-break: break-word;
  color: #303133;
}

.add-button-wrapper {
  padding: 5px;
  border: 2px dashed #dcdfe6;
  border-radius: 4px;
  text-align: center;
  background: #fafafa;
  transition: all 0.3s ease;
  margin: 4px 0;
}

.add-button-wrapper:hover {
  border-color: #409eff;
  background: #f0f7ff;
}

.context-item.highlight-insert .add-button-wrapper {
  border-color: #409eff;
  background: #f0f7ff;
  border-style: solid;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0.4);
  }

  70% {
    box-shadow: 0 0 0 6px rgba(64, 158, 255, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0);
  }
}

.add-btn {
  width: 100%;
  height: 20px;
  font-size: 14px;
}
</style>