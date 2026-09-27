<!-- App.vue -->

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MainNav from "./components/Layout/MainNav.vue"
import ConfirmWindow from "./components/Window/ConfirmWindow.vue"
import ToastWindow from "./components/Window/ToastWindow.vue";
import RichTextOverlayHost from "./components/Text/RichTextOverlayHost.vue";
import { useSiteSeo } from "./utils/seo.js";

const route = useRoute()
const showMainNav = computed(() => route.meta?.hideNav !== true)

useSiteSeo(route)

</script>


<template>
  <div id="app">

    <!-- 主导航（含顶部渐隐遮罩），样式与逻辑在 MainNav.vue 内部 -->
    <MainNav v-if="showMainNav"/>

    <main class="page-container" :class="{'no-main-nav': !showMainNav}">
      <router-view/>
      <ConfirmWindow/>
      <ToastWindow/>
      <RichTextOverlayHost/>
    </main>
  </div>
</template>

<style scoped>
.page-container.no-main-nav {
  max-width: none;
  padding-top: 0;
}
</style>
