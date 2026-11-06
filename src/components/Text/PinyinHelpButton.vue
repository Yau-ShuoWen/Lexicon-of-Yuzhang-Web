<script setup>
import { ref } from 'vue'
import UnifiedModal from '../Window/UnifiedModal.vue'
import questionIcon from '../../assets/icons/pinyin/question.svg'

const visible = ref(false)
</script>

<template>
  <button class="pinyin-help-button" type="button" aria-label="拼音说明" title="拼音说明" @click="visible = true">
    <img :src="questionIcon" alt="" aria-hidden="true">
  </button>
  <UnifiedModal v-model="visible" title="拼音说明" size="small" :backdrop-blur="false" />
</template>

<style scoped>
.pinyin-help-button{display:inline-grid;place-items:center;flex:0 0 auto;width:30px;height:30px;padding:4px;border:0;border-radius:50%;background:transparent;cursor:pointer}
.pinyin-help-button img{display:block;width:22px;height:22px}
.pinyin-help-button:hover{background:#edf5e8}
.pinyin-help-button:focus-visible{outline:2px solid #1e5721;outline-offset:2px}
</style>
