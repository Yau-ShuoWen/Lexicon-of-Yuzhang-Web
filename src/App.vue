<script>
import Logo from "./views/logo.vue";

export default {
  name: 'App',
  components: {Logo}
}
</script>

<style>
@import '/public/fonts/fonts.css';
</style>

<template>
  <div id="app">


    <nav class="main-nav">
      <router-link id="link" to="/">首页</router-link>
      <router-link id="link" to="/search">查询</router-link>
      <router-link id="link" to="/style">样式</router-link>
      <router-link id="link" to="/contact">联系</router-link>
      <router-link id="link" to="/test">测试</router-link>
      <router-link id="link" to="/logo">技术支持</router-link>
    </nav>

    <!-- 主要内容区域 -->
    <div style="padding: 20px 0;">
      <router-view></router-view>
    </div>

  </div>
</template>

<style scoped>

#app {
  font-family: MiSans, sans-serif;
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
}

#link {

  text-decoration: none;
}

.main-nav {
  padding: 20px;
  background: #f0f0f0;
  width: 100%;
  flex-shrink: 0;


  display: flex;
  flex-wrap: wrap; /* 关键：允许换行 */
  gap: 50px; /* 替代 margin-right */
  justify-content: center; /* 水平居中 */
  align-items: center;
  box-sizing: border-box; /* 确保 padding 包含在宽度内 */
}

.main-nav a {
  text-decoration: none;
  color: black;
}
</style>
