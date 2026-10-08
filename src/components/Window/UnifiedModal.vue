<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import closeIcon from '../../assets/icons/close.svg'
import closeDisabledIcon from '../../assets/icons/close-disabled.svg'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  size: {
    type: String,
    default: 'medium',
    validator: value => ['small', 'medium', 'large'].includes(value)
  },
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEscape: { type: Boolean, default: true },
  showClose: { type: Boolean, default: true },
  backdropBlur: { type: Boolean, default: true },
  lockTop: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: '加载中…' },
  loadingDelay: { type: Number, default: 180 },
  loadingMinHeight: { type: String, default: '72px' },
  contentMaxHeight: { type: Number, default: 420 }
})

const emit = defineEmits(['update:modelValue', 'close'])
const dialogRef = ref(null)
const bodyRef = ref(null)
const contentRef = ref(null)
const showLoadingIndicator = ref(false)
const bodyHeight = ref(null)
const animatingHeight = ref(false)
const titleId = `unified-modal-title-${Math.random().toString(36).slice(2, 9)}`
const descriptionId = `unified-modal-description-${Math.random().toString(36).slice(2, 9)}`
let previousActiveElement = null
let previousScrollX = 0
let previousScrollY = 0
let backdropPressed = false
let loadingTimer = null
let heightTimer = null
let contentResizeObserver = null

const dialogClass = computed(() => `unified-modal--${props.size}`)
const bodyStyle = computed(() => ({
  height: bodyHeight.value || undefined,
  maxHeight: `${props.contentMaxHeight}px`
}))

function measureBodyTargetHeight() {
  if (!bodyRef.value || !contentRef.value || !dialogRef.value) return null

  const bodyStyles = window.getComputedStyle(bodyRef.value)
  const verticalPadding = parseFloat(bodyStyles.paddingTop) + parseFloat(bodyStyles.paddingBottom)
  // 富文本指令可能在包装层完成渲染后继续改变表格尺寸；body.scrollHeight
  // 能包含包装层未计入的外边距和这些后续变化。
  const contentHeight = Math.max(
    contentRef.value.scrollHeight,
    bodyRef.value.scrollHeight - verticalPadding
  )
  const modalChromeHeight = dialogRef.value.clientHeight - bodyRef.value.offsetHeight
  const viewportInset = window.innerWidth <= 640 ? 24 : 48
  const availableHeight = Math.max(120, window.innerHeight - viewportInset - modalChromeHeight - verticalPadding)

  return Math.ceil(Math.min(contentHeight, props.contentMaxHeight, availableHeight))
}

function observeContentSize() {
  contentResizeObserver?.disconnect()
  if (!contentRef.value || typeof ResizeObserver === 'undefined') return

  contentResizeObserver = new ResizeObserver(() => {
    if (props.loading || animatingHeight.value) return
    const targetHeight = measureBodyTargetHeight()
    if (targetHeight && bodyHeight.value !== `${targetHeight}px`) {
      bodyHeight.value = `${targetHeight}px`
    }
  })
  contentResizeObserver.observe(contentRef.value)
}

function requestClose(reason) {
  if (props.busy) return
  emit('update:modelValue', false)
  emit('close', reason)
}

function handleBackdropPointerDown(event) {
  backdropPressed = event.target === event.currentTarget
}

function handleBackdropPointerUp(event) {
  const releasedOnBackdrop = event.target === event.currentTarget
  if (backdropPressed && releasedOnBackdrop && props.closeOnBackdrop) {
    requestClose('backdrop')
  }
  backdropPressed = false
}

function preventBackgroundScroll(event) {
  const body = bodyRef.value
  const isInsideScrollableBody = body?.contains(event.target) && body.scrollHeight > body.clientHeight
  if (!isInsideScrollableBody) event.preventDefault()
}

function addScrollLockListeners() {
  document.addEventListener('wheel', preventBackgroundScroll, { passive: false })
  document.addEventListener('touchmove', preventBackgroundScroll, { passive: false })
}

function removeScrollLockListeners() {
  document.removeEventListener('wheel', preventBackgroundScroll)
  document.removeEventListener('touchmove', preventBackgroundScroll)
}

function handleKeydown(event) {
  if (event.key === 'Escape' && props.closeOnEscape) {
    event.preventDefault()
    requestClose('escape')
    return
  }

  if (['PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
    const isFormControl = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)
    if (!isFormControl) event.preventDefault()
  }

  if (event.key !== 'Tab' || !dialogRef.value) return
  const focusable = [...dialogRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )]
  if (!focusable.length) {
    event.preventDefault()
    dialogRef.value.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.modelValue, async open => {
  if (open) {
    previousActiveElement = document.activeElement
    previousScrollX = window.scrollX
    previousScrollY = window.scrollY
    addScrollLockListeners()
    await nextTick()
    window.scrollTo(previousScrollX, previousScrollY)
    const firstFocusable = dialogRef.value?.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    ;(firstFocusable || dialogRef.value)?.focus({ preventScroll: true })
  } else {
    removeScrollLockListeners()
    contentResizeObserver?.disconnect()
    window.scrollTo(previousScrollX, previousScrollY)
    previousActiveElement?.focus?.({ preventScroll: true })
    previousActiveElement = null
  }
}, { immediate: true })

watch(() => props.loading, loading => {
  window.clearTimeout(loadingTimer)
  window.clearTimeout(heightTimer)
  loadingTimer = null
  if (!loading) {
    showLoadingIndicator.value = false
    nextTick(() => {
      const targetHeight = measureBodyTargetHeight()
      if (!targetHeight) {
        bodyHeight.value = null
        return
      }
      observeContentSize()
      animatingHeight.value = true
      requestAnimationFrame(() => {
        bodyHeight.value = `${targetHeight}px`
        heightTimer = window.setTimeout(() => {
          animatingHeight.value = false
          // 保留动画终点的显式高度。若在这里切回 auto，短内容会因
          // scrollHeight 的整数取值与浏览器小数像素布局产生一次细微跳动。
          const correctedHeight = measureBodyTargetHeight() || targetHeight
          bodyHeight.value = `${correctedHeight}px`
        }, 220)
      })
    })
    return
  }
  contentResizeObserver?.disconnect()
  animatingHeight.value = false
  bodyHeight.value = props.loadingMinHeight
  loadingTimer = window.setTimeout(() => {
    showLoadingIndicator.value = true
  }, Math.max(0, props.loadingDelay))
}, { immediate: true })

onBeforeUnmount(() => {
  window.clearTimeout(loadingTimer)
  window.clearTimeout(heightTimer)
  contentResizeObserver?.disconnect()
  removeScrollLockListeners()
  window.scrollTo(previousScrollX, previousScrollY)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="unified-modal-fade">
      <div
        v-if="modelValue"
        class="unified-modal-backdrop"
        :class="{
          'unified-modal-backdrop--blur': backdropBlur,
          'unified-modal-backdrop--top-locked': lockTop
        }"
        @pointerdown="handleBackdropPointerDown"
        @pointerup="handleBackdropPointerUp"
        @pointercancel="backdropPressed = false"
        @keydown="handleKeydown"
      >
        <section
          ref="dialogRef"
          class="unified-modal"
          :class="dialogClass"
          role="dialog"
          aria-modal="true"
          :aria-busy="loading"
          :aria-labelledby="titleId"
          :aria-describedby="description ? descriptionId : undefined"
          tabindex="-1"
        >
          <header class="unified-modal__header">
            <div class="unified-modal__heading">
              <h2 :id="titleId">{{ title }}</h2>
              <p v-if="description" :id="descriptionId">{{ description }}</p>
            </div>
            <button
              v-if="showClose"
              class="unified-modal__close"
              type="button"
              aria-label="關閉彈窗"
              :disabled="busy"
              @click="requestClose('button')"
            >
              <img :src="busy ? closeDisabledIcon : closeIcon" alt="" aria-hidden="true">
            </button>
          </header>

          <div
            ref="bodyRef"
            class="unified-modal__body"
            :class="{
              'unified-modal__body--loading': loading,
              'unified-modal__body--animating': animatingHeight
            }"
            :style="bodyStyle"
          >
            <div v-if="loading" class="unified-modal__loading" role="status" aria-live="polite">
              <div v-if="showLoadingIndicator" class="unified-modal__loading-content">
                <span class="unified-modal__spinner" aria-hidden="true"></span>
                <span>{{ loadingText }}</span>
              </div>
            </div>
            <div v-else ref="contentRef" class="unified-modal__content">
              <slot />
            </div>
          </div>

          <footer v-if="$slots.footer" class="unified-modal__footer">
            <slot name="footer" :close="requestClose" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.unified-modal-backdrop {
  position: fixed;
  z-index: 8000;
  inset: 0;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 24px;
  overflow-y: auto;
  scrollbar-width: none;
  background: rgba(20, 38, 24, .48);
}

.unified-modal-backdrop::-webkit-scrollbar { display: none; }
.unified-modal-backdrop--blur { backdrop-filter: blur(5px); }
.unified-modal-backdrop--top-locked {
  align-items: start;
  padding-top: clamp(88px, 14vh, 136px);
}

.unified-modal {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100dvh - 48px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .86);
  border-radius: 20px;
  color: var(--color-text);
  background: rgba(255, 255, 255, .98);
  box-shadow: 0 28px 80px rgba(15, 37, 19, .25), 0 4px 14px rgba(15, 37, 19, .12);
  outline: none;
}

.unified-modal--small { max-width: 420px; }
.unified-modal--medium { max-width: 600px; }
.unified-modal--large { max-width: 900px; }

.unified-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 20px;
  border-bottom: 2px solid #dce7de;
}

.unified-modal__heading { min-width: 0; }

.unified-modal__heading h2 {
  margin: 0;
  color: var(--color-primary-dark);
  font-size: 1.22rem;
  line-height: 1.4;
}

.unified-modal__heading p {
  margin: 6px 0 0;
  color: var(--color-text-light);
  font-size: .86rem;
  line-height: 1.65;
}

.unified-modal__close {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin: 0 -3px 0 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #54705a;
  background: transparent;
  cursor: pointer;
}

.unified-modal__close img {
  display: block;
  width: 26px;
  height: 26px;
}

.unified-modal__close:focus-visible { outline: 3px solid rgba(46, 125, 50, .22); }
.unified-modal__close:disabled { cursor: default; }

.unified-modal__body {
  box-sizing: content-box;
  min-height: 0;
  padding: 22px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.unified-modal__body::-webkit-scrollbar { display: none; }

.unified-modal__body--animating {
  overflow: hidden;
  transition: height .2s cubic-bezier(.22, .8, .3, 1);
}

.unified-modal__body--loading {
  display: grid;
  place-items: center;
}

.unified-modal__loading {
  display: grid;
  min-height: 72px;
  place-items: center;
}

.unified-modal__loading-content {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-light);
  font-size: .86rem;
}

.unified-modal__spinner {
  width: 19px;
  height: 19px;
  border: 2px solid #dce8de;
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: unified-modal-spin .72s linear infinite;
}

@keyframes unified-modal-spin { to { transform: rotate(360deg); } }

.unified-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--color-border-light);
  background: #fbfdfb;
}

.unified-modal-fade-enter-active,
.unified-modal-fade-leave-active { transition: opacity .18s ease; }
.unified-modal-fade-enter-active .unified-modal,
.unified-modal-fade-leave-active .unified-modal { transition: transform .2s ease, opacity .18s ease; }
.unified-modal-fade-enter-from,
.unified-modal-fade-leave-to { opacity: 0; }
.unified-modal-fade-enter-from .unified-modal,
.unified-modal-fade-leave-to .unified-modal { opacity: 0; transform: translateY(10px) scale(.985); }

@media (max-width: 640px) {
  .unified-modal-backdrop {
    align-items: end;
    padding: 12px;
  }

  .unified-modal-backdrop--top-locked {
    align-items: start;
    padding-top: 76px;
  }

  .unified-modal {
    max-height: calc(100dvh - 24px);
    border-radius: 20px;
  }

  .unified-modal__header { padding: 13px 16px; }
  .unified-modal__body { padding: 18px; }
  .unified-modal__footer { padding: 14px 18px 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .unified-modal-fade-enter-active,
  .unified-modal-fade-leave-active,
  .unified-modal-fade-enter-active .unified-modal,
  .unified-modal-fade-leave-active .unified-modal { transition: none; }
  .unified-modal__spinner { animation-duration: 1.4s; }
}
</style>
