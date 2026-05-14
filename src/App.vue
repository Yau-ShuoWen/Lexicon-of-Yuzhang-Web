<!-- App.vue -->

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ConfirmWindow from "./components/Window/ConfirmWindow.vue"
import ToastWindow from "./components/Window/ToastWindow.vue";

// 路由
const route = useRoute()

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/${path}`

const isYsw = computed(() => route.path.includes('/ysw/'))
</script>


<template>
  <div id="app">

    <nav v-if="isYsw" class="main-nav">
      <router-link :to="{ name: 'YswHome', params: { language: language } }"
                   class="nav-link" v-formatted-text="`屋里`"/>

      <router-link :to="getPath(`ysw/alphabet`)" class="nav-link"
                   v-formatted-text="$t('personal.alphabet_table.title_short')"
      />
      <router-link :to="getPath(`about`)" class="nav-link" v-formatted-text="`词典↗`"/>
    </nav>

    <nav v-else class="main-nav">
      <router-link :to="getPath(`home`)" class="nav-link" v-formatted-text="$t('nav.search')"/>
      <!--      <router-link :to="getPath(`tutorial`)" class="nav-link" v-formatted-text="$t('nav.tutorial')"/>-->
      <router-link :to="getPath(`pinyin`)" class="nav-link" v-formatted-text="$t('nav.pinyin')"/>
      <router-link :to="getPath(`about`)" class="nav-link" v-formatted-text="$t('nav.about')"/>
    </nav>

    <main class="page-container">
      <router-view/>
      <ConfirmWindow/>
      <ToastWindow/>
    </main>
  </div>
</template>

<style scoped/>