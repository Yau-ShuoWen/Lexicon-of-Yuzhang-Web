<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import RichText from '../../../components/Text/RichText.vue'

const text = ref('')
const route = useRoute()
const language = computed(() => String(route.params.language))
const dialect = computed(() => String(route.params.dialect))
</script>

<template>
  <main class="rich-text-guide">
    <section class="guide-section">
      <h1>富文本使用方法</h1>
      <textarea v-model="text" class="guide-input" aria-label="富文本输入" rows="12" />
    </section>
    <section class="guide-section guide-preview">
      <h2>预览</h2>
      <div class="guide-preview-content">
        <RichText :model-value="text" :language="language" :dialect="dialect" plain />
      </div>
    </section>
  </main>
</template>

<style scoped>
.rich-text-guide { box-sizing: border-box; max-width: 1080px; margin: 36px auto; padding: 0 24px 72px; color: #203228; }
.guide-section + .guide-section { margin-top: 32px; }
.guide-section h1, .guide-section h2 { margin: 0 0 14px; }
.guide-section h1 { font-size: 1.5rem; }
.guide-section h2 { font-size: 1.18rem; }
.guide-input { box-sizing: border-box; display: block; width: 100%; min-height: 320px; padding: 12px 14px; border: 1px solid #c8d2ca; border-radius: 10px; outline: none; resize: vertical; background: #fbfcfa; color: #203228; font: inherit; line-height: 1.6; }
.guide-input:focus { border-color: #37744d; box-shadow: 0 0 0 3px rgba(55, 116, 77, .11); }
.guide-preview { box-sizing: border-box; min-height: 320px; padding: 24px; border: 1px solid #d8ded9; border-radius: 16px; background: #fff; }
.guide-preview-content { padding: 12px 14px; line-height: 1.6; overflow-wrap: anywhere; }
@media (max-width: 640px) { .rich-text-guide { margin-top: 24px; padding-inline: 16px; } .guide-input { min-height: 180px; } .guide-preview { min-height: 180px; padding: 18px; } }
</style>
