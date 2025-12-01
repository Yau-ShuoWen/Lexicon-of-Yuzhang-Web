<!-- 导航路径为：/developer-home -->
<!-- 修改时候请勿删除此路径 -->

<script setup>
import BackButton from "../../components/Button/BackButton.vue";
</script>

<template>
  <div class="page-container">
    <div class="container">

      <div class="d-flex flex-column gap-5">

        <section>
          <BackButton  target-route="/about" button-text="← 返回目录" />
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">方言拼音</h2>
          <div class="d-flex flex-wrap gap-3">
            <router-link to="/style" class="link btn btn-primary">拼音方案测试</router-link>
          </div>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">方言漢字、詞語、句子</h2>
          <div class="d-flex flex-wrap gap-3">
            <router-link to="/test" class="link btn btn-secondary">简繁转换</router-link>
            <router-link to="/filter" class="link btn btn-secondary">編輯漢字</router-link>
          </div>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3">方言資料</h2>
          <div class="d-flex flex-wrap gap-3">
            <router-link to="/reference" class="link btn btn-primary">編輯資料</router-link>
          </div>
        </section>

      </div>
    </div>
  </div>
</template>

<style scoped>

hr {
  border: none;
  height: 1px;
  background-color: var(--color-border);
  margin: 0;
}

section {
  padding: 30 var(--spacing-sm);
}
</style>