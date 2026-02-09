<script setup>
import {ref, watch, computed} from 'vue'
import {ElMessage} from 'element-plus'

/* =======================
   Props & Emits
======================= */
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  dialect: {
    type: String,
    required: true
  },
  cacheKey: {
    type: String,
    default: 'dict-select'
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
  }
})

const emit = defineEmits(['update:modelValue', 'change', 'loaded', 'error'])

/* =======================
   State
======================= */
const dictionaries = ref([])
const loading = ref(false)
const selectedDictionaryName = ref('')

/* =======================
   Cache (按 dialect 隔离)
======================= */
const useCache = (key) => {
  if (!key) {
    return {
      enabled: false,
      get: () => null,
      set: () => {
      },
      clear: () => {
      }
    }
  }

  return {
    enabled: true,
    get: () => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    set: (value) => {
      try {
        localStorage.setItem(key, value)
      } catch {
      }
    },
    clear: () => {
      localStorage.removeItem(key)
    }
  }
}

const cache = computed(() =>
    useCache(
        props.cacheKey
            ? `${props.cacheKey}:${props.dialect}`
            : ''
    )
)

/* =======================
   Utils
======================= */
const processDictionaries = (data) => {
  if (!Array.isArray(data)) return []

  return data.map(item => {
    if (item.left !== undefined && item.right !== undefined) {
      return item
    }
    if (item.name !== undefined && item.code !== undefined) {
      return {left: item.name, right: item.code}
    }
    if (typeof item === 'string') {
      return {left: item, right: item}
    }
    return {left: '未知', right: 'unknown'}
  })
}


const getApiUrl = () => `/api/ref/get-dictionaries/${props.dialect}`

/* =======================
   Load
======================= */
const restoreFromCache = () => {
  if (!cache.value.enabled) return false

  const cachedCode = cache.value.get()
  if (!cachedCode) return false

  const dict = dictionaries.value.find(d => d.right === cachedCode)
  if (!dict) return false

  emit('update:modelValue', dict.right)
  selectedDictionaryName.value = dict.left
  return true
}

const loadDictionaries = async () => {
  if (!props.dialect) return

  loading.value = true
  try {
    const response = await fetch(getApiUrl())
    const result = await response.json()

    const data = result?.success === false
        ? []
        : result?.data ?? result

    dictionaries.value = processDictionaries(data)

    if (dictionaries.value.length) {
      if (!restoreFromCache() && props.modelValue) {
        const dict = dictionaries.value.find(d => d.right === props.modelValue)
        if (dict) selectedDictionaryName.value = dict.left
      }
    }

    emit('loaded', {
      dictionaries: dictionaries.value,
      dialect: props.dialect,
      hasCache: !!cache.value.get(),
      hasSelection: !!props.modelValue
    })

    //console.log("获得数据"+result.dictionaries.value)
  } catch (err) {

    console.log('获取词典失败' + err)
    emit('error', err)
  } finally {
    loading.value = false
  }
}

/* =======================
   Events
======================= */
const handleDictionaryChange = (code) => {
  const dict = dictionaries.value.find(d => d.right === code)
  if (!dict) return

  selectedDictionaryName.value = dict.left

  if (cache.value.enabled) {
    cache.value.set(dict.right)
  }

  emit('change', {
    code: dict.right,
    name: dict.left,
    dialect: props.dialect,
    usedCache: cache.value.enabled
  })
}

/* =======================
   Watchers
======================= */
watch(
    () => props.dialect,
    () => {
      dictionaries.value = []
      selectedDictionaryName.value = ''
      emit('update:modelValue', '')
      loadDictionaries()
    },
    {immediate: true}
)

watch(
    () => props.modelValue,
    (val) => {
      const dict = dictionaries.value.find(d => d.right === val)
      selectedDictionaryName.value = dict ? dict.left : ''
    }
)

/* =======================
   Expose
======================= */
defineExpose({
  dictionaries,
  selectedDictionaryName,
  clearCache: () => cache.value.clear(),
  isCacheEnabled: computed(() => cache.value.enabled),
  refreshDictionaries: loadDictionaries,
  getCacheState: () => ({
    enabled: cache.value.enabled,
    value: cache.value.get()
  })
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
          @update:model-value="v => $emit('update:modelValue', v)"
          :placeholder="placeholder"
          :style="{ width }"
          :loading="loading"
          :disabled="loading || !dictionaries.length"
          clearable
          @change="handleDictionaryChange"
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
        @update:model-value="v => $emit('update:modelValue', v)"
        :placeholder="placeholder"
        :style="{ width }"
        :loading="loading"
        :disabled="loading || !dictionaries.length"
        clearable
        @change="handleDictionaryChange"
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
}

.dict-select :deep(.el-select) {
  width: 100%;
}
</style>
