<template>
  <div>
    <h2>前后端连接测试</h2>
    <button @click="callHello">默认问候</button>
    <input type="text" placeholder="你的名字" @input="callHelloParam" v-model="name" maxlength="100" />
    <button @click="callHelloParam"></button>
    <p v-if="message">返回结果：{{ message }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const message = ref('')
const name = ref('')

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
  const params = new URLSearchParams({ name: name.value.trim() })
  fetch(`http://localhost:8080/api/hello/param?name=`+name.value)
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