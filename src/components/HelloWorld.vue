<template>
  <div>
    <h2>前后端联调测试</h2>
    <button @click="callHello">调用 /api/hello</button>
    <button @click="callHelloParam">调用 /api/hello/param?name=budou</button>
    <p v-if="message">返回结果：{{ message }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const message = ref('')

function callHello() {
  fetch('http://localhost:8080/api/hello')
      .then(res => res.json())
      .then(data => {
        message.value = data.message
      })
      .catch(err => {
        message.value = '请求失败: ' + err.message
      })
}

function callHelloParam() {
  fetch('http://localhost:8080/api/hello/param?name=budou')
      .then(res => res.json())
      .then(data => {
        message.value = data.message
      })
      .catch(err => {
        message.value = '请求失败: ' + err.message
      })
}
</script>

<style scoped>
button {
  margin-right: 10px;
  padding: 6px 12px;
  font-size: 16px;
}
</style>