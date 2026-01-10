<template>
  <div class="container">
    <JumpButton to="/developer-home" buttonText="←返回导航" size="middle"/>
    <h3 class="card-title">连接测试</h3>

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
</template>

<script setup>
import {ref} from 'vue'
import {formatRichText} from "../utils/textFormatter.js"
import AutoProofreadText from "../components/Text/AutoProofreadText.vue";
import PinyinProofreadText from "../components/Text/PinyinProofreadText.vue";
import JumpButton from "../components/Button/JumpButton.vue";

const message = ref('')
const name = ref('')
const traditionalText = ref('')
const simplifiedText = ref('')

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
        message.value = formatRichText(data.message);
      })
      .catch(err => {
        message.value = '请求失败: ' + err.message
      })
}

// 简繁体转换组件的事件处理
function handleTraditionalUpdate(value) {
  traditionalText.value = value
}

function handleSimplifiedUpdate(value) {
  simplifiedText.value = value
}

function handleConvert(data) {
  console.log('转换完成:', data)
}

function handleCorrect(data) {
  console.log('校对完成:', data)
}

function handleError(error) {
  console.error('转换错误:', error)
}
</script>

<style>
/* 原有的样式保持不变 */
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