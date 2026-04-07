<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import JumpButton from "../../components/Button/JumpButton.vue";
import PinyinProofreadText from "../../components/Text/PinyinProofreadText.vue";
import RichText from "../../components/Text/RichText.vue";
import ScAndTcText from "../../components/Text/ScAndTcText.vue";

const text=ref('');
const t2=ref('')

const route = useRoute()
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
</script>

<template>
  <div class="container">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <div class="card">
      <div class="card-body">
        <h3 class="card-title">拼音转换框：回车或点击其他地方提交</h3>
        <PinyinProofreadText :placeholder="'拼音'" class="short-input" :dialect="dialect.toString()" />
      </div>
    </div>
    <div class="card">
      <div class="card-body">
        <ScAndTcText v-model:traditionalText="text" v-model:simplifiedText="t2"
                     :layout="'large'" :dialect="dialect.toString()"/>
        <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                  :model-value="text"/>
        <RichText :language="language.toString()" :dialect="dialect.toString()" :all-pinyin="false"
                  :model-value="t2"/>
      </div>
    </div>


  </div>
</template>

<style/>