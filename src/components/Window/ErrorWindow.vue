<script setup>
import { useErrorState } from '../../services/ErrorService.js'

const { errors } = useErrorState()
</script>

<template>
  <div class="error-container">
    <div
        v-for="e in errors"
        :key="e.id"
        class="error-message"
    >
      {{ e.message }}
    </div>
  </div>
</template>

<style scoped>
.error-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
}

.error-message {
  background: #f56565;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  margin-bottom: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: slideIn 0.25s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>