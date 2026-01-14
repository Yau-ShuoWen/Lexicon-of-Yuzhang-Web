<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { locale } = useI18n()

const VALID_LANGUAGES = ['sc', 'tc']
const VALID_DIALECTS = ['nam']

watch(
    () => route.params.language,
    (newLang) => {
      if (VALID_LANGUAGES.includes(newLang)) {
        locale.value = newLang
        localStorage.setItem('user-language', newLang)
      }
    },
    { immediate: true }
)

watch(
    () => route.params.dialect,
    (newDialect) => {
      if (VALID_DIALECTS.includes(newDialect)) {
        localStorage.setItem('user-dialect', newDialect)
      }
    },
    { immediate: true }
)
</script>

<template>
  <router-view />
</template>
