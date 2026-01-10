<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LanguageChanger from "./components/Button/LanguageChanger.vue";
const route = useRoute()

const currentLang = computed(() => {
  return route.params.lang === 'tc' ? 'tc' : 'sc'
})
</script>


<template>
  <div id="app">

    <nav class="main-nav">
      <router-link :to="`/${currentLang}/home`" class="nav-link"
                   v-formatted-text="$t('nav.home')" />

      <router-link :to="`/${currentLang}/pinyin`" class="nav-link"
                   v-formatted-text="$t('nav.pinyin')" />

      <router-link :to="`/${currentLang}/about`" class="nav-link"
                   v-formatted-text="$t('nav.about')" />

      <LanguageChanger/>
    </nav>

    <main class="page-container">
      <router-view/>
    </main>
  </div>
</template>

<style scoped/>