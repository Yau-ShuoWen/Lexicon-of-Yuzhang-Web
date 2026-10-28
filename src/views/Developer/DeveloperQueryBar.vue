<script setup>
import searchIcon from '../../assets/icons/search.svg'

defineProps({
  modelValue: { type: String, required: true },
  placeholder: { type: String, required: true },
  buttonText: { type: String, default: '查询' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'submit'])
</script>

<template>
  <form class="developer-query" @submit.prevent="emit('submit')">
    <input
      class="developer-query__input"
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="placeholder"
      :disabled="disabled"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <button class="developer-query__button" type="submit" :disabled="disabled || loading" :aria-label="loading ? '查询中' : buttonText" :title="loading ? '查询中' : buttonText">
      <img :src="searchIcon" alt="" aria-hidden="true" />
    </button>
  </form>
</template>

<style scoped>
.developer-query { box-sizing: border-box; display: flex; align-items: center; width: 100%; height: 52px; margin: 0; border: 1px solid #c8d2ca; border-radius: 9px; background: #fff; }
.developer-query:focus-within { border-color: #37744d; box-shadow: 0 0 0 3px rgba(55, 116, 77, .11); }
.developer-query__input { box-sizing: border-box; flex: 1; min-width: 0; height: 100%; padding: 0 15px; border: 0; border-radius: inherit; outline: none; background: transparent; color: var(--color-text); font: inherit; font-size: 17px; }
.developer-query__input:disabled { background: #f0f3f0; color: var(--color-text-light); }
.developer-query__button { box-sizing: border-box; display: grid; place-items: center; flex: none; width: 48px; height: 48px; padding: 8px; border: 0; border-radius: 8px; background: transparent; cursor: pointer; }
.developer-query__button img { width: 26px; height: 26px; }
.developer-query__button:hover:not(:disabled) { background: var(--color-border-light); }
.developer-query__button:disabled { cursor: not-allowed; opacity: .55; }
</style>
