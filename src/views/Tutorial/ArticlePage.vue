<!--src/views/Tutorial.ArticlePage.vue-->

<script setup>
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";

const route = useRoute()

const title = ref('')
const content = ref('')
const loading = ref(false)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const id = computed(() => route.params.id)

const load = async () => {
  if (!id.value) return
  loading.value = true

  try {
    const res = await fetch(
        `/api/course/text/${dialect.value}/${language.value}/${id.value}`
    )
    const data = await res.json()

    title.value = data.left
    content.value = data.right
  }
  finally {
    loading.value = false
  }
}

// 初次 + 切换
watch([language, dialect, id], load, {immediate: true})
</script>

<template>
  <div class="middle-layout">
    <LoadingIcon v-if="loading" />

    <div v-else class="broaden-layout pronunciation-block">
      <h2 v-formatted-text="title"/>
      <div v-formatted-text="content"/>

    </div>
  </div>

</template>

<style>
</style>