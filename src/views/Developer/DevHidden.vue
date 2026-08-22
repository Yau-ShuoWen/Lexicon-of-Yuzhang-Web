<script setup>
</script>

<template>
  <div class="narrow-layout">
    <div class="hidden-box">
      <h3>页面不存在</h3>
      <p>你访问的地址暂时不可用。</p>
    </div>
  </div>
</template>

<style scoped>
.hidden-box {
  min-height: 42vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 12px;
  background: var(--app-bg-color);
  border: 1.5px solid var(--color-primary);
  border-radius: var(--border-radius-md);
  padding: 32px;
  color: var(--color-text);
}

.hidden-box h3 {
  font-size: 1.5rem;
  margin: 0;
}

.hidden-box p {
  margin: 0;
  opacity: 0.75;
}
</style>
