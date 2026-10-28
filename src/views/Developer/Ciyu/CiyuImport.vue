<script setup>
import CiyuCreator from './CiyuCreator.vue'
</script>

<template>
  <main class="ciyu-import">
    <h1>导入词语</h1>
    <CiyuCreator />
  </main>
</template>

<style scoped>
.ciyu-import { max-width: 1080px; margin: 0 auto; padding: 28px 20px 60px; }
.ciyu-import h1 { margin: 0 0 24px; color: var(--color-text); font-size: clamp(1.7rem, 3vw, 2.1rem); }
.ciyu-import :deep(.middle-layout) { padding: 0; }
</style>
