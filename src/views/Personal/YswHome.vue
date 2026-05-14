<script setup>

import LanguageSelector from "../../components/Select/LanguageSelector.vue";
import LoadingIcon from "../../components/Status/LoadingIcon.vue";
import { useHead } from "@vueuse/head";
import { showError } from "../../services/ToastService.js";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { computed, onMounted, ref } from "vue";

const {t} = useI18n()
const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const loading = ref(true)
const result = ref('')

useHead({
  title: () => `${t('nav.about_us')}`
})
const fetchAbout = async () => {
  loading.value = true

  try {
    const res = await fetch(`/api/personal/hello`)

    if (!res.ok) throw new Error(t('common.loadingError'))

    result.value = await res.json()
  } catch (err) {
    console.error(err)
    showError(err.message);
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAbout()
})
</script>

<template>
  <div class="broaden-layout">

    <LanguageSelector/>

    <div v-if="loading" class="loading-wrapper">
      <LoadingIcon/>
    </div>

    <div v-else>

      <div class="text-box contact-box">
        <div class="contact-title" v-formatted-text="$t('nav.about')"/>
        <div v-formatted-text="result[language]"></div>
      </div>

    </div>

  </div>
</template>

<style scoped>
.text-box {
  background: var(--color-background);
  border: 2px solid var(--color-primary-light);
  border-radius: var(--border-radius-md);
  padding: 20px;
  line-height: 1.7;
  color: var(--color-text);
}

/* 加载 */
.loading-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

/* 联系区域 */
.contact-box {
  margin-bottom: 30px;
}

/* 标题 */
.contact-title {
  font-size: 25px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-text);
}
</style>