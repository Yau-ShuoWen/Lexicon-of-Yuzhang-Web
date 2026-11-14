<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import feedbackIcon from '../../assets/icons/special/feedback.svg'

defineProps({ showRandom: { type: Boolean, default: false } })

const route = useRoute()
const prefix = computed(() => `/${route.params.language}/${route.params.dialect}/dict`)
</script>

<template>
  <div class="dictionary-no-result" :class="showRandom ? 'dictionary-no-result--search' : 'dictionary-no-result--detail'">
    <p class="dictionary-no-result__title">{{ $t('search_result.empty_title') }}</p>
    <p class="dictionary-no-result__line">{{ $t('search_result.empty_line') }}</p>
    <div class="dictionary-no-result__actions">
      <router-link v-if="showRandom" class="dictionary-no-result__button" :to="`${prefix}/search?q=random`">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>
        <span>{{ $t('search_result.empty_random') }}</span>
      </router-link>
      <router-link class="dictionary-no-result__button" :to="`${prefix}/feedback`">
        <img :src="feedbackIcon" alt="" />
        <span>{{ $t('search_result.empty_feedback') }}</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.dictionary-no-result {
  width: 100%;
  border-radius: var(--border-radius-lg);
}
.dictionary-no-result--search {
  padding: 42px 24px;
  text-align: center;
  background: #e2eddd;
  box-shadow: 0 2px 7px rgba(31, 62, 36, .04);
}
.dictionary-no-result--detail {
  margin: 30px 0 24px;
  padding: 28px;
  text-align: center;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: 0 3px 12px rgba(27, 67, 31, .09);
}
.dictionary-no-result__title,
.dictionary-no-result__line { margin: 0; color: var(--color-text); font-weight: 600; line-height: 1.5; }
.dictionary-no-result--search .dictionary-no-result__title,
.dictionary-no-result--search .dictionary-no-result__line { font-size: 24px; }
.dictionary-no-result--detail .dictionary-no-result__title,
.dictionary-no-result--detail .dictionary-no-result__line { color: var(--color-primary-dark); font-size: 28px; }
.dictionary-no-result__actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.dictionary-no-result--search .dictionary-no-result__actions { justify-content: center; }
.dictionary-no-result--detail .dictionary-no-result__actions { justify-content: center; }
.dictionary-no-result__button {
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  min-height: 36px; padding: 5px 12px; border: 1px solid var(--color-border);
  border-radius: 8px; color: var(--color-text); background: var(--color-background);
  font-weight: 500; text-decoration: none;
  transition: background-color .2s ease, border-color .2s ease;
}
.dictionary-no-result__button:hover, .dictionary-no-result__button:focus-visible {
  background: var(--color-border-light); border-color: #bfcfc2;
}
.dictionary-no-result__button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.dictionary-no-result__button svg, .dictionary-no-result__button img { width: 18px; height: 18px; flex: 0 0 auto; }
.dictionary-no-result__button svg { fill: none; stroke: var(--color-primary-dark); stroke-width: 1.5; }
.dictionary-no-result__button circle { fill: var(--color-primary-dark); stroke: none; }
@media (max-width: 768px) { .dictionary-no-result--detail { padding: 22px 16px; } }
@media (max-width: 480px) {
  .dictionary-no-result__actions { flex-direction: column; align-items: center; }
  .dictionary-no-result--detail .dictionary-no-result__title,
  .dictionary-no-result--detail .dictionary-no-result__line { font-size: 24px; }
}
</style>
