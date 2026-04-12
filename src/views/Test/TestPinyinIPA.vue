<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import JumpButton from "../../components/Button/JumpButton.vue";
import RichText from "../../components/Text/RichText.vue";
import ScAndTcText from "../../components/Text/ScAndTcText.vue";

const tc=ref('');
const sc=ref('')

const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
</script>

<template>
  <div class="container">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <div class="card">
      <div class="card-body">
        <ScAndTcText v-model:traditionalText="tc" v-model:simplifiedText="sc"
                     :layout="'large'" :dialect="dialect.toString()"/>
        <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                  :model-value="tc"/>
        <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                  :model-value="sc"/>
      </div>
    </div>


  </div>
</template>

<style/>