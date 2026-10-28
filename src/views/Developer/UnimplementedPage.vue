<script setup>
import { computed } from 'vue'
import { useHead } from '@vueuse/head'

const props = defineProps({ feature: { type: String, required: true } })
const labels = { 'rich-text-guide': '富文本使用方法', users: '用户信息', 'import-ciyu': '导入词语', examples: '编辑例句', support: '客服' }
const title = computed(() => labels[props.feature] || '未实现的功能')
useHead({ title })
</script>

<template>
  <div class="unimplemented-page">
    <h1>{{ title }}</h1>
    <p>此界面尚未实现。</p>
  </div>
</template>

<style scoped>
.unimplemented-page { max-width: 780px; margin: 0 auto; padding: 56px 24px; color: var(--color-text); }
.unimplemented-page h1 { margin: 0 0 16px; font-size: 28px; }
.unimplemented-page p { margin: 0; color: var(--color-text-light); }
</style>
