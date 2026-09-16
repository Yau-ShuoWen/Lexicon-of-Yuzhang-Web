<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  expectedDuration: { type: Number, default: 3000 },
  text: { type: String, default: '' },
  complete: { type: Boolean, default: false }
})

const emit = defineEmits(['finished'])
const progress = ref(0)
let animationFrame = 0
let finishTimer = 0
let startedAt = 0
let finished = false
let taskComplete = false

const finish = () => {
  if (finished) return
  finished = true
  window.cancelAnimationFrame(animationFrame)
  progress.value = 100
  finishTimer = window.setTimeout(() => emit('finished'), 280)
}

const animate = (now) => {
  const duration = Math.max(300, props.expectedDuration)
  const elapsed = now - startedAt
  const elapsedRatio = Math.max(0, elapsed / duration)

  if (taskComplete && elapsed >= duration) {
    finish()
    return
  }

  // 常见假进度条的缓出节奏：开头推进较快，越接近预期时间越慢。
  const target = elapsedRatio <= 1
      ? 94 * (1 - Math.pow(1 - elapsedRatio, 1.45))
      : 94 + 5 * (1 - Math.exp(-(elapsedRatio - 1) * .45))
  progress.value = Math.min(99, Math.max(progress.value, target))
  animationFrame = window.requestAnimationFrame(animate)
}

watch(() => props.complete, value => {
  taskComplete = value
})

onMounted(() => {
  startedAt = performance.now()
  taskComplete = props.complete
  animationFrame = window.requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrame)
  window.clearTimeout(finishTimer)
})
</script>

<template>
  <section class="loading-page" aria-live="polite" aria-busy="true">
    <div class="loading-content">
      <div class="loading-track" role="progressbar" :aria-label="$t('status.loading_progress')" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: `${progress}%` }"></span>
      </div>
      <p v-formatted-text="text || $t('message.welcome')" />
    </div>
  </section>
</template>

<style scoped>
.loading-page {
  display: grid;
  min-height: 100vh;
  box-sizing: border-box;
  place-items: center;
  padding: 32px 24px;
  background: radial-gradient(circle at 50% 42%, rgba(139, 195, 74, .09), transparent 34%);
}

.loading-content {
  width: min(440px, 82vw);
  transform: translateY(-4vh);
  text-align: center;
}

.loading-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #dcebdc;
  box-shadow: inset 0 1px 2px rgba(27, 94, 32, .08);
}

.loading-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-primary-light), var(--color-primary));
  box-shadow: 0 0 12px rgba(46, 125, 50, .2);
  transition: width .12s linear;
}

.loading-content p {
  margin: 22px 0 0;
  color: var(--color-primary-dark);
  font-size: clamp(.95rem, 2.4vw, 1.08rem);
  line-height: 1.7;
}

@media (prefers-reduced-motion: reduce) {
  .loading-track span { transition: none; }
}
</style>
