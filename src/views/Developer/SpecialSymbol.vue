<script setup>

import CopyButton from "../../components/Button/CopyButton.vue";
import JumpButton from "../../components/Button/JumpButton.vue";
</script>

<template>

  <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>

  <div>
    <CopyButton text="˥" hint="˥" class="dev-normal-button dev-btn-middle"/>
    <CopyButton text="˦" hint="˦" class="dev-normal-button dev-btn-middle"/>
    <CopyButton text="˧" hint="˧" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="˨" hint="˨" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="˩" hint="˩" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="꜒" hint="꜒" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="꜓" hint="꜓" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="꜔" hint="꜔" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="꜕" hint="꜕" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="꜖" hint="꜖" class="dev-normal-button dev-btn-middle copy"/>
  </div>

  <div>
    <CopyButton text="̀" hint="à" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="́" hint="á" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="̌" hint="ǎ" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="̄" hint="ā" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="̉" hint="ả" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="̋" hint="a̋" class="dev-normal-button dev-btn-middle copy"/>
    <CopyButton text="̏" hint="ȁ" class="dev-normal-button dev-btn-middle copy"/>

  </div>

  <div>


  </div>

</template>

<style scoped>
.copy{
  font-size: var(--spacing-md);
}
</style>