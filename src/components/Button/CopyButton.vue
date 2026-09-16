<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showError, showSuccess } from "../../services/ToastService.js";

const { t } = useI18n()

const props = defineProps({
  text: {type: String, required: true},
  hint: {type: String, default: ''},
})

const copied = ref(false)
const displayHint = computed(() => props.hint || t('common.copy'))

const copyText = async () => {
  try {
    await navigator.clipboard.writeText(props.text)
    copied.value = true

    setTimeout(() => {
      copied.value = false
    }, 1500)
    showSuccess(t('common.copy_success'))
  } catch (err) {
    console.error('複製失敗:', err)
    showError(t('common.copy_failed'))
  }
}
</script>

<template>
  <button @click="copyText" v-formatted-text="displayHint"/>
</template>
