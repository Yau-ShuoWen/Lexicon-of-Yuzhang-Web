<template>
  <SloganText/>

  <div class="selector-container">
    <LanguageSelector/>
    <DialectSelector/>
  </div>

  <SearchInput/>
</template>

<script setup>
import { computed, ref } from "vue"
import { useRoute } from "vue-router"

import SearchInput from "./Search/SearchInput.vue"
import LanguageSelector from "../components/Select/LanguageSelector.vue"
import DialectSelector from "../components/Select/DialectSelector.vue"
import SloganText from "./SloganText.vue";

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
</script>

<style scoped>
.selector-container {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 350px;
  margin: 5px auto;
  font-size: 1.2rem;
  padding: 10px;
  gap: 20px; /* 元素之间的间距 */
}
</style>