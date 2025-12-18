<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '请选择词典'
  },
  width: {
    type: String,
    default: '200px'
  },
  showLabel: {
    type: Boolean,
    default: true
  },
  labelText: {
    type: String,
    default: '词典选择'
  },
  required: {
    type: Boolean,
    default: true
  },
  cacheKey: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'change', 'loaded', 'error'])

// 响应式数据
const dictionaries = ref([])
const loading = ref(false)
const selectedDictionaryName = ref('')

// 计算属性：选中的词典信息
const selectedDictionary = computed(() => {
  return dictionaries.value.find(dict => dict.right === props.modelValue) || null
})

// 缓存管理 - 只有 cacheKey 存在时才启用
const cacheManager = {
  isEnabled: computed(() => !!props.cacheKey),

  get: () => {
    if (!props.cacheKey) return null
    try {
      const cached = localStorage.getItem(props.cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (e) {
      console.error('读取缓存失败:', e)
      return null
    }
  },

  set: (code, name) => {
    if (!props.cacheKey) return
    try {
      localStorage.setItem(props.cacheKey, JSON.stringify({code, name}))
    } catch (e) {
      console.error('保存缓存失败:', e)
    }
  },

  clear: () => {
    if (!props.cacheKey) return
    localStorage.removeItem(props.cacheKey)
  }
}

// API响应调试辅助函数
const debugAPIResponse = async (response) => {
  const text = await response.text()
  try {
    const parsed = JSON.parse(text)
    return parsed
  } catch (e) {
    console.error('API响应JSON解析失败:', e)
    throw new Error(`响应不是有效的JSON: ${text}`)
  }
}

// 处理词典数据格式
const processDictionaries = (data) => {
  if (!data || !Array.isArray(data)) return []

  return data.map(item => {
    if (item.left !== undefined && item.right !== undefined) {
      return item
    } else if (item.name !== undefined && item.code !== undefined) {
      return {left: item.name, right: item.code}
    } else if (typeof item === 'string') {
      return {left: item, right: item}
    } else {
      return {left: '未知', right: 'unknown'}
    }
  })
}

// 加载词典列表
const loadDictionaries = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/refer/get-dictionaries/nam')
    const apiResponse = await debugAPIResponse(response)

    let data = []
    if (apiResponse.success !== undefined) {
      if (!apiResponse.success) {
        throw new Error(apiResponse.message || '获取字典列表失败')
      }
      data = apiResponse.data || []
    } else if (Array.isArray(apiResponse)) {
      data = apiResponse
    } else {
      throw new Error(`未知的API响应格式: ${JSON.stringify(apiResponse)}`)
    }

    dictionaries.value = processDictionaries(data)

    if (dictionaries.value.length > 0) {
      // 1. 先检查是否有缓存（仅在启用缓存时）
      if (cacheManager.isEnabled.value) {
        const cached = cacheManager.get()
        if (cached) {
          // 有缓存数据，尝试匹配
          const cachedDict = dictionaries.value.find(dict => dict.right === cached.code)
          if (cachedDict) {
            // 找到缓存的词典，更新选择
            emit('update:modelValue', cachedDict.right)
            selectedDictionaryName.value = cachedDict.left
            ElMessage.success(`已从缓存恢复词典: ${cachedDict.left}`)
          }
        }
      }

      // 2. 如果没有从缓存恢复，检查是否有父组件传入的默认值
      if (!props.modelValue) {
        // 既没有缓存也没有默认值，保持空白，不做默认选择
        // 注意：这里我们什么都不做，让选择框保持空白
      } else {
        // 有父组件传入的默认值，检查是否在列表中
        const defaultDict = dictionaries.value.find(dict => dict.right === props.modelValue)
        if (defaultDict) {
          selectedDictionaryName.value = defaultDict.left
        }
      }

      // 3. 发送加载完成事件
      emit('loaded', {
        dictionaries: dictionaries.value,
        hasCache: cacheManager.isEnabled.value ? !!cacheManager.get() : false,
        hasSelection: !!props.modelValue
      })
    } else {
      ElMessage.warning('没有可用的词典')
      emit('loaded', {
        dictionaries: [],
        hasCache: false,
        hasSelection: false
      })
    }
  } catch (error) {
    const errorMessage = `获取词典列表失败: ${error.message}`
    ElMessage.error(errorMessage)
    emit('error', error)
  } finally {
    loading.value = false
  }
}

// 处理词典选择变化
const handleDictionaryChange = (selectedCode) => {
  const selectedDict = dictionaries.value.find(dict => dict.right === selectedCode)
  if (selectedDict) {
    selectedDictionaryName.value = selectedDict.left

    // 仅在启用缓存时保存选择
    if (cacheManager.isEnabled.value) {
      cacheManager.set(selectedDict.right, selectedDict.left)
    }

    // 触发事件
    emit('change', {
      code: selectedDict.right,
      name: selectedDict.left,
      usedCache: cacheManager.isEnabled.value
    })

    ElMessage.success(`已选择词典: ${selectedDict.left}`)
  }
}

// 清除当前选择的缓存
const clearCurrentCache = () => {
  if (cacheManager.isEnabled.value) {
    cacheManager.clear()
    ElMessage.success('已清除词典缓存')
  } else {
    ElMessage.warning('未启用缓存功能，无法清除')
  }
}

// 重新加载词典列表
const refreshDictionaries = async () => {
  await loadDictionaries()
  ElMessage.success('词典列表已刷新')
}

// 暴露给父组件的方法
defineExpose({
  dictionaries,
  selectedDictionaryName,
  isCacheEnabled: cacheManager.isEnabled,
  loadDictionaries: refreshDictionaries,
  clearCache: clearCurrentCache,
  refreshDictionaries,
  // 获取当前缓存状态
  getCacheState: () => {
    return {
      enabled: cacheManager.isEnabled.value,
      data: cacheManager.isEnabled.value ? cacheManager.get() : null
    }
  }
})

// 监听 modelValue 变化
watch(() => props.modelValue, (newValue) => {
  if (newValue && dictionaries.value.length > 0) {
    const dict = dictionaries.value.find(d => d.right === newValue)
    if (dict) {
      selectedDictionaryName.value = dict.left
    }
  } else {
    selectedDictionaryName.value = ''
  }
})

// 组件挂载时加载词典
onMounted(() => {
  loadDictionaries()
})
</script>

<template>
  <div class="dict-select">
    <el-form-item
        v-if="showLabel"
        :label="labelText"
        :required="required"
    >
      <el-select
          :model-value="modelValue"
          @update:model-value="value => $emit('update:modelValue', value)"
          :placeholder="placeholder"
          :style="{ width }"
          @change="handleDictionaryChange"
          :loading="loading"
          :disabled="loading || dictionaries.length === 0"
          clearable
      >
        <el-option
            v-for="dict in dictionaries"
            :key="dict.right"
            :label="dict.left"
            :value="dict.right"
        />
      </el-select>

    </el-form-item>

    <el-select
        v-else
        :model-value="modelValue"
        @update:model-value="value => $emit('update:modelValue', value)"
        :placeholder="placeholder"
        :style="{ width }"
        @change="handleDictionaryChange"
        :loading="loading"
        :disabled="loading || dictionaries.length === 0"
        clearable
    >
      <el-option
          v-for="dict in dictionaries"
          :key="dict.right"
          :label="dict.left"
          :value="dict.right"
      />
    </el-select>
  </div>
</template>

<style scoped>
.dict-select {
  display: inline-block;
  position: relative;
}

.cache-indicator {
  margin-left: 8px;
  font-size: 14px;
  opacity: 0.6;
  cursor: help;
  vertical-align: middle;
}

.dict-select :deep(.el-select) {
  width: 100%;
}
</style>