<script setup>

import AutoProofreadText from "../../components/Text/AutoProofreadText.vue";
import JumpButton from "../../components/Button/JumpButton.vue";
</script>

<template>
  <div class="container">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <div class="card">
      <div class="card-body">
        <h3 class="card-title">简繁转换框：小</h3>
        <AutoProofreadText layout="small"/>
      </div>

      <div class="card-body">
        <h3 class="card-title">简繁转换框：大</h3>
        <AutoProofreadText layout="large"/>
      </div>
    </div>
  </div>
</template>

<style/>