<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// props
const props = defineProps({
  special: {
    type: Number,
    required: true
  },
  type: {
    type: String, // hanzi / ciyu
    required: true
  },
  dialect: {
    type: String,
    required: true
  }
})

const {t} = useI18n()
const key = computed(() => 'l' + props.special)

// icon 映射
const iconMap = {
  "l0": new URL('../../assets/icons/special/true.svg', import.meta.url).href,
  "l1": new URL('../../assets/icons/special/idea.svg', import.meta.url).href,
  "l2": new URL('../../assets/icons/special/half-right.svg', import.meta.url).href,
  "l3": new URL('../../assets/icons/special/none.svg', import.meta.url).href,
  "l4": new URL('../../assets/icons/special/book.svg', import.meta.url).href
}

// icon
const iconSrc = computed(() => {
  return iconMap[key.value]
})

// 文本
const text = computed(() => {
  return t(`linguistic.special.${key.value}`, {
    type: t(`linguistic.${props.type}`),
    dialect: t(`dialect.${props.dialect}`)
  })
})
</script>

<template>
  <div class="special-box" :data-type="key">
    <div class="icon-wrapper">
      <img :src="iconSrc" class="icon" />
    </div>
    <div class="content">
      <span class="text" v-formatted-text="text" />
    </div>
  </div>
</template>
<style scoped>
.icon {
  width: 32px;
  height: 32px;
  margin-top: 2px;
  flex-shrink: 0;
}

.special-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  padding: 12px 14px;
  margin: 16px 0;

  border: 1px solid #e0e0e0;
  border-left: 4px solid #aaa;
  border-radius: 6px;

  background-color: #fafafa;
}

/* 左侧图标区域 */
.icon-wrapper {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.icon {
  width: 24px;
  height: 24px;
}

/* 右侧内容 */
.content {
  flex: 1;
}

.text {
  font-size: var(--font-size-base);
  line-height: 1.8;
  color: #333;
}

/* 基本相同 */
.special-box[data-type="l0"] {
  border-left-color: #4caf50;
  background: #f6fbf7;
}

/* 特殊词汇 */
.special-box[data-type="l1"] {
  border-left-color: #2196f3;
  background: #f4f8fd;
}

/* 使用减少 */
.special-box[data-type="l2"] {
  border-left-color: #ff9800;
  background: #fff8f2;
}

/* 不使用 */
.special-box[data-type="l3"] {
  border-left-color: #9e9e9e;
  background: #f5f5f5;
  color: #777;
}

/* 百科 */
.special-box[data-type="l4"] {
  border-left-color: #673ab7;
  background: #f7f5fb;
}
</style>