<script setup>
</script>

<template>
  <div id="app">
    <nav class="main-nav">
      <router-link to="/" class="nav-link" v-formatted-text="$t('nav.home')"/>
      <router-link to="/pinyin" class="nav-link" v-formatted-text="$t('nav.pinyin')"/>
      <router-link to="/about" class="nav-link" v-formatted-text="$t('nav.about')"/>
    </nav>

    <main class="page-container">
      <router-view/>
    </main>
  </div>
</template>

<style scoped/>