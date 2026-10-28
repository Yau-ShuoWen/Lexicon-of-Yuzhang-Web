<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { request } from '../../services/request.js'

const props = defineProps({
  modelValue: {type: String, required: true},
  outputValue: {type: String}, // 只為了 v-model 語法存在
  language: {type: String, required: true},
  dialect: {type: String, required: true},
  allPinyin: {type: Boolean, default: false},
  dict: {type: String, default: null},
  copyable: {type: Boolean, default: false},
  plain: {type: Boolean, default: false}
})

const emit = defineEmits(['update:modelValue'])

const result = ref(props.modelValue)
const isValid = ref(true)
const resolved = ref(false)

let timer = null
let requestVersion = 0

// ⭐ 關鍵：只負責「往外輸出」，不接受外部控制
const outputValueProxy = computed({
  get: () => '', // 不使用 props.outputValue
  set: (val) => emit('update:outputValue', val)
})

// 构造发送内容
const buildText = (text) => {
  if (!props.allPinyin) return text;

  if (text.includes('\n'))
    return text.split('\n').map(line => `[${line.trim()}]`).join('\n')
  else
    return `[${text.trim()}]`
}

// 核心检查逻辑
const check = async (text, version) => {
  if (!text) {
    return
  }

  try {
    const params = new URLSearchParams()
    params.append('text', buildText(text))

    if (props.dict) params.append('dict', props.dict)


    const data = await request(
        `/api/proofread/check/${props.language}/${props.dialect}`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: params
        }
    )

    if (version !== requestVersion) return
    isValid.value = data.left
    result.value = data.right
    resolved.value = true
    outputValueProxy.value = result.value.replace(/[\[\]]/g, '')

  } catch (e) {
    if (version !== requestVersion) return
    console.error(e)
    isValid.value = false
    result.value = '{b 请求失败}'
    resolved.value = true
  }
}

// 监听外部输入变化
watch(
    () => [props.modelValue, props.language, props.dialect, props.dict, props.allPinyin],
    () => {
      const version = ++requestVersion
      const text = props.modelValue
      clearTimeout(timer)
      result.value = text
      resolved.value = false
      if (text.trim()) timer = setTimeout(() => check(text, version), 400)
    },
    {immediate: true, flush: 'sync'}
)
onUnmounted(() => {
  requestVersion++
  clearTimeout(timer)
})
</script>

<template>
  <div
      v-if="result"
      class="result"
      :class="plain ? 'plain' : (!resolved ? 'pending' : (isValid ? 'valid' : 'invalid'))"
      v-formatted-text="result"
  ></div>
</template>

<style scoped>
.result {
  padding: 5px 20px;
  border-radius: 6px;
  min-height: 10px;
  transition: 0.2s;
  margin: 5px 0 5px 0;
}

.valid {
  background-color: white;
  border: 1px solid #39cd51;
}

.pending {
  background-color: white;
  border: 1px solid transparent;
}

.invalid {
  background-color: #fff1f0;
  border: 2px solid #bc4c47;
}

.plain {
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
}
</style>
