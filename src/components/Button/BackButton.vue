<template>
  <button @click="goBack" class="back-btn">
    {{ buttonText }}
  </button>
</template>

<script>
export default {
  name: 'BackButton',
  props: {
    buttonText: {
      type: String,
      default: '← 返回'
    }
  },
  methods: {
    goBack() {
      this.$router.back();
    }
  }
}
</script>

<style scoped>
.back-btn {
  padding: 8px 16px;
  margin: 16px 0;
  border: 1px solid #ccc;
  background: white;
  color: #333;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.back-btn:hover {
  background: #f5f5f5;
}
</style>