<template>
    <p class="page-subtitle" v-formatted-text="$t('message.welcome')"/>
    <p class="page-subtitle" v-formatted-text="$t('message.welcome_nam')"/>
    <SearchInput/>

    <div class="selector-container">
      <LanguageSelector/>
      <DialectSelector/>
    </div>
</template>

<script>
import {defineComponent} from "vue";
import SearchInput from "../components/SearchInput.vue";
import LanguageSelector from "../components/Select/LanguageSelector.vue";
import DialectSelector from "../components/Select/DialectSelector.vue";

export default defineComponent({
  components: {DialectSelector, LanguageSelector, SearchInput}
});
</script>

<style scoped>
.selector-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 400px;
  margin: 5px auto;
  font-size: 1.2rem;
  padding: 10px 0;
}
</style>
