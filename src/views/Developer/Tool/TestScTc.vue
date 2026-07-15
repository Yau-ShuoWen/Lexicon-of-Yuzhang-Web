<script setup>
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";
import { useRoute, useRouter } from "vue-router";
import { computed } from "vue";

const route = useRoute()
const router = useRouter()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
</script>

<template>
  <div class="container">
    <ScAndTcText layout="small" :dialect="dialect.toString()"/>
    <ScAndTcText layout="large" :dialect="dialect.toString()"/>
  </div>
</template>