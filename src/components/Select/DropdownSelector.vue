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
    <div class="trigger" @click="handleTriggerClick">
      <img :src="triggerIcon" alt=""/>
      <span v-text="triggerText"/>
    </div>

    <!-- 下拉选项 -->
    <ul v-if="open" class="dropdown">
      <li
          v-for="item in items"
          :key="item.value"
          :class="{ active: item.value === currentInRoute() }"
          @click="changeFunc(item.value); open = false"
      >
        <img :src="item.icon" alt=""/>
        <span>{{ item.label }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dropdown-selector {
  position: relative;
  width: 160px;
  font-size: 16px;
  user-select: none;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 8px;
  background: #f6f8fa;
  transition: background 0.2s;
}

.trigger:hover {
  background: #f0f0f0;
}

.trigger img {
  width: 24px;
  height: 24px;
}

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  padding: 6px 0;
  z-index: 1000; /* 确保在最上层 */
}

.dropdown li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown li:hover {
  background: #f0f0f0;
}

.dropdown li.active {
  background: #e6f4ff;
  color: #1677ff;
  cursor: default;
}

.dropdown img {
  width: 24px;
  height: 24px;
}
</style>