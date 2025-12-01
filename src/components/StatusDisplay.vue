<template>
  <div v-if="type === 'loading'" class="loading-state">
    <div class="loading-content">
      <span class="loading-icon">⏳</span>
      <h3>查询中...</h3>
    </div>
  </div>


  <div v-else-if="type === 'error'" class="error-state">
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <h3>{{ message }}</h3>
      <button v-if="showRetry" @click="$emit('retry')" class="btn btn-primary">重试</button>
    </div>
  </div>

  <div v-else-if="type === 'empty'" class="empty-state">
    <div class="empty-content">
      <span class="empty-icon">🔍</span>
      <h3>未找到相关信息</h3>
      <p>请尝试输入其他内容</p>
    </div>
  </div>

  <div v-else-if="type === 'initial'" class="initial-state">
    <div class="initial-content">
      <span class="initial-icon">📖</span>
      <h3>返回首页查询</h3>
      <p>你好像什么也没有查询哦</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    required: true,
    validator: (value) => ['loading', 'error', 'empty', 'initial'].includes(value)
  },
  message: {
    type: String,
    default: ''
  },
  showRetry: {
    type: Boolean,
    default: false
  }
})

defineEmits(['retry'])
</script>

<style scoped>
.loading-state,
.error-state,
.empty-state,
.initial-state {
  text-align: center;
  padding: 60px 20px;
}

.loading-content,
.error-content,
.empty-content,
.initial-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-icon,
.empty-icon,
.initial-icon,
.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-state {
  color: var(--color-error);
}

.empty-state,
.initial-state {
  color: var(--color-text-light);
}
</style>