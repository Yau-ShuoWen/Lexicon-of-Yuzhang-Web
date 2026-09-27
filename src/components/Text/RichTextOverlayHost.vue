<script setup>
import NotePopup from './NotePopup.vue'
import PinyinPopup from './PinyinPopup.vue'
</script>

<template>
  <!-- 富文本字符串只产生触发标记；所有交互浮层在这里由 Vue 统一管理。 -->
  <NotePopup />
  <PinyinPopup />
</template>
