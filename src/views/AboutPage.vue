<script setup>
import {useRoute} from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="auth-links btn btn-ghost text-center">
    <img src="../assets/icons/developer.svg" alt="code" class="icon">
    <router-link :to="{name: 'DeveloperHomeWithLang',params: { language: route.params.language }  }" class="link">
      {{ $t('about.developer_mode') }}
    </router-link>
  </div>
  <a href="https://github.com/Yau-ShuoWen" target="_blank" class="btn btn-ghost">
    <img src="../assets/icons/github.svg" alt="GitHub" class="icon">
    {{ $t('about.github_project') }}
  </a>
</template>

<style scoped>
.icon {
  width: 20px;
  height: 20px;
  vertical-align: middle;
  margin-right: var(--spacing-sm);
}
</style>