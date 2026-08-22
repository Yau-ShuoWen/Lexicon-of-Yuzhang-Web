<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatRichText } from "../../../utils/textFormatter.js";
import RichText from "../../../components/Text/RichText.vue";
import ScAndTcText from "../../../components/Text/ScAndTcText.vue";

const tc=ref('');
const sc=ref('')

const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

// 拼音块测试数据

</script>

<template>
  <div class="container">

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

    <ScAndTcText layout="mobile" v-model:traditionalText="tc" v-model:simplifiedText="sc" :dialect="dialect"/>


  </div>
</template>

<style/>
