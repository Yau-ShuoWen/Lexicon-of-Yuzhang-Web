<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {type: Boolean, default: false},
  anchor: {type: Object, default: null},
  mobileBreakpoint: {type: Number, default: 768}
})

const emit = defineEmits(['update:modelValue', 'close', 'mouseenter', 'mouseleave'])
const panelRef = ref(null)
const mobile = ref(false)
const position = ref({left: '', top: ''})

function requestClose(reason) {
  emit('update:modelValue', false)
  emit('close', reason)
}

function place() {
  const panel = panelRef.value
  if (!panel || !props.anchor || mobile.value) return

  const anchorRect = props.anchor.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const gap = 10
  const viewportGap = 12
  const left = Math.max(viewportGap, Math.min(
    anchorRect.left + anchorRect.width / 2 - panelRect.width / 2,
    window.innerWidth - panelRect.width - viewportGap
  ))
  const below = anchorRect.bottom + gap
  const top = below + panelRect.height <= window.innerHeight - viewportGap
    ? below
    : Math.max(viewportGap, anchorRect.top - panelRect.height - gap)
  position.value = {left: `${left}px`, top: `${top}px`}
}

function handlePointerDown(event) {
  if (panelRef.value?.contains(event.target) || props.anchor?.contains(event.target)) return
  requestClose('outside')
}

function handleKeydown(event) {
  if (event.key === 'Escape') requestClose('escape')
}

function handleViewportChange() {
  if (window.innerWidth <= props.mobileBreakpoint) {
    mobile.value = true
    return
  }
  requestClose('viewport')
}

watch(() => props.modelValue, async open => {
  if (!open) {
    document.removeEventListener('pointerdown', handlePointerDown, true)
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('scroll', handleViewportChange, true)
    window.removeEventListener('resize', handleViewportChange)
    return
  }

  mobile.value = window.innerWidth <= props.mobileBreakpoint
  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('scroll', handleViewportChange, true)
  window.addEventListener('resize', handleViewportChange)
  await nextTick()
  place()
}, {immediate: true})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown, true)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', handleViewportChange, true)
  window.removeEventListener('resize', handleViewportChange)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="anchored-popup-fade">
      <div
        v-if="modelValue"
        class="anchored-popup-layer"
        :class="{'anchored-popup-layer--mobile': mobile}"
      >
        <section
          ref="panelRef"
          class="anchored-popup"
          :class="{'anchored-popup--mobile': mobile}"
          :style="mobile ? undefined : {
            left: position.left,
            top: position.top
          }"
          role="dialog"
          tabindex="-1"
          @mouseenter="emit('mouseenter')"
          @mouseleave="emit('mouseleave')"
        >
          <div class="anchored-popup__content">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.anchored-popup-layer {
  position: fixed;
  z-index: 8000;
  inset: 0;
  pointer-events: none;
}

.anchored-popup-layer--mobile {
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(20, 38, 24, .38);
  pointer-events: auto;
}

.anchored-popup {
  position: fixed;
  width: max-content;
  min-width: 230px;
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  border: 1px solid #d9dfda;
  border-radius: 12px;
  color: var(--color-text);
  background: #fff;
  box-shadow: 0 14px 36px rgba(22, 42, 28, .18), 0 3px 10px rgba(22, 42, 28, .1);
  pointer-events: auto;
  outline: none;
}

.anchored-popup__content {
  max-height: inherit;
  overflow: auto;
  border-radius: inherit;
}

.anchored-popup--mobile {
  position: relative;
  width: min(440px, 100%);
  min-width: 0;
  max-height: calc(100dvh - 32px);
  border-radius: 16px;
}

.anchored-popup-fade-enter-active,
.anchored-popup-fade-leave-active { transition: opacity .14s ease; }
.anchored-popup-fade-enter-active .anchored-popup,
.anchored-popup-fade-leave-active .anchored-popup { transition: transform .16s ease, opacity .14s ease; }
.anchored-popup-fade-enter-from,
.anchored-popup-fade-leave-to { opacity: 0; }
.anchored-popup-fade-enter-from .anchored-popup,
.anchored-popup-fade-leave-to .anchored-popup { opacity: 0; transform: translateY(5px) scale(.985); }

@media (prefers-reduced-motion: reduce) {
  .anchored-popup-fade-enter-active,
  .anchored-popup-fade-leave-active,
  .anchored-popup-fade-enter-active .anchored-popup,
  .anchored-popup-fade-leave-active .anchored-popup { transition: none; }
}
</style>
