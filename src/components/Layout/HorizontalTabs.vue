<script setup>
import { useId } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  items: { type: Array, required: true },
  label: { type: String, required: true },
  idPrefix: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const generatedId = useId()
const prefix = props.idPrefix || generatedId

function selectByKey(event, index) {
  let nextIndex
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % props.items.length
  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + props.items.length) % props.items.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = props.items.length - 1
  else return

  event.preventDefault()
  const next = props.items[nextIndex]
  emit('update:modelValue', next.value)
  event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus()
}
</script>

<template>
  <div class="horizontal-tabs" role="tablist" :aria-label="label">
    <button v-for="(item, index) in items" :id="`${prefix}-tab-${item.value}`" :key="item.value"
            type="button" role="tab" class="horizontal-tabs__tab"
            :class="{ 'horizontal-tabs__tab--active': modelValue === item.value }"
            :aria-selected="modelValue === item.value" :aria-controls="`${prefix}-panel-${item.value}`"
            :tabindex="modelValue === item.value ? 0 : -1"
            @click="emit('update:modelValue', item.value)" @keydown="selectByKey($event, index)">
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.horizontal-tabs { display: flex; gap: 28px; overflow-x: auto; border-bottom: 1px solid var(--color-border); scrollbar-width: none; }
.horizontal-tabs::-webkit-scrollbar { display: none; }
.horizontal-tabs__tab { position: relative; flex: none; min-height: 46px; padding: 9px 2px 12px; border: 0; background: transparent; color: var(--color-text-light); font: inherit; font-size: 14px; cursor: pointer; white-space: nowrap; }
.horizontal-tabs__tab:hover { color: var(--color-text); }
.horizontal-tabs__tab--active { color: var(--color-primary-dark); font-weight: 650; }
.horizontal-tabs__tab--active::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--color-primary); content: ''; }
.horizontal-tabs__tab:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; }
</style>
