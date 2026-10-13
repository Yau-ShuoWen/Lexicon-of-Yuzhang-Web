<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BLOCKQUOTE_TAG_MAP } from '../../utils/blockquote.js'

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

const neutralTheme = {
  accent: '#737a76',
  bg: '#f5f5f5',
  headerBg: '#e7e9e8',
  iconBg: '#cfd3d1'
}

const themeMap = {
  l0: BLOCKQUOTE_TAG_MAP.bq,
  l1: BLOCKQUOTE_TAG_MAP.pyq,
  l2: BLOCKQUOTE_TAG_MAP.warn,
  l3: neutralTheme,
  l4: BLOCKQUOTE_TAG_MAP.sl
}

const themeStyle = computed(() => {
  const theme = themeMap[key.value] || neutralTheme
  return {
    '--bq-accent': theme.accent,
    '--bq-bg': theme.bg,
    '--bq-header-bg': theme.headerBg,
    '--bq-icon-bg': theme.iconBg,
    '--bq-text': theme.text || theme.accent
  }
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
  <blockquote class="rt-blockquote rt-blockquote-tag" :style="themeStyle">
    <div class="rt-blockquote__header">
      <img :src="iconSrc" class="rt-blockquote__icon" alt="" aria-hidden="true" />
      <span class="rt-blockquote__title" v-formatted-text="text" />
    </div>
  </blockquote>
</template>
