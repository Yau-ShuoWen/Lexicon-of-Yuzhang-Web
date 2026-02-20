<!-- App.vue -->

<script setup>
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import ConfirmWindow from "./components/Window/ConfirmWindow.vue"
import ErrorWindow from "./components/Window/ErrorWindow.vue";

// 路由
const route = useRoute()

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/${path}`
</script>


<template>
  <div id="app">

    <nav class="main-nav">
      <router-link :to="getPath(`home`)" class="nav-link" v-formatted-text="$t('nav.home')"/>
      <router-link :to="getPath(`pinyin`)" class="nav-link" v-formatted-text="$t('nav.pinyin')"/>
      <router-link :to="getPath(`about`)" class="nav-link" v-formatted-text="$t('nav.about')"/>
    </nav>

    <main class="page-container">
      <router-view/>
      <ConfirmWindow/>
      <ErrorWindow/>
    </main>
  </div>
</template>

<style scoped/>