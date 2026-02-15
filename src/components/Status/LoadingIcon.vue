<template>
  <div :class="['loading-container', { 'loading-inline': inline }]">
    <span
        class="loading-spinner"
        :style="{
        width: size + 'px',
        height: size + 'px',
        borderWidth: borderSize + 'px'
      }"
    ></span>
    <span v-if="showText && !inline" class="loading-text">
      {{ text }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // 加载图标尺寸（px）
  size: {
    type: [Number, String],
    default: 20
  },
  // 边框粗细（px）
  borderSize: {
    type: [Number, String],
    default: 2
  },
  // 是否显示加载文字
  showText: {
    type: Boolean,
    default: true
  },
  // 加载文字内容
  text: {
    type: String,
    default: '加载中...'
  },
  // 是否行内显示（不换行）
  inline: {
    type: Boolean,
    default: false
  },
  // 自定义颜色
  color: {
    type: String,
    default: ''
  }
});

// 计算边框颜色
const borderColor = computed(() => {
  if (props.color) return props.color;
  return 'var(--color-primary)';
});
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.loading-container.loading-inline {
  flex-direction: row;
  display: inline-flex;
  padding: 0;
  gap: var(--spacing-xs);
}

.loading-spinner {
  display: block;
  border-style: solid;
  border-color: var(--color-border);
  border-top-color: v-bind(borderColor);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: v-bind(borderColor);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>