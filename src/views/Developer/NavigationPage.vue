<!-- 导航路径为：/developer-home -->
<!-- 修改时候请勿删除此路径 -->

<script setup>
import JumpButton from "../../components/Button/JumpButton.vue";
</script>

<template>
  <div class="narrow-layout">

    <div class="d-flex flex-column gap-5">

      <section>
        <JumpButton size="middle" button-text="← 返回" to="/about"/>
      </section>

      <section>
        <h4>功能试用</h4>
        <div class="d-flex flex-wrap gap-3">
          <JumpButton to="/test" button-text="测试连接" size="middle"/>
          <JumpButton to="/test/sc-tc" button-text="繁转简自动转换框" size="middle"/>
          <JumpButton to="/test/pinyin-ipa" button-text="拼音、国际音标自动转换框" size="middle"/>
          <JumpButton to="/login" button-text="登陆" size="middle"/>
          <JumpButton to="/profile" button-text="管理" size="middle"/>
        </div>
      </section>

      <section>
        <h4>方言拼音</h4>
        <div class="d-flex flex-wrap gap-3">
          <JumpButton to="/style" button-text="拼音方案测试" size="middle"/>
        </div>
      </section>

      <section>
        <h4>方言漢字、詞語、句子</h4>
        <div class="d-flex flex-wrap gap-3">
          <JumpButton to="/hanzi-filter" button-text="編輯漢字" size="middle"/>
          <JumpButton to="/ref-filter" button-text="編輯資料" size="middle"/>
        </div>
      </section>

    </div>
  </div>
</template>

<style/>