<template>


  <div class="slogan">
    <SloganText/>
  </div>


  <SearchInput/>

  <div class="logo">
    <img src="../assets/images/yuzhangci.svg" draggable="false"/>
  </div>

</template>

<script setup>
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import { useI18n } from 'vue-i18n'
import SearchInput from "./Search/SearchInput.vue"
import SloganText from "./SloganText.vue";
import { useHead } from '@vueuse/head'

const route = useRoute()
const {t} = useI18n()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

useHead({
  title: () => `${t('dialect_about.website_title.' + dialect.value)}`
})
</script>

<style scoped>
.slogan {
  padding-top: var(--spacing-xl);
  padding-bottom: var(--spacing-xl);
}

.logo {
  text-align: center;
}

.logo img {
  width: 240px;
  height: auto;
  pointer-events: none; /* 完全不接收點擊/觸控 */
  user-select: none; /* 不可選取 */
  -webkit-user-drag: none; /* 禁止拖動（Safari/Chrome） */
  -webkit-touch-callout: none; /* 禁止長按選單（iOS） */
}

@media (max-width: 768px) {
  .logo img {
    width: 40%; /* 手機上放大一點 */
  }
}

@media (max-width: 480px) {
  .slogan {
    padding-top: var(--spacing-md);
    padding-bottom: var(--spacing-md);
  }

  .logo img {
    width: 50%;
  }
}
</style>