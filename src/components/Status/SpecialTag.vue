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
  if (props.type === 'hanzi' && props.special === 4) return t('linguistic.special.hanziConflict')
  return t(`linguistic.special.${key.value}`, {
    type: t(`linguistic.${props.type}`),
    dialect: t(`dialect.${props.dialect}`)
  })
})
</script>

<template>
  <div class="special-box" :data-type="key">
    <div class="icon-wrapper">
      <img :src="iconSrc" class="icon-clickable" alt="" aria-hidden="true" />
    </div>
    <div class="content">
      <span class="text" v-formatted-text="text" />
    </div>
  </div>
</template>
<style scoped>
.special-box {
  --special-accent: #199e2d;
  --special-header-bg: #c1ebc7;
  --special-icon-bg: #97d8a0;

  display: flex;
  align-items: center;
  gap: 8px;

  padding: 10px 14px;
  margin: 12px 0;

  border: 1px solid var(--special-header-bg);
  border-left: 4px solid var(--special-accent);
  border-radius: 6px;
  background: var(--special-header-bg);
}

/* 左侧图标区域 */
.icon-wrapper {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  box-sizing: content-box;
  width: 20px;
  height: 20px;
  padding: 2px;
  border-radius: 20%;
  background: var(--special-icon-bg);
}

.icon-clickable {
  width: 20px;
  height: 20px;
}

/* 右侧内容 */
.content {
  flex: 1;
}

.text {
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: 1.8;
  color: var(--special-accent);
}

/* 基本相同 */
.special-box[data-type="l0"] {
  --special-accent: #199e2d;
  --special-header-bg: #c1ebc7;
  --special-icon-bg: #97d8a0;
}

/* 特殊词汇 */
.special-box[data-type="l1"] {
  --special-accent: #3b82f6;
  --special-header-bg: #cbdffd;
  --special-icon-bg: #a7c8fb;
}

/* 使用减少 */
.special-box[data-type="l2"] {
  --special-accent: #f97316;
  --special-header-bg: #fee0c4;
  --special-icon-bg: #fdc297;
}

/* 不使用 */
.special-box[data-type="l3"] {
  --special-accent: #737a76;
  --special-header-bg: #e7e9e8;
  --special-icon-bg: #cfd3d1;
}

/* 百科 */
.special-box[data-type="l4"] {
  --special-accent: #7f72ea;
  --special-header-bg: #d1cefb;
  --special-icon-bg: #bcb7f7;
}
</style>
