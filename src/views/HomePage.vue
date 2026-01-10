<template>
  <div class="page-container">

    <p class="page-subtitle" v-formatted-text="$t('message.welcome')"/>
    <p class="page-subtitle" v-formatted-text="$t('message.welcome_nam')"/>
    <SearchInput/>

  </div>
</template>

<script>
import {defineComponent} from "vue";
import SearchInput from "../components/SearchInput.vue";
import LanguageChanger from "../components/Button/LanguageChanger.vue";

export default defineComponent({
  components: {LanguageChanger, SearchInput}
})
</script>

<style scoped>
.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-subtitle {
  text-align: center;
  font-size: 1.2rem;
  color: #666;
}
</style>