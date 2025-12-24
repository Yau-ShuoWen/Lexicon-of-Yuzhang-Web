<script setup>

import JumpButton from "../../components/Button/JumpButton.vue";
import PinyinProofreadText from "../../components/Text/PinyinProofreadText.vue";
</script>

<template>
  <div class="container">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <div class="card">
      <div class="card-body">
        <h3 class="card-title">拼音转换框</h3>
        <PinyinProofreadText :placeholder="'拼音'" class="short-input"/>
      </div>
    </div>
  </div>
</template>

<style/>