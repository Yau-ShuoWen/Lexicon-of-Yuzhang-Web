<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">功能测试</h1>
    </div>

    <div class="card">
      <div class="card-body">
        <h3 class="card-title">打招呼功能</h3>

        <div class="form-group">
          <input
              type="text"
              placeholder="你想说的"
              @input="callHelloParam"
              v-model="name"
              maxlength="100"
              class="form-control"
          />
        </div>

        <div class="button-group">
          <button @click="callHello" class="btn btn-primary">默认问候</button>
          <button @click="callHelloParam" class="btn btn-secondary">刷新文本</button>
        </div>

        <div v-if="message" class="response mt-3" v-html="message"></div>
      </div>
    </div>

    <div class="card mt-4">
      <div class="card-body">
        <h3 class="card-title">简繁体转换</h3>

        <div class="form-group">
          <input
              type="text"
              placeholder="繁體文本"
              @input="transfer"
              v-model="txt"
              maxlength="500"
              class="form-control"
          />
        </div>

        <button @click="transfer" class="btn btn-primary">刷新简体文本</button>

        <div v-if="sc" class="response mt-3">
          {{ sc }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref} from 'vue'
import {formatTextWithFont} from "../utils/textFormatter.js";

const message = ref('')
const name = ref('')
const txt = ref('')
const sc = ref('')

function callHello() {
  fetch('/api/hello')
      .then(res => res.json())
      .then(data => {
        message.value = data.message
      })
      .catch(err => {
        message.value = '请求失败: ' + err.message
      })
}

function callHelloParam() {
  fetch(`/api/hello/param?name=` + name.value)
      .then(res => res.json())
      .then(data => {
        message.value = formatTextWithFont(data.message);
      })
      .catch(err => {
        message.value = '请求失败: ' + err.message
      })
}

function transfer() {
  fetch(`/api/transfer/tc?tc=` + txt.value)
      .then(res => res.json())
      .then(data => {
        sc.value = data.sc
      }).catch(err => {
    sc.value = '我也不知道: ' + err.message
  })
}
</script>

<style scoped>
.button-group {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.response {
  padding: var(--spacing-md);
  background-color: var(--color-background-alt);
  border-radius: var(--border-radius-md);
  border-left: 4px solid var(--color-primary);
}

@media (max-width: 768px) {
  .button-group {
    flex-direction: column;
  }
}
</style>