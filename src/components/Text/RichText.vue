<template>
  <div
      v-if="result"
      class="result"
      :class="isValid ? 'valid' : 'invalid'"
      v-formatted-text="result"
  ></div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  language: { type: String, required: true },
  dialect: { type: String, required: true },
  allPinyin: { type: Boolean, default: false },
  dict: { type: String, default: null }
})

const emit = defineEmits(['update:modelValue'])

const result = ref('')
const isValid = ref(true)

let timer = null

// 构造发送内容
const buildText = () => {
  if (props.allPinyin) {
    return `[${props.modelValue.trim()}]`
  }
  return props.modelValue
}

// 核心检查逻辑
const check = async () => {
  const text = props.modelValue.trim()
  if (!text) {
    result.value = ''
    return
  }

  try {
    const params = new URLSearchParams()
    params.append('text', buildText())

    if (props.dict) params.append('dict', props.dict)


    const res = await fetch(
        `/api/proofread/check/${props.language}/${props.dialect}`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: params
        }
    )

    const data = await res.json()

    isValid.value = data.left
    result.value = data.right
  } catch (e) {
    console.error(e)
    isValid.value = false
    result.value = '{b 请求失败}'
  }
}

// 监听外部输入变化
watch(
    () => props.modelValue,
    () => {
      clearTimeout(timer)
      timer = setTimeout(check, 400)
    },
    {immediate: true}
)
</script>

<style scoped>
.result {
  padding: 5px 20px;
  border-radius: 6px;
  min-height: 10px;
  transition: 0.2s;
}

.valid {
  background-color: #e6ffed;
  border: 1px solid #39cd51;
}

.invalid {
  background-color: #fff1f0;
  border: 1px solid #bc4c47;
}
</style>