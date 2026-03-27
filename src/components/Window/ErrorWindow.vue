<script setup>
import { useErrorState } from '../../services/ErrorService.js'

const {errors} = useErrorState()
</script>

<template>
  <div class="error-container">
    <div
        v-for="e in errors"
        :key="e.id"
        class="error-message"
        :class="e.type"
        v-formatted-text="e.message.toString()"
    />
  </div>
</template>

<style scoped>
.error-container {
  position: fixed;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.error-message {
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  margin-bottom: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.3s ease forwards;
  text-align: left;          /* 文字左對齊 */
  word-wrap: break-word;     /* 長文字換行 */
  box-sizing: border-box;    /* 內距包含在寬度內 */
}

/* 顏色分類 */
.error-message.error {
  background: #f56565;
}

/* 紅色 */
.error-message.success {
  background: #48bb78;
}

/* 綠色 */
.error-message.warning {
  background: #ecc94b;
  color: black;
}

/* 從上方滑入動畫 */
@keyframes slideDown {
  from {
    transform: translateY(-100%); /* 不再用 translateX */
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>