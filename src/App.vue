<script>
import Logo from "./views/logo.vue";

export default {
  name: 'App',
  components: {Logo}
}
</script>


<!--<script setup>-->
<!--import HelloWorld from "./components/HelloWorld.vue";-->
<!--</script>-->

<style>
@import '/public/fonts/fonts.css';
</style>

<template>
  <div id="app">


    <nav>
      <router-link id="link" to="/">首页</router-link>
      <router-link id="link" to="/search">查询</router-link>
      <router-link id="link" to="/style">样式</router-link>
      <router-link id="link" to="/contact">联系</router-link>
      <router-link id="link" to="/test">测试</router-link>
      <router-link id="link" to="/logo">技术支持</router-link>
    </nav>

    <!-- 主要内容区域 -->
    <div style="padding: 200px;">
      <router-view></router-view>
    </div>

  </div>
</template>

<style scoped>

#app {
  font-family: MiSans, sans-serif;
}

#link {
  margin-right: 50px;
  text-decoration: none;
}

nav {
  padding: 20px;
  background: #f0f0f0;
  width: 100%; /* 关键设置 */
}
</style>
