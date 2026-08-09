<script setup>
import {ref, computed, onMounted, onUnmounted} from 'vue'

const props = defineProps({
  items: {type: Array, required: true},
  currentInRoute: {type: Function, required: true},
  changeFunc: {type: Function, required: true},
  defaultText: {type: String, default: '选择'},
  defaultIcon: {type: String, required: true},
})

const open = ref(false)
const dropdownRef = ref(null)

// 动态变换的文字和图标
const triggerText = computed(() => {
  const current = props.items.find(item => item.value === props.currentInRoute())
  return current ? current.label : props.defaultText
})

const triggerIcon = computed(() => {
  const current = props.items.find(item => item.value === props.currentInRoute())
  return current ? current.icon : props.defaultIcon
})

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    open.value = false
  }
}

// 处理触发器点击 - 避免事件冒泡
const handleTriggerClick = (event) => {
  event.stopPropagation()
  open.value = !open.value
}

// 监听点击事件
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="dropdown-selector">
    <!-- 触发器 -->
    <div
        class="trigger"
        :class="{ open }"
        @click="handleTriggerClick"
        aria-haspopup="listbox"
        :aria-expanded="open"
    >
      <img :src="triggerIcon" alt=""/>
      <span v-text="triggerText"/>
      <!-- 展开箭头（SVG，旋转不变形、无锯齿） -->
      <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- 下拉选项 -->
    <Transition name="dropdown">
      <ul v-if="open" class="dropdown" role="listbox">
        <li
            v-for="item in items"
            :key="item.value"
            :class="{ active: item.value === currentInRoute() }"
            @click="changeFunc(item.value); open = false"
        >
          <img :src="item.icon" alt=""/>
          <span>{{ item.label }}</span>
          <!-- 选中对勾（SVG） -->
          <svg v-if="item.value === currentInRoute()" class="check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12l5 5 9-11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-selector {
  position: relative;
  min-width: 160px;
  font-size: 16px;
  user-select: none;
}

/* ---------- 触发器 ---------- */
.trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  cursor: pointer;
  border-radius: 999px;
  border: 1.5px solid var(--color-border);
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.25s ease, box-shadow 0.25s ease,
    background 0.25s ease, transform 0.25s ease;
}

/* 悬停：轻微上浮 + 绿色描边 */
.trigger:hover {
  border-color: var(--color-primary-light);
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.15);
  transform: translateY(-1px);
}

/* 展开状态：点亮为绿色主题 */
.trigger.open {
  border-color: var(--color-primary);
  background: #f1f9f1;
  box-shadow: 0 4px 14px rgba(46, 125, 50, 0.18);
}

.trigger img {
  width: 24px;
  height: 24px;
}

/* 右侧展开箭头（SVG），随展开状态旋转 180° */
.arrow {
  margin-left: auto;
  width: 14px;
  height: 14px;
  color: var(--color-text-lighter);
  transition: transform 0.3s ease, color 0.3s ease;
}

.trigger:hover .arrow {
  color: var(--color-primary-light);
}

.trigger.open .arrow {
  transform: rotate(180deg);
  color: var(--color-primary);
}

/* ---------- 下拉面板 ---------- */
.dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  min-width: 100%;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 9px 6px 6px 6px;
  z-index: 1000; /* 确保在最上层 */
  transform-origin: top left;
}

/* 顶部小三角，指向触发器 */
.dropdown::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 26px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-left: 1px solid var(--color-border);
  border-top: 1px solid var(--color-border);
  border-top-left-radius: 4px;
  transform: rotate(45deg);
}

.dropdown li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  cursor: pointer;
  border-radius: var(--border-radius-md);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.dropdown li:hover {
  background: var(--color-background-alt);
  transform: translateX(2px);
}

.dropdown li:active {
  transform: scale(0.98);
}

/* 当前选中项：浅绿底 + 对勾 */
.dropdown li.active {
  background: #eaf5ea;
  color: var(--color-primary);
  font-weight: 500;
  cursor: default;
}

.dropdown li.active:hover {
  transform: none;
}

/* 选中对勾（SVG） */
.check {
  margin-left: auto;
  width: 16px;
  height: 16px;
  color: var(--color-primary);
}

.dropdown img {
  width: 20px;
  height: 20px;
}

/* ---------- 弹出 / 收起动画 ---------- */
.dropdown-enter-active {
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* 尊重系统「减弱动态效果」设置 */
@media (prefers-reduced-motion: reduce) {
  .trigger,
  .arrow,
  .dropdown li,
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: none;
  }
}
</style>