<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import AlphabetIntroCard from './AlphabetIntroCard.vue'
import AlphabetTransferPanel from './AlphabetTransferPanel.vue'
import AlphabetTable from './AlphabetTable.vue'

const route = useRoute()
const { t } = useI18n()

const code = computed(() => route.params.code)
const language = computed(() => route.params.language)

useHead({
  title: () => `${t('personal.alphabet_table.title')}`
})
</script>

<template>
  <div class="broaden-layout">
    <div class="alphabet-shell">
      <div class="alphabet-page">
      <AlphabetIntroCard :code="code" :language="language" />
      <AlphabetTransferPanel :code="code" :language="language" />
      <AlphabetTable :code="code" :language="language" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.alphabet-shell {
  width: 1088px;
  margin: 0 auto 50px;
}

.alphabet-page {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

@media (max-width: 1105px) {
  .alphabet-shell {
    width: 754px;
  }
}

@media (max-width: 750px) {
  .alphabet-shell {
    width: 500px;
  }
}

@media (max-width: 500px) {
  .alphabet-shell {
    width: 100%;
  }
}
</style>
