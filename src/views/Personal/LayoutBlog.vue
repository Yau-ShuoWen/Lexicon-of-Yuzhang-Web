<template>
  <div ref="viewHost" :style="{minHeight: retainedHeight}">
    <router-view v-slot="{ Component }">
      <KeepAlive include="SearchResult">
        <component :is="Component" :key="pinyinSchemeRevision" />
      </KeepAlive>
    </router-view>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { pinyinSchemeRevision } from '../../utils/accountSettings.js'

const route = useRoute()
const viewHost = ref(null)
const retainedHeight = ref('')

watch(pinyinSchemeRevision, async () => {
  const scrollY = window.scrollY
  retainedHeight.value = `${viewHost.value?.offsetHeight || 0}px`
  await nextTick()
  window.scrollTo({top: scrollY, behavior: 'instant'})
})

watch(() => route.fullPath, () => { retainedHeight.value = '' })
</script>
