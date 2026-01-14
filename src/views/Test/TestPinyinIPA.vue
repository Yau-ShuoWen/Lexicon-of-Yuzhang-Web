<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import JumpButton from "../../components/Button/JumpButton.vue";
import PinyinProofreadText from "../../components/Text/PinyinProofreadText.vue";


const route = useRoute()
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
  </div>
</template>

<style/>