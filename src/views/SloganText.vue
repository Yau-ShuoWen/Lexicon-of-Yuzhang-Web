<script setup>
import { computed, ref } from "vue"
import { useRoute } from "vue-router"

import TextInfo from "../components/Status/TextInfo.vue";

const route = useRoute()

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

// 核心状态：控制是否显示隐藏的文字
const isRevealed = ref(false)

// 统一的激活函数
const activateEffect = () => {
  if (!isRevealed.value) {
    isRevealed.value = true
  }
}
</script>

<template>

  <!--
   标题容器区域
   - @mouseenter: 适配 PC 端鼠标悬停
   - @touchstart: 适配移动端手指触摸或滑过 (手指一碰到区域即触发)
   - passive: 优化移动端滚动性能，告诉浏览器这个事件不会阻止默认滚动
 -->
  <div
      class="title-wrapper"
      @mouseenter="activateEffect"
      @touchstart.passive="activateEffect"
  >
    <!-- 1. 原始文字 (默认显示) -->
    <p
        class="page-subtitle original-text"
        v-formatted-text="$t('message.welcome')"
        :class="{ 'fade-out': isRevealed }"
    />

    <!-- 2. 目标文字 (TextInfo，默认隐藏) -->
    <TextInfo
        :dialect="dialect.toString()"
        :language="language.toString()"
        textKey="welcome"
        class="page-subtitle revealed-text"
        :class="{ 'fade-in': isRevealed }"
    />
  </div>
</template>

<style scoped>
.title-wrapper {
  position: relative;
  width: 100%;
  max-width: 500px;
  height: 100px;
  margin: 0 auto 20px auto;
  overflow: hidden;

  /* 关键：在移动端增加一点内边距，扩大“可触摸/划过”的热区，提升体验 */
  padding: 10px 0;
  box-sizing: border-box;

  /* 提示用户可交互 (PC 端显示手型，移动端通常不显示但不影响功能) */
  cursor: pointer;
}

.page-subtitle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  text-align: center;
  margin: 0;
  /* 渐变动画 */
  transition: opacity 0.6s ease-in-out;
  /* 确保文字不会被截断导致布局跳动 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.original-text {
  font-size: var(--font-size-2xl);
  font-weight: bold;
  opacity: 1;
  z-index: 1;
}

.revealed-text {
  opacity: 0;
  z-index: 2;
  /* 如果 TextInfo 内部有行高问题，可以在这里强制调整 */
  line-height: 1.2;
}

.fade-out {
  opacity: 0 !important;
}

.fade-in {
  opacity: 1 !important;
}
</style>