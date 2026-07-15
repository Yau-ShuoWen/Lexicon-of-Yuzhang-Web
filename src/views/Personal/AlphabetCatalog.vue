<script setup>

import {computed, onMounted, ref, watch} from "vue";
import {useRoute, useRouter} from "vue-router";
import {showError} from "../../services/ToastService.js";
import LoadingIcon from "../../components/Status/LoadingIcon.vue";

const route = useRoute()
const router = useRouter()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

const loading = ref(false)

const catalog = ref([])

async function fetchCatalog() {

  try {

    loading.value = true

    const res = await fetch(
        `/api/personal/alphabet/catalog/${language.value}`
    )

    if (!res.ok) {
      throw new Error(res.status)
    }

    catalog.value = await res.json()

  } catch (e) {

    console.error(e)

    showError("加载目录失败")
  }
  finally {

    loading.value = false
  }
}

function openAlphabet(item) {

  router.push(
      `/${language.value}/${dialect.value}/ysw/alphabet/${item.url}`
  )
}

watch(language, fetchCatalog)

onMounted(fetchCatalog)

</script>

<template>

  <div class="broaden-layout">

    <LoadingIcon v-if="loading"/>

    <section v-for="group in catalog" :key="group.left"
        class="catalog-group"
    >

      <h2 class="catalog-title" v-formatted-text="group.left"/>

      <div class="alphabet-grid">

        <router-link
            v-for="item in group.right"
            :key="item.url"
            class="alphabet-card"
            :to="`/${language}/${dialect}/ysw/alphabet/${item.url}`"
        >

          <div class="alphabet-example" v-formatted-text="item.example"/>
          <div class="alphabet-name" v-formatted-text="item.name"/>
        </router-link>
      </div>

    </section>

  </div>

</template>

<style scoped>

/* ===== group ===== */

.catalog-group {
  margin-bottom: 30px;
}

.catalog-title {
  margin-bottom: 15px;
  font-size: 22px;
  font-weight: 600;

  color: var(--color-text);
}

/* ===== grid ===== */

.alphabet-grid {
  display: grid;
  grid-template-columns:
      repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

/* ===== card ===== */

.alphabet-card {
  background: var(--card-bg-color);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 18px 14px;
  cursor: pointer;
  transition: all .2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 110px;
}

.alphabet-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
}

/* ===== example ===== */

.alphabet-example {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  color: var(--color-text);
  margin-bottom: 10px;
  line-height: 1.3;
  word-break: break-word;
}

/* ===== name ===== */

.alphabet-name {
  font-size: 16px;
  color: #333333;
  text-align: center;
  line-height: 1.4;
}

/* ===== mobile ===== */

@media (max-width: 600px) {

  .alphabet-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .alphabet-card {
    min-height: 95px;
    padding: 14px 10px;
  }

  .alphabet-example {
    font-size: 20px;
  }

  .alphabet-name {
    font-size: 12px;
  }
}

</style>