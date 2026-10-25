<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AnchoredPopup from '../Window/AnchoredPopup.vue'
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
const trigger = ref(null)
const visible = ref(false)
let locked = false
let popupHovered = false
let showTimer = null
let hideTimer = null

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
  headerBg: '#e7e9e8'
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
    '--special-accent': theme.accent,
    '--special-bg': theme.bg,
    '--special-hover-bg': theme.headerBg
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

const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

function clearTimers() {
  window.clearTimeout(showTimer)
  window.clearTimeout(hideTimer)
}

function onTriggerEnter() {
  if (!canHover() || locked) return
  clearTimers()
  showTimer = window.setTimeout(() => { visible.value = true }, 300)
}

function onTriggerLeave() {
  window.clearTimeout(showTimer)
  if (!canHover() || locked) return
  hideTimer = window.setTimeout(() => {
    if (!popupHovered) visible.value = false
  }, 120)
}

function onTriggerClick() {
  clearTimers()
  if (visible.value && locked) {
    visible.value = false
    return
  }
  locked = true
  visible.value = true
}

function onPopupEnter() {
  popupHovered = true
  window.clearTimeout(hideTimer)
}

function onPopupLeave() {
  popupHovered = false
  if (locked || !canHover()) return
  hideTimer = window.setTimeout(() => { visible.value = false }, 120)
}

watch(visible, open => {
  if (!open) {
    clearTimers()
    locked = false
    popupHovered = false
  }
})

onBeforeUnmount(clearTimers)
</script>

<template>
  <button
    ref="trigger"
    class="special-tag-trigger"
    :style="themeStyle"
    type="button"
    :aria-label="text"
    aria-haspopup="dialog"
    :aria-expanded="visible"
    @mouseenter="onTriggerEnter"
    @mouseleave="onTriggerLeave"
    @click="onTriggerClick"
  >
    <img :src="iconSrc" alt="" aria-hidden="true" />
  </button>

  <AnchoredPopup
    v-model="visible"
    :anchor="trigger"
    @mouseenter="onPopupEnter"
    @mouseleave="onPopupLeave"
  >
    <p class="special-tag-description">{{ text }}</p>
  </AnchoredPopup>
</template>

<style scoped>
.special-tag-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 7px;
  border: 1px solid var(--special-accent);
  border-radius: var(--border-radius-md);
  background: var(--special-bg);
  cursor: pointer;
  vertical-align: middle;
}

.special-tag-trigger:hover,
.special-tag-trigger[aria-expanded="true"] {
  background: var(--special-hover-bg);
}

.special-tag-trigger:focus-visible {
  outline: 2px solid var(--special-accent);
  outline-offset: 2px;
}

.special-tag-trigger img {
  display: block;
  width: 20px;
  height: 20px;
}

.special-tag-description {
  width: min(360px, calc(100vw - 56px));
  margin: 0;
  padding: 14px 16px;
  line-height: 1.6;
}
</style>
