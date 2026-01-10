<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { locale } = useI18n()

watch(
    () => route.params.lang,
    (lang) => {
      if (lang === 'sc' || lang === 'tc') {
        locale.value = lang
      }
    },
    { immediate: true }
)
</script>

<template>
  <router-view />
</template>
