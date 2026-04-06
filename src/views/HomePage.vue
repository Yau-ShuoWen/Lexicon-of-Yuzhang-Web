<template>


  <SloganText/>

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

</style>