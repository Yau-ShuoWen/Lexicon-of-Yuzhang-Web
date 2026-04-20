<template>


  <div class="slogan">
    <SloganText/>
  </div>


  <SearchInput/>
</template>

<script setup>
import { computed, ref } from "vue"
import { useRoute } from "vue-router"

import SearchInput from "./Search/SearchInput.vue"
import SloganText from "./SloganText.vue";

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
</script>

<style scoped>
.slogan {
  padding-top: var(--spacing-2xl);
  padding-bottom: var(--spacing-2xl);
}
</style>