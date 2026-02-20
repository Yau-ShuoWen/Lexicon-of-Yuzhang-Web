<script setup>
import {useRoute} from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="auth-links btn btn-ghost text-center">
    <img src="../assets/icons/developer.svg" alt="code" class="icon">
    <router-link :to="{name: 'DeveloperHome',params: { language: route.params.language }  }" class="link">
      {{ $t('about.developer_mode') }}
    </router-link>
  </div>
  <a href="https://github.com/Yau-ShuoWen" target="_blank" class="btn btn-ghost">
    <img src="../assets/icons/github.svg" alt="GitHub" class="icon">
    {{ $t('about.github_project') }}
  </a>
  <a href="http://beian.miit.gov.cn" target="_blank" class="btn btn-ghost">
    <img src="../assets/icons/icp.svg" alt="GitHub" class="icon">
    蜀ICP备 2026005399号</a>
</template>

<style scoped>
.icon {
  width: 20px;
  height: 20px;
  vertical-align: middle;
  margin-right: var(--spacing-sm);
}
</style>