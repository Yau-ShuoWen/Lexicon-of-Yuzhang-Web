<script setup>
import { ref } from 'vue'
import { showError, showSuccess } from "../../services/ToastService.js";

const props = defineProps({
  text: {type: String, required: true},
  hint: {type: String, default: '複製'},
})

const copied = ref(false)

const copyText = async () => {
  try {
    await navigator.clipboard.writeText(props.text)
    copied.value = true

    setTimeout(() => {
      copied.value = false
    }, 1500)
    showSuccess("複製成功")
  } catch (err) {
    console.error('複製失敗:', err)
    showError("複製失敗")
  }
}
</script>

<template>
  <button @click="copyText">{{hint}}</button>
</template>