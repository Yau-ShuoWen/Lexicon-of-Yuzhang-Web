<!--src/views/Tutorial.ArticlePage.vue-->

<script setup>
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";
import { request } from '../../services/request.js'

const route = useRoute()

const title = ref('')
const content = ref('')
const loading = ref(false)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const id = computed(() => route.params.id)

const description = computed(() => {
  const plainText = content.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return plainText ? plainText.slice(0, 150) : '豫章词语言教程与相关资料。'
})

useHead({
  title: computed(() => title.value || '语言教程'),
  meta: [
    { key: 'description', name: 'description', content: description },
    { key: 'og-description', property: 'og:description', content: description },
    { key: 'og-type', property: 'og:type', content: 'article' }
  ]
})

const load = async () => {
  if (!id.value) return
  loading.value = true

  try {
    const data = await request(
        `/api/course/text/${dialect.value}/${language.value}/${id.value}`
    )
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
