<template>
  <div class="page-container">

    <p class="page-subtitle" v-formatted-text="$t('message.welcome')"/>
    <p class="page-subtitle" v-formatted-text="$t('message.welcome_nam')"/>
    <SearchInput/>

    <div class="selector-container">
      <LanguageSelector/>
      <DialectSelector/>
    </div>

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
.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-subtitle {
  text-align: center;
  font-size: 1.2rem; /* 放大字体 */
  color: #666;
  margin: 15px 0;
}

/* 新增：左右排列选择器 */
.selector-container {
  display: flex;
  justify-content: space-between; /* 左右分开 */
  align-items: center; /* 垂直居中 */
  max-width: 400px; /* 可以根据需要调整容器宽度 */
  margin: 0 auto; /* 容器居中 */
  font-size: 1.2rem; /* 让选择器显示稍大 */
  padding: 10px 0;
}
</style>
