<!-- App.vue -->

<script setup>
import { onMounted } from 'vue'
import MainNav from "./components/Layout/MainNav.vue"
import ConfirmWindow from "./components/Window/ConfirmWindow.vue"
import ToastWindow from "./components/Window/ToastWindow.vue";
import { initNoteTooltip } from "./utils/noteTooltip.js";
import { initPinyinBlock } from "./utils/pinyinBlock.js";

onMounted(() => {
  initNoteTooltip();
  initPinyinBlock();
});
</script>


<template>
  <div id="app">

    <!-- 主导航（含顶部渐隐遮罩），样式与逻辑在 MainNav.vue 内部 -->
    <MainNav/>

    <main class="page-container">
      <router-view/>
      <ConfirmWindow/>
      <ToastWindow/>
    </main>
  </div>
</template>

<style scoped/>
