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

<template>
  <div id="app">


    <nav style="padding: 20px; background: #f0f0f0;">
      <router-link id="link" to="/" >首页</router-link>
      <router-link id="link" to="/about"   >关于</router-link>
      <router-link id="link" to="/contact" >联系</router-link>
      <router-link id="link" to="/test" >测试</router-link>
      <router-link id="link" to="/logo" >支持</router-link>
    </nav>

    <!-- 主要内容区域 -->
    <div style="padding: 200px;">
      <router-view></router-view>
    </div>

  </div>
</template>

<style scoped>

#app{
  font-family: 標楷體, sans-serif;
}
#link
{
  margin-right: 50px; text-decoration: none;
}
</style>
