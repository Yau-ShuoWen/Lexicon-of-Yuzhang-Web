<template>
  <div class="page-container">
    <div class="page-header">
      <p class="page-subtitle">{{$t('message.welcome')}}</p>
    </div>

    <SearchInput/>

  </div>
</template>

<script>
import {defineComponent} from "vue";
import SearchInput from "../components/SearchInput.vue";
import LanguageSwitcher from "../components/Button/LanguageSwitcher.vue";

export default defineComponent({
  components: {LanguageSwitcher, SearchInput}
})
</script>

<style scoped>
.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
}

.page-subtitle {
  font-size: 1.2rem;
  color: #666;
}
</style>