<template>
  <div class="aaa">
    <h2>打个招呼</h2>

    <input type="text" placeholder="你想说的" @input="callHelloParam" v-model="name" maxlength="100"/>
    <div class="bbb">
      <button @click="callHello">默认问候</button>
      <button @click="callHelloParam">刷新文本</button>
      <p v-if="message">{{ message }}</p>
    </div>

  </div>

  <div class="aaa">
    <h2>简繁体转换</h2>
      <input type="text" placeholder="繁體文本" @input="transfer" v-model="txt" maxlength="500"/>
      <button @click="transfer">刷新简体文本</button>
      <p v-if="sc">{{ sc }}</p>
  </div>
</template>

<script setup>

import {ref} from 'vue'

const message = ref('')
const name = ref('')
const txt = ref('')
const sc = ref('')

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
  fetch(`http://localhost:8080/api/hello/param?name=` + name.value)
      .then(res => res.json())
      .then(data => {
        message.value = data.message
      })
      .catch(err => {
        message.value = '请求失败: ' + err.message
      })
}


function transfer() {
  fetch(`http://localhost:8080/api/transfer/tc?tc=` + txt.value)
      .then(res => res.json())
      .then(data => {
        sc.value = data.sc
      }).catch(err => {
    sc.value = '我也不知道: ' + err.message
  })
}
</script>

<style scoped>
button {
  margin-right: 10px;
  padding: 6px 12px;
  font-size: 16px;
}

.aaa {
  display: grid;
}

.bbb {
  flex-direction: column;
}

div {
  flex-direction: column;
}
</style>