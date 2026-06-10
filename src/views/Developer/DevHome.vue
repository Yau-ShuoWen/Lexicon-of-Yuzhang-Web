<script setup>
import DialectSelector from "../../components/Select/DialectSelector.vue";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useHead } from "@vueuse/head";

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/dev/${path}`

useHead({
  title: () => `開發者模式`
})

</script>

<template>
  <div class="narrow-layout">

    <div class="d-flex flex-column gap-5">

      <DialectSelector/>

      <section>
        <router-link :to="getPath(`profile`)" class="dev-btn-middle dev-normal-button" v-formatted-text="`管理`"/>
      </section>


      <section>
        <h4>工具</h4>
        <div class="d-flex flex-wrap gap-3">

          <router-link :to="getPath(`test/sc-tc`)" class="dev-btn-middle dev-normal-button"
                       v-formatted-text="`繁體轉簡體`"/>
          <router-link :to="getPath(`test/pinyin-ipa`)" class="dev-btn-middle dev-normal-button"
                       v-formatted-text="`富文本展示框`"/>
          <router-link :to="getPath(`tool/special-symbol`)" class="dev-btn-middle dev-normal-button"
                       v-formatted-text="`特殊符號複製`"/>

        </div>
      </section>

      <section>
        <h4>方言漢字、詞語、句子</h4>
        <div class="d-flex flex-wrap gap-3">

          <router-link :to="getPath(`hanzi-filter`)" class="dev-btn-middle dev-normal-button"
                       v-formatted-text="`編輯漢字`"/>
          <router-link :to="getPath(`ciyu-filter`)" class="dev-btn-middle dev-normal-button"
                       v-formatted-text="`編輯词语`"/>
          <router-link :to="getPath(`ref-filter`)" class="dev-btn-middle dev-normal-button"
                       v-formatted-text="`編輯資料`"/>

        </div>
      </section>

    </div>
  </div>
</template>

<style/>