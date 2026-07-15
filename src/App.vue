<!-- App.vue -->

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ConfirmWindow from "./components/Window/ConfirmWindow.vue"
import ToastWindow from "./components/Window/ToastWindow.vue";
import { initNoteTooltip } from "./utils/noteTooltip.js";

// 路由
const route = useRoute()

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/${path}`

onMounted(() => {
  initNoteTooltip();
});

const statue = computed(() => {
  if (route.path.includes('/ysw/')) return 'ysw'
  if (route.path.includes('/dev/')) return 'dev'
  else return 'normal'

})
</script>


<template>
  <div id="app">

    <nav v-if="statue==='normal'" class="main-nav">
      <router-link :to="getPath(`home`)" class="nav-link" v-formatted-text="$t('nav.search')"/>
      <!--      <router-link :to="getPath(`tutorial`)" class="nav-link" v-formatted-text="$t('nav.tutorial')"/>-->
      <router-link :to="getPath(`pinyin`)" class="nav-link" v-formatted-text="$t('nav.pinyin')"/>
      <router-link :to="getPath(`about`)" class="nav-link" v-formatted-text="$t('nav.about')"/>
    </nav>

    <nav v-if="statue==='dev'" class="main-nav">
      <router-link :to="getPath(`dev/home`)" class="nav-link" v-formatted-text="`開發者首頁`"/>
      <router-link :to="getPath(`home`)" class="nav-link" v-formatted-text="`回到詞典↗`" target="_blank"/>
    </nav>

    <nav v-if="statue==='ysw'" class="main-nav">
      <router-link :to="{ name: 'YswHome', params: { language: language } }"
                   class="nav-link" v-formatted-text="`屋里`"/>

      <router-link :to="getPath(`ysw/alphabet`)" class="nav-link"
                   v-formatted-text="$t('personal.alphabet_table.title_short')"
      />
      <router-link :to="getPath(`ysw/diary`)" class="nav-link"
                   v-formatted-text="language === 'tc' ? '日記' : '日记'"
      />
      <router-link :to="getPath(`about`)" class="nav-link" v-formatted-text="`词典↗`"  target="_blank"/>
    </nav>

    <main class="page-container">
      <router-view/>
      <ConfirmWindow/>
      <ToastWindow/>
    </main>
  </div>
</template>

<style scoped/>
